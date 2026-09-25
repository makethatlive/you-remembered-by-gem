/**
 * Restore Gem's Pick Products from Backup
 * 
 * Usage: node scripts/restore-gems-picks.js "path/to/backup/folder"
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function restore() {
  const backupPath = process.argv[2];
  
  if (!backupPath) {
    console.error('❌ Error: Please provide backup folder path');
    console.log('Usage: node scripts/restore-gems-picks.js "path/to/backup/folder"');
    process.exit(1);
  }
  
  if (!fs.existsSync(backupPath)) {
    console.error('❌ Error: Backup folder not found:', backupPath);
    process.exit(1);
  }
  
  console.log('🔄 Starting restore from backup...\n');
  console.log(`📂 Backup location: ${backupPath}\n`);
  
  try {
    // Step 1: Load retailers
    const retailersPath = path.join(backupPath, 'retailers.json');
    if (!fs.existsSync(retailersPath)) {
      console.error('❌ Error: retailers.json not found in backup');
      process.exit(1);
    }
    
    console.log('📥 Loading retailers...');
    const retailers = JSON.parse(fs.readFileSync(retailersPath, 'utf-8'));
    console.log(`   ✅ Loaded ${retailers.length} retailers\n`);
    
    // Step 2: Load products
    const productsPath = path.join(backupPath, 'curated-products.json');
    if (!fs.existsSync(productsPath)) {
      console.error('❌ Error: curated-products.json not found in backup');
      process.exit(1);
    }
    
    console.log('📥 Loading products...');
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
    console.log(`   ✅ Loaded ${products.length} products\n`);
    
    // Step 3: Restore retailers first
    console.log('📦 Restoring retailers...');
    let retailersRestored = 0;
    
    for (const retailer of retailers) {
      // Remove nested data
      const { _count, ...retailerData } = retailer;
      
      await prisma.retailer.upsert({
        where: { id: retailer.id },
        update: retailerData,
        create: retailerData
      });
      
      retailersRestored++;
      
      if (retailersRestored % 10 === 0) {
        console.log(`   📦 Restored ${retailersRestored}/${retailers.length} retailers...`);
      }
    }
    
    console.log(`   ✅ Restored ${retailersRestored} retailers\n`);
    
    // Step 4: Restore products
    console.log('📦 Restoring products...');
    let productsRestored = 0;
    
    for (const product of products) {
      // Remove nested data and computed fields
      const { retailer, _count, ...productData } = product;
      
      await prisma.product.upsert({
        where: { id: product.id },
        update: productData,
        create: productData
      });
      
      productsRestored++;
      
      if (productsRestored % 50 === 0) {
        console.log(`   📦 Restored ${productsRestored}/${products.length} products...`);
      }
    }
    
    console.log(`   ✅ Restored ${productsRestored} products\n`);
    
    // Step 5: Verify
    console.log('🔍 Verifying restore...');
    const curatedCount = await prisma.product.count({
      where: { sourceType: 'CURATED_PRODUCT' }
    });
    
    console.log(`   📊 CURATED_PRODUCT in database: ${curatedCount}`);
    console.log(`   📊 Expected: ${products.length}`);
    
    if (curatedCount === products.length) {
      console.log('   ✅ Verification successful!\n');
    } else {
      console.log('   ⚠️  Count mismatch - some products may not have restored\n');
    }
    
    // Step 6: Summary
    console.log('✅ Restore Complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Retailers restored: ${retailersRestored}`);
    console.log(`   ✅ Products restored: ${productsRestored}`);
    console.log(`   ✅ Database verified\n`);
    
  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restore();
