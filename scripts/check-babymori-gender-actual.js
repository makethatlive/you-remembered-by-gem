import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGenderValues() {
  try {
    console.log('🔍 Checking babymori Gender Values\n');

    const retailer = await prisma.retailer.findFirst({
      where: { name: { contains: 'babymori', mode: 'insensitive' } }
    });

    if (!retailer) {
      console.log('❌ Not found');
      return;
    }

    // Get all unique gender values
    const products = await prisma.product.findMany({
      where: {
        retailerId: retailer.id,
        status: 'ACTIVE'
      },
      select: {
        genderAppliesTo: true,
        name: true,
        price: true
      },
      take: 200
    });

    console.log(`Total active products: ${products.length}\n`);

    // Group by gender
    const genderCounts = {};
    products.forEach(p => {
      const gender = p.genderAppliesTo || 'NULL';
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;
    });

    console.log('Gender distribution:');
    Object.entries(genderCounts).forEach(([gender, count]) => {
      console.log(`  ${gender}: ${count}`);
    });

    // Show sample products
    console.log('\nSample products:');
    products.slice(0, 10).forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   £${p.price} | Gender: ${p.genderAppliesTo || 'NULL'}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkGenderValues();
