import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRetailerStatus() {
  try {
    console.log('🔍 Checking Retailer Status\n');

    const retailers = await prisma.retailer.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    console.log(`📊 Total Retailers: ${retailers.length}\n`);

    const statusCounts = {
      ACTIVE: 0,
      INACTIVE: 0,
      NEEDS_REVIEW: 0,
      NULL_OR_UNDEFINED: 0
    };

    retailers.forEach(r => {
      if (r.status === 'ACTIVE') statusCounts.ACTIVE++;
      else if (r.status === 'INACTIVE') statusCounts.INACTIVE++;
      else if (r.status === 'NEEDS_REVIEW') statusCounts.NEEDS_REVIEW++;
      else statusCounts.NULL_OR_UNDEFINED++;
    });

    console.log('Status Distribution:');
    console.log(`  ✅ ACTIVE: ${statusCounts.ACTIVE}`);
    console.log(`  ❌ INACTIVE: ${statusCounts.INACTIVE}`);
    console.log(`  ⚠️  NEEDS_REVIEW: ${statusCounts.NEEDS_REVIEW}`);
    console.log(`  ❓ NULL/UNDEFINED: ${statusCounts.NULL_OR_UNDEFINED}\n`);

    // Show retailers with products
    const withProducts = retailers.filter(r => r._count.products > 0);
    console.log(`Retailers with products: ${withProducts.length}\n`);

    console.log('Top 10 retailers by product count:');
    withProducts
      .sort((a, b) => b._count.products - a._count.products)
      .slice(0, 10)
      .forEach((r, i) => {
        console.log(`${i + 1}. ${r.name}`);
        console.log(`   Status: ${r.status || 'NULL'}`);
        console.log(`   Products: ${r._count.products}`);
        console.log(`   Type: ${r.sourceType || 'NULL'}\n`);
      });

    // Check specifically for retailers in Devis's budget
    console.log('Retailers with products in £20-£99 range (CURATED):');
    const productsInRange = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        sourceType: 'CURATED_PRODUCT',
        price: { gte: 19, lte: 104 },
        genderAppliesTo: { in: ['MALE', 'MEN', 'UNISEX'] }
      },
      include: { retailer: true },
      take: 20
    });

    const uniqueRetailers = [...new Map(productsInRange.map(p => [p.retailer.id, p.retailer])).values()];
    console.log(`\n  Found ${uniqueRetailers.length} unique retailers\n`);

    uniqueRetailers.forEach((r, i) => {
      console.log(`${i + 1}. ${r.name}`);
      console.log(`   Status: ${r.status || 'NULL'}`);
      console.log(`   Source: ${r.sourceType || 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRetailerStatus();
