/**
 * Product Normalization & Deduplication Script
 * 
 * This script will:
 * 1. Find and remove duplicate products
 * 2. Fix incorrect interest tags (e.g., pyjamas tagged as "Cooking & food")
 * 3. Normalize categories
 * 4. Clean up data quality
 * 5. Export clean data for backup
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Clothing/Fashion keywords - should NOT be tagged as food
const CLOTHING_KEYWORDS = [
  'pyjama', 'pajama', 'shirt', 'trouser', 'shorts', 'dress', 'skirt',
  'jacket', 'coat', 'sweater', 'jumper', 'cardigan', 'hoodie',
  'jeans', 'pants', 'leggings', 'socks', 'underwear', 'bra',
  'hat', 'cap', 'scarf', 'gloves', 'belt', 'tie', 'suit'
];

// Food/Drink keywords - should be tagged as food
const FOOD_KEYWORDS = [
  'chocolate', 'coffee', 'tea', 'wine', 'whisky', 'gin', 'vodka',
  'beer', 'champagne', 'cake', 'biscuit', 'cookie', 'candy',
  'sauce', 'oil', 'vinegar', 'spice', 'herb', 'jam', 'honey',
  'cheese', 'meat', 'fish', 'snack', 'drink', 'beverage'
];

// Jewelry keywords
const JEWELRY_KEYWORDS = [
  'necklace', 'bracelet', 'ring', 'earring', 'pendant', 'chain',
  'brooch', 'anklet', 'cufflink', 'piercing', 'stud'
];

// Home & Interior keywords
const HOME_KEYWORDS = [
  'cushion', 'pillow', 'blanket', 'throw', 'rug', 'mat',
  'vase', 'candle', 'frame', 'mirror', 'lamp', 'clock',
  'furniture', 'chair', 'table', 'shelf', 'storage'
];

/**
 * Detect what category a product should be
 */
function detectCorrectCategory(product) {
  const text = `${product.name} ${product.description}`.toLowerCase();
  
  // Check clothing
  if (CLOTHING_KEYWORDS.some(kw => text.includes(kw))) {
    return {
      category: 'Clothing & Accessories',
      interests: ['Fashion & accessories', 'Clothing'],
      giftTypes: ['Practical but high quality']
    };
  }
  
  // Check jewelry
  if (JEWELRY_KEYWORDS.some(kw => text.includes(kw))) {
    return {
      category: 'Jewellery',
      interests: ['Jewellery', 'Fashion & accessories'],
      giftTypes: ['Designer items', 'Practical but high quality']
    };
  }
  
  // Check home
  if (HOME_KEYWORDS.some(kw => text.includes(kw))) {
    return {
      category: 'Home & interiors',
      interests: ['Home & interiors'],
      giftTypes: ['Practical but high quality']
    };
  }
  
  // Check food/drink
  if (FOOD_KEYWORDS.some(kw => text.includes(kw))) {
    return {
      category: 'Food & Drink',
      interests: ['Cooking & food', 'Wine & drinks'],
      giftTypes: ['Things to eat or drink']
    };
  }
  
  return null;
}

/**
 * Main normalization function
 */
