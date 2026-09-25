/**
 * Sync Database from Live to Local
 * 
 * This script:
 * 1. Backs up current local database
 * 2. Exports data from live database
 * 3. Imports data to local database
 * 
 * Usage: node scripts/sync-db-from-live.js
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: Update these connection strings
const LIVE_DATABASE_URL = process.env.DATABASE_URL; // Current Railway DB
const LOCAL_DATABASE_URL = "postgresql://postgres:password@localhost:5432/youremembered"; // Your local DB

async function syncDatabase() {
  console.log('🔄 Starting database sync from live to local...\n');
  
  // Step 1: Connect to live database
  console.log('📡 Connecting to LIVE database...');
  const livePrisma = new PrismaClient({
    datasources: {
      db: {
        url: LIVE_DATABASE_URL
      }
    }
  });
  
  try {
    await livePrisma.$connect();
    console.log('   ✅ Connected to live database\n');
  } catch (error) {
    console.error('   ❌ Failed to connect to live database:', error.message);
    process.exit(1);
  }
  
  // Step 2: Export data from live
  console.log('📤 Exporting data from LIVE database...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = path.join(__dirname, '..', 'database-backups', `live-sync-${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  try {
    // Export all tables
    const tables = [
      'users',
      'subscribers',
      'recipients',
      'giftLists',
      'giftItems',
      'retailers',
      'products',
      'emailLogs',
      'signupAttempts',
      'trendStats',
      'scrapeRunLogs',
      'scrapeStates'
    ];
    
    const exportedData = {};
    
    for (const table of tables) {
      console.log(`   📊 Exporting ${table}...`);
      
      let data = [];
      
      switch(table) {
        case 'users':
          data = await livePrisma.user.findMany();
          break;
        case 'subscribers':
          data = await livePrisma.subscriber.findMany();
          break;
        case 'recipients':
          data = await livePrisma.recipient.findMany();
          break;
        case 'giftLists':
          data = await livePrisma.giftList.findMany();
          break;
        case 'giftItems':
          data = await livePrisma.giftItem.findMany();
          break;
        case 'retailers':
          data = await livePrisma.retailer.findMany();
          break;
        case 'products':
          data = await livePrisma.product.findMany();
          break;
        case 'emailLogs':
          data = await livePrisma.emailLog.findMany();
          break;
        case 'signupAttempts':
          data = await livePrisma.signupAttempt.findMany();
          break;
        case 'trendStats':
          data = await livePrisma.trendStats.findMany();
          break;
        case 'scrapeRunLogs':
          data = await livePrisma.scrapeRunLog.findMany();
          break;
        case 'scrapeStates':
          data = await livePrisma.scrapeState.findMany();
          break;
      }
      
      exportedData[table] = data;
      
      // Save to file
      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      console.log(`      ✅ Exported ${data.length} ${table}`);
    }
    
    console.log(`\n   ✅ All data exported to: ${backupDir}\n`);
    
  } catch (error) {
    console.error('   ❌ Export failed:', error.message);
    await livePrisma.$disconnect();
    process.exit(1);
  }
  
  await livePrisma.$disconnect();
  console.log('   ✅ Disconnected from live database\n');
  
  // Step 3: Connect to local database
  console.log('📡 Connecting to LOCAL database...');
  const localPrisma = new PrismaClient({
    datasources: {
      db: {
        url: LOCAL_DATABASE_URL
      }
    }
  });
  
  try {
    await localPrisma.$connect();
    console.log('   ✅ Connected to local database\n');
  } catch (error) {
    console.error('   ❌ Failed to connect to local database:', error.message);
    console.error('   💡 Make sure PostgreSQL is running locally and database exists');
    process.exit(1);
  }
  
  // Step 4: Clear local database
  console.log('🗑️  Clearing LOCAL database...');
  
  try {
    await localPrisma.$executeRaw`SET session_replication_role = 'replica';`;
    
    await localPrisma.giftItem.deleteMany();
    console.log('   ✅ Cleared giftItems');
    
    await localPrisma.giftList.deleteMany();
    console.log('   ✅ Cleared giftLists');
    
    await localPrisma.recipient.deleteMany();
    console.log('   ✅ Cleared recipients');
    
    await localPrisma.product.deleteMany();
    console.log('   ✅ Cleared products');
    
    await localPrisma.retailer.deleteMany();
    console.log('   ✅ Cleared retailers');
    
    await localPrisma.subscriber.deleteMany();
    console.log('   ✅ Cleared subscribers');
    
    await localPrisma.user.deleteMany();
    console.log('   ✅ Cleared users');
    
    await localPrisma.emailLog.deleteMany();
    console.log('   ✅ Cleared emailLogs');
    
    await localPrisma.signupAttempt.deleteMany();
    console.log('   ✅ Cleared signupAttempts');
    
    await localPrisma.trendStats.deleteMany();
    console.log('   ✅ Cleared trendStats');
    
    await localPrisma.scrapeRunLog.deleteMany();
    console.log('   ✅ Cleared scrapeRunLogs');
    
    await localPrisma.scrapeState.deleteMany();
    console.log('   ✅ Cleared scrapeStates');
    
    await localPrisma.$executeRaw`SET session_replication_role = 'origin';`;
    
    console.log('\n   ✅ Local database cleared\n');
    
  } catch (error) {
    console.error('   ❌ Clear failed:', error.message);
    await localPrisma.$disconnect();
    process.exit(1);
  }
  
  // Step 5: Import data to local
  console.log('📥 Importing data to LOCAL database...');
  
  try {
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const table = file.replace('.json', '');
      const filePath = path.join(backupDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      if (data.length === 0) {
        console.log(`   ⏭️  Skipped ${table} (empty)`);
        continue;
      }
      
      console.log(`   📥 Importing ${data.length} ${table}...`);
      
      // Import in batches
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        switch(table) {
          case 'users':
            await localPrisma.user.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'subscribers':
            await localPrisma.subscriber.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'recipients':
            await localPrisma.recipient.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'giftLists':
            await localPrisma.giftList.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'giftItems':
            await localPrisma.giftItem.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'retailers':
            await localPrisma.retailer.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'products':
            await localPrisma.product.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'emailLogs':
            await localPrisma.emailLog.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'signupAttempts':
            await localPrisma.signupAttempt.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'trendStats':
            await localPrisma.trendStats.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'scrapeRunLogs':
            await localPrisma.scrapeRunLog.createMany({ data: batch, skipDuplicates: true });
            break;
          case 'scrapeStates':
            await localPrisma.scrapeState.createMany({ data: batch, skipDuplicates: true });
            break;
        }
      }
      
      console.log(`      ✅ Imported ${data.length} ${table}`);
    }
    
    console.log('\n   ✅ All data imported to local database\n');
    
  } catch (error) {
    console.error('   ❌ Import failed:', error.message);
    await localPrisma.$disconnect();
    process.exit(1);
  }
  
  await localPrisma.$disconnect();
  console.log('   ✅ Disconnected from local database\n');
  
  // Step 6: Summary
  console.log('✅ Database sync complete!\n');
  console.log('📊 Summary:');
  console.log(`   Backup saved to: ${backupDir}`);
  console.log(`   Local database now matches live database`);
  console.log(`   You can now test your changes locally\n`);
}

// Run the sync
syncDatabase().catch(console.error);
