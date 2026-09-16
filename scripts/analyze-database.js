/**
 * Analyze Current Database
 * Check for duplicates, wrong tags, and data quality
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeDatabase() {
  console.log(`\n📊 DATABASE ANALYSIS`);
  console.log(`════════════════════════════════════════════\n`);

  try {
    // Basic counts
    const total = await prisma.product.count();
    const active = await prisma.product.count({ where: { status: 'ACTIVE' } });
    const curated = await prisma.product.count({ where: { sourceType: 'CURATED_PRODUCT' } });
    const shopify = await prisma.product.count({ where: { sourceType: 'SHOPIFY_UPLOAD' } });
    
    console.log(`📈 Product Counts:`);
    console.log(`   Total: ${total}`);
    console.log(`   Active: ${active}`);
    console.log(`   Curated: ${curated}`);
    console.log(`   Shopify: ${shopify}\n`);

    // Find duplicates by URL
    console.log(`🔍 Checking for duplicates...\n`);
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        productUrl: true,
        sourceType: true
      }
    });

    const urlMap = new Map();
    let duplicateCount = 0;
    const duplicateExamples = [];

    for (const p of allProducts) {
      const url = p.productUrl;
      if (!url || url === 'N/A') continue;
      
      if (urlMap.has(url)) {
        duplicateCount++;
        if (duplicateExamples.length < 5) {
          duplicateExamples.push({
            url: url.substring(0, 60),
            products: [urlMap.get(url).name.substring(0, 40), p.name.substring(0, 40)]
          });
        }
      } else {
        urlMap.set(url, p);
      }
    }

    console.log(`   Total Duplicates: ${duplicateCount}`);
    if (duplicateExamples.length > 0) {
      console.log(`\n   Examples:`);
      duplicateExamples.forEach(d => {
        console.log(`   - ${d.url}`);
        d.products.forEach(name => console.log(`     • ${name}`));
      });
    }
    console.log('');

    // Check for wrong tags (clothing as food)
    console.log(`🏷️  Checking for incorrect tags...\n`);
    
    const wronglyTagged = await prisma.product.findMany({
      where: {
        OR: [
          {
            name: { contains: 'pyjama', mode: 'insensitive' },
            interestTags: { has: 'Cooking & food' }
          },
          {
            name: { contains: 'shirt', mode: 'insensitive' },
            interestTags: { has: 'Cooking & food' }
          },
          {
            name: { contains: 'dress', mode: 'insensitive' },
            interestTags: { has: 'Cooking & food' }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        category: true,
        interestTags: true,
        giftTypeTags: true
      },
      take: 10
    });

    console.log(`   Clothing tagged as Food: ${wronglyTagged.length}`);
    if (wronglyTagged.length > 0) {
      console.log(`\n   Examples:`);
      wronglyTagged.slice(0, 5).forEach(p => {
        console.log(`   ❌ ${p.name.substring(0, 50)}`);
        console.log(`      Category: ${p.category || 'None'}`);
        console.log(`      Interest Tags: ${p.interestTags?.join(', ') || 'None'}`);
        console.log(`      Gift Tags: ${p.giftTypeTags?.join(', ') || 'None'}\n`);
      });
    }

    // Check missing tags
    const missingTags = await prisma.product.count({
      where: {
        AND: [
          { status: 'ACTIVE' },
          {
            OR: [
              { interestTags: { isEmpty: true } },
              { giftTypeTags: { isEmpty: true } }
            ]
          }
        ]
      }
    });

    console.log(`   Missing Tags: ${missingTags} products\n`);

    // Category distribution
    console.log(`📁 Category Distribution:\n`);
    const categories = await prisma.product.groupBy({
      by: ['category'],
      _count: true,
      where: { status: 'ACTIVE' },
      orderBy: { _count: { category: 'desc' } },
      take: 15
    });

    categories.forEach(cat => {
      const catName = cat.category || '(No Category)';
      console.log(`   ${catName}: ${cat._count}`);
    });

    console.log(`\n════════════════════════════════════════════`);
    console.log(`📋 SUMMARY`);
    console.log(`════════════════════════════════════════════\n`);
    console.log(`   Issues Found:`);
    console.log(`   • Duplicates: ${duplicateCount}`);
    console.log(`   • Wrong Tags: ${wronglyTagged.length}`);
    console.log(`   • Missing Tags: ${missingTags}\n`);
    
    if (duplicateCount > 0 || wronglyTagged.length > 0 || missingTags > 0) {
      console.log(`💡 Recommendation:`);
      console.log(`   Run: npm run cleanup:database\n`);
    } else {
      console.log(`✅ Database looks good!\n`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeDatabase();
