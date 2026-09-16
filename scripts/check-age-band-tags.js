import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAgeBandTags() {
  try {
    console.log('🔍 Checking Age Band Tags for CURATED Products\n');

    // Check products in Devis's range
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        sourceType: 'CURATED_PRODUCT',
        price: { gte: 19, lte: 104 },
        genderAppliesTo: { in: ['MALE', 'MEN', 'UNISEX'] }
      },
      select: {
        id: true,
        name: true,
        suitableAgeBands: true,
        price: true
      },
      take: 100
    });

    console.log(`📦 Total products: ${products.length}\n`);

    // Count age band tags
    const ageBandCounts = {
      'ZERO_TO_10': 0,
      'ELEVEN_TO_17': 0,
      'EIGHTEEN_TO_30': 0,
      'THIRTY_ONE_TO_50': 0,
      'FIFTY_ONE_PLUS': 0,
      'NONE': 0
    };

    products.forEach(p => {
      if (!p.suitableAgeBands || p.suitableAgeBands.length === 0) {
        ageBandCounts['NONE']++;
      } else {
        p.suitableAgeBands.forEach(band => {
          if (ageBandCounts[band] !== undefined) {
            ageBandCounts[band]++;
          }
        });
      }
    });

    console.log('📊 Age Band Distribution:\n');
    Object.entries(ageBandCounts).forEach(([band, count]) => {
      const pct = ((count / products.length) * 100).toFixed(1);
      console.log(`  ${band}: ${count} (${pct}%)`);
    });

    // Show products suitable for 11-17
    const kidsProducts = products.filter(p => 
      p.suitableAgeBands && p.suitableAgeBands.includes('ELEVEN_TO_17')
    );

    console.log(`\n✅ Products suitable for ELEVEN_TO_17: ${kidsProducts.length}`);

    if (kidsProducts.length > 0) {
      console.log('\nSample:');
      kidsProducts.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   £${p.price} | Age bands: ${p.suitableAgeBands.join(', ')}`);
      });
    } else {
      console.log('\n❌ NO PRODUCTS for 11-17 year olds!');
      console.log('\nShowing adult products that will be sent:');
      products.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   £${p.price} | Age bands: ${p.suitableAgeBands?.join(', ') || 'NONE'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAgeBandTags();
