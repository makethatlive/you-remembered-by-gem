import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGenderData() {
  const products = await prisma.product.findMany({
    where: { 
      status: 'ACTIVE',
      interestTags: { has: 'Cooking & food' }
    },
    select: { 
      name: true, 
      genderAppliesTo: true,
      price: true
    },
    take: 20
  });
  
  console.log('\n📊 Sample ACTIVE products with "Cooking & food":\n');
  products.forEach(p => {
    console.log(`- ${p.name}`);
    console.log(`  Gender: '${p.genderAppliesTo}'`);
    console.log(`  Price: £${p.price}\n`);
  });
  
  // Check unique gender values
  const allProducts = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: { genderAppliesTo: true },
    distinct: ['genderAppliesTo']
  });
  
  console.log('All unique gender values in database:');
  allProducts.forEach(p => console.log(`  - '${p.genderAppliesTo}'`));
  
  await prisma.$disconnect();
}

checkGenderData().catch(console.error);
