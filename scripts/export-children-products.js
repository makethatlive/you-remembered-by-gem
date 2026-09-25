/**
 * Export Children Products Only for Age Band Correction
 * 
 * Only exports products with category containing "Children"
 * Uses specific age formats: 1-2, 3-4, 5-6, 7-8, 9-11
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function exportChildrenProducts() {
  console.log('🔍 Fetching Children products from database...\n');

  try {
    // Fetch products where category contains "Children" or "children" or "CHILDREN"
    const products = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT',
        status: 'ACTIVE',
        OR: [
          { category: { contains: 'Children', mode: 'insensitive' } },
          { category: { contains: 'Kids', mode: 'insensitive' } },
          { category: { contains: 'Baby', mode: 'insensitive' } },
          { category: { contains: 'Toddler', mode: 'insensitive' } },
          { interestTags: { has: 'Children & family activities' } }
        ]
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

    console.log(`✅ Found ${products.length} Children products\n`);

    if (products.length === 0) {
      console.log('⚠️  No children products found!');
      console.log('   Try checking if category field contains "Children" or related keywords.\n');
      return;
    }

    // Format for AI processing with children-specific age bands
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
      
      // Current values
      current_gender: product.genderAppliesTo || 'Not set',
      current_age_bands: product.suitableAgeBands || [],
      age_restricted: product.ageRestricted || false,
      
      // Additional context
      interest_tags: product.interestTags || [],
      gift_type_tags: product.giftTypeTags || [],
      
      // Placeholder for AI corrections (children-specific format)
      corrected_child_age_bands: [],  // Will be: ["1-2", "3-4", "5-6", "7-8", "9-11"]
      correction_reasoning: ''
    }));

    // Create export directory if not exists
    const exportDir = path.join(__dirname, '..', 'age-band-exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Save as JSON
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const jsonPath = path.join(exportDir, `children-products-for-age-correction-${timestamp}.json`);
    
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
    console.log(`✅ Exported to: ${jsonPath}\n`);

    // Also create CSV for manual review
    const csvPath = path.join(exportDir, `children-products-for-age-correction-${timestamp}.csv`);
    const csvHeader = 'ID,Index,Name,Category,Retailer,Price,Current Gender,Current Age Bands,Interest Tags\n';
    const csvRows = exportData.map(p => 
      `"${p.id}",${p.index},"${p.name}","${p.category}","${p.retailer}",${p.price},"${p.current_gender}","${p.current_age_bands.join('; ')}","${p.interest_tags.join('; ')}"`
    ).join('\n');
    
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`✅ CSV exported to: ${csvPath}\n`);

    // Statistics
    console.log('📊 Statistics:');
    console.log(`   Total children products: ${exportData.length}`);
    
    const genderStats = {};
    exportData.forEach(p => {
      const gender = p.current_gender;
      genderStats[gender] = (genderStats[gender] || 0) + 1;
    });
    
    console.log('\n   Gender Distribution:');
    Object.entries(genderStats).forEach(([gender, count]) => {
      console.log(`   - ${gender}: ${count} products`);
    });
    
    const categoryStats = {};
    exportData.forEach(p => {
      const cat = p.category || 'No category';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });
    
    console.log('\n   Category Distribution:');
    Object.entries(categoryStats).forEach(([cat, count]) => {
      console.log(`   - ${cat}: ${count} products`);
    });
    
    console.log('\n✅ Export complete! Ready for AI processing.');
    console.log('\n📝 Next Steps:');
    console.log('   1. Review the exported JSON file');
    console.log('   2. Send to AI for children age band corrections');
    console.log('   3. Run update-children-age-bands.js script to apply corrections\n');

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
exportChildrenProducts()
  .then(result => {
    console.log('🎉 Export successful!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Export failed:', error);
    process.exit(1);
  });
