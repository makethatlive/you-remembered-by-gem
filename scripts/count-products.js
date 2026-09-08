/**
 * Count total products in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function countProducts() {
  try {
    const total = await prisma.product.count();
    console.log(`\n📦 Total products in database: ${total}`);

    const byStatus = await prisma.product.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    console.log('\n📊 Products by status:');
    for (const group of byStatus) {
      console.log(`   ${group.status}: ${group._count.status}`);
    }

    const recentRetailers = await prisma.product.groupBy({
      by: ['retailerId'],
      _count: {
        retailerId: true
      },
      orderBy: {
        _count: {
          retailerId: 'desc'
        }
      },
      take: 10
    });

    console.log('\n🏪 Top 10 retailers by product count:');
    for (const group of recentRetailers) {
      const retailer = await prisma.retailer.findUnique({
        where: { id: group.retailerId },
        select: { name: true }
      });
      console.log(`   ${retailer?.name || 'Unknown'}: ${group._count.retailerId}`);
    }

    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

countProducts();
