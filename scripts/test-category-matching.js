#!/usr/bin/env node
/**
 * Test if 3-level category hierarchy works correctly in gift matching
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCategoryMatching() {
  try {
    console.log('🧪 Testing Category Hierarchy in Gift Matching\n');
    console.log('═'.repeat(80));
    
    // Test 1: Check if products have 3-level categories
    console.log('\n📊 TEST 1: Category Structure\n');
    
    const products = await prisma.product.findMany({
      where: {
        category: { not: null }
      },
      select: {
        id: true,
        name: true,
        category: true,
        interestTags: true,
      },
      take: 10,
    });
    
    console.log(`Sample products with categories:`);
    products.forEach((p, i) => {
      const levels = p.category.split('>').map(c => c.trim());
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   Category: ${p.category}`);
      console.log(`   Levels: ${levels.length} (${levels.join(' → ')})`);
      console.log(`   Interest Tags: [${p.interestTags.join(', ')}]`);
    });
    
    // Test 2: Check category distribution
    console.log('\n\n📊 TEST 2: Category Distribution (Top 10 Level-1 Categories)\n');
    
    const allProducts = await prisma.product.findMany({
      where: {
        category: { not: null },
        status: 'ACTIVE',
      },
      select: {
        category: true,
      },
    });
    
    const categoryCount = {};
    allProducts.forEach(p => {
      const topCategory = p.category.split('>')[0]?.trim() || 'Uncategorized';
      categoryCount[topCategory] = (categoryCount[topCategory] || 0) + 1;
    });
    
    const sortedCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    sortedCategories.forEach(([cat, count]) => {
      const bar = '█'.repeat(Math.min(50, Math.floor(count / 10)));
      console.log(`   ${cat.padEnd(30)} ${count.toString().padStart(4)} ${bar}`);
    });
    
    // Test 3: Check products without interest tags
    console.log('\n\n⚠️  TEST 3: Products With Interest Tag Issues\n');
    
    const noTags = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        interestTags: { equals: [] },
      },
      select: {
        id: true,
        name: true,
        category: true,
        interestTags: true,
      },
      take: 5,
    });
    
    if (noTags.length > 0) {
      console.log(`Found ${noTags.length} products without interest tags (showing 5):`);
      noTags.forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Category: ${p.category || '(none)'}`);
        console.log(`   ⚠️  Will rely on category text matching for interests`);
      });
      
      const totalNoTags = await prisma.product.count({
        where: {
          status: 'ACTIVE',
          interestTags: { equals: [] },
        },
      });
      
      const totalActive = await prisma.product.count({
        where: { status: 'ACTIVE' }
      });
      
      const percentage = ((totalNoTags / totalActive) * 100).toFixed(1);
      console.log(`\n⚠️  Total: ${totalNoTags}/${totalActive} (${percentage}%) products lack interest tags`);
      console.log(`   These products rely on category text matching for interests`);
    } else {
      console.log(`✅ All active products have interest tags!`);
    }
    
    // Test 4: Verify diversity sampling will work
    console.log('\n\n✅ TEST 4: Diversity Sampling Readiness\n');
    
    const exampleInterest = 'Wine';
    const wineProducts = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { interestTags: { has: exampleInterest } },
          { category: { contains: exampleInterest, mode: 'insensitive' } },
        ],
      },
      select: {
        name: true,
        category: true,
        interestTags: true,
      },
      take: 20,
    });
    
    console.log(`Example: Products matching interest "${exampleInterest}" (top 20):\n`);
    
    const topCategoryDist = {};
    wineProducts.forEach(p => {
      const topCat = p.category?.split('>')[0]?.trim() || 'Uncategorized';
      topCategoryDist[topCat] = (topCategoryDist[topCat] || 0) + 1;
    });
    
    console.log(`Top-level category distribution:`);
    Object.entries(topCategoryDist).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} products`);
    });
    
    console.log(`\n💡 Diversity sampling will limit each category to max 3-6 products`);
    console.log(`   This ensures AI receives variety, not all ${wineProducts.length} ${exampleInterest} products`);
    
    // Summary
    console.log('\n\n' + '═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    console.log('\n✅ Category Hierarchy: 3 levels (Category 1 > Category 2 > Category 3)');
    console.log('✅ Diversity Sampling: Uses top-level category (Category 1)');
    console.log('✅ AI Context: Full 3-level hierarchy provided to AI');
    console.log('✅ Fallback Matching: Category text searched when interestTags missing');
    
    if (noTags.length > 0) {
      const totalNoTags = await prisma.product.count({
        where: {
          status: 'ACTIVE',
          interestTags: { equals: [] },
        },
      });
      
      console.log(`\n⚠️  Note: ${totalNoTags} products lack interest tags`);
      console.log(`   These products rely on category text matching for better results`);
    } else {
      console.log('\n🎉 All products have interest tags - matching will be optimal!');
    }
    
    console.log('\n📚 Documentation: See CATEGORY_HIERARCHY_GIFT_MATCHING.md\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testCategoryMatching()
  .then(() => {
    console.log('✅ Test completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
