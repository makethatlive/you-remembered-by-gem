/**
 * Remove duplicate Gem's Picks products
 * Keeps the oldest (first created) product and removes newer duplicates
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function removeDuplicates() {
  console.log('🔧 Starting Gem\'s Picks Duplicate Cleanup...\n');
  
  try {
    // Step 1: Create backup
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('STEP 1: Creating backup...\n');
    
    const gemsPicks = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT'
      }
    });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = 'gems-picks-export';
    const backupPath = path.join(backupDir, `gems-picks-backup-before-dedup-${timestamp}.json`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    fs.writeFileSync(backupPath, JSON.stringify(gemsPicks, null, 2));
    console.log(`✅ Backup created: ${backupPath}`);
    console.log(`   Total products backed up: ${gemsPicks.length}\n`);
    
    // Step 2: Find exact duplicates
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('STEP 2: Finding exact duplicates...\n');
    
    const exactMap = new Map();
    gemsPicks.forEach(product => {
      const key = `${product.name.trim().toLowerCase()}::${product.retailerId}`;
      if (!exactMap.has(key)) {
        exactMap.set(key, []);
      }
      exactMap.get(key).push(product);
    });
    
    const exactDuplicates = Array.from(exactMap.entries())
      .filter(([key, products]) => products.length > 1)
      .sort((a, b) => b[1].length - a[1].length);
    
    console.log(`Found ${exactDuplicates.length} groups of duplicates\n`);
    
    if (exactDuplicates.length === 0) {
      console.log('✅ No duplicates to remove!\n');
      await prisma.$disconnect();
      return;
    }
    
    // Step 3: Identify products to delete
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('STEP 3: Identifying products to delete...\n');
    
    const idsToDelete = [];
    const productsToKeep = [];
    
    exactDuplicates.forEach(([key, products]) => {
      // Sort by createdAt to keep the oldest
      products.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      const keeper = products[0];
      const duplicates = products.slice(1);
      
      productsToKeep.push(keeper);
      idsToDelete.push(...duplicates.map(p => p.id));
      
      console.log(`"${keeper.name}"`);
      console.log(`   KEEP: ID ${keeper.id} (created: ${keeper.createdAt})`);
      duplicates.forEach(dup => {
        console.log(`   DELETE: ID ${dup.id} (created: ${dup.createdAt})`);
      });
      console.log('');
    });
    
    console.log(`Total products to delete: ${idsToDelete.length}\n`);
    
    // Step 4: Delete duplicates
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('STEP 4: Deleting duplicate products...\n');
    
    console.log('⚠️  This will permanently delete duplicate products.');
    console.log('   Backup has been created.');
    console.log('');
    console.log('Starting deletion in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Delete in batches of 50
    const batchSize = 50;
    let deleted = 0;
    
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      
      const result = await prisma.product.deleteMany({
        where: {
          id: { in: batch }
        }
      });
      
      deleted += result.count;
      console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}: ${result.count} products (${deleted}/${idsToDelete.length})`);
    }
    
    console.log('');
    console.log(`✅ Deleted ${deleted} duplicate products\n`);
    
    // Step 5: Verify
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('STEP 5: Verifying cleanup...\n');
    
    const remaining = await prisma.product.count({
      where: {
        sourceType: 'CURATED_PRODUCT'
      }
    });
    
    console.log(`📊 Before: ${gemsPicks.length} products`);
    console.log(`📊 Deleted: ${deleted} duplicates`);
    console.log(`📊 After: ${remaining} products`);
    console.log(`📊 Expected: ${gemsPicks.length - deleted} products`);
    
    if (remaining === gemsPicks.length - deleted) {
      console.log('');
      console.log('✅ Cleanup successful!\n');
    } else {
      console.log('');
      console.log('⚠️  Count mismatch! Please verify manually.\n');
    }
    
    // Check for remaining duplicates
    const finalCheck = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT'
      },
      select: {
        id: true,
        name: true,
        retailerId: true,
        createdAt: true
      }
    });
    
    const finalMap = new Map();
    finalCheck.forEach(product => {
      const key = `${product.name.trim().toLowerCase()}::${product.retailerId}`;
      if (!finalMap.has(key)) {
        finalMap.set(key, []);
      }
      finalMap.get(key).push(product);
    });
    
    const remainingDuplicates = Array.from(finalMap.values()).filter(arr => arr.length > 1);
    
    if (remainingDuplicates.length === 0) {
      console.log('✅ No duplicates remaining!\n');
    } else {
      console.log(`⚠️  ${remainingDuplicates.length} duplicate groups still remain.\n`);
      console.log('This might be due to products created during cleanup.');
      console.log('Run the script again if needed.\n');
    }
    
    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 CLEANUP COMPLETE!\n');
    console.log(`✅ Backup: ${backupPath}`);
    console.log(`✅ Deleted: ${deleted} duplicate products`);
    console.log(`✅ Remaining: ${remaining} unique Gem's Picks`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

removeDuplicates();
