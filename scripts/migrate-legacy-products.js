import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Migrate LEGACY_UNKNOWN products to proper sourceType
 * 
 * Logic:
 * - If product was manually added (has certain characteristics) → CURATED_PRODUCT
 * - Otherwise → CURATED_RETAILER (default for old scraped products)
 */
async function migrateLegacyProducts() {
  try {
    console.log('🔄 Starting LEGACY_UNKNOWN product migration...\n');

    // Count total LEGACY products first
    const totalCount = await prisma.product.count({
      where: { sourceType: 'LEGACY_UNKNOWN' }
    });

    console.log(`📊 Found ${totalCount} LEGACY_UNKNOWN products\n`);

    if (totalCount === 0) {
      console.log('✅ No LEGACY_UNKNOWN products to migrate!');
      return;
    }

    let migratedToCurated = 0;
    let migratedToRetailer = 0;
    let errors = 0;
    let processed = 0;

    const BATCH_SIZE = 50; // Process 50 products at a time
    const totalBatches = Math.ceil(totalCount / BATCH_SIZE);

    console.log(`📦 Processing in ${totalBatches} batches of ${BATCH_SIZE} products each\n`);

    // Process in batches to avoid timeout
    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      console.log(`\n🔄 Processing batch ${batchNum + 1}/${totalBatches}...`);

      const legacyProducts = await prisma.product.findMany({
        where: { sourceType: 'LEGACY_UNKNOWN' },
        take: BATCH_SIZE,
        include: { retailer: true }
      });

      for (const product of legacyProducts) {
        try {
          // Decide new sourceType based on product characteristics
          let newSourceType;

          // Heuristic: Products with high quality score and good data are likely curated
          if (
            product.qualityScore >= 80 &&
            product.description &&
            product.description.length > 100 &&
            product.interestTags?.length > 0
          ) {
            newSourceType = 'CURATED_PRODUCT';
            migratedToCurated++;
          } else {
            // Default: Assume old scraped products
            newSourceType = 'CURATED_RETAILER';
            migratedToRetailer++;
          }

          // Update the product
          await prisma.product.update({
            where: { id: product.id },
            data: { sourceType: newSourceType }
          });

          processed++;
          
          // Show progress every 10 products
          if (processed % 10 === 0) {
            console.log(`   ✓ Progress: ${processed}/${totalCount} (${Math.round(processed/totalCount*100)}%)`);
          }
        } catch (error) {
          console.error(`   ✗ Error updating ${product.name}:`, error.message);
          errors++;
        }
      }

      console.log(`✅ Batch ${batchNum + 1} complete`);
    }

    console.log('\n\n📊 MIGRATION COMPLETE:');
    console.log(`   ✅ Migrated to CURATED_PRODUCT: ${migratedToCurated}`);
    console.log(`   ✅ Migrated to CURATED_RETAILER: ${migratedToRetailer}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📦 Total processed: ${processed}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateLegacyProducts()
  .then(() => {
    console.log('\n✅ Migration script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
