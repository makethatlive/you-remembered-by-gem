import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function findBestInterests() {
  try {
    console.log('\n=== FINDING BEST INTERESTS FOR MATE ===\n');
    
    // Budget constraints
    const budgetMin = 100;
    const budgetMax = 230;

    // Get all unique interest tags from products
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        price: { gte: budgetMin, lte: budgetMax },
        qualityScore: { gte: 50 }
      },
      select: {
        interestTags: true
      }
    });

    // Count products per interest tag
    const interestCounts = {};
    products.forEach(p => {
      (p.interestTags || []).forEach(tag => {
        interestCounts[tag] = (interestCounts[tag] || 0) + 1;
      });
    });

    // Sort by count
    const sorted = Object.entries(interestCounts)
      .sort((a, b) => b[1] - a[1])
      .filter(([tag, count]) => count >= 3); // Only interests with 3+ products

    console.log('📊 AVAILABLE INTERESTS (with product counts):\n');
    sorted.forEach(([tag, count], index) => {
      const emoji = count >= 10 ? '✅' : count >= 7 ? '👍' : '⚠️';
      console.log(`${emoji} ${index + 1}. ${tag}: ${count} products`);
    });

    console.log('\n\n💡 RECOMMENDED INTERESTS FOR MATE:\n');
    
    // Pick top 3-4 interests with most products
    const recommended = sorted.slice(0, 4).map(([tag]) => tag);
    console.log('Update Mate\'s interests to:');
    recommended.forEach((tag, i) => {
      console.log(`  ${i + 1}. "${tag}"`);
    });

    console.log('\n\n📝 SQL TO UPDATE MATE:\n');
    console.log(`UPDATE "Recipient" SET "interests" = ARRAY[${recommended.map(t => `'${t}'`).join(', ')}] WHERE id = 'cmtwtxwg1000812fmmnod41pm';`);

    console.log('\n\n🎯 EXPECTED RESULTS:');
    const totalProducts = recommended.reduce((sum, tag) => sum + (interestCounts[tag] || 0), 0);
    console.log(`  Total matching products: ~${totalProducts} (with overlaps)`);
    console.log(`  Expected gift count: 7-15 (AI will choose based on quality)`);
    
    if (totalProducts >= 20) {
      console.log(`  ✅ Excellent - Should generate 10+ high-quality gifts`);
    } else if (totalProducts >= 10) {
      console.log(`  👍 Good - Should generate 7-10 gifts`);
    } else {
      console.log(`  ⚠️  Limited - May only generate 5-7 gifts`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findBestInterests();
