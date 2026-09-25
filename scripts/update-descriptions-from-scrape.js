#!/usr/bin/env node
/**
 * Update product descriptions in database from scrape results
 * Usage: node scripts/update-descriptions-from-scrape.js <scrape-results-file.json>
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function updateDescriptions(scrapeResultsPath) {
  try {
    // Load scrape results
    console.log(`📂 Loading scrape results from: ${scrapeResultsPath}\n`);
    
    if (!fs.existsSync(scrapeResultsPath)) {
      throw new Error(`File not found: ${scrapeResultsPath}`);
    }
    
    const data = JSON.parse(fs.readFileSync(scrapeResultsPath, 'utf-8'));
    const results = data.results || [];
    
    // Filter successfully scraped products
    const scrapedProducts = results.filter(r => r.status === 'scraped' && (r.imageUrl || r.description));
    
    console.log(`📊 Scrape Results Summary:`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Scraped: ${scrapedProducts.length}`);
    console.log(`   - Found images: ${results.filter(r => r.foundImage).length}`);
    console.log(`   - Found descriptions: ${results.filter(r => r.foundDescription).length}`);
    console.log(`   Skipped: ${results.filter(r => r.status === 'skipped').length}`);
    console.log(`   Failed: ${results.filter(r => r.status === 'failed').length}`);
    console.log(`   Errors: ${results.filter(r => r.status === 'error').length}\n`);
    
    if (scrapedProducts.length === 0) {
      console.log('⚠️  No products to update. Exiting.');
      return;
    }
    
    console.log(`📝 Updating ${scrapedProducts.length} products in database...\n`);
    console.log('─'.repeat(80));
    
    let updated = 0;
    let failed = 0;
    const errors = [];
    
    // Update products in database
    for (const result of scrapedProducts) {
      try {
        const updateData = {};
        if (result.imageUrl) updateData.imageUrl = result.imageUrl;
        if (result.description) updateData.description = result.description;
        
        await prisma.product.update({
          where: { id: result.productId },
          data: updateData,
        });
        
        updated++;
        
        if (updated % 10 === 0) {
          console.log(`   ✓ Updated ${updated}/${scrapedProducts.length} products...`);
        }
      } catch (error) {
        failed++;
        errors.push({
          productId: result.productId,
          error: error.message,
        });
        console.error(`   ❌ Failed to update ${result.productId}: ${error.message}`);
      }
    }
    
    console.log('─'.repeat(80));
    console.log('\n✅ DATABASE UPDATE COMPLETE\n');
    console.log(`📊 Results:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Success rate: ${((updated / scrapedProducts.length) * 100).toFixed(1)}%\n`);
    
    // Log errors if any
    if (errors.length > 0) {
      console.log(`⚠️  Errors encountered:`);
      errors.forEach(err => {
        console.log(`   - ${err.productId}: ${err.error}`);
      });
      console.log();
    }
    
    // Save update log
    const logPath = scrapeResultsPath.replace('.json', '-update-log.json');
    const logData = {
      timestamp: new Date().toISOString(),
      sourceFile: scrapeResultsPath,
      stats: {
        total: scrapedProducts.length,
        updated,
        failed,
        successRate: ((updated / scrapedProducts.length) * 100).toFixed(1) + '%',
      },
      errors,
    };
    
    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf-8');
    console.log(`📄 Update log saved: ${logPath}\n`);
    
  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get file path from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Usage: node scripts/update-descriptions-from-scrape.js <scrape-results-file.json>');
  console.error('\nExample:');
  console.error('   node scripts/update-descriptions-from-scrape.js scrape-results/gems-picks-descriptions-2026-09-17T12-00-00.json');
  process.exit(1);
}

let scrapeResultsPath = args[0];

// If relative path or just filename, resolve it
if (!path.isAbsolute(scrapeResultsPath)) {
  // Check if it's just a filename (no directory)
  if (path.basename(scrapeResultsPath) === scrapeResultsPath) {
    // Look in scrape-results directory
    scrapeResultsPath = path.join(__dirname, '..', 'scrape-results', scrapeResultsPath);
  } else {
    // Resolve relative to script location
    scrapeResultsPath = path.resolve(__dirname, '..', scrapeResultsPath);
  }
}

// Run the update
updateDescriptions(scrapeResultsPath)
  .then(() => {
    console.log('✅ Update completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });
