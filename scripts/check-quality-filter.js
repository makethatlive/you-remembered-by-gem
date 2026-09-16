import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkQualityFilter() {
  try {
    console.log('🔍 Testing qualityScore filter impact...\n');
    
    // WITHOUT quality filter
    const withoutQuality = await prisma.product.count({
      where: {
        sourceType: 'CURATED_PRODUCT',
        status: 'ACTIVE',
        price: { gte: 47.5, lte: 157.5 },
        genderAppliesTo: {
          in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT']
        }
      }
    });
    
    console.log(`WITHOUT quality filter: ${withoutQuality} products`);
    
    // WITH quality filter (as in product-matcher.js)
    const withQuality = await prisma.product.count({
      where: {
        sourceType: 'CURATED_PRODUCT',
        status: 'ACTIVE',
        price: { gte: 47.5, lte: 157.5 },
        genderAppliesTo: {
          in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT']
        },
        OR: [
          { qualityScore: { gte: 50 } },
          { qualityScore: null }
        ]
      }
    });
    
    console.log(`WITH quality filter (≥50 or null): ${withQuality} products`);
    console.log(`\n❌ Lost ${withoutQuality - withQuality} products due to quality filter!\n`);
    
    // Check qualityScore distribution
    console.log('📊 Quality score distribution for CURATED products:\n');
    
    const qualityDist = await prisma.product.groupBy({
      by: ['qualityScore'],
      where: {
        sourceType: 'CURATED_PRODUCT',
        status: 'ACTIVE',
        price: { gte: 47.5, lte: 157.5 },
        genderAppliesTo: {
          in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT']
        }
      },
      _count: true,
      orderBy: {
        qualityScore: 'asc'
      }
    });
    
    qualityDist.forEach(q => {
      const score = q.qualityScore === null ? 'NULL' : q.qualityScore;
      const blocked = q.qualityScore !== null && q.qualityScore < 50 ? '❌ BLOCKED' : '✅ OK';
      console.log(`   Score ${score}: ${q._count} products ${blocked}`);
    });
    
    // Show some blocked products
    const blocked = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT',
        status: 'ACTIVE',
        price: { gte: 47.5, lte: 157.5 },
        genderAppliesTo: {
          in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT']
        },
        qualityScore: { lt: 50, not: null }
      },
      select: {
        name: true,
        qualityScore: true,
        interestTags: true
      },
      take: 10
    });
    
    if (blocked.length > 0) {
      console.log(`\n\n❌ BLOCKED PRODUCTS (qualityScore < 50):\n`);
      blocked.forEach((p, i) => {
        console.log(`${i + 1}. ${p.name.substring(0, 60)}...`);
        console.log(`   Quality: ${p.qualityScore} | Tags: ${p.interestTags?.join(', ')}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkQualityFilter();
