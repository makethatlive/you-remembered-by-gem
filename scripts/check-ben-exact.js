import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBenExact() {
  const budgetMin = 50;
  const budgetMax = 150;
  const budgetMinWithMargin = budgetMin * 0.95; // 47.5
  const budgetMaxWithMargin = budgetMax * 1.05; // 157.5
  
  console.log('\n📊 CHECKING WITH BEN\'S EXACT FILTERS\n');
  console.log(`Budget: £${budgetMin}-£${budgetMax} (with margin: £${budgetMinWithMargin}-£${budgetMaxWithMargin})`);
  console.log('Gender: MALE');
  console.log('Interests: Cooking & food, Watches, DIY & tools, Gardening, Tech & gadgets\n');
  
  // TIER 1: Curated + Interest match
  console.log('═══ TIER 1: CURATED + INTEREST MATCH ═══\n');
  
  const tier1Where = {
    status: 'ACTIVE',
    sourceType: 'CURATED_PRODUCT',
    price: {
      gte: budgetMinWithMargin,
      lte: budgetMaxWithMargin,
    },
    genderAppliesTo: { 
      in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT'] 
    },
    OR: [
      { qualityScore: { gte: 50 } },
      { qualityScore: null }
    ]
  };
  
  const tier1All = await prisma.product.findMany({
    where: tier1Where,
    select: {
      name: true,
      price: true,
      genderAppliesTo: true,
      interestTags: true,
      qualityScore: true
    }
  });
  
  console.log(`Found ${tier1All.length} curated products matching gender/budget/quality\n`);
  
  // Show ALL tier1 products before filtering
  if (tier1All.length > 0) {
    console.log('All Tier 1 products BEFORE interest filter:');
    tier1All.forEach(p => {
      console.log(`  - ${p.name}`);
      console.log(`    Price: £${p.price}, Gender: ${p.genderAppliesTo}`);
      console.log(`    Interests: ${JSON.stringify(p.interestTags)}\n`);
    });
  }
  
  // Filter for interests (case-insensitive)
  const benInterests = ['cooking & food', 'watches', 'diy & tools', 'gardening', 'tech & gadgets'];
  const tier1WithInterest = tier1All.filter(p => {
    const productTags = (p.interestTags || []).map(t => t.toLowerCase());
    const hasMatch = productTags.some(tag => benInterests.includes(tag));
    
    if (hasMatch) {
      console.log(`✅ MATCH: ${p.name}`);
      console.log(`   Product tags: ${productTags}`);
      console.log(`   Matched with: ${benInterests.filter(bi => productTags.includes(bi))}\n`);
    }
    
    return hasMatch;
  });
  
  console.log(`After interest filter: ${tier1WithInterest.length} products\n`);
  
  if (tier1WithInterest.length > 0) {
    console.log('Sample Tier 1 products:');
    tier1WithInterest.slice(0, 5).forEach(p => {
      console.log(`  - ${p.name}`);
      console.log(`    Price: £${p.price}, Gender: ${p.genderAppliesTo}`);
      console.log(`    Interests: ${p.interestTags?.join(', ')}\n`);
    });
  } else {
    console.log('❌ NO Tier 1 products found!\n');
    
    // Debug: Show what curated products exist
    console.log('Debugging: What curated products DO exist?');
    const curatedSample = await prisma.product.findMany({
      where: { 
        status: 'ACTIVE',
        sourceType: 'CURATED_PRODUCT' 
      },
      select: {
        name: true,
        price: true,
        genderAppliesTo: true,
        interestTags: true
      },
      take: 10
    });
    console.log(`\nSample of ${curatedSample.length} curated products (any gender/price):`);
    curatedSample.forEach(p => {
      console.log(`  - ${p.name} (£${p.price}, ${p.genderAppliesTo})`);
      console.log(`    Interests: ${p.interestTags?.join(', ') || 'None'}\n`);
    });
  }
  
  // TIER 2: Scraped + Interest match
  console.log('\n═══ TIER 2: SCRAPED + INTEREST MATCH ═══\n');
  
  const tier2Where = {
    status: 'ACTIVE',
    sourceType: { in: ['CURATED_RETAILER', 'SHOPIFY_UPLOAD', 'LEGACY_UNKNOWN'] },
    price: {
      gte: budgetMinWithMargin,
      lte: budgetMaxWithMargin,
    },
    genderAppliesTo: { 
      in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT'] 
    },
    OR: [
      { qualityScore: { gte: 50 } },
      { qualityScore: null }
    ]
  };
  
  const tier2All = await prisma.product.findMany({
    where: tier2Where,
    select: {
      name: true,
      price: true,
      genderAppliesTo: true,
      interestTags: true,
      sourceType: true
    }
  });
  
  console.log(`Found ${tier2All.length} scraped products matching gender/budget/quality\n`);
  
  const tier2WithInterest = tier2All.filter(p => {
    const productTags = (p.interestTags || []).map(t => t.toLowerCase());
    return productTags.some(tag => benInterests.includes(tag));
  });
  
  console.log(`After interest filter: ${tier2WithInterest.length} products\n`);
  
  if (tier2WithInterest.length > 0) {
    console.log('Sample Tier 2 products:');
    tier2WithInterest.slice(0, 5).forEach(p => {
      console.log(`  - ${p.name}`);
      console.log(`    Price: £${p.price}, Gender: ${p.genderAppliesTo}, Source: ${p.sourceType}`);
      console.log(`    Interests: ${p.interestTags?.join(', ')}\n`);
    });
  } else {
    console.log('❌ NO Tier 2 products found!\n');
  }
  
  await prisma.$disconnect();
}

checkBenExact().catch(console.error);
