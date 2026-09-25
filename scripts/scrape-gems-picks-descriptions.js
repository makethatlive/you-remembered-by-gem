#!/usr/bin/env node
/**
 * Scrape descriptions for all Gem's Pick products (CURATED_PRODUCT)
 * Fetches product URL and extracts description from the actual product page
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Rate limiting configuration
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests
const BATCH_SIZE = 10; // Process 10 products, then save progress

/**
 * Extract image URL from HTML
 * Tries multiple strategies to find the main product image
 */
function extractImageUrl(html, productUrl) {
  // Priority 1: JSON-LD Product schema
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      const imageUrl = findProductImage(data);
      if (imageUrl) {
        console.log(`   ✓ Found image in JSON-LD`);
        return imageUrl;
      }
    } catch (e) {
      // Invalid JSON, continue
    }
  }
  
  // Priority 2: Open Graph image
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (ogImageMatch && ogImageMatch[1]) {
    console.log(`   ✓ Found image in og:image`);
    return ogImageMatch[1];
  }
  
  // Priority 3: Twitter card image
  const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                            html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i);
  if (twitterImageMatch && twitterImageMatch[1]) {
    console.log(`   ✓ Found image in twitter:image`);
    return twitterImageMatch[1];
  }
  
  // Priority 4: Product image with itemprop
  const itempropMatch = html.match(/<img[^>]*itemprop=["']image["'][^>]*src=["']([^"']+)["']/i) ||
                       html.match(/<img[^>]*src=["']([^"']+)["'][^>]*itemprop=["']image["']/i);
  if (itempropMatch && itempropMatch[1]) {
    console.log(`   ✓ Found image with itemprop`);
    return itempropMatch[1];
  }
  
  // Priority 5: First large image in product container
  const productImgMatch = html.match(/<img[^>]*class=["'][^"']*product[^"']*["'][^>]*src=["']([^"']+)["']/i);
  if (productImgMatch && productImgMatch[1]) {
    console.log(`   ✓ Found image in product container`);
    return productImgMatch[1];
  }
  
  return null;
}

/**
 * Find product image in JSON-LD data (recursive)
 */
function findProductImage(data) {
  if (!data || typeof data !== 'object') return null;
  
  if (Array.isArray(data)) {
    for (const item of data) {
      const img = findProductImage(item);
      if (img) return img;
    }
    return null;
  }
  
  // Check if this is a Product
  const type = data['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes('Product') && data.image) {
    // Image can be string, array, or object
    if (typeof data.image === 'string') {
      return data.image;
    }
    if (Array.isArray(data.image) && data.image.length > 0) {
      return typeof data.image[0] === 'string' ? data.image[0] : data.image[0].url;
    }
    if (typeof data.image === 'object' && data.image.url) {
      return data.image.url;
    }
  }
  
  // Check @graph
  if (data['@graph']) {
    return findProductImage(data['@graph']);
  }
  
  return null;
}

/**
 * Simple regex-based HTML parser (no external dependencies)
 * Extracts description from common e-commerce patterns
 */
function extractDescription(html, url) {
  // Priority 1: JSON-LD Product schema
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      const description = findProductDescription(data);
      if (description && description.length >= 50 && description.length <= 5000) {
        console.log(`   ✓ Found description in JSON-LD (${description.length} chars)`);
        return cleanDescription(description);
      }
    } catch (e) {
      // Invalid JSON, continue
    }
  }
  
  // Priority 2: Meta tags
  const metaPatterns = [
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i,
    /<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i,
  ];
  
  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const description = decodeHtmlEntities(match[1]);
      if (description.length >= 50 && description.length <= 5000) {
        console.log(`   ✓ Found description in meta tag (${description.length} chars)`);
        return cleanDescription(description);
      }
    }
  }
  
  // Priority 3: Common class/id selectors (extract text content)
  const selectorPatterns = [
    // Shopify common
    /<div[^>]*class=["'][^"']*product-description[^"']*["'][^>]*>(.*?)<\/div>/is,
    /<div[^>]*class=["'][^"']*product__description[^"']*["'][^>]*>(.*?)<\/div>/is,
    /<div[^>]*itemprop=["']description["'][^>]*>(.*?)<\/div>/is,
    
    // General
    /<div[^>]*id=["']product-description["'][^>]*>(.*?)<\/div>/is,
    /<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>(.*?)<\/div>/is,
    /<p[^>]*class=["'][^"']*product-description[^"']*["'][^>]*>(.*?)<\/p>/is,
  ];
  
  for (const pattern of selectorPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const description = stripHtmlTags(match[1]);
      if (description.length >= 50 && description.length <= 5000) {
        console.log(`   ✓ Found description in HTML content (${description.length} chars)`);
        return cleanDescription(description);
      }
    }
  }
  
  return null;
}

/**
 * Find product description in JSON-LD data (recursive)
 */
function findProductDescription(data) {
  if (!data || typeof data !== 'object') return null;
  
  if (Array.isArray(data)) {
    for (const item of data) {
      const desc = findProductDescription(item);
      if (desc) return desc;
    }
    return null;
  }
  
  // Check if this is a Product
  const type = data['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes('Product') && data.description) {
    return data.description;
  }
  
  // Check @graph
  if (data['@graph']) {
    return findProductDescription(data['@graph']);
  }
  
  return null;
}

/**
 * Strip HTML tags from text
 */
function stripHtmlTags(html) {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };
  
  return text.replace(/&[^;]+;/g, match => entities[match] || match);
}

/**
 * Clean and normalize description
 */
function cleanDescription(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

/**
 * Scrape a single product URL for BOTH image and description
 */
async function scrapeProductUrl(product) {
  try {
    console.log(`\n[${product.currentIndex}/${product.totalCount}] ${product.name}`);
    console.log(`   URL: ${product.productUrl}`);
    
    // Check what's already present
    const hasImage = !!product.imageUrl;
    const hasDescription = !!product.description && product.description.length >= 50;
    
    if (hasImage && hasDescription) {
      console.log(`   ⏭️  Already has both image and description - skipping`);
      return {
        success: true,
        productId: product.id,
        status: 'skipped',
        reason: 'already_complete',
        imageUrl: product.imageUrl,
        description: product.description,
      };
    }
    
    console.log(`   Need: ${!hasImage ? 'Image' : ''}${!hasImage && !hasDescription ? ' + ' : ''}${!hasDescription ? 'Description' : ''}`);
    
    // Fetch product page using native fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(product.productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}`);
      return {
        success: false,
        productId: product.id,
        status: 'failed',
        reason: `HTTP ${response.status}`,
      };
    }
    
    // Get HTML content
    const html = await response.text();
    
    // Extract image URL (if needed)
    let imageUrl = product.imageUrl;
    if (!hasImage) {
      imageUrl = extractImageUrl(html, product.productUrl);
      if (!imageUrl) {
        console.log(`   ⚠️  No image found on page`);
      }
    }
    
    // Extract description (if needed)
    let description = product.description;
    if (!hasDescription) {
      description = extractDescription(html, product.productUrl);
      if (!description) {
        console.log(`   ⚠️  No description found on page`);
      }
    }
    
    // Check what we got
    const foundImage = !hasImage && !!imageUrl;
    const foundDescription = !hasDescription && !!description;
    
    if (!foundImage && !foundDescription) {
      console.log(`   ❌ Found nothing`);
      return {
        success: false,
        productId: product.id,
        status: 'failed',
        reason: 'nothing_found',
      };
    }
    
    // Success!
    const results = [];
    if (foundImage) results.push(`Image: ${imageUrl.substring(0, 60)}...`);
    if (foundDescription) results.push(`Description: ${description.substring(0, 60)}...`);
    console.log(`   ✅ Scraped: ${results.join(' | ')}`);
    
    return {
      success: true,
      productId: product.id,
      status: 'scraped',
      imageUrl: imageUrl || '',
      description: description || '',
      foundImage,
      foundDescription,
      imageLength: imageUrl?.length || 0,
      descriptionLength: description?.length || 0,
    };
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    
    return {
      success: false,
      productId: product.id,
      status: 'error',
      reason: error.message,
    };
  }
}

/**
 * Save progress to JSON file
 */
function saveProgress(results, outputPath) {
  const stats = {
    total: results.length,
    scraped: results.filter(r => r.status === 'scraped').length,
    foundImages: results.filter(r => r.foundImage).length,
    foundDescriptions: results.filter(r => r.foundDescription).length,
    skipped: results.filter(r => r.status === 'skipped').length,
    failed: results.filter(r => r.status === 'failed').length,
    errors: results.filter(r => r.status === 'error').length,
  };
  
  const output = {
    timestamp: new Date().toISOString(),
    stats,
    results,
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n💾 Progress saved: ${outputPath}`);
  console.log(`   Scraped: ${stats.scraped} | Images: ${stats.foundImages} | Descriptions: ${stats.foundDescriptions} | Skipped: ${stats.skipped} | Failed: ${stats.failed} | Errors: ${stats.errors}`);
}

/**
 * Update products in database with scraped descriptions
 */
async function updateProductDescriptions(results) {
  console.log('\n📝 Updating products in database...');
  
  const scrapedResults = results.filter(r => r.status === 'scraped' && r.description);
  
  let updated = 0;
  let failed = 0;
  
  for (const result of scrapedResults) {
    try {
      await prisma.product.update({
        where: { id: result.productId },
        data: { description: result.description },
      });
      updated++;
      
      if (updated % 10 === 0) {
        console.log(`   ✓ Updated ${updated}/${scrapedResults.length} products...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to update ${result.productId}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ Database update complete:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  
  return { updated, failed };
}

/**
 * Main scraping function
 */
async function scrapeGemsPicks() {
  try {
    console.log('🔍 Fetching Gem\'s Pick products (CURATED_PRODUCT)...\n');
    
    // Fetch all Gem's Pick products
    const products = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT',
      },
      select: {
        id: true,
        name: true,
        productUrl: true,
        imageUrl: true,
        description: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    console.log(`✅ Found ${products.length} Gem's Pick products\n`);
    
    if (products.length === 0) {
      console.log('No products to scrape. Exiting.');
      return;
    }
    
    // Create output directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputDir = path.join(__dirname, '..', 'scrape-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, `gems-picks-descriptions-${timestamp}.json`);
    
    console.log(`📊 Scraping ${products.length} products...`);
    console.log(`⏱️  Estimated time: ${Math.ceil(products.length * DELAY_BETWEEN_REQUESTS / 1000 / 60)} minutes\n`);
    console.log(`⚙️  Rate limit: ${DELAY_BETWEEN_REQUESTS}ms between requests`);
    console.log(`📦 Batch size: ${BATCH_SIZE} products\n`);
    console.log('─'.repeat(80));
    
    const results = [];
    const totalCount = products.length;
    
    // Process products with rate limiting
    for (let i = 0; i < products.length; i++) {
      const product = {
        ...products[i],
        currentIndex: i + 1,
        totalCount,
      };
      
      // Scrape product
      const result = await scrapeProductUrl(product);
      results.push(result);
      
      // Save progress after each batch
      if ((i + 1) % BATCH_SIZE === 0 || i === products.length - 1) {
        saveProgress(results, outputPath);
      }
      
      // Rate limiting (except for last item)
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('SCRAPING COMPLETE');
    console.log('═'.repeat(80));
    
    // Final statistics
    const stats = {
      total: results.length,
      scraped: results.filter(r => r.status === 'scraped').length,
      foundImages: results.filter(r => r.foundImage).length,
      foundDescriptions: results.filter(r => r.foundDescription).length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length,
      errors: results.filter(r => r.status === 'error').length,
    };
    
    console.log('\n📊 Final Statistics:');
    console.log(`   Total products: ${stats.total}`);
    console.log(`   ✅ Scraped: ${stats.scraped}`);
    console.log(`      📷 Found images: ${stats.foundImages}`);
    console.log(`      📝 Found descriptions: ${stats.foundDescriptions}`);
    console.log(`   ⏭️  Skipped: ${stats.skipped} (already had both)`);
    console.log(`   ❌ Failed: ${stats.failed} (nothing found)`);
    console.log(`   ⚠️  Errors: ${stats.errors} (network/timeout errors)`);
    console.log(`   Success rate: ${((stats.scraped / (stats.total - stats.skipped)) * 100).toFixed(1)}%`);
    
    // Save final results
    saveProgress(results, outputPath);
    
    // Ask user if they want to update database
    console.log('\n' + '─'.repeat(80));
    console.log('📝 UPDATE DATABASE?');
    console.log('─'.repeat(80));
    console.log(`\nReady to update ${stats.scraped} products in database with scraped descriptions.`);
    console.log(`\nTo update database, run:`);
    console.log(`   node scripts/update-descriptions-from-scrape.js ${path.basename(outputPath)}`);
    console.log(`\nOr manually review the file first:`);
    console.log(`   ${outputPath}\n`);
    
    // Optionally auto-update (uncomment if you want automatic updates)
    // const { updated, failed } = await updateProductDescriptions(results);
    
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the scraper
scrapeGemsPicks()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
