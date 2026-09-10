/**
 * Forensic Audit Service
 * 
 * Read-only catalogue analysis that classifies products into quality buckets
 * and grades retailer coverage. Based on base44 auditScrapeForensics.
 * 
 * Product Buckets:
 * - healthy: Active products with no issues
 * - correctly_rejected: Junk products (failed validation, duplicates, non-product URLs)
 * - needs_manual_review: Products awaiting human decision (pending, broken, inactive with no reason, curated that fail heuristics)
 * - needs_re_enrichment: Products missing descriptions, images, or tags
 */

// Non-product URL patterns (same as scraper)
const BASE_NON_PRODUCT_PATTERNS = [
  '/blog', '/blogs', '/pages', '/collections', '/search', '/about',
];

const EXTRA_NON_PRODUCT_PATTERNS = [
  '/account', '/login', '/basket', '/cart', '/checkout', '/careers', '/press',
  '/terms', '/privacy', '/returns', '/delivery', '/faq', '/help', '/wishlist',
];

const NON_PRODUCT_PATTERNS = [...BASE_NON_PRODUCT_PATTERNS, ...EXTRA_NON_PRODUCT_PATTERNS];

// Underfilled threshold (same as base44)
const UNDERFILLED_THRESHOLD = 10;

/**
 * Normalize URL for duplicate detection
 * Returns: hostname + pathname, lowercased, trailing slash removed
 */
