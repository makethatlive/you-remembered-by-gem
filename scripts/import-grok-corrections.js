/**
 * Import Grok AI Corrections
 * 
 * Applies Grok's corrected tags back to the database
 * 
 * Usage: node scripts/import-grok-corrections.js <path-to-grok-output.json>
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

async function importGrokCorrections(filename) {
  try {
    console.log('📥 Importing Grok AI corrections...\n');

    // Read Grok output file
    const data = JSON.parse(readFileSync(filename, 'utf8'));
    console.log(`✅ Loaded ${data.length} products from ${filename}\n`);

    // Statistics
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const changes = {
      interestTags: 0,
      giftTypeTags: 0,
      searchKeywords: 0,
    };

    // Process each product
    for (const product of data) {
      try {
        // Validate required fields
        if (!product.id) {
          console.warn(`⚠️  Skipping product - missing ID`);
          skipped++;
          continue;
        }

        // Build update data (ONLY 3 fields)
        const updateData = {};
        let hasChanges = false;

        // Interest Tags
        if (Array.isArray(product.corrected_interestTags) && 
            JSON.stringify(product.corrected_interestTags) !== JSON.stringify(product.current_interestTags)) {
          updateData.interestTags = product.corrected_interestTags;
          changes.interestTags++;
          hasChanges = true;
        }

        // Gift Type Tags
        if (Array.isArray(product.corrected_giftTypeTags) && 
            JSON.stringify(product.corrected_giftTypeTags) !== JSON.stringify(product.current_giftTypeTags)) {
          updateData.giftTypeTags = product.corrected_giftTypeTags;
          changes.giftTypeTags++;
          hasChanges = true;
        }

        // Search Keywords
        if (Array.isArray(product.corrected_searchKeywords) && 
            JSON.stringify(product.corrected_searchKeywords) !== JSON.stringify(product.current_searchKeywords)) {
          updateData.searchKeywords = product.corrected_searchKeywords;
          changes.searchKeywords++;
          hasChanges = true;
        }

        // Update database if changes detected
        if (hasChanges) {
          await prisma.product.update({
            where: { id: product.id },
            data: updateData,
          });
          
          updated++;
          console.log(`✅ Updated: ${product.name.substring(0, 50)}...`);
        } else {
          skipped++;
        }

      } catch (error) {
        console.error(`❌ Error updating product ${product.id}:`, error.message);
        errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total products processed: ${data.length}`);
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`⏭️  Skipped (no changes): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('\n📝 CHANGES BY FIELD:');
    console.log(`   Interest tags changed: ${changes.interestTags}`);
    console.log(`   Gift type tags changed: ${changes.giftTypeTags}`);
    console.log(`   Search keywords changed: ${changes.searchKeywords}`);
    console.log('='.repeat(80) + '\n');

    if (updated > 0) {
      console.log('✅ Import complete! Products have been updated in the database.\n');
    } else {
      console.log('⚠️  No changes were applied. Please check the input file.\n');
    }

  } catch (error) {
    console.error('❌ Error importing corrections:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get filename from command line
const filename = process.argv[2];

if (!filename) {
  console.error('❌ Error: Please provide the Grok output JSON file path');
  console.log('\nUsage: node scripts/import-grok-corrections.js <path-to-grok-output.json>');
  console.log('Example: node scripts/import-grok-corrections.js d:/grok-corrected-products.json\n');
  process.exit(1);
}

// Run import
importGrokCorrections(filename)
  .then(() => {
    console.log('✅ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
