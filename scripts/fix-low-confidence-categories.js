/**
 * Quick Fix for Common Low Confidence Mistakes
 * 
 * Fixes obvious categorization errors based on product names
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_FIXES = [
  // Plant pots → Gardening
  {
    keywords: ['planter', 'plant pot', 'terracotta pot', 'flower pot'],
    correctCategory: 'Home, Style & Objects > Gardening'
  },
  // Kitchen utensils → Cooking
  {
    keywords: ['utensil jar', 'kitchen utensil', 'cooking utensil'],
    correctCategory: 'Food & Drink > Cooking & food'
  },
  // Garden tools → Gardening
  {
    keywords: ['garden', 'gardening tool', 'garden fork', 'trowel', 'spade'],
    correctCategory: 'Home, Style & Objects > Gardening'
  },
  // Seeds, plants → Gardening
  {
    keywords: ['seed', 'plant seed', 'flower seed', 'herb seed'],
    correctCategory: 'Home, Style & Objects > Gardening'
  },
];

async function fixLowConfidenceCategories() {
  console.log('🔧 Fixing common low confidence categorization mistakes...\n');
  
  try {
    let totalFixed = 0;
    
    for (const fix of CATEGORY_FIXES) {
      console.log(`🔍 Searching for: ${fix.keywords.join(', ')}`);
      console.log(`   → Will change to: ${fix.correctCategory}\n`);
      
      // Find products matching keywords
      const products = await prisma.product.findMany({
        where: {
          OR: fix.keywords.map(keyword => ({
            name: {
              contains: keyword,
              mode: 'insensitive'
            }
          }))
        }
      });
      
      if (products.length === 0) {
        console.log(`   ℹ️  No products found\n`);
        continue;
      }
      
      console.log(`   📦 Found ${products.length} products:`);
      products.forEach(p => {
        console.log(`      - ${p.name}`);
        console.log(`        Current: ${p.category || '—'}`);
      });
      console.log('');
      
      // Update categories
      for (const product of products) {
        await prisma.product.update({
          where: { id: product.id },
          data: { category: fix.correctCategory }
        });
      }
      
      console.log(`   ✅ Updated ${products.length} products to: ${fix.correctCategory}\n`);
      totalFixed += products.length;
    }
    
    console.log('✅ Fix Complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Total products fixed: ${totalFixed}\n`);
    
    // Show example results
    const examplePlanter = await prisma.product.findFirst({
      where: {
        name: {
          contains: 'KEW Terracotta',
          mode: 'insensitive'
        }
      }
    });
    
    if (examplePlanter) {
      console.log('📋 Example Result:');
      console.log(`   Product: ${examplePlanter.name}`);
      console.log(`   New Category: ${examplePlanter.category}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixLowConfidenceCategories();
