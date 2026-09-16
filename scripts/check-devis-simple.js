import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDevisSimple() {
  try {
    console.log('🔍 Checking Devis Product Matching\n');

    // Check ALL CURATED_PRODUCT in budget
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        sourceType: 'CURATED_PRODUCT',
        price: {
          gte: 19,   // £20 with -5%
          lte: 104   // £99 with +5%
        },
        genderAppliesTo: { 
          in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT'] 
        }
      },
      include: { retailer: true },
      take: 100
    });

    console.log(`📦 Found ${products.length} CURATED products in budget (£20-£99, MALE/UNISEX)\n`);

    if (products.length === 0) {
      console.log('❌ NO PRODUCTS FOUND!\n');
      
      // Check without gender filter
      const withoutGender = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          sourceType: 'CURATED_PRODUCT',
          price: { gte: 19, lte: 104 }
        },
        take: 10
      });
      
      console.log(`Without gender filter: ${withoutGender.length} products`);
      if (withoutGender.length > 0) {
        console.log('\nSample:');
        withoutGender.slice(0, 5).forEach(p => {
          console.log(`- ${p.name} | Gender: ${p.genderAppliesTo || 'NULL'}`);
        });
      }
      
      await prisma.$disconnect();
      return;
    }

    // Analyze products
    console.log('🔍 QUALITY ANALYSIS:\n');

    let goodQuality = 0;
    let badQuality = 0;
    let nullQuality = 0;
    let noDescription = 0;
    let noRetailer = 0;
    let inactiveRetailer = 0;

    products.forEach(p => {
      // Quality score
      if (p.qualityScore === null) {
        nullQuality++;
      } else if (p.qualityScore >= 50) {
        goodQuality++;
      } else {
        badQuality++;
      }

      // Description
      if (!p.description || p.description.length < 10) {
        noDescription++;
      }

      // Retailer
      if (!p.retailer) {
        noRetailer++;
      } else if (p.retailer.status !== 'ACTIVE') {
        inactiveRetailer++;
      }
    });

    console.log('Quality Score Distribution:');
    console.log(`  ✅ Good (≥50): ${goodQuality}`);
    console.log(`  ❌ Bad (<50): ${badQuality}`);
    console.log(`  ⚠️  Null: ${nullQuality}`);
    console.log(`  Total: ${products.length}\n`);

    console.log('Validation Issues:');
    console.log(`  Missing description: ${noDescription}`);
    console.log(`  No retailer: ${noRetailer}`);
    console.log(`  Inactive retailer: ${inactiveRetailer}\n`);

    // Show products that would PASS validation
    console.log('🔍 VALIDATION CHECK:\n');
    
    const validProducts = products.filter(p => {
      // From isValidProduct() logic
      if (!p.name || p.name.length < 3) return false;
      if (!p.price || p.price < 1) return false;
      if (!p.retailer || p.retailer.status !== 'ACTIVE') return false;
      
      // CURATED_PRODUCT can skip description (per your fix)
      if (p.sourceType !== 'CURATED_PRODUCT') {
        if (!p.description || p.description.length < 10) return false;
      }
      
      return true;
    });

    console.log(`Valid products (pass validation): ${validProducts.length}`);
    console.log(`Invalid products: ${products.length - validProducts.length}\n`);

    // Apply quality filter
    const afterQualityFilter = validProducts.filter(p => {
      if (p.qualityScore === null) return true; // null passes
      return p.qualityScore >= 50;
    });

    console.log(`After qualityScore ≥50 filter: ${afterQualityFilter.length}`);
    console.log(`Filtered out: ${validProducts.length - afterQualityFilter.length}\n`);

    if (afterQualityFilter.length === 0) {
      console.log('❌ ALL PRODUCTS FILTERED OUT!\n');
      console.log('Showing why first 10 products were filtered:\n');
      
      products.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   Price: £${p.price}`);
        console.log(`   Quality: ${p.qualityScore || 'NULL'}`);
        console.log(`   Description: ${p.description ? `YES (${p.description.length} chars)` : 'NO'}`);
        console.log(`   Retailer: ${p.retailer?.name || 'NULL'} (${p.retailer?.status || 'N/A'})`);
        
        // Check validation
        const issues = [];
        if (!p.name || p.name.length < 3) issues.push('Name too short');
        if (!p.price || p.price < 1) issues.push('Invalid price');
        if (!p.retailer) issues.push('No retailer');
        else if (p.retailer.status !== 'ACTIVE') issues.push('Inactive retailer');
        if (p.sourceType !== 'CURATED_PRODUCT' && (!p.description || p.description.length < 10)) {
          issues.push('No description');
        }
        if (p.qualityScore !== null && p.qualityScore < 50) issues.push('Low quality score');
        
        if (issues.length > 0) {
          console.log(`   ❌ Issues: ${issues.join(', ')}`);
        } else {
          console.log(`   ✅ Should pass`);
        }
        console.log('');
      });
    } else {
      console.log(`✅ ${afterQualityFilter.length} products available for AI!\n`);
      console.log('Top 5:');
      afterQualityFilter.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   £${p.price} | Quality: ${p.qualityScore || 'NULL'} | ${p.retailer?.name}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDevisSimple();
