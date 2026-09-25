/**
 * Export Gem's Curated Products for Age Band Correction
 * 
 * Exports all CURATED_PRODUCT items to JSON for AI processing
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function exportGemsProducts() {
  console.log('🔍 Fetching Gem\'s curated products from database...\n');

  try {
    // Fetch all CURATED_PRODUCT items (Gem's hand-picked products)
    const products = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT',
        status: 'ACTIVE'
      },
      include: {
        retailer: {
          select: {
            name: true,
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`✅ Found ${products.length} Gem's curated products\n`);

    // Format for AI processing
    const exportData = products.map((product, index) => ({
      // Core identifiers
      id: product.id,
      index: index + 1,
      
      // Product details for AI
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      retailer: product.retailer?.name || 'Unknown',
      price: Number(product.price),
      
      // Current values (to be corrected)
      current_gender: product.genderAppliesTo || 'Not set',
      current_age_bands: product.suitableAgeBands || [],
      age_restricted: product.ageRestricted || false,
      
      // Additional context
      interest_tags: product.interestTags || [],
      gift_type_tags: product.giftTypeTags || [],
      
      // Placeholder for AI corrections
      corrected_age_bands: [],
      correction_reasoning: ''
    }));

    // Create export directory if not exists
    const exportDir = path.join(__dirname, '..', 'age-band-exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Save as JSON
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const jsonPath = path.join(exportDir, `gems-products-for-age-correction-${timestamp}.json`);
    
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
    console.log(`✅ Exported to: ${jsonPath}\n`);

    // Also create CSV for manual review
    const csvPath = path.join(exportDir, `gems-products-for-age-correction-${timestamp}.csv`);
    const csvHeader = 'ID,Index,Name,Category,Retailer,Price,Current Gender,Current Age Bands,Age Restricted,Interest Tags\n';
    const csvRows = exportData.map(p => 
      `"${p.id}",${p.index},"${p.name}","${p.category}","${p.retailer}",${p.price},"${p.current_gender}","${p.current_age_bands.join('; ')}",${p.age_restricted},"${p.interest_tags.join('; ')}"`
    ).join('\n');
    
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`✅ CSV exported to: ${csvPath}\n`);

    // Statistics
    console.log('📊 Statistics:');
    console.log(`   Total products: ${exportData.length}`);
    
    const genderStats = {};
    exportData.forEach(p => {
      const gender = p.current_gender;
      genderStats[gender] = (genderStats[gender] || 0) + 1;
    });
    
    console.log('\n   Gender Distribution:');
    Object.entries(genderStats).forEach(([gender, count]) => {
      console.log(`   - ${gender}: ${count} products`);
    });
    
    const ageBandStats = {};
    exportData.forEach(p => {
      p.current_age_bands.forEach(band => {
        ageBandStats[band] = (ageBandStats[band] || 0) + 1;
      });
    });
    
    console.log('\n   Age Band Distribution:');
    if (Object.keys(ageBandStats).length === 0) {
      console.log('   ⚠️  No age bands currently set!');
    } else {
      Object.entries(ageBandStats).forEach(([band, count]) => {
        console.log(`   - ${band}: ${count} products`);
      });
    }
    
    const ageRestrictedCount = exportData.filter(p => p.age_restricted).length;
    console.log(`\n   Age Restricted: ${ageRestrictedCount} products`);
    
    console.log('\n✅ Export complete! Ready for AI processing.');
    console.log('\n📝 Next Steps:');
    console.log('   1. Review the exported JSON file');
    console.log('   2. Send to AI for age band corrections');
    console.log('   3. Run update-age-bands.js script to apply corrections\n');

    return {
      jsonPath,
      csvPath,
      totalProducts: exportData.length
    };

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run export
exportGemsProducts()
  .then(result => {
    console.log('🎉 Export successful!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Export failed:', error);
    process.exit(1);
  });
