import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugDevisProducts() {
  try {
    console.log('🔍 Debugging Devis Product Matching\n');

    // Get Devis recipient
    const recipient = await prisma.recipient.findFirst({
      where: { name: 'Devis' },
      include: { subscriber: true }
    });

    if (!recipient) {
      console.log('❌ Devis not found');
      return;
    }

    console.log('✅ Found recipient: Devis');
    console.log(`   Gender: ${recipient.gender}`);
    console.log(`   Age Band: ${recipient.ageBand}`);
    console.log(`   Budget: £${recipient.budgetMin}-£${recipient.budgetMax}`);
    console.log(`   Interests: ${recipient.interests.join(', ') || 'None'}\n`);

    // Check TIER 1 products
    const budgetMin = recipient.budgetMin * 0.95;
    const budgetMax = recipient.budgetMax * 1.05;

    const tier1Products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        sourceType: 'CURATED_PRODUCT',
        price: {
          gte: budgetMin,
          lte: budgetMax
        },
        OR: [
          { genderTags: { has: 'MALE' } },
          { genderTags: { has: 'Male' } },
          { genderTags: { has: 'MEN' } },
          { genderTags: { has: 'Men' } },
          { genderTags: { has: 'UNISEX' } },
          { genderTags: { has: 'Unisex' } },
          { genderTags: { has: 'UNISEX_ADULT' } }
        ],
        ageBandTags: { has: 'ELEVEN_TO_17' }
      },
      include: { retailer: true },
      take: 100
    });

    console.log(`📦 TIER 1 PRODUCTS: ${tier1Products.length} found\n`);

    if (tier1Products.length > 0) {
      console.log('🔍 Checking quality scores:\n');
      
      let goodQuality = 0;
      let badQuality = 0;
      let nullQuality = 0;
      
      tier1Products.forEach((p, i) => {
        if (i < 10) {
          console.log(`${i + 1}. ${p.name}`);
          console.log(`   Price: £${p.price} | Quality: ${p.qualityScore || 'null'}`);
          console.log(`   Description: ${p.description ? 'YES' : 'NO'} (${p.description?.length || 0} chars)`);
          console.log(`   Image: ${p.imageUrl ? 'YES' : 'NO'}`);
        }
        
        if (p.qualityScore === null) {
          nullQuality++;
        } else if (p.qualityScore >= 50) {
          goodQuality++;
        } else {
          badQuality++;
        }
      });

      console.log(`\n📊 QUALITY BREAKDOWN:`);
      console.log(`   Good (≥50): ${goodQuality}`);
      console.log(`   Bad (<50): ${badQuality}`);
      console.log(`   Null: ${nullQuality}`);
      console.log(`   Total: ${tier1Products.length}`);

      // Check for missing descriptions (CURATED_PRODUCT should be allowed)
      const noDescription = tier1Products.filter(p => !p.description || p.description.length < 10);
      console.log(`\n⚠️  Missing descriptions: ${noDescription.length}`);
      
      if (noDescription.length > 0) {
        console.log('\nSample products without description:');
        noDescription.slice(0, 5).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.name} (${p.sourceType})`);
        });
      }

      // Check validation logic
      console.log('\n🔍 VALIDATION CHECK:');
      const validProducts = tier1Products.filter(p => {
        // From isValidProduct() logic
        if (!p.name || p.name.length < 3) return false;
        if (!p.price || p.price < 1) return false;
        if (!p.retailer || p.retailer.status !== 'ACTIVE') return false;
        
        // CURATED_PRODUCT can skip description check
        if (p.sourceType !== 'CURATED_PRODUCT') {
          if (!p.description || p.description.length < 10) return false;
        }
        
        return true;
      });

      console.log(`   Valid products (passed validation): ${validProducts.length}`);
      console.log(`   Invalid products: ${tier1Products.length - validProducts.length}`);

      // Check scoring
      console.log('\n🔍 QUALITY SCORE FILTER (≥50):');
      const scoredProducts = validProducts.filter(p => {
        if (p.qualityScore === null) return true; // null passes
        return p.qualityScore >= 50;
      });
      
      console.log(`   After qualityScore filter: ${scoredProducts.length}`);
      console.log(`   Filtered out: ${validProducts.length - scoredProducts.length}`);

    } else {
      console.log('❌ No products found in TIER 1!');
      console.log('\nChecking without age band filter...\n');

      const withoutAge = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          sourceType: 'CURATED_PRODUCT',
          price: { gte: budgetMin, lte: budgetMax },
          OR: [
            { genderTags: { has: 'MALE' } },
            { genderTags: { has: 'UNISEX' } }
          ]
        },
        take: 10
      });

      console.log(`   Without age filter: ${withoutAge.length} products`);
      
      if (withoutAge.length > 0) {
        console.log('\n⚠️  ISSUE: Products exist but missing ELEVEN_TO_17 age tag!');
        console.log('\nSample products:');
        withoutAge.slice(0, 5).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.name}`);
          console.log(`      Age Tags: ${p.ageBandTags?.join(', ') || 'None'}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

debugDevisProducts();
