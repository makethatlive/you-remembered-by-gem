/**
 * Check products for Aadornattire retailer
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProducts() {
  try {
    // Find the retailer
    const retailer = await prisma.retailer.findUnique({
      where: { id: 'cmtsi4gtx0000axfsmych0wj2' }
    });

    if (!retailer) {
      console.log('❌ Retailer not found');
      return;
    }

    console.log('\n🏪 Retailer:', retailer.name);
    console.log('   ID:', retailer.id);
    console.log('   Last Scrape:', retailer.lastScrapeAt);
    console.log('   Products Found:', retailer.lastScrapeProductsFound);
    console.log('   Status:', retailer.lastScrapeStatus);

    // Get products for this retailer
    const products = await prisma.product.findMany({
      where: {
        retailerId: retailer.id
      },
      orderBy: {
        addedDate: 'desc'
      },
      take: 10,
      select: {
        id: true,
        name: true,
        status: true,
        price: true,
        addedDate: true,
        sourceType: true,
      }
    });

    console.log(`\n📦 Found ${products.length} products in database for this retailer`);

    if (products.length > 0) {
      console.log('\n📋 Recent products:');
      for (const product of products) {
        console.log(`\n   ${product.name}`);
        console.log(`   - ID: ${product.id}`);
        console.log(`   - Status: ${product.status}`);
        console.log(`   - Price: ${product.price ? `£${product.price}` : 'N/A'}`);
        console.log(`   - Source: ${product.sourceType}`);
        console.log(`   - Added: ${product.addedDate?.toISOString() || 'N/A'}`);
      }
    }

    // Check total products by status
    const statusCounts = await prisma.product.groupBy({
      by: ['status'],
      where: {
        retailerId: retailer.id
      },
      _count: {
        status: true
      }
    });

    console.log('\n📊 Products by status:');
    for (const group of statusCounts) {
      console.log(`   ${group.status}: ${group._count.status}`);
    }

    // Get total count
    const totalCount = await prisma.product.count({
      where: {
        retailerId: retailer.id
      }
    });

    console.log(`\n✅ Total products for ${retailer.name}: ${totalCount}\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProducts();
