/**
 * Comprehensive Database Cleanup
 * 1. Fix missing tags
 * 2. Normalize weird categories (like "Hoop Earrings" should be "Jewellery")
 * 3. Set proper interest tags
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Category normalization mapping
const CATEGORY_MAP = {
  'Hoop Earrings': 'Jewellery',
  'Huggie Earrings': 'Jewellery',
  'Piercing Stud': 'Jewellery',
  'Leather Wallet': 'Fashion & accessories',
  'Leather Card Case': 'Fashion & accessories',
  'Greeting Card': 'Reading & books',
  'Accessories': 'Fashion & accessories',
  'Gifts': 'Home & interiors',
  '100-cyo': 'Home & interiors'
};

// Interest tag mapping by category
const INTEREST_BY_CATEGORY = {
  'Fashion & accessories': ['Fashion & accessories'],
  'Jewellery': ['Jewellery', 'Fashion & accessories'],
  'Home & interiors': ['Home & interiors'],
  'Food & Drink': ['Cooking & food', 'Wine & drinks'],
  'Beauty & skincare': ['Beauty & skincare', 'Wellness & self-care'],
  'Reading & books': ['Reading & books'],
  'Toys & games': ['Toys, games, or activities'],
  'Sports & fitness': ['Sports & fitness'],
  'Art & culture': ['Art & culture'],
  'Travel & adventure': ['Travel & adventure']
};

// Gift type mapping
const GIFT_TYPE_BY_CATEGORY = {
  'Fashion & accessories': ['Practical but high quality'],
  'Jewellery': ['Designer items'],
  'Home & interiors': ['Practical but high quality'],
  'Food & Drink': ['Things to eat or drink'],
  'Beauty & skincare': ['Practical but high quality'],
  'Reading & books': ['Practical but high quality'],
  'Toys & games': ['Fun and quirky']
};

async function cleanupDatabase() {
  console.log(`\n🧹 COMPREHENSIVE DATABASE CLEANUP`);
  console.log(`════════════════════════════════════════════\n`);

  try {
    // Step 1: Normalize weird categories
    console.log(`📁 Step 1: Normalizing categories...\n`);
    
    let normalizedCount = 0;
    for (const [oldCat, newCat] of Object.entries(CATEGORY_MAP)) {
      const count = await prisma.product.count({
        where: { category: oldCat }
      });
      
      if (count > 0) {
        await prisma.product.updateMany({
          where: { category: oldCat },
          data: { 
            category: newCat,
            canonicalCategory: newCat
          }
        });
        console.log(`   ✅ ${oldCat} → ${newCat} (${count} products)`);
        normalizedCount += count;
      }
    }
    
    console.log(`   Total normalized: ${normalizedCount}\n`);

    // Step 2: Fix missing interest tags
    console.log(`🏷️  Step 2: Adding missing interest tags...\n`);
    
    // Use raw query for array checking
    const missingInterests = await prisma.$queryRaw`
      SELECT id, category, name 
      FROM products 
      WHERE status = 'ACTIVE' 
      AND (interest_tags = '{}' OR interest_tags IS NULL)
    `;

    console.log(`   Found ${missingInterests.length} products without interest tags`);
    
    let fixedInterests = 0;
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < missingInterests.length; i += BATCH_SIZE) {
      const batch = missingInterests.slice(i, i + BATCH_SIZE);
      
      await prisma.$transaction(
        batch.map(product => {
          const category = product.category || 'Fashion & accessories';
          const interests = INTEREST_BY_CATEGORY[category] || ['Fashion & accessories'];
          
          return prisma.product.update({
            where: { id: product.id },
            data: { interestTags: interests }
          });
        }),
        { timeout: 30000 }
      );
      
      fixedInterests += batch.length;
      console.log(`   ... fixed ${fixedInterests}/${missingInterests.length}`);
    }
    
    console.log(`   ✅ Added interest tags to ${fixedInterests} products\n`);

    // Step 3: Fix missing gift type tags
    console.log(`🎁 Step 3: Adding missing gift type tags...\n`);
    
    const missingGiftTypes = await prisma.$queryRaw`
      SELECT id, category 
      FROM products 
      WHERE status = 'ACTIVE' 
      AND (gift_type_tags = '{}' OR gift_type_tags IS NULL)
    `;

    console.log(`   Found ${missingGiftTypes.length} products without gift type tags`);
    
    let fixedGiftTypes = 0;
    const BATCH_SIZE2 = 50;
    
    for (let i = 0; i < missingGiftTypes.length; i += BATCH_SIZE2) {
      const batch = missingGiftTypes.slice(i, i + BATCH_SIZE2);
      
      await prisma.$transaction(
        batch.map(product => {
          const category = product.category || 'Fashion & accessories';
          const giftTypes = GIFT_TYPE_BY_CATEGORY[category] || ['Practical but high quality'];
          
          return prisma.product.update({
            where: { id: product.id },
            data: { giftTypeTags: giftTypes }
          });
        }),
        { timeout: 30000 }
      );
      
      fixedGiftTypes += batch.length;
      console.log(`   ... fixed ${fixedGiftTypes}/${missingGiftTypes.length}`);
    }
    
    console.log(`   ✅ Added gift type tags to ${fixedGiftTypes} products\n`);

    // Step 4: Final verification
    console.log(`✅ Step 4: Verification...\n`);
    
    const stillMissingTags = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE status = 'ACTIVE' 
      AND (interest_tags = '{}' OR gift_type_tags = '{}' OR interest_tags IS NULL OR gift_type_tags IS NULL)
    `;
    
    const missingCount = Number(stillMissingTags[0]?.count || 0);

    const categoryDist = await prisma.product.groupBy({
      by: ['category'],
      _count: true,
      where: { status: 'ACTIVE' },
      orderBy: { _count: { category: 'desc' } },
      take: 10
    });

    console.log(`   Products still missing tags: ${missingCount}`);
    console.log(`\n   Top Categories after cleanup:`);
    categoryDist.forEach(cat => {
      console.log(`   ${cat.category || '(No Category)'}: ${cat._count}`);
    });

    console.log(`\n════════════════════════════════════════════`);
    console.log(`✅ CLEANUP COMPLETE!`);
    console.log(`════════════════════════════════════════════\n`);
    console.log(`📊 Summary:`);
    console.log(`   Categories normalized: ${normalizedCount}`);
    console.log(`   Interest tags added: ${fixedInterests}`);
    console.log(`   Gift type tags added: ${fixedGiftTypes}`);
    console.log(`   Still missing tags: ${missingCount}\n`);
    
    console.log(`💡 Next steps:`);
    console.log(`   1. Run: npm run backup:db`);
    console.log(`   2. Test gift generation`);
    console.log(`   3. Check Admin Dashboard → Products Review\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase();
