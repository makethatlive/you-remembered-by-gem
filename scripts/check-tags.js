import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTags() {
  try {
    console.log('🔍 Checking Product Tags\n');

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
        interestTags: true,
        giftTypeTags: true,
        qualityScore: true
      },
      take: 20
    });

    console.log(`📦 Found ${products.length} products\n`);

    let noInterestTags = 0;
    let noGiftTypeTags = 0;
    let noTags = 0;

    products.forEach(p => {
      const hasInterest = p.interestTags && p.interestTags.length > 0;
      const hasGiftType = p.giftTypeTags && p.giftTypeTags.length > 0;

      if (!hasInterest) noInterestTags++;
      if (!hasGiftType) noGiftTypeTags++;
      if (!hasInterest && !hasGiftType) noTags++;
    });

    console.log('📊 Tag Statistics:');
    console.log(`  No interest tags: ${noInterestTags}`);
    console.log(`  No gift type tags: ${noGiftTypeTags}`);
    console.log(`  No tags at all: ${noTags}\n`);

    console.log('Sample products:\n');
    products.slice(0, 10).forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Interest tags: ${p.interestTags?.join(', ') || 'NONE'}`);
      console.log(`   Gift type tags: ${p.giftTypeTags?.join(', ') || 'NONE'}`);
      console.log(`   Quality: ${p.qualityScore || 'NULL'}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTags();
