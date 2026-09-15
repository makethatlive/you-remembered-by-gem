import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStats() {
  try {
    const stats = await prisma.product.groupBy({
      by: ['sourceType'],
      _count: { sourceType: true }
    });

    console.log('\n📊 CURRENT DATABASE STATUS:\n');
    stats.forEach(stat => {
      console.log(`   ${stat.sourceType}: ${stat._count.sourceType} products`);
    });

    const total = stats.reduce((sum, stat) => sum + stat._count.sourceType, 0);
    console.log(`\n   📦 TOTAL: ${total} products\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStats();
