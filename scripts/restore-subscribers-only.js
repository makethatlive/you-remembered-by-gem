/**
 * Restore ONLY Subscribers, Recipients, Gift Lists
 * Skip products - you'll import fresh ones
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function restoreSubscribersOnly() {
  const backupsDir = path.join(__dirname, '..', 'database-backups');
  const backups = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup-'))
    .sort()
    .reverse();
  
  const backupDir = path.join(backupsDir, backups[0]);
  
  console.log(`\n⚡ RESTORE SUBSCRIBERS & RECIPIENTS ONLY`);
  console.log(`════════════════════════════════════════════`);
  console.log(`   Backup: ${backups[0]}`);
  console.log(`   Skipping: Products (you'll import fresh ones)\n`);

  try {
    // Clear only subscriber-related data
    console.log('🗑️  Clearing subscriber data...');
    await prisma.$executeRawUnsafe('DELETE FROM "gift_items"');
    await prisma.$executeRawUnsafe('DELETE FROM "gift_lists"');
    await prisma.$executeRawUnsafe('DELETE FROM "recipients"');
    await prisma.$executeRawUnsafe('DELETE FROM "subscribers"');
    await prisma.$executeRawUnsafe('DELETE FROM "email_logs"');
    console.log('   ✅ Cleared\n');

    // Restore subscribers
    console.log('📥 Restoring subscribers...');
    const subscribers = JSON.parse(fs.readFileSync(path.join(backupDir, 'subscribers.json'), 'utf8'));
    for (const s of subscribers) {
      await prisma.subscriber.create({ data: s });
    }
    console.log(`   ✅ ${subscribers.length} subscribers restored\n`);

    // Restore recipients
    console.log('📥 Restoring recipients...');
    const recipients = JSON.parse(fs.readFileSync(path.join(backupDir, 'recipients.json'), 'utf8'));
    for (const r of recipients) {
      const { subscriber, ...data } = r;
      await prisma.recipient.create({ data });
    }
    console.log(`   ✅ ${recipients.length} recipients restored\n`);

    // Restore gift lists
    console.log('📥 Restoring gift lists...');
    const giftLists = JSON.parse(fs.readFileSync(path.join(backupDir, 'giftLists.json'), 'utf8'));
    for (const gl of giftLists) {
      const { recipient, subscriber, ...data } = gl;
      await prisma.giftList.create({ data });
    }
    console.log(`   ✅ ${giftLists.length} gift lists restored\n`);

    // Skip gift items - they reference products that don't exist
    console.log('⚠️  Skipping gift items (they reference old products)\n');

    // Restore email logs
    console.log('📥 Restoring email logs...');
    const emailLogs = JSON.parse(fs.readFileSync(path.join(backupDir, 'emailLogs.json'), 'utf8'));
    for (const log of emailLogs) {
      await prisma.emailLog.create({ data: log });
    }
    console.log(`   ✅ ${emailLogs.length} email logs restored\n`);

    console.log(`════════════════════════════════════════════`);
    console.log(`✅ SUBSCRIBERS RESTORED!`);
    console.log(`════════════════════════════════════════════\n`);
    console.log(`📊 What was restored:`);
    console.log(`   Subscribers: ${subscribers.length}`);
    console.log(`   Recipients: ${recipients.length}`);
    console.log(`   Gift Lists: ${giftLists.length}`);
    console.log(`   Gift Items: 0 (skipped - will regenerate)`);
    console.log(`   Email Logs: ${emailLogs.length}\n`);
    
    console.log(`⚠️  Products were NOT restored (0 products in database)`);
    console.log(`\n💡 Next step: Import your 400 new products`);
    console.log(`   Run: npm run import:products "path/to/your-products.csv"\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restoreSubscribersOnly();
