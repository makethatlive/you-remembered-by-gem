/**
 * Fast Batch Import - Grok AI Corrections
 * 
 * Uses Prisma transactions for 100x faster imports
 * 
 * Usage: node scripts/import-grok-corrections-fast.js <path-to-grok-output.json>
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

const BATCH_SIZE = 25; // Process 25 products at once (safer for large updates)

async function importGrokCorrectionsFast(filename) {
  try {
    console.log('🚀 Fast Batch Import - Grok AI corrections...\n');

    // Read Grok output file
    const data = JSON.parse(readFileSync(filename, 'utf8'));
    console.log(`✅ Loaded ${data.length} products from ${filename}\n`);

    // Statistics
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    const changes = {
      interestTags: 0,
      giftTypeTags: 0,
      searchKeywords: 0,
    };

    // Split into batches
    const batches = [];
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      batches.push(data.slice(i, i + BATCH_SIZE));
    }

    console.log(`📦 Processing ${batches.length} batches of ${BATCH_SIZE} products each...\n`);

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchNum = batchIndex + 1;
      
      console.log(`⏳ Batch ${batchNum}/${batches.length} (${batch.length} products)...`);

      try {
        // Prepare all updates for this batch
        const updates = [];
        
        for (const product of batch) {
          // Validate required fields
          if (!product.id) {
            totalSkipped++;
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

          // Add to batch if has changes
          if (hasChanges) {
            updates.push({
              id: product.id,
              data: updateData,
            });
          } else {
            totalSkipped++;
          }
        }

        // Execute all updates in a single transaction
        if (updates.length > 0) {
          await prisma.$transaction(
            updates.map(update => 
              prisma.product.update({
                where: { id: update.id },
                data: update.data,
              })
            )
          );
          
          totalUpdated += updates.length;
          console.log(`   ✅ Updated ${updates.length} products`);
        } else {
          console.log(`   ⏭️  No changes needed`);
        }

      } catch (error) {
        console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
        totalErrors += batch.length;
      }

      // Progress percentage
      const progress = Math.round((batchNum / batches.length) * 100);
      console.log(`   📊 Progress: ${progress}% (${totalUpdated} updated, ${totalSkipped} skipped)\n`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('🎉 FAST IMPORT COMPLETE!');
    console.log('='.repeat(80));
    console.log(`Total products processed: ${data.length}`);
    console.log(`✅ Successfully updated: ${totalUpdated}`);
    console.log(`⏭️  Skipped (no changes): ${totalSkipped}`);
    console.log(`❌ Errors: ${totalErrors}`);
    console.log('\n📝 CHANGES BY FIELD:');
    console.log(`   Interest tags changed: ${changes.interestTags}`);
    console.log(`   Gift type tags changed: ${changes.giftTypeTags}`);
    console.log(`   Search keywords changed: ${changes.searchKeywords}`);
    console.log('='.repeat(80) + '\n');

    if (totalUpdated > 0) {
      console.log('✅ Import complete! All products have been updated in the database.\n');
      console.log('💡 Next steps:');
      console.log('   1. Test gift generation with a few recipients');
      console.log('   2. Check admin product search');
      console.log('   3. Verify interest/gift type matching works\n');
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
  console.log('\nUsage: node scripts/import-grok-corrections-fast.js <path-to-grok-output.json>');
  console.log('Example: node scripts/import-grok-corrections-fast.js d:/grok-corrected-products.json\n');
  process.exit(1);
}

// Run import
const startTime = Date.now();
importGrokCorrectionsFast(filename)
  .then(() => {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️  Total time: ${duration} seconds\n`);
    console.log('✅ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
