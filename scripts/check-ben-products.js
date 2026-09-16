import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBenProducts() {
  console.log('\n📊 CHECKING PRODUCTS WITH BEN\'S INTERESTS\n');
  console.log('Ben\'s Interests: Cooking & food, Watches, DIY & tools, Gardening, Tech & gadgets\n');
  
  // Get all active products
  const allProducts = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      price: true,
      status: true,
      sourceType: true,
      interestTags: true,
      genderAppliesTo: true,
      suitableAgeBands: true
    }
  });
  
  console.log('Total ACTIVE products:', allProducts.length);
  
  // Filter for Ben's interests
  const benInterests = ['Cooking & food', 'Watches', 'DIY & tools', 'Gardening', 'Tech & gadgets'];
  
  const withInterests = allProducts.filter(p => 
    p.interestTags && p.interestTags.some(tag => benInterests.includes(tag))
  );
  
  console.log('Products with Ben\'s interests:', withInterests.length, '\n');
  
  // Group by interest
  benInterests.forEach(interest => {
    const matching = allProducts.filter(p => p.interestTags?.includes(interest));
    console.log(`  ${interest}: ${matching.length} products`);
    if (matching.length > 0 && matching.length <= 5) {
      matching.forEach(p => {
        console.log(`    - ${p.name} (£${p.price}) - Gender: ${p.genderAppliesTo}, Age: ${p.suitableAgeBands?.join(', ')}`);
      });
    }
  });
  
  console.log('\n🔍 CHECKING MALE FILTER\n');
  
  const maleProducts = allProducts.filter(p => {
    const gender = p.genderAppliesTo || '';
    return ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT'].some(g => gender.includes(g));
  });
  
  console.log('Products suitable for MALE:', maleProducts.length);
  
  const maleWithInterests = maleProducts.filter(p => 
    p.interestTags && p.interestTags.some(tag => benInterests.includes(tag))
  );
  
  console.log('MALE products with Ben\'s interests:', maleWithInterests.length, '\n');
  
  if (maleWithInterests.length > 0) {
    console.log('Sample MALE products with interests:');
    maleWithInterests.slice(0, 10).forEach(p => {
      console.log(`  - ${p.name}`);
      console.log(`    Interests: ${p.interestTags?.join(', ')}`);
      console.log(`    Gender: ${p.genderAppliesTo}`);
      console.log(`    Price: £${p.price}\n`);
    });
  } else {
    console.log('❌ NO MALE products found with Ben\'s interests!\n');
    
    console.log('Checking what interests exist for MALE products:');
    const allMaleInterests = new Set();
    maleProducts.forEach(p => {
      if (p.interestTags) {
        p.interestTags.forEach(tag => allMaleInterests.add(tag));
      }
    });
    console.log('Available interests for MALE products:', Array.from(allMaleInterests).join(', '));
  }
  
  await prisma.$disconnect();
}

checkBenProducts().catch(console.error);
