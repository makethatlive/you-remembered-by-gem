/**
 * Clean Database for Fresh Product Import
 * Deletes: Gift Items → Gift Lists → Products
 * Keeps: Recipients, Subscribers, Users, Retailers
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

async function cleanForImport() {
  try {
    // Count what will be deleted
    const giftItemCount = await prisma.giftItem.count();
    const giftListCount = await prisma.giftList.count();
    const productCount = await prisma.product.count();
    
    console.log(`\n🧹 CLEAN DATABASE FOR FRESH IMPORT`);
    console.log(`════════════════════════════════════════════`);
    console.log(`\n📊 Current database contents:`);
    console.log(`   Gift Items: ${giftItemCount}`);
    console.log(`   Gift Lists: ${giftListCount}`);
    console.log(`   Products: ${productCount}`);
    
    console.log(`\n⚠️  This will DELETE:`);
    console.log(`   ❌ All ${giftItemCount} gift items`);
    console.log(`   ❌ All ${giftListCount} gift lists`);
    console.log(`   ❌ All ${productCount} products`);
    
    console.log(`\n✅ This will KEEP:`);
    console.log(`   ✓ All recipients (they'll just have no gifts yet)`);
    console.log(`   ✓ All subscribers`);
    console.log(`   ✓ All users`);
    console.log(`   ✓ All retailers`);
    console.log(`   ✓ All email logs`);
    
    console.log(`\n💾 Backup saved at:`);
    console.log(`   D:\\you-remembered-by-gem\\database-backups\\backup-2026-09-15T14-02-53`);
    
    console.log(`\n⚠️  WARNING: This operation cannot be undone!`);
    console.log(`   (But you can restore from backup if needed)\n`);
    
    const confirm = await question('Type "CLEAN DATABASE" to proceed: ');
    
    if (confirm !== 'CLEAN DATABASE') {
      console.log('\n❌ Operation cancelled. Nothing was deleted.');
      rl.close();
      process.exit(0);
    }
    
    rl.close();
    
    console.log(`\n🧹 Cleaning database...`);
    console.log(`════════════════════════════════════════════\n`);
    
    // Step 1: Delete Gift Items (they depend on products and gift lists)
    if (giftItemCount > 0) {
      console.log(`🗑️  Deleting ${giftItemCount} gift items...`);
      const result1 = await prisma.giftItem.deleteMany();
      console.log(`   ✅ ${result1.count} gift items deleted\n`);
    } else {
      console.log(`ℹ️  No gift items to delete\n`);
    }
    
    // Step 2: Delete Gift Lists (they depend on recipients)
    if (giftListCount > 0) {
      console.log(`🗑️  Deleting ${giftListCount} gift lists...`);
      const result2 = await prisma.giftList.deleteMany();
      console.log(`   ✅ ${result2.count} gift lists deleted\n`);
    } else {
      console.log(`ℹ️  No gift lists to delete\n`);
    }
    
    // Step 3: Delete Products (they depend on retailers)
    if (productCount > 0) {
      console.log(`🗑️  Deleting ${productCount} products...`);
      const result3 = await prisma.product.deleteMany();
      console.log(`   ✅ ${result3.count} products deleted\n`);
    } else {
      console.log(`ℹ️  No products to delete\n`);
    }
    
    console.log(`════════════════════════════════════════════`);
    console.log(`✅ DATABASE CLEANED SUCCESSFULLY!`);
    console.log(`════════════════════════════════════════════\n`);
    
    // Show what remains
    const remainingCounts = {
      recipients: await prisma.recipient.count(),
      subscribers: await prisma.subscriber.count(),
      users: await prisma.user.count(),
      retailers: await prisma.retailer.count(),
      emailLogs: await prisma.emailLog.count(),
    };
    
    console.log(`📊 What's still in the database:`);
    console.log(`   Recipients: ${remainingCounts.recipients}`);
    console.log(`   Subscribers: ${remainingCounts.subscribers}`);
    console.log(`   Users: ${remainingCounts.users}`);
    console.log(`   Retailers: ${remainingCounts.retailers}`);
    console.log(`   Email Logs: ${remainingCounts.emailLogs}`);
    
    console.log(`\n✨ Database is ready for fresh product import!`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Prepare your CSV file with correct product data`);
    console.log(`   2. Run: npm run import:products "path/to/your-products.csv"`);
    console.log(`   3. Test gift generation to verify products are correctly tagged\n`);
    
    console.log(`🔄 If you need to restore your old data:`);
    console.log(`   Run: npm run restore:db\n`);

  } catch (error) {
    console.error('\n❌ Cleaning failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanForImport();
