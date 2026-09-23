/**
 * Main scraper service orchestrator
 * Handles lock management, batch orchestration, coverage stamping, and forensics logging
 */

import ClaudeClient from '../ai/claude-client.js';
import { discoverShopifyProducts } from './discovery/shopify-discovery.js';
import { discoverSitemapProducts } from './discovery/sitemap-discovery.js';
import { crawlDiscoverProductUrls } from './discovery/crawl-discovery.js';
import { extractFromProductPage } from './extraction/product-extractor.js';
import { extractWithAI } from './extraction/ai-extractor.js';
import { validateProduct, trackRejection } from './validation/product-validator.js';
import { loadExistingMap, upsertProduct, flushPending } from './persistence/product-persister.js';
import { encodeCursor, decodeCursor, validateCursorScope, createInitialCursor } from '../../utils/continuation-token.js';
import { normaliseUrl } from '../../utils/scrape-utils.js';

const BATCH_DEADLINE_MS = 45000; // 45-second soft deadline
const SHOPIFY_PAGES_PER_BATCH = 2;
const PRODUCT_PAGES_PER_BATCH = 12;
const AI_FALLBACKS_PER_BATCH = 4;
const LOCK_STALE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Acquire scrape lock with heartbeat recovery
 * @param {object} prisma - Prisma client instance
 * @returns {Promise<{success: boolean, error?: string, status?: number}>}
 */
export async function acquireLock(prisma) {
  const states = await prisma.scrapeState.findMany();
  let state = states[0];
  
  if (state?.isRunning) {
    const beat = state.heartbeatAt ? Date.parse(state.heartbeatAt) : NaN;
    const lockIsFresh = Number.isFinite(beat) && Date.now() - beat < LOCK_STALE_MS;
    if (lockIsFresh) {
      return {
        success: false,
        error: "A scrape is already running — try again shortly.",
        status: 409,
      };
    }
    // Stale lock: recover by updating below
  }
  
  if (state) {
    await prisma.scrapeState.update({
      where: { id: state.id },
      data: {
        isRunning: true,
        heartbeatAt: new Date().toISOString(),
      },
    });
  } else {
    state = await prisma.scrapeState.create({
      data: {
        isRunning: true,
        heartbeatAt: new Date().toISOString(),
      },
    });
  }
  
  return { success: true, stateId: state.id };
}

/**
 * Release scrape lock
 * @param {object} prisma - Prisma client instance
 */
export async function releaseLock(prisma) {
  const states = await prisma.scrapeState.findMany();
  if (states[0]) {
    await prisma.scrapeState.update({
      where: { id: states[0].id },
      data: {
        isRunning: false,
        lastCompletedAt: new Date().toISOString(),
      },
    });
  }
}

/**
 * Update heartbeat timestamp
 * @param {object} prisma - Prisma client instance
 */
async function updateHeartbeat(prisma) {
  const states = await prisma.scrapeState.findMany();
  if (states[0]) {
    await prisma.scrapeState.update({
      where: { id: states[0].id },
      data: { heartbeatAt: new Date().toISOString() },
    }).catch((err) => { console.error("[stampRetailer] Failed to update retailer:", retailer?.name, err.message); }); // Log errors
  }
}

/**
 * Stamp retailer with coverage metadata
 * @param {object} prisma - Prisma client instance
 * @param {object} retailer
 * @param {object} fields
 */
async function stampRetailer(prisma, retailer, fields) {
  if (!retailer?.id) return;
  await prisma.retailer.update({
    where: { id: retailer.id },
    data: fields,
  }).catch(() => {}); // Silent failure OK
}

/**
 * Create ScrapeRunLog record
 * @param {object} prisma - Prisma client instance
 * @param {object} logData
 */
async function createScrapeRunLog(prisma, logData) {
  try {
    await prisma.scrapeRunLog.create({
      data: logData,
    });
  } catch (err) {
    console.error('Failed to create ScrapeRunLog:', err.message);
  }
}

/**
 * Process a single retailer
 * @param {object} options
 * @returns {Promise<{done: boolean, error?: string}>}
 */
