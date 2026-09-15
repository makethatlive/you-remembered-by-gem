import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

/**
 * Export LEGACY_UNKNOWN products to CSV for manual review
 * Admin can then decide proper sourceType for each
 */
async function exportLegacyProducts() {
  try {
    console.log('📤 Exporting LEGACY_UNKNOWN products for review...\n');

    const legacyProducts = await prisma.product.findMany({
      where: {
        sourceType: 'LEGACY_UNKNOWN'
      },
      include: {
        retailer: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`Found ${legacyProducts.length} LEGACY_UNKNOWN products\n`);

    if (legacyProducts.length === 0) {
      console.log('✅ No LEGACY_UNKNOWN products found!');
      return;
    }

    // Create CSV header
    const csvRows = [];
    csvRows.push([
      'Product ID',
      'Name',
      'Retailer',
      'Price',
      'Quality Score',
      'Status',
      'Interest Tags',
      'Description Length',
      'Current sourceType',
      'Suggested sourceType',
      'Reason'
    ].join(','));

    // Process each product
    for (const product of legacyProducts) {
      // Suggest sourceType based on heuristics
      let suggested = 'CURATED_RETAILER';
      let reason = 'Default: Old scraped product';

      if (product.qualityScore >= 80 && product.description?.length > 100) {
        suggested = 'CURATED_PRODUCT';
        reason = 'High quality, likely manually curated';
      } else if (product.qualityScore < 50) {
        suggested = 'SHOPIFY_UPLOAD';
        reason = 'Low quality, likely auto-scraped';
      }

      const row = [
        product.id,
        `"${product.name}"`,
        `"${product.retailer?.name || 'N/A'}"`,
        product.price,
        product.qualityScore || 0,
        product.status,
        `"${product.interestTags?.join('; ') || 'None'}"`,
        product.description?.length || 0,
        product.sourceType,
        suggested,
        `"${reason}"`
      ].join(',');

      csvRows.push(row);
    }

    // Write to file
    const outputPath = path.join(__dirname, '../legacy-products-review.csv');
    fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf-8');

    console.log(`✅ Exported to: ${outputPath}`);
    console.log(`📊 Total products: ${legacyProducts.length}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Open legacy-products-review.csv');
    console.log('   2. Review "Suggested sourceType" column');
    console.log('   3. Edit if needed');
    console.log('   4. Run import script to apply changes');

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run export
exportLegacyProducts()
  .then(() => {
    console.log('\n✅ Export completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  });
