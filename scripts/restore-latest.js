/**
 * Restore Latest Backup Script
 * Automatically restores the most recent backup without prompts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function restoreLatestBackup() {
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
  
  const latestBackup = backups[0];
  const backupDir = path.join(backupsDir, latestBackup);
  const metadataPath = path.join(backupDir, 'metadata.json');
  
  if (!fs.existsSync(metadataPath)) {
    console.error('❌ Backup metadata not found!');
    process.exit(1);
  }
  
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  
  console.log(`\n🔄 RESTORING LATEST BACKUP`);
  console.log(`════════════════════════════════════════════`);
  console.log(`   Backup: ${latestBackup}`);
  console.log(`   Date: ${new Date(metadata.timestamp).toLocaleString()}`);
  console.log(`   Products: ${metadata.counts.products}`);
  console.log(`   Recipients: ${metadata.counts.recipients}`);
  console.log(`   Subscribers: ${metadata.counts.subscribers}`);
  console.log(`════════════════════════════════════════════\n`);

  try {
    // Delete existing data (in reverse order due to foreign keys)
    console.log('🗑️  Step 1: Deleting existing data...\n');
    
    console.log('   Deleting gift items...');
    await prisma.giftItem.deleteMany();
    console.log('   ✅ Gift items deleted\n');
    
    console.log('   Deleting gift lists...');
    await prisma.giftList.deleteMany();
    console.log('   ✅ Gift lists deleted\n');
    
    console.log('   Deleting recipients...');
    await prisma.recipient.deleteMany();
    console.log('   ✅ Recipients deleted\n');
    
    console.log('   Deleting subscribers...');
    await prisma.subscriber.deleteMany();
    console.log('   ✅ Subscribers deleted\n');
    
    console.log('   Deleting email logs...');
    await prisma.emailLog.deleteMany();
    console.log('   ✅ Email logs deleted\n');
    
    console.log('   Deleting products...');
    await prisma.product.deleteMany();
    console.log('   ✅ Products deleted\n');
    
    console.log('   Deleting retailers...');
    await prisma.retailer.deleteMany();
    console.log('   ✅ Retailers deleted\n');
    
    console.log('   Deleting scrape states...');
    await prisma.scrapeState.deleteMany();
    console.log('   ✅ Scrape states deleted\n');
    
    console.log('   ℹ️  Users NOT deleted (for safety)\n');

    // Restore data (in correct order due to foreign keys)
    console.log('📥 Step 2: Restoring data from backup...\n');
    
    // Retailers first (products depend on them)
    console.log('   Restoring retailers...');
    const retailers = JSON.parse(fs.readFileSync(path.join(backupDir, 'retailers.json'), 'utf8'));
    for (const retailer of retailers) {
      // Use upsert to avoid duplicate key errors
      await prisma.retailer.upsert({
        where: { id: retailer.id },
        update: retailer,
        create: retailer
      });
    }
    console.log(`   ✅ ${retailers.length} retailers restored\n`);
    
    // Products (use batch inserts for speed)
    console.log('   Restoring products...');
    const products = JSON.parse(fs.readFileSync(path.join(backupDir, 'products.json'), 'utf8'));
    
    // Batch insert products in chunks of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map(product => {
          const { retailer, ...productData } = product;
          return prisma.product.create({ data: productData });
        })
      );
      if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= products.length) {
        console.log(`   ... ${Math.min(i + BATCH_SIZE, products.length)}/${products.length} products restored`);
      }
    }
    console.log(`   ✅ ${products.length} products restored\n`);
    
    // Subscribers
    console.log('   Restoring subscribers...');
    const subscribers = JSON.parse(fs.readFileSync(path.join(backupDir, 'subscribers.json'), 'utf8'));
    for (const subscriber of subscribers) {
      await prisma.subscriber.create({ data: subscriber });
    }
    console.log(`   ✅ ${subscribers.length} subscribers restored\n`);
    
    // Recipients
    console.log('   Restoring recipients...');
    const recipients = JSON.parse(fs.readFileSync(path.join(backupDir, 'recipients.json'), 'utf8'));
    for (const recipient of recipients) {
      const { subscriber, ...recipientData } = recipient;
      await prisma.recipient.create({ data: recipientData });
    }
    console.log(`   ✅ ${recipients.length} recipients restored\n`);
    
    // Gift Lists
    console.log('   Restoring gift lists...');
    const giftLists = JSON.parse(fs.readFileSync(path.join(backupDir, 'giftLists.json'), 'utf8'));
    for (const giftList of giftLists) {
      const { recipient, subscriber, ...giftListData } = giftList;
      await prisma.giftList.create({ data: giftListData });
    }
    console.log(`   ✅ ${giftLists.length} gift lists restored\n`);
    
    // Gift Items
    console.log('   Restoring gift items...');
    const giftItems = JSON.parse(fs.readFileSync(path.join(backupDir, 'giftItems.json'), 'utf8'));
    for (const giftItem of giftItems) {
      const { product, giftList, ...giftItemData } = giftItem;
      await prisma.giftItem.create({ data: giftItemData });
    }
    console.log(`   ✅ ${giftItems.length} gift items restored\n`);
    
    // Email Logs
    console.log('   Restoring email logs...');
    const emailLogs = JSON.parse(fs.readFileSync(path.join(backupDir, 'emailLogs.json'), 'utf8'));
    for (const log of emailLogs) {
      await prisma.emailLog.create({ data: log });
    }
    console.log(`   ✅ ${emailLogs.length} email logs restored\n`);
    
    // Scrape States
    console.log('   Restoring scrape states...');
    const scrapeStates = JSON.parse(fs.readFileSync(path.join(backupDir, 'scrapeStates.json'), 'utf8'));
    for (const state of scrapeStates) {
      await prisma.scrapeState.create({ data: state });
    }
    console.log(`   ✅ ${scrapeStates.length} scrape states restored\n`);

    console.log(`════════════════════════════════════════════`);
    console.log(`✅ DATABASE RESTORE COMPLETE!`);
    console.log(`════════════════════════════════════════════\n`);
    console.log(`📊 Restored:`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Retailers: ${retailers.length}`);
    console.log(`   Subscribers: ${subscribers.length}`);
    console.log(`   Recipients: ${recipients.length}`);
    console.log(`   Gift Lists: ${giftLists.length}`);
    console.log(`   Gift Items: ${giftItems.length}\n`);

  } catch (error) {
    console.error('\n❌ Restore failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restoreLatestBackup();