async function processRetailer({
  retailer,
  cursor,
  prisma,
  claudeClient,
  existingMap,
  pending,
  counts,
  startedAt,
  shopifyPagesLeft,
  productPagesLeft,
  aiLeft,
}) {
  const pastDeadline = () => Date.now() - startedAt > BATCH_DEADLINE_MS;
  let retailerError = "";
  
  try {
    // Build origins
    const origins = [];
    if (retailer.giftPageUrl) {
      try {
        origins.push(new URL(retailer.giftPageUrl).origin);
      } catch {}
    }
    if (retailer.websiteUrl) {
      try {
        const origin = new URL(retailer.websiteUrl).origin;
        if (!origins.includes(origin)) origins.push(origin);
      } catch {}
    }
    
    if (origins.length === 0) {
      // No source URLs
      await stampRetailer(prisma, retailer, {
        lastScrapeAt: new Date(),
        lastDiscoveryMethod: "NONE",
        lastScrapeStatus: "SKIPPED_NO_SOURCE",
        lastScrapeError: "No usable Website URL or Gift Page URL",
        lastScrapeProductsFound: 0,
      });
      return { done: true };
    }
    
    // Try Shopify discovery
    if (cursor.discoveryMode === "none" || cursor.discoveryMode === "shopify") {
      const shopifyResult = await discoverShopifyProducts(retailer, cursor, shopifyPagesLeft.value);
      
      if (shopifyResult.origin) {
        cursor.discoveryMode = "shopify";
        cursor.shopifyOrigin = shopifyResult.origin;
        cursor.storeCurrency = shopifyResult.storeCurrency; // Cache currency for next batch
        cursor.exchangeRate = shopifyResult.exchangeRate; // Cache exchange rate for next batch
        
        // Process Shopify products
        for (const prod of shopifyResult.products) {
          const validation = validateProduct(prod);
          if (!validation.valid) {
            trackRejection(counts, cursor, validation.reason);
            continue;
          }
          upsertProduct(prod, retailer, existingMap, pending, counts, "SHOPIFY_UPLOAD", cursor);
        }
        
        // Update pages processed
        if (shopifyResult.nextPage) {
          cursor.shopifyPage = shopifyResult.nextPage;
          shopifyPagesLeft.value -= (shopifyResult.nextPage - (cursor.shopifyPage || 1));
          // Stamp interim progress so UI updates even if stopped mid-scrape
          await stampRetailer(prisma, retailer, {
            lastScrapeAt: new Date(),
            lastDiscoveryMethod: "SHOPIFY",
            lastScrapeStatus: "OK",
            lastScrapeError: "",
            lastScrapeProductsFound: cursor.newProducts + cursor.updated,
          });
          
          return { done: false }; // More Shopify pages to process
        } else {
          // Shopify complete for this retailer
          await stampRetailer(prisma, retailer, {
            lastScrapeAt: new Date(),
            lastDiscoveryMethod: "SHOPIFY",
            lastScrapeStatus: cursor.newProducts + cursor.updated > 0 ? "OK" : "NO_PRODUCTS",
            lastScrapeError: "",
            lastScrapeProductsFound: cursor.newProducts + cursor.updated,
          });
          
          await createScrapeRunLog(prisma, {
            runDate: new Date(),
            scope: cursor.scope === "retailer" ? "RETAILER" : "FULL",
            retailerId: retailer.id,
            retailerName: retailer.name,
            scrapeStatus: cursor.newProducts + cursor.updated > 0 ? "OK" : "NO_PRODUCTS",
            discoveryMethod: "SHOPIFY",
            newProducts: cursor.newProducts,
            updated: cursor.updated,
            rejectReasonsJson: JSON.stringify(cursor.rejectReasons || {}),
            error: "",
          });
          
          return { done: true };
        }
      }
    }
    
    // Try sitemap discovery
    if (cursor.discoveryMode === "none") {
      const sitemapUrls = await discoverSitemapProducts(retailer);
      
      if (sitemapUrls.length > 0) {
        cursor.discoveryMode = "sitemap";
        cursor.productUrls = sitemapUrls;
        cursor.productIndex = 0;
      }
    }
    
    // Try crawl discovery as fallback
    if (cursor.discoveryMode === "none") {
      const crawlUrls = await crawlDiscoverProductUrls(retailer);
      
      if (crawlUrls.length > 0) {
        cursor.discoveryMode = "crawl";
        cursor.productUrls = crawlUrls;
        cursor.productIndex = 0;
      }
    }
    
    // Process product URLs (from sitemap or crawl)
    if (cursor.discoveryMode === "sitemap" || cursor.discoveryMode === "crawl") {
      const urls = cursor.productUrls || [];
      
      while (cursor.productIndex < urls.length && productPagesLeft.value > 0 && !pastDeadline()) {
        const url = urls[cursor.productIndex];
        cursor.productIndex++;
        
        // Try structured extraction first
        const extractResult = await extractFromProductPage(url);
        
        if (extractResult.success) {
          const prod = { ...extractResult.product, product_url: url };
          const validation = validateProduct(prod);
          if (!validation.valid) {
            trackRejection(counts, cursor, validation.reason);
          } else {
            upsertProduct(prod, retailer, existingMap, pending, counts, "CURATED_RETAILER", cursor);
          }
          productPagesLeft.value--;
        } else if (extractResult.rejected) {
          trackRejection(counts, cursor, extractResult.rejected);
          productPagesLeft.value--;
        } else if (extractResult.error) {
          // Network error, count but don't decrement budget
          counts.errors.push(`${url}: ${extractResult.error}`);
        } else {
          // No structured data, try AI fallback using the already-fetched HTML
          const html = extractResult.html || "";
          const aiResult = await extractWithAI(claudeClient, html, aiLeft.value);
          
          if (aiResult.usedAI) aiLeft.value--;
          
          if (aiResult.success) {
            const prod = { ...aiResult.product, product_url: url };
            const validation = validateProduct(prod);
            if (!validation.valid) {
              trackRejection(counts, cursor, validation.reason);
            } else {
              upsertProduct(prod, retailer, existingMap, pending, counts, "CURATED_RETAILER", cursor);
            }
          } else if (aiResult.rejected) {
            trackRejection(counts, cursor, aiResult.rejected);
          }
          
          productPagesLeft.value--;
        }
        
        // Update heartbeat periodically
        if (cursor.productIndex % 5 === 0) {
          await updateHeartbeat(prisma);
        }
      }
      
      // Check if we're done with this retailer
      if (cursor.productIndex >= urls.length) {
        // Determine the discovery method based on cursor state
        const finalDiscoveryMethod = cursor.discoveryMode === "sitemap" ? "SITEMAP" : 
                                     cursor.discoveryMode === "crawl" ? "CRAWL" : "NONE";
        
        // Retailer complete
        await stampRetailer(prisma, retailer, {
          lastScrapeAt: new Date(),
          lastDiscoveryMethod: finalDiscoveryMethod,
          lastScrapeStatus: cursor.newProducts + cursor.updated > 0 ? "OK" : "NO_PRODUCTS",
          lastScrapeError: "",
          lastScrapeProductsFound: cursor.newProducts + cursor.updated,
        });
        
        await createScrapeRunLog(prisma, {
          runDate: new Date(),
          scope: cursor.scope === "retailer" ? "RETAILER" : "FULL",
          retailerId: retailer.id,
          retailerName: retailer.name,
          scrapeStatus: cursor.newProducts + cursor.updated > 0 ? "OK" : "NO_PRODUCTS",
          discoveryMethod: finalDiscoveryMethod,
          newProducts: cursor.newProducts,
          updated: cursor.updated,
          rejectReasonsJson: JSON.stringify(cursor.rejectReasons || {}),
          error: "",
        });
        
        return { done: true };
      } else {
        // More products to process
        // Stamp interim progress
        const finalDiscoveryMethod = cursor.discoveryMode === "sitemap" ? "SITEMAP" : 
                                     cursor.discoveryMode === "crawl" ? "CRAWL" : "NONE";
        
        await stampRetailer(prisma, retailer, {
          lastScrapeAt: new Date(),
          lastDiscoveryMethod: finalDiscoveryMethod,
          lastScrapeStatus: "OK",
          lastScrapeError: "",
          lastScrapeProductsFound: cursor.newProducts + cursor.updated,
        });
        
        return { done: false };
      }
    }
    
    // No discovery method worked
    await stampRetailer(prisma, retailer, {
      lastScrapeAt: new Date(),
      lastDiscoveryMethod: "NONE",
      lastScrapeStatus: "NO_PRODUCTS",
      lastScrapeError: "",
      lastScrapeProductsFound: 0,
    });
    
    await createScrapeRunLog(prisma, {
      runDate: new Date(),
      scope: cursor.scope === "retailer" ? "RETAILER" : "FULL",
      retailerId: retailer.id,
      retailerName: retailer.name,
      scrapeStatus: "NO_PRODUCTS",
      discoveryMethod: "NONE",
      newProducts: 0,
      updated: 0,
      rejectReasonsJson: "{}",
      error: "",
    });
    
    return { done: true };
    
  } catch (err) {
    retailerError = err.message;
    counts.errors.push(`${retailer.name}: ${retailerError}`);
    cursor.lastError = retailerError;
    
    // Determine discovery method from cursor state
    const finalDiscoveryMethod = cursor.discoveryMode === "shopify" ? "SHOPIFY" :
                                 cursor.discoveryMode === "sitemap" ? "SITEMAP" :
                                 cursor.discoveryMode === "crawl" ? "CRAWL" : "NONE";
    
    await stampRetailer(prisma, retailer, {
      lastScrapeAt: new Date(),
      lastDiscoveryMethod: finalDiscoveryMethod,
      lastScrapeStatus: "ERROR",
      lastScrapeError: retailerError,
      lastScrapeProductsFound: 0,
    });
    
    await createScrapeRunLog(prisma, {
      runDate: new Date(),
      scope: cursor.scope,
      retailerId: retailer.id,
      retailerName: retailer.name,
      scrapeStatus: "ERROR",
      discoveryMethod: finalDiscoveryMethod,
      newProducts: cursor.newProducts || 0,
      updated: cursor.updated || 0,
      rejectReasonsJson: JSON.stringify(cursor.rejectReasons || {}),
      error: retailerError,
    });
    
    return { done: true, error: retailerError };
  }
}