async function normalizeProducts() {
  console.log(`\n🔧 PRODUCT NORMALIZATION & CLEANUP`);
  console.log(`════════════════════════════════════════════\n`);

  try {
    // Step 1: Count current state
    const totalProducts = await prisma.product.count();
    console.log(`📊 Current database state:`);
    console.log(`   Total products: ${totalProducts}\n`);

    // Step 2: Find duplicates by product URL
    console.log(`🔍 Step 1: Finding duplicates...\n`);
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        productUrl: true,
        sourceType: true,
        createdAt: true,
        interestTags: true,
        giftTypeTags: true,
        category: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by URL to find duplicates
    const urlMap = new Map();
    const duplicates = [];
    
    for (const product of allProducts) {
      if (!product.productUrl || product.productUrl === 'N/A') continue;
      
      if (urlMap.has(product.productUrl)) {
        // Duplicate found - keep the one with sourceType = CURATED_PRODUCT or newer
        const existing = urlMap.get(product.productUrl);
        
        // Prefer CURATED_PRODUCT over others
        if (product.sourceType === 'CURATED_PRODUCT' && existing.sourceType !== 'CURATED_PRODUCT') {
          duplicates.push(existing.id);
          urlMap.set(product.productUrl, product);
        } else if (existing.sourceType === 'CURATED_PRODUCT' && product.sourceType !== 'CURATED_PRODUCT') {
          duplicates.push(product.id);
        } else {
          // Keep older one, delete newer
          duplicates.push(product.id);
        }
      } else {
        urlMap.set(product.productUrl, product);
      }
    }

    console.log(`   Found ${duplicates.length} duplicate products\n`);

    // Step 3: Find incorrectly tagged products
    console.log(`🔍 Step 2: Finding incorrectly tagged products...\n`);
    
    const incorrectlyTagged = [];
    
    for (const product of allProducts) {
      if (duplicates.includes(product.id)) continue; // Skip duplicates
      
      const correction = detectCorrectCategory(product);
      
      if (correction) {
        const currentInterests = product.interestTags || [];
        const currentCategory = product.category || '';
        
        // Check if current tags are wrong
        const hasWrongTags = (
          // Clothing tagged as food
          (CLOTHING_KEYWORDS.some(kw => product.name.toLowerCase().includes(kw)) &&
           currentInterests.includes('Cooking & food')) ||
          // Wrong category
          (correction.category !== currentCategory && currentCategory)
        );
        
        if (hasWrongTags) {
          incorrectlyTagged.push({
            id: product.id,
            name: product.name,
            currentCategory: currentCategory,
            currentInterests: currentInterests,
            correctCategory: correction.category,
            correctInterests: correction.interests,
            correctGiftTypes: correction.giftTypes
          });
        }
      }
    }

    console.log(`   Found ${incorrectlyTagged.length} incorrectly tagged products\n`);
    
    // Show examples
    if (incorrectlyTagged.length > 0) {
      console.log(`   Examples of incorrect tags:\n`);
      incorrectlyTagged.slice(0, 5).forEach(p => {
        console.log(`   ❌ ${p.name.substring(0, 50)}`);
        console.log(`      Current: ${p.currentCategory} | ${p.currentInterests.join(', ')}`);
        console.log(`      Should be: ${p.correctCategory} | ${p.correctInterests.join(', ')}\n`);
      });
    }

    // Step 4: Ask for confirmation
    console.log(`\n📋 Cleanup Summary:`);
    console.log(`   Products to delete (duplicates): ${duplicates.length}`);
    console.log(`   Products to fix (wrong tags): ${incorrectlyTagged.length}`);
    console.log(`   Products to keep unchanged: ${totalProducts - duplicates.length - incorrectlyTagged.length}`);
    console.log(`   Final product count: ${totalProducts - duplicates.length}\n`);

    // Step 5: Delete duplicates
    if (duplicates.length > 0) {
      console.log(`🗑️  Step 3: Deleting ${duplicates.length} duplicate products...\n`);
      
      // Delete in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < duplicates.length; i += BATCH_SIZE) {
        const batch = duplicates.slice(i, i + BATCH_SIZE);
        await prisma.product.deleteMany({
          where: { id: { in: batch } }
        });
        console.log(`   ... deleted ${Math.min(i + BATCH_SIZE, duplicates.length)}/${duplicates.length}`);
      }
      console.log(`   ✅ Duplicates removed\n`);
    }

    // Step 6: Fix incorrect tags
    if (incorrectlyTagged.length > 0) {
      console.log(`🔧 Step 4: Fixing ${incorrectlyTagged.length} products with wrong tags...\n`);
      
      // Batch update for speed
      const BATCH_SIZE = 50;
      for (let i = 0; i < incorrectlyTagged.length; i += BATCH_SIZE) {
        const batch = incorrectlyTagged.slice(i, i + BATCH_SIZE);
        
        await prisma.$transaction(
          batch.map(p => prisma.product.update({
            where: { id: p.id },
            data: {
              category: p.correctCategory,
              canonicalCategory: p.correctCategory,
              interestTags: p.correctInterests,
              giftTypeTags: p.correctGiftTypes
            }
          })),
          { timeout: 30000 }
        );
        
        console.log(`   ... fixed ${Math.min(i + BATCH_SIZE, incorrectlyTagged.length)}/${incorrectlyTagged.length}`);
      }
      console.log(`   ✅ Tags corrected\n`);
    }

    // Step 7: Final counts
    const finalCount = await prisma.product.count();
    const curated = await prisma.product.count({ where: { sourceType: 'CURATED_PRODUCT' } });
    const shopify = await prisma.product.count({ where: { sourceType: 'SHOPIFY_UPLOAD' } });
    
    console.log(`════════════════════════════════════════════`);
    console.log(`✅ NORMALIZATION COMPLETE!`);
    console.log(`════════════════════════════════════════════\n`);
    console.log(`📊 Final database state:`);
    console.log(`   Total products: ${finalCount}`);
    console.log(`   Curated products: ${curated}`);
    console.log(`   Shopify products: ${shopify}`);
    console.log(`   Removed: ${totalProducts - finalCount} duplicates\n`);
    
    console.log(`💡 Next steps:`);
    console.log(`   1. Review products in Admin Dashboard`);
    console.log(`   2. Run: npm run backup:db (backup clean data)`);
    console.log(`   3. Test gift generation to verify tags are correct\n`);

  } catch (error) {
    console.error('\n❌ Normalization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

normalizeProducts();
