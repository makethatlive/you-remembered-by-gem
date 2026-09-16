/**
 * Delete All Products Script
 * Removes all products from the database
 * Use before importing fresh product data
 */

import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function deleteAllProducts() {
  try {
    // Count current products
    const productCount = await prisma.product.count();
    const giftItemCount = await prisma.giftItem.count();
    
    console.log(`\n⚠️  WARNING: This will delete ALL products!`);
    console.log(`   Products to delete: ${productCount}`);
    console.log(`   Gift items that reference products: ${giftItemCount}`);
    console.log(`\n   This operation cannot be undone!`);
    console.log(`   Make sure you have a backup! (Run: npm run backup-db)\n`);
    
    const confirm = await question('Type "DELETE ALL PRODUCTS" to confirm: ');
    
    if (confirm !== 'DELETE ALL PRODUCTS') {
      console.log('❌ Operation cancelled.');
      rl.close();
      process.exit(0);
    }
    
    rl.close();
    
    console.log('\n🗑️  Deleting products...');
    
    // Delete gift items first (they reference products)
    if (giftItemCount > 0) {
      console.log('   Deleting gift items...');
      await prisma.giftItem.deleteMany();
      console.log(`   ✅ ${giftItemCount} gift items deleted`);
    }
    
    // Delete products
    console.log('   Deleting products...');
    const result = await prisma.product.deleteMany();
    console.log(`   ✅ ${result.count} products deleted`);
    
    console.log(`\n✅ ALL PRODUCTS DELETED!`);
    console.log(`\n💡 Now you can import fresh products using:`);
    console.log(`   node scripts/import-csv-products.js path/to/your-products.csv`);

  } catch (error) {
    console.error('\n❌ Delete failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllProducts();
