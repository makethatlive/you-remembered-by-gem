import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkQualityScores() {
  try {
    console.log('🔍 Checking quality scores for Ben\'s products...\n');
    
    // Same query as Tier 1
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        sourceType: 'CURATED_PRODUCT',
        price: { gte: 47.5, lte: 157.5 },
        genderAppliesTo: {
          in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT']
        }
      },
      select: {
        id: true,
        name: true,
        qualityScore: true,
        interestTags: true,
        description: true
      }
    });
    
    console.log(`📊 Total CURATED_PRODUCT in Ben's range: ${products.length}\n`);
    
    // Group by quality score
    const byQuality = {
      'null': [],
      '< 50': [],
      '50-74': [],
      '75-89': [],
      '90-100': []
    };
    
    products.forEach(p => {
      if (p.qualityScore === null) {
        byQuality['null'].push(p);
      } else if (p.qualityScore < 50) {
        byQuality['< 50'].push(p);
      } else if (p.qualityScore < 75) {
        byQuality['50-74'].push(p);
      } else if (p.qualityScore < 90) {
        byQuality['75-89'].push(p);
      } else {
        byQuality['90-100'].push(p);
      }
    });
    
    console.log('📊 QUALITY SCORE DISTRIBUTION:\n');
    Object.entries(byQuality).forEach(([range, prods]) => {
      console.log(`   ${range}: ${prods.length} products`);
    });
    
    // Show products with score < 50
    if (byQuality['< 50'].length > 0) {
      console.log(`\n⚠️  PRODUCTS WITH QUALITY SCORE < 50 (first 10):\n`);
      byQuality['< 50'].slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name.substring(0, 60)}...`);
        console.log(`   Quality Score: ${p.qualityScore}`);
        console.log(`   Tags: ${p.interestTags?.join(', ')}`);
        console.log(`   Has Description: ${p.description ? 'Yes' : 'No'}`);
        console.log('');
      });
    }
    
    // Show products with null score
    if (byQuality['null'].length > 0) {
      console.log(`\n✅ PRODUCTS WITH NULL QUALITY SCORE (first 10):\n`);
      byQuality['null'].slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name.substring(0, 60)}...`);
        console.log(`   Quality Score: null (allowed)`);
        console.log(`   Tags: ${p.interestTags?.join(', ')}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkQualityScores();
