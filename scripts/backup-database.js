/**
 * Complete Database Backup Script
 * Backs up all tables with data to JSON files
 * Run before deleting products to test new imports
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const backupDir = path.join(__dirname, '..', 'database-backups', `backup-${timestamp}`);
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log(`📦 Starting database backup...`);
  console.log(`📁 Backup directory: ${backupDir}\n`);

  try {
    // Backup Products
    console.log('💾 Backing up Products...');
    const products = await prisma.product.findMany({
      include: { retailer: true }
    });
    fs.writeFileSync(
      path.join(backupDir, 'products.json'),
      JSON.stringify(products, null, 2)
    );
    console.log(`   ✅ ${products.length} products backed up`);

    // Backup Retailers
    console.log('💾 Backing up Retailers...');
    const retailers = await prisma.retailer.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'retailers.json'),
      JSON.stringify(retailers, null, 2)
    );
    console.log(`   ✅ ${retailers.length} retailers backed up`);

    // Backup Subscribers
    console.log('💾 Backing up Subscribers...');
    const subscribers = await prisma.subscriber.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'subscribers.json'),
      JSON.stringify(subscribers, null, 2)
    );
    console.log(`   ✅ ${subscribers.length} subscribers backed up`);

    // Backup Recipients
    console.log('💾 Backing up Recipients...');
    const recipients = await prisma.recipient.findMany({
      include: { subscriber: true }
    });
    fs.writeFileSync(
      path.join(backupDir, 'recipients.json'),
      JSON.stringify(recipients, null, 2)
    );
    console.log(`   ✅ ${recipients.length} recipients backed up`);

    // Backup Gift Lists
    console.log('💾 Backing up Gift Lists...');
    const giftLists = await prisma.giftList.findMany({
      include: {
        recipient: true,
        subscriber: true
      }
    });
    fs.writeFileSync(
      path.join(backupDir, 'giftLists.json'),
      JSON.stringify(giftLists, null, 2)
    );
    console.log(`   ✅ ${giftLists.length} gift lists backed up`);

    // Backup Gift Items
    console.log('💾 Backing up Gift Items...');
    const giftItems = await prisma.giftItem.findMany({
      include: {
        product: true,
        giftList: true
      }
    });
    fs.writeFileSync(
      path.join(backupDir, 'giftItems.json'),
      JSON.stringify(giftItems, null, 2)
    );
    console.log(`   ✅ ${giftItems.length} gift items backed up`);

    // Backup Users
    console.log('💾 Backing up Users...');
    const users = await prisma.user.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'users.json'),
      JSON.stringify(users, null, 2)
    );
    console.log(`   ✅ ${users.length} users backed up`);

    // Backup Email Logs
    console.log('💾 Backing up Email Logs...');
    const emailLogs = await prisma.emailLog.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'emailLogs.json'),
      JSON.stringify(emailLogs, null, 2)
    );
    console.log(`   ✅ ${emailLogs.length} email logs backed up`);

    // Backup Scrape States
    console.log('💾 Backing up Scrape States...');
    const scrapeStates = await prisma.scrapeState.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'scrapeStates.json'),
      JSON.stringify(scrapeStates, null, 2)
    );
    console.log(`   ✅ ${scrapeStates.length} scrape states backed up`);

    // Create backup metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      databaseUrl: process.env.DATABASE_URL ? 'Set (hidden)' : 'Not set',
      counts: {
        products: products.length,
        retailers: retailers.length,
        subscribers: subscribers.length,
        recipients: recipients.length,
        giftLists: giftLists.length,
        giftItems: giftItems.length,
        users: users.length,
        emailLogs: emailLogs.length,
        scrapeStates: scrapeStates.length
      }
    };
    
    fs.writeFileSync(
      path.join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Save Prisma schema
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
    if (fs.existsSync(schemaPath)) {
      fs.copyFileSync(schemaPath, path.join(backupDir, 'schema.prisma'));
      console.log('💾 Backing up Prisma schema...');
      console.log(`   ✅ Schema file backed up`);
    }

    console.log(`\n✅ DATABASE BACKUP COMPLETE!`);
    console.log(`📁 Location: ${backupDir}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Retailers: ${retailers.length}`);
    console.log(`   Subscribers: ${subscribers.length}`);
    console.log(`   Recipients: ${recipients.length}`);
    console.log(`   Gift Lists: ${giftLists.length}`);
    console.log(`   Gift Items: ${giftItems.length}`);
    console.log(`   Users: ${users.length}`);
    console.log(`\n💡 To restore this backup later, use: npm run restore-backup`);

  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
