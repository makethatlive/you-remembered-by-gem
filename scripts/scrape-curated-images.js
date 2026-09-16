import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';

const prisma = new PrismaClient();

/**
 * Scrape image URL from product page
 */
async function scrapeImageFromUrl(browser, productUrl, productName) {
  const page = await browser.newPage();
  
  try {
    console.log(`   Scraping: ${productName.substring(0, 50)}...`);
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate with timeout
    await page.goto(productUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Wait a bit for dynamic content (using setTimeout instead of waitForTimeout)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try multiple selectors to find product image
    const imageUrl = await page.evaluate(() => {
      // Common product image selectors (priority order)
      const selectors = [
        'meta[property="og:image"]',
        'meta[property="og:image:secure_url"]',
        'meta[name="twitter:image"]',
        'img[class*="product"][class*="image"]:first-of-type',
        'img[class*="ProductImage"]:first-of-type',
        'img[class*="product-main-image"]',
        'img[id*="product-image"]',
        '.product-image img:first-of-type',
        '.product-gallery img:first-of-type',
        '[data-testid*="product-image"] img',
        'main img:first-of-type',
        'article img:first-of-type'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        
        if (element) {
          // For meta tags
          if (element.tagName === 'META') {
            const content = element.getAttribute('content');
            if (content && content.startsWith('http')) {
              return content;
            }
          }
          
          // For img tags
          if (element.tagName === 'IMG') {
            const src = element.src || element.getAttribute('data-src') || element.getAttribute('data-lazy-src');
            if (src && src.startsWith('http')) {
              return src;
            }
          }
        }
      }
      
      return null;
    });
    
    await page.close();
    
    if (imageUrl) {
      console.log(`   ✅ Found image: ${imageUrl.substring(0, 80)}...`);
      return imageUrl;
    } else {
      console.log(`   ⚠️  No image found`);
      return null;
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    await page.close();
    return null;
  }
}

/**
 * Main function to scrape images for CURATED products
 */
async function scrapeCuratedImages() {
  let browser = null;
  
  try {
    console.log('🔍 Finding CURATED products without images...\n');
    
    // Find CURATED_PRODUCT with missing imageUrl
    const products = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT',
        status: 'ACTIVE',
        OR: [
          { imageUrl: null },
          { imageUrl: '' },
          { imageUrl: 'N/A' }
        ]
      },
      select: {
        id: true,
        name: true,
        productUrl: true,
        imageUrl: true,
        retailer: {
          select: {
            name: true
          }
        }
      },
      take: 100 // Process first 100, can increase later
    });
    
    console.log(`📊 Found ${products.length} CURATED products without images\n`);
    
    if (products.length === 0) {
      console.log('✅ All CURATED products already have images!');
      return;
    }
    
    // Launch browser
    console.log('🌐 Launching browser...\n');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    let scraped = 0;
    let failed = 0;
    const updates = [];
    
    // Process each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      // Skip if no product URL
      if (!product.productUrl || product.productUrl === 'N/A' || product.productUrl === '') {
        console.log(`\n[${i + 1}/${products.length}] ${product.name.substring(0, 60)}...`);
        console.log(`   ⚠️  Skipping - No product URL`);
        failed++;
        continue;
      }
      
      console.log(`\n[${i + 1}/${products.length}] ${product.name.substring(0, 60)}...`);
      console.log(`   Retailer: ${product.retailer?.name || 'Unknown'}`);
      console.log(`   URL: ${product.productUrl.substring(0, 80)}...`);
      
      try {
        const imageUrl = await scrapeImageFromUrl(browser, product.productUrl, product.name);
        
        if (imageUrl) {
          updates.push({
            id: product.id,
            name: product.name,
            imageUrl: imageUrl
          });
          scraped++;
        } else {
          failed++;
        }
        
        // Rate limiting - wait between requests
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        failed++;
      }
    }
    
    // Apply updates to database
    if (updates.length > 0) {
      console.log(`\n\n💾 Updating ${updates.length} products in database...\n`);
      
      for (const update of updates) {
        await prisma.product.update({
          where: { id: update.id },
          data: { imageUrl: update.imageUrl }
        });
      }
      
      console.log('✅ Database updated!\n');
    }
    
    // Summary
    console.log('═══════════════════════════════════════');
    console.log('           SUMMARY REPORT              ');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total products processed: ${products.length}`);
    console.log(`✅ Images scraped successfully: ${scraped}`);
    console.log(`❌ Failed to scrape: ${failed}`);
    console.log(`💾 Database updates: ${updates.length}`);
    console.log('═══════════════════════════════════════\n');
    
    if (failed > 0) {
      console.log('💡 TIP: Failed products may need manual image URLs');
      console.log('   You can add them via admin dashboard or CSV import\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    await prisma.$disconnect();
  }
}

// Run the script
console.log('🖼️  CURATED PRODUCTS IMAGE SCRAPER\n');
console.log('This script will scrape product images from product URLs');
console.log('for CURATED_PRODUCT items that are missing images.\n');

scrapeCuratedImages();