/**
 * Execute one batch of scraping
 * @param {object} options
 * @param {object} options.prisma - Prisma client instance
 * @param {string} options.retailerId - Optional specific retailer ID
 * @param {string} options.cursorToken - Optional continuation token
 * @param {string} options.claudeApiKey - Claude API key for AI fallback
 * @returns {Promise<object>} Batch response
 */
export async function executeBatch({ prisma, retailerId = null, cursorToken = null, claudeApiKey = null }) {
  // Initialize Claude client if API key is available
  const claudeClient = claudeApiKey ? new ClaudeClient(claudeApiKey, prisma) : null;
  
  // Decode cursor or create initial
  let cursor = cursorToken ? decodeCursor(cursorToken) : null;
  if (!cursor) {
    cursor = createInitialCursor(retailerId);
  }
  
  // Validate cursor scope
  const scopeValidation = validateCursorScope(cursor, retailerId);
  if (!scopeValidation.valid) {
    throw new Error(scopeValidation.error);
  }
  
  // Load retailers
  const allRetailers = retailerId
    ? await prisma.retailer.findMany({ where: { id: retailerId } })
    : await prisma.retailer.findMany({ orderBy: { name: 'asc' } });
  
  const enabled = allRetailers.filter((r) => r.active === true && r.curatedOnly !== true);
  const usable = enabled.filter((r) => normaliseUrl(r.websiteUrl) || normaliseUrl(r.giftPageUrl));
  
  // Initialize batch state
  const startedAt = Date.now();
  const counts = {
    retailers_attempted: 0,
    discovered: 0,
    new_products: 0,
    updated: 0,
    skipped_duplicates: 0,
    rejected: 0,
    reject_reasons: {},
    errors: [],
  };
  
  const pending = { creates: [], updates: [], seenKeys: new Set() };
  const shopifyPagesLeft = { value: SHOPIFY_PAGES_PER_BATCH };
  const productPagesLeft = { value: PRODUCT_PAGES_PER_BATCH };
  const aiLeft = { value: AI_FALLBACKS_PER_BATCH };
  
  let currentRetailerName = null;
  let retailersRemaining = usable.length;
  
  // Resume from cursor position
  let ri = cursor.retailerIndex || 0;
  if (cursor.retailerId) {
    ri = usable.findIndex((r) => r.id === cursor.retailerId);
    if (ri < 0) {
      ri = 0;
      cursor = createInitialCursor(retailerId);
    }
  }
  
  // Process retailers
  while (ri < usable.length && shopifyPagesLeft.value > 0 && productPagesLeft.value > 0) {
    const retailer = usable[ri];
    currentRetailerName = retailer.name;
    retailersRemaining = usable.length - ri - 1;
    counts.retailers_attempted++;
    
    // Reset per-retailer cursor state if starting new retailer
    if (cursor.retailerId !== retailer.id) {
      cursor.retailerId = retailer.id;
      cursor.discoveryMode = "none";
      cursor.shopifyOrigin = null;
      cursor.shopifyPage = 1;
      cursor.productIndex = 0;
      cursor.productUrls = [];
      cursor.newProducts = 0;
      cursor.updated = 0;
      cursor.rejectReasons = {};
      cursor.lastError = null;
    }
    
    // Load existing products for this retailer
    const existingMap = await loadExistingMap(prisma, retailer.id);
    
    // Process retailer
    const result = await processRetailer({
      retailer,
      cursor,
      prisma,
      claudeClient,
      existingMap,
      pending,
      counts,
      startedAt,
      shopifyPagesLeft,
      productPagesLeft,
      aiLeft,
    });
    
    if (result.done) {
      // Move to next retailer
      ri++;
      cursor.retailerIndex = ri;
    } else {
      // Retailer not complete, will continue in next batch
      break;
    }
    
    // Flush pending periodically
    if (pending.creates.length + pending.updates.length >= 100) {
      await flushPending(prisma, pending);
    }
    
    // Check deadline
    if (Date.now() - startedAt > BATCH_DEADLINE_MS) {
      break;
    }
  }
  
  // Final flush
  await flushPending(prisma, pending);
  
  // Build response
  const done = ri >= usable.length;
  const nextCursor = done ? null : encodeCursor(cursor);
  
  return {
    done,
    cursor: nextCursor,
    batch: {
      new_products: counts.new_products,
      updated: counts.updated,
      skipped_duplicates: counts.skipped_duplicates,
      rejected: counts.rejected,
      discovered: counts.discovered,
      errors: counts.errors,
      reject_reasons: counts.reject_reasons,
    },
    current_retailer: currentRetailerName,
    retailers_remaining: retailersRemaining,
  };
}

