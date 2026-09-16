/**
 * Normalize Backup Products & Restore
 * 
 * This script will:
 * 1. Load 5916 products from backup-2026-09-15T14-02-53
 * 2. Remove duplicates
 * 3. Fix incorrect tags (pyjamas as food, etc.)
 * 4. Delete current products from database
 * 5. Import clean normalized products
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const BACKUP_DIR = path.join(__dirname, '..', 'database-backups', 'backup-2026-09-15T14-02-53');

// Pattern matching for categories
const PATTERNS = {
  clothing: /pyjama|pajama|shirt|trouser|shorts|dress|skirt|jacket|coat|sweater|jumper|cardigan|hoodie|jeans|pants|leggings|socks|underwear|bra|hat|cap|scarf|gloves|belt|tie|suit|t-shirt|top|blouse|vest/i,
  jewelry: /necklace|bracelet|ring|earring|pendant|chain|brooch|anklet|cufflink|piercing|stud|jewellery|jewelry/i,
  home: /cushion|pillow|blanket|throw|rug|mat|vase|candle|frame|mirror|lamp|clock|furniture|chair|table|shelf|storage|decor/i,
  food: /chocolate|coffee|tea|wine|whisky|whiskey|gin|vodka|beer|champagne|cake|biscuit|cookie|candy|sauce|oil|vinegar|spice|herb|jam|honey|cheese|snack|drink|beverage|spirit|liqueur/i,
  books: /book|novel|journal|diary|notebook|magazine|comic|graphic novel/i,
  beauty: /perfume|fragrance|cologne|skincare|makeup|cosmetic|lotion|cream|serum|shampoo|conditioner/i,
  toys: /toy|game|puzzle|lego|doll|action figure|board game|card game|playmat/i
};

function detectCategory(product) {
  const text = `${product.name} ${product.description || ''}`.toLowerCase();
  
  if (PATTERNS.clothing.test(text)) {
    return {
      category: 'Fashion & accessories',
      canonicalCategory: 'Fashion & accessories',
      interestTags: ['Fashion & accessories'],
      giftTypeTags: ['Practical but high quality']
    };
  }
  
  if (PATTERNS.jewelry.test(text)) {
    return {
      category: 'Jewellery',
      canonicalCategory: 'Jewellery',
      interestTags: ['Jewellery', 'Fashion & accessories'],
      giftTypeTags: ['Designer items']
    };
  }
  
  if (PATTERNS.home.test(text)) {
    return {
      category: 'Home & interiors',
      canonicalCategory: 'Home & interiors',
      interestTags: ['Home & interiors'],
      giftTypeTags: ['Practical but high quality']
    };
  }
  
  if (PATTERNS.food.test(text)) {
    return {
      category: 'Food & Drink',
      canonicalCategory: 'Cooking & food',
      interestTags: ['Cooking & food', 'Wine & drinks'],
      giftTypeTags: ['Things to eat or drink']
    };
  }
  
  if (PATTERNS.books.test(text)) {
    return {
      category: 'Reading & books',
      canonicalCategory: 'Reading & books',
      interestTags: ['Reading & books'],
      giftTypeTags: ['Practical but high quality']
    };
  }
  
  if (PATTERNS.beauty.test(text)) {
    return {
      category: 'Beauty & skincare',
      canonicalCategory: 'Beauty & skincare',
      interestTags: ['Beauty & skincare', 'Wellness & self-care'],
      giftTypeTags: ['Practical but high quality']
    };
  }
  
  if (PATTERNS.toys.test(text)) {
    return {
      category: 'Toys & games',
      canonicalCategory: 'Toys, games, or activities',
      interestTags: ['Toys, games, or activities'],
      giftTypeTags: ['Fun and quirky']
    };
  }
  
  return null;
}

async function normalizeAndRestore() {
  console.log(`\n🔧 NORMALIZE BACKUP & RESTORE TO DATABASE`);
  console.log(`════════════════════════════════════════════\n`);
  
  try {
    // Step 1: Load products from backup
    console.log(`📂 Step 1: Loading products from backup...\n`);
    const backupPath = path.join(BACKUP_DIR, 'products.json');
    
    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Backup not found: ${backupPath}`);
      process.exit(1);
    }
    
    const rawProducts = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`   Loaded ${rawProducts.length} products from backup\n`);
    
    // Step 2: Remove duplicates by URL
    console.log(`🔍 Step 2: Removing duplicates...\n`);
    const urlMap = new Map();
    const unique = [];
    let duplicateCount = 0;
    
    for (const product of rawProducts) {
      const url = product.productUrl || product.affiliateUrl;
      if (!url || url === 'N/A') {
        unique.push(product);
        continue;
      }
      
      if (urlMap.has(url)) {
        duplicateCount++;
        const existing = urlMap.get(url);
        // Keep CURATED_PRODUCT over others
        if (product.sourceType === 'CURATED_PRODUCT' && existing.sourceType !== 'CURATED_PRODUCT') {
          const index = unique.indexOf(existing);
          unique[index] = product;
          urlMap.set(url, product);
        }
      } else {
        urlMap.set(url, product);
        unique.push(product);
      }
    }
    
    console.log(`   Removed ${duplicateCount} duplicates`);
    console.log(`   Unique products: ${unique.length}\n`);
    
    // Step 3: Normalize tags
    console.log(`🔧 Step 3: Normalizing categories and tags...\n`);
    const normalized = [];
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const product of unique) {
      // Skip invalid products
      if (!product.name || product.name.length < 3 || !product.retailerId) {
        skippedCount++;
        continue;
      }
      
      const correction = detectCategory(product);
      
      if (correction) {
        // Apply correction
        normalized.push({
          ...product,
          category: correction.category,
          canonicalCategory: correction.canonicalCategory,
          interestTags: correction.interestTags,
          giftTypeTags: correction.giftTypeTags
        });
        fixedCount++;
      } else {
        // Keep as-is if we can't determine category
        normalized.push(product);
      }
    }
    
    console.log(`   Fixed tags: ${fixedCount} products`);
    console.log(`   Kept as-is: ${normalized.length - fixedCount} products`);
    console.log(`   Skipped (invalid): ${skippedCount} products`);
    console.log(`   Final count: ${normalized.length}\n`);
    
    // Step 4: Show examples
    const examples = normalized.filter(p => 
      PATTERNS.clothing.test(p.name) && 
      p.interestTags?.includes('Fashion & accessories')
    ).slice(0, 3);
    
    if (examples.length > 0) {
      console.log(`   ✅ Examples of corrected products:\n`);
      examples.forEach(p => {
        console.log(`      ${p.name.substring(0, 60)}`);
        console.log(`         Category: ${p.category}`);
        console.log(`         Tags: ${p.interestTags?.join(', ') || 'None'}\n`);
      });
    }
    
    // Step 5: Clear current products
    console.log(`🗑️  Step 4: Clearing current database products...\n`);
    await prisma.$executeRawUnsafe('DELETE FROM "gift_items"');
    await prisma.product.deleteMany();
    console.log(`   ✅ Current products deleted\n`);
    
    // Step 6: Import normalized products
    console.log(`📥 Step 5: Importing ${normalized.length} clean products...\n`);
    console.log(`   This will take a few minutes...\n`);
    
    const BATCH_SIZE = 200;
    let imported = 0;
    
    for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
      const batch = normalized.slice(i, i + BATCH_SIZE);
      
      await prisma.$transaction(
        batch.map(p => {
          const { retailer, ...data } = p;
          // Remove any fields that might cause issues
          delete data.id; // Let Prisma generate new IDs
          return prisma.product.create({ data });
        }),
        { timeout: 60000 }
      );
      
      imported += batch.length;
      if (imported % 500 === 0 || imported >= normalized.length) {
        console.log(`   ... imported ${imported}/${normalized.length}`);
      }
    }
    
    console.log(`   ✅ All products imported\n`);
    
    // Step 7: Verify
    const finalCount = await prisma.product.count();
    const curated = await prisma.product.count({ where: { sourceType: 'CURATED_PRODUCT' } });
    
    console.log(`════════════════════════════════════════════`);
    console.log(`✅ NORMALIZATION & RESTORE COMPLETE!`);
    console.log(`════════════════════════════════════════════\n`);
    console.log(`📊 Final Results:`);
    console.log(`   Original backup: ${rawProducts.length} products`);
    console.log(`   Duplicates removed: ${duplicateCount}`);
    console.log(`   Invalid products skipped: ${skippedCount}`);
    console.log(`   Tags fixed: ${fixedCount}`);
    console.log(`   Final imported: ${finalCount}`);
    console.log(`   Curated products: ${curated}\n`);
    
    console.log(`💡 Next steps:`);
    console.log(`   1. Run: npm run backup:db (backup clean normalized data)`);
    console.log(`   2. Test gift generation with "Cooking & food" interest`);
    console.log(`   3. Verify NO pyjamas appear in results!\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

normalizeAndRestore();