function urlKey(urlString) {
  try {
    const url = new URL(urlString);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Check if a product passes basic validation heuristics
 */
function validProduct(name, productUrl) {
  // Check name
  if (!name || typeof name !== 'string') return false;
  if (name.length < 3) return false;
  
  // Check URL
  if (!productUrl || typeof productUrl !== 'string') return false;
  
  // Check against non-product patterns
  const lowerUrl = productUrl.toLowerCase();
  for (const pattern of NON_PRODUCT_PATTERNS) {
    if (lowerUrl.includes(pattern)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Classify a single product into its quality bucket
 * 
 * @param {Object} product - Product from database
 * @param {Set} dupKeys - Set of product IDs that are duplicates
 * @returns {Object} { bucket: string, reasons: string[] }
 */
function classifyProduct(product, dupKeys) {
  const flags = Array.isArray(product.dataQualityFlags) ? product.dataQualityFlags : [];
  
  // Round-3 prime directive: curated products are never auto-condemned
  const curated = product.sourceType === 'CURATED_PRODUCT' || product.sourceType === 'CURATED_RETAILER';
  const reasons = [];
  
  // Rule 1: Pipeline's own junk heuristics
  if (!validProduct(product.name, product.productUrl)) {
    reasons.push('failed_validation');
  }
  if (flags.includes('junk_title')) {
    reasons.push('flagged_junk_title');
  }
  if (flags.includes('editorial_not_product')) {
    reasons.push('flagged_editorial');
  }
  
  if (reasons.length > 0) {
    if (curated) {
      // Curated products that fail heuristics go to manual review, not rejection
      return { 
        bucket: 'needs_manual_review', 
        reasons: ['curated_fails_scraper_heuristics', ...reasons] 
      };
    }
    // Non-curated junk products
    if (product.status === 'ACTIVE' || product.status === 'NEEDS_REVIEW') {
      reasons.push('junk_but_not_retired');
    }
    return { bucket: 'correctly_rejected', reasons };
  }
  
  // Rule 2: Duplicate URL within the retailer
  if (dupKeys.has(product.id)) {
    if (curated) {
      return { 
        bucket: 'needs_manual_review', 
        reasons: ['curated_duplicate_url'] 
      };
    }
    return { bucket: 'correctly_rejected', reasons: ['duplicate_url'] };
  }
  
  // Rule 3: Retired with no recorded reason - only admin can adjudicate
  if (product.status === 'INACTIVE') {
    return { 
      bucket: 'needs_manual_review', 
      reasons: ['inactive_no_recorded_reason'] 
    };
  }
  
  // Rule 4: Enrichment has not run, or it flagged gaps
  if (!product.catalogueEnrichedAt) {
    return { 
      bucket: 'needs_re_enrichment', 
      reasons: ['never_enriched'] 
    };
  }
  
  const gapFlags = flags.filter(f => 
    f === 'missing_description' || f === 'missing_image'
  );
  if (gapFlags.length > 0) {
    return { bucket: 'needs_re_enrichment', reasons: gapFlags };
  }
  
  // Rule 5: Clean and waiting on a human
  if (product.status === 'NEEDS_REVIEW') {
    return { 
      bucket: 'needs_manual_review', 
      reasons: ['awaiting_review'] 
    };
  }
  if (product.status === 'REPORTED_BROKEN') {
    return { 
      bucket: 'needs_manual_review', 
      reasons: ['reported_broken'] 
    };
  }
  
  // Everything else is healthy
  return { bucket: 'healthy', reasons: [] };
}

/**
 * Detect duplicate products within each retailer
 * Returns a Set of product IDs that are duplicates
 */
function detectDuplicates(products) {
  const dupKeys = new Set();
  const seenPerRetailer = new Map();
  
  // Sort by created date (oldest first) to keep the oldest product
  const sorted = [...products].sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );
  
  for (const product of sorted) {
    const key = `${product.retailerId}::${urlKey(product.productUrl)}`;
    const urlKeyValue = urlKey(product.productUrl);
    
    if (!urlKeyValue) continue; // Skip invalid URLs
    
    if (seenPerRetailer.has(key)) {
      // This is a duplicate
      dupKeys.add(product.id);
    } else {
      // First occurrence
      seenPerRetailer.set(key, product.id);
    }
  }
  
  return dupKeys;
}

/**
 * Grade a retailer's coverage
 */
function gradeRetailer(retailer, counters, scrapeLog) {
  const hasSource = Boolean(retailer.websiteUrl || retailer.giftPageUrl);
  
  // Expected products: use scrape stamp first, then log, else unknown
  const stampValue = retailer.lastScrapeProductsFound;
  const expected = stampValue !== null && stampValue !== undefined
    ? stampValue
    : (scrapeLog 
        ? (scrapeLog.newProducts || 0) + (scrapeLog.updated || 0) 
        : null);
  
  const reviewable = counters.active + counters.needs_review;
  const gap = expected !== null ? expected - reviewable : null;
  
  const stampStatus = retailer.lastScrapeStatus || scrapeLog?.scrapeStatus || '';
  const method = retailer.lastDiscoveryMethod || scrapeLog?.discoveryMethod || '';
  
  let verdict = 'ok';
  
  if (retailer.curatedOnly === true) {
    verdict = 'curated_only';
  } else if (retailer.active !== true) {
    verdict = 'inactive_retailer';
  } else if (!hasSource) {
    verdict = 'no_source';
  } else if (
    counters.total === 0 ||
    reviewable < UNDERFILLED_THRESHOLD ||
    stampStatus === 'ERROR' || stampStatus === 'NO_PRODUCTS' ||
    method === 'CRAWL' || method === 'NONE' ||
    (gap !== null && gap > 0)
  ) {
    verdict = 'needs_rescrape';
  }
  
  // Parse rejection reasons from log
  let rejectReasons = {};
  if (scrapeLog?.rejectReasonsJson) {
    try {
      rejectReasons = JSON.parse(scrapeLog.rejectReasonsJson);
    } catch {
      rejectReasons = {};
    }
  }
  
  return {
    retailerId: retailer.id,
    name: retailer.name,
    active: retailer.active === true,
    curatedOnly: retailer.curatedOnly === true,
    hasSource,
    counts: counters,
    expectedFound: expected,
    coverageGap: gap,
    lastScrapeStatus: stampStatus,
    discoveryMethod: method,
    lastScrapeError: retailer.lastScrapeError || scrapeLog?.error || '',
    rejectReasons,
    verdict,
  };
}

/**
 * Run the forensic audit
 * 
 * @param {Object} prisma - Prisma client
 * @returns {Promise<Object>} Audit results
 */
export async function runForensicAudit(prisma) {
  const startTime = Date.now();
  
  // Fetch all products (limit 5000, newest first)
  const products = await prisma.product.findMany({
    take: 5000,
    orderBy: { createdAt: 'desc' },
    include: {
      retailer: true,
    },
  });
  
  // Fetch all retailers
  const retailers = await prisma.retailer.findMany({
    orderBy: { name: 'asc' },
  });
  
  // Fetch scrape run logs (newest first)
  const scrapeRunLogs = await prisma.scrapeRunLog.findMany({
    take: 5000,
    orderBy: { createdAt: 'desc' },
  });
  
  // Detect duplicates
  const dupKeys = detectDuplicates(products);
  
  // Initialize buckets
  const buckets = {
    correctly_rejected: [],
    needs_manual_review: [],
    needs_re_enrichment: [],
    healthy: [],
  };
  
  // Initialize per-retailer counters
  const perRetailer = new Map();
  
  const getCounterFor = (retailerId) => {
    if (!perRetailer.has(retailerId)) {
      perRetailer.set(retailerId, {
        total: 0,
        active: 0,
        needs_review: 0,
        inactive: 0,
        reported_broken: 0,
        correctly_rejected: 0,
        needs_manual_review: 0,
        needs_re_enrichment: 0,
        healthy: 0,
      });
    }
    return perRetailer.get(retailerId);
  };
  
  // Classify all products
  for (const product of products) {
    const { bucket, reasons } = classifyProduct(product, dupKeys);
    buckets[bucket].push({ product, reasons });
    
    const counters = getCounterFor(product.retailerId || 'unknown');
    counters.total++;
    
    // Count by status (map enum to counter keys)
    const statusMap = {
      'ACTIVE': 'active',
      'NEEDS_REVIEW': 'needs_review',
      'INACTIVE': 'inactive',
      'REPORTED_BROKEN': 'reported_broken',
    };
    const statusKey = statusMap[product.status];
    if (statusKey && counters[statusKey] !== undefined) {
      counters[statusKey]++;
    }
    
    // Count by bucket
    counters[bucket]++;
  }
  
  // Build retailer index by ID
  const retailerById = new Map(retailers.map(r => [r.id, r]));
  
  // Latest scrape log per retailer
  const latestLogByRetailer = new Map();
  for (const log of scrapeRunLogs) {
    if (log.retailerId && !latestLogByRetailer.has(log.retailerId)) {
      latestLogByRetailer.set(log.retailerId, log);
    }
  }
  
  // Grade all retailers
  const coverage = retailers.map(retailer => {
    const counters = getCounterFor(retailer.id);
    const scrapeLog = latestLogByRetailer.get(retailer.id) || null;
    return gradeRetailer(retailer, counters, scrapeLog);
  });
  
  // Calculate totals
  const totals = {
    products: products.length,
    poolTruncated: products.length === 5000,
    healthy: buckets.healthy.length,
    correctlyRejected: buckets.correctly_rejected.length,
    needsManualReview: buckets.needs_manual_review.length,
    needsReEnrichment: buckets.needs_re_enrichment.length,
    retailers: retailers.length,
    retailersNeedingRescrape: coverage.filter(c => c.verdict === 'needs_rescrape').length,
    retailersNoSource: coverage.filter(c => c.verdict === 'no_source').length,
    runLogRows: scrapeRunLogs.length,
  };
  
  // Build examples (first 15 of each problem bucket)
  const examples = {};
  for (const key of ['correctly_rejected', 'needs_manual_review', 'needs_re_enrichment']) {
    examples[key] = buckets[key].slice(0, 15).map(({ product, reasons }) => ({
      id: product.id,
      name: product.name,
      retailer: retailerById.get(product.retailerId)?.name || '—',
      status: product.status,
      reasons,
    }));
  }
  
  const executionTime = Date.now() - startTime;
  
  return {
    generatedAt: new Date().toISOString(),
    executionTimeMs: executionTime,
    totals,
    coverage,
    examples,
    notes: [
      'Per-URL rejection reasons for runs before ScrapeRunLog was implemented were never persisted and are unrecoverable; reason tallies appear only for runs made after ScrapeRunLog is live.',
      'Retailer scrape stamps are publish-gated fields; before publish the expected/actual comparison uses product counts and heuristics only.',
      'needs_re_enrichment rows: run per-retailer Enrich for the affected retailers, then re-run this audit — rows migrate to needs_manual_review once enriched.',
      'Curated rows (source_type CURATED_PRODUCT or CURATED_RETAILER) are never auto-bucketed as correctly rejected: scraper-heuristic hits on them are advisory (curated_fails_scraper_heuristics / curated_duplicate_url) — verify with curator before retiring anything manually supplied.',
      'The retailer coverage grade counts active+needs_review against the threshold of 10; the Retailers tab\'s Underfilled badge counts actives only, so the two surfaces can legitimately disagree on retailers with many unreviewed rows.',
    ],
  };
}

/**
 * Export audit results to Google Sheets (optional feature)
 * Requires Google Sheets API credentials
 */
export async function exportAuditToSheet(auditResults, accessToken) {
  // TODO: Implement Google Sheets export if needed
  // This is optional and requires Google OAuth setup
  throw new Error('Google Sheets export not yet implemented');
}
