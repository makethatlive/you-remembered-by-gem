/**
 * Database Restore Script
 * Restores data from a backup directory
 * WARNING: This will DELETE existing data before restoring!
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function restoreDatabase() {
  const backupsDir = path.join(__dirname, '..', 'database-backups');
  
  // List available backups
  if (!fs.existsSync(backupsDir)) {
    console.error('❌ No backups directory found!');
    process.exit(1);
  }
  
  const backups = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup-'))
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    console.error('❌ No backups found!');
    process.exit(1);
  }
  
  console.log('📦 Available backups:\n');
  backups.forEach((backup, i) => {
    const metadataPath = path.join(backupsDir, backup, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      console.log(`${i + 1}. ${backup}`);
      console.log(`   Date: ${new Date(metadata.timestamp).toLocaleString()}`);
      console.log(`   Products: ${metadata.counts.products}`);
      console.log(`   Recipients: ${metadata.counts.recipients}`);
      console.log('');
    }
  });
  
  const answer = await question('\nEnter backup number to restore (or "cancel" to exit): ');
  
  if (answer.toLowerCase() === 'cancel') {
    console.log('Restore cancelled.');
    rl.close();
    process.exit(0);
  }
  
  const backupIndex = parseInt(answer) - 1;
  if (isNaN(backupIndex) || backupIndex < 0 || backupIndex >= backups.length) {
    console.error('❌ Invalid backup number!');
    rl.close();
    process.exit(1);
  }
  
  const backupDir = path.join(backupsDir, backups[backupIndex]);
  
  console.log(`\n⚠️  WARNING: This will DELETE all existing data and restore from backup!`);
  const confirm = await question('Type "YES" to confirm: ');
  
  if (confirm !== 'YES') {
    console.log('Restore cancelled.');
    rl.close();
    process.exit(0);
  }
  
  rl.close();
  
  console.log(`\n🔄 Restoring from: ${backups[backupIndex]}\n`);

  try {
    // Delete existing data (in reverse order due to foreign keys)
    console.log('🗑️  Deleting existing data...');
    
    await prisma.giftItem.deleteMany();
    console.log('   ✅ Gift items deleted');
    
    await prisma.giftList.deleteMany();
    console.log('   ✅ Gift lists deleted');
    
    await prisma.recipient.deleteMany();
    console.log('   ✅ Recipients deleted');
    
    await prisma.subscriber.deleteMany();
    console.log('   ✅ Subscribers deleted');
    
    await prisma.emailLog.deleteMany();
    console.log('   ✅ Email logs deleted');
    
    await prisma.product.deleteMany();
    console.log('   ✅ Products deleted');
    
    await prisma.retailer.deleteMany();
    console.log('   ✅ Retailers deleted');
    
    await prisma.scrapeState.deleteMany();
    console.log('   ✅ Scrape states deleted');
    
    // Note: Users are NOT deleted for safety
    console.log('   ℹ️  Users NOT deleted (for safety)');

    // Restore data (in correct order due to foreign keys)
    console.log('\n📥 Restoring data...');
    
    // Retailers first (products depend on them)
    const retailers = JSON.parse(fs.readFileSync(path.join(backupDir, 'retailers.json'), 'utf8'));
    for (const retailer of retailers) {
      await prisma.retailer.create({ data: retailer });
    }
    console.log(`   ✅ ${retailers.length} retailers restored`);
    
    // Products
    const products = JSON.parse(fs.readFileSync(path.join(backupDir, 'products.json'), 'utf8'));
    for (const product of products) {
      const { retailer, ...productData } = product;
      await prisma.product.create({ data: productData });
    }
    console.log(`   ✅ ${products.length} products restored`);
    
    // Subscribers
    const subscribers = JSON.parse(fs.readFileSync(path.join(backupDir, 'subscribers.json'), 'utf8'));
    for (const subscriber of subscribers) {
      await prisma.subscriber.create({ data: subscriber });
    }
    console.log(`   ✅ ${subscribers.length} subscribers restored`);
    
    // Recipients
    const recipients = JSON.parse(fs.readFileSync(path.join(backupDir, 'recipients.json'), 'utf8'));
    for (const recipient of recipients) {
      const { subscriber, ...recipientData } = recipient;
      await prisma.recipient.create({ data: recipientData });
    }
    console.log(`   ✅ ${recipients.length} recipients restored`);
    
    // Gift Lists
    const giftLists = JSON.parse(fs.readFileSync(path.join(backupDir, 'giftLists.json'), 'utf8'));
    for (const giftList of giftLists) {
      const { recipient, subscriber, ...giftListData } = giftList;
      await prisma.giftList.create({ data: giftListData });
    }
    console.log(`   ✅ ${giftLists.length} gift lists restored`);
    
    // Gift Items
    const giftItems = JSON.parse(fs.readFileSync(path.join(backupDir, 'giftItems.json'), 'utf8'));
    for (const giftItem of giftItems) {
      const { product, giftList, ...giftItemData } = giftItem;
      await prisma.giftItem.create({ data: giftItemData });
    }
    console.log(`   ✅ ${giftItems.length} gift items restored`);
    
    // Email Logs
    const emailLogs = JSON.parse(fs.readFileSync(path.join(backupDir, 'emailLogs.json'), 'utf8'));
    for (const log of emailLogs) {
      await prisma.emailLog.create({ data: log });
    }
    console.log(`   ✅ ${emailLogs.length} email logs restored`);
    
    // Scrape States
    const scrapeStates = JSON.parse(fs.readFileSync(path.join(backupDir, 'scrapeStates.json'), 'utf8'));
    for (const state of scrapeStates) {
      await prisma.scrapeState.create({ data: state });
    }
    console.log(`   ✅ ${scrapeStates.length} scrape states restored`);

    console.log(`\n✅ DATABASE RESTORE COMPLETE!`);
    console.log(`📊 All data has been restored from backup.`);

  } catch (error) {
    console.error('\n❌ Restore failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restoreDatabase();
