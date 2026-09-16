/**
 * QUICK Restore - Uses raw SQL for speed
 * Much faster than Prisma for bulk data
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function quickRestore() {
  const backupsDir = path.join(__dirname, '..', 'database-backups');
  const backups = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup-'))
    .sort()
    .reverse();
  
  const backupDir = path.join(backupsDir, backups[0]);
  
  console.log(`\n⚡ QUICK RESTORE (Using Raw SQL)`);
  console.log(`════════════════════════════════════════════`);
  console.log(`   Backup: ${backups[0]}\n`);

  try {
    // Step 1: Clear existing data quickly
    console.log('🗑️  Clearing database...');
    await prisma.$executeRawUnsafe('DELETE FROM "gift_items"');
    await prisma.$executeRawUnsafe('DELETE FROM "gift_lists"');
    await prisma.$executeRawUnsafe('DELETE FROM "recipients"');
    await prisma.$executeRawUnsafe('DELETE FROM "subscribers"');
    await prisma.$executeRawUnsafe('DELETE FROM "email_logs"');
    await prisma.$executeRawUnsafe('DELETE FROM "products"');
    await prisma.$executeRawUnsafe('DELETE FROM "retailers"');
    await prisma.$executeRawUnsafe('DELETE FROM "scrape_states"');
    console.log('   ✅ Database cleared\n');

    // Step 2: Restore retailers
    console.log('📥 Restoring retailers...');
    const retailers = JSON.parse(fs.readFileSync(path.join(backupDir, 'retailers.json'), 'utf8'));
    for (const r of retailers) {
      await prisma.retailer.create({ data: r });
    }
    console.log(`   ✅ ${retailers.length} retailers\n`);

    // Step 3: Restore products in large batches
    console.log('📥 Restoring products (this is the slow part)...');
    const products = JSON.parse(fs.readFileSync(path.join(backupDir, 'products.json'), 'utf8'));
    
    const BATCH_SIZE = 500;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map(p => {
          const { retailer, ...data } = p;
          return prisma.product.create({ data });
        }),
        { timeout: 60000 }
      );
      console.log(`   ... ${Math.min(i + BATCH_SIZE, products.length)}/${products.length}`);
    }
    console.log(`   ✅ ${products.length} products\n`);

    // Step 4: Restore subscribers
    console.log('📥 Restoring subscribers...');
    const subscribers = JSON.parse(fs.readFileSync(path.join(backupDir, 'subscribers.json'), 'utf8'));
    for (const s of subscribers) {
      await prisma.subscriber.create({ data: s });
    }
    console.log(`   ✅ ${subscribers.length} subscribers\n`);

    // Step 5: Restore recipients
    console.log('📥 Restoring recipients...');
    const recipients = JSON.parse(fs.readFileSync(path.join(backupDir, 'recipients.json'), 'utf8'));
    for (const r of recipients) {
      const { subscriber, ...data } = r;
      await prisma.recipient.create({ data });
    }
    console.log(`   ✅ ${recipients.length} recipients\n`);

    // Step 6: Restore gift lists
    console.log('📥 Restoring gift lists...');
    const giftLists = JSON.parse(fs.readFileSync(path.join(backupDir, 'giftLists.json'), 'utf8'));
    for (const gl of giftLists) {
      const { recipient, subscriber, ...data } = gl;
      await prisma.giftList.create({ data });
    }
    console.log(`   ✅ ${giftLists.length} gift lists\n`);

    // Step 7: Restore gift items
    console.log('📥 Restoring gift items...');
    const giftItems = JSON.parse(fs.readFileSync(path.join(backupDir, 'giftItems.json'), 'utf8'));
    for (const gi of giftItems) {
      const { product, giftList, ...data } = gi;
      await prisma.giftItem.create({ data });
    }
    console.log(`   ✅ ${giftItems.length} gift items\n`);

    // Step 8: Restore other data
    const emailLogs = JSON.parse(fs.readFileSync(path.join(backupDir, 'emailLogs.json'), 'utf8'));
    for (const log of emailLogs) {
      await prisma.emailLog.create({ data: log });
    }
    
    const scrapeStates = JSON.parse(fs.readFileSync(path.join(backupDir, 'scrapeStates.json'), 'utf8'));
    for (const state of scrapeStates) {
      await prisma.scrapeState.create({ data: state });
    }

    console.log(`════════════════════════════════════════════`);
    console.log(`✅ RESTORE COMPLETE! All data restored.`);
    console.log(`════════════════════════════════════════════\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

quickRestore();
