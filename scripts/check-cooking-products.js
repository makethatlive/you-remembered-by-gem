import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCookingProducts() {
  const products = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      sourceType: 'CURATED_PRODUCT',
      interestTags: { has: 'Cooking & food' },
      price: {
        gte: 47.5,
        lte: 157.5
      }
    },
    select: {
      name: true,
      price: true,
      qualityScore: true,
      genderAppliesTo: true,
      sourceType: true,
      interestTags: true
    },
    orderBy: { qualityScore: 'desc' }
  });
  
  console.log('\n📊 Curated "Cooking & food" products in Ben\'s budget (£47.5-£157.5):\n');
  console.log(`Found: ${products.length} products\n`);
  
  products.forEach(p => {
    console.log(`- ${p.name}`);
    console.log(`  Price: £${p.price}`);
    console.log(`  Gender: ${p.genderAppliesTo}`);
    console.log(`  Quality Score: ${p.qualityScore}`);
    console.log(`  Interests: ${p.interestTags?.join(', ')}\n`);
  });
  
  await prisma.$disconnect();
}

checkCookingProducts().catch(console.error);
