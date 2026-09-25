/**
 * Show what products WOULD be available for Alexa without budget filter
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('\n🔍 ===== PRODUCTS AVAILABLE FOR ALEXA (ignoring budget) =====\n');

  // Products suitable for Alexa (age 7-8, Female, Children category)
  const products = await prisma.product.findMany({
    where: {
      sourceType: 'CURATED_PRODUCT',
      category: { startsWith: 'Children' },
      status: 'ACTIVE',
      suitableAgeBands: { has: '7-8' }
    },
    select: {
      name: true,
      price: true,
      genderAppliesTo: true,
      suitableAgeBands: true
    },
    orderBy: { price: 'asc' }
  });

  // Filter for Female or Unisex (case-insensitive)
  const suitable = products.filter(p => {
    const g = (p.genderAppliesTo || '').toUpperCase();
    return g === 'FEMALE' || g === 'UNISEX';
  });

  console.log(`📦 Total products for age 7-8 (Female/Unisex): ${suitable.length}\n`);

  // Group by price ranges
  const ranges = {
    'Under £20': suitable.filter(p => p.price < 20),
    '£20-£50': suitable.filter(p => p.price >= 20 && p.price < 50),
    '£50-£100': suitable.filter(p => p.price >= 50 && p.price < 100),
    '£100-£200': suitable.filter(p => p.price >= 100 && p.price < 200),
    '£200+': suitable.filter(p => p.price >= 200)
  };

  console.log('📊 Price Distribution:');
  Object.entries(ranges).forEach(([range, prods]) => {
    console.log(`   ${range}: ${prods.length} products`);
  });

  console.log(`\n\n🎯 Alexa's Budget: £100-£500`);
  console.log(`   Products in range: ${ranges['£100-£200'].length + ranges['£200+'].length}\n`);

  if (ranges['£100-£200'].length + ranges['£200+'].length > 0) {
    console.log('Products in Alexa\'s budget:');
    [...ranges['£100-£200'], ...ranges['£200+']].forEach((p, i) => {
      console.log(`${i+1}. ${p.name}`);
      console.log(`   £${p.price} | ${p.genderAppliesTo}\n`);
    });
  } else {
    console.log('❌ NO PRODUCTS IN ALEXA\'S BUDGET RANGE!\n');
  }

  console.log('\n💡 RECOMMENDATION:');
  console.log('   Most children\'s products are priced £6-£80.');
  console.log('   Alexa\'s budget (£100-£500) is too high for typical children\'s gifts.');
  console.log('   \n   Suggested budget ranges:');
  console.log('   - Standard: £10-£50');
  console.log('   - Premium: £20-£100');
  console.log('   - Luxury: £50-£150\n');

  console.log('==========================================\n');

  await prisma.$disconnect();
}

check().catch(console.error);
