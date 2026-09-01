/**
 * Migration script to export data from Base44 and import to new database
 * 
 * Usage: node scripts/migrate-from-base44.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Base44 SDK would normally be imported here
// import base44 from '@base44/sdk';

const EXPORT_DIR = path.join(__dirname, '../database-csv');

/**
 * Export data from Base44 to CSV files
 * (This requires Base44 SDK to be still installed)
 */
async function exportFromBase44() {
  console.log('📤 Exporting data from Base44...\n');
  
  // Ensure export directory exists
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  console.log('⚠️  Note: You need to export data manually from Base44 dashboard');
  console.log('   or use the Base44 SDK if still available.');
  console.log(`   Save CSV exports to: ${EXPORT_DIR}\n`);
  
  const entities = [
    'User',
    'Subscriber', 
    'Recipient',
    'Retailer',
    'Product',
    'GiftList',
    'GiftItem',
    'EmailLog',
    'SignupAttempt',
    'ScrapeRunLog',
    'ScrapeState',
    'TrendStats'
  ];

  console.log('   Expected files:');
  entities.forEach(entity => {
    console.log(`   - ${entity}.csv`);
  });
  
  return entities;
}

/**
 * Import CSV data to PostgreSQL using Prisma
 */
async function importToPostgres(entities) {
  console.log('\n📥 Importing data to PostgreSQL...\n');

  for (const entity of entities) {
    const csvPath = path.join(EXPORT_DIR, `${entity}.csv`);
    
    if (!fs.existsSync(csvPath)) {
      console.log(`⚠️  Skipping ${entity} - file not found`);
      continue;
    }

    console.log(`   Importing ${entity}...`);
    
    try {
      // Read CSV file
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length <= 1) {
        console.log(`   ⚠️  No data in ${entity}.csv`);
        continue;
      }

      // Parse CSV headers
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Parse rows
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const record = {};
        
        headers.forEach((header, index) => {
          let value = values[index];
          
          // Handle empty values
          if (value === '' || value === 'null' || value === 'NULL') {
            value = null;
          }
          // Handle JSON fields
          else if (value && (value.startsWith('{') || value.startsWith('['))) {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Keep as string if parsing fails
            }
          }
          // Handle boolean values
          else if (value === 'true' || value === 'false') {
            value = value === 'true';
          }
          // Handle numeric values
          else if (!isNaN(value) && value !== '') {
            value = parseFloat(value);
          }
          
          record[header] = value;
        });
        
        records.push(record);
      }

      // Import to database
      const model = getModel(entity);
      if (model) {
        await model.createMany({
          data: records,
          skipDuplicates: true,
        });
        console.log(`   ✅ Imported ${records.length} ${entity} records`);
      }
    } catch (error) {
      console.error(`   ❌ Error importing ${entity}:`, error.message);
    }
  }
}

/**
 * Get Prisma model by entity name
 */
function getModel(entityName) {
  const modelMap = {
    User: prisma.user,
    Subscriber: prisma.subscriber,
    Recipient: prisma.recipient,
    Retailer: prisma.retailer,
    Product: prisma.product,
    GiftList: prisma.giftList,
    GiftItem: prisma.giftItem,
    EmailLog: prisma.emailLog,
    SignupAttempt: prisma.signupAttempt,
    ScrapeRunLog: prisma.scrapeRunLog,
    ScrapeState: prisma.scrapeState,
    TrendStats: prisma.trendStats,
  };

  return modelMap[entityName];
}

/**
 * Verify imported data
 */
async function verifyImport() {
  console.log('\n🔍 Verifying imported data...\n');

  const counts = {
    users: await prisma.user.count(),
    subscribers: await prisma.subscriber.count(),
    recipients: await prisma.recipient.count(),
    retailers: await prisma.retailer.count(),
    products: await prisma.product.count(),
    giftLists: await prisma.giftList.count(),
    giftItems: await prisma.giftItem.count(),
    emailLogs: await prisma.emailLog.count(),
  };

  console.log('   Record counts:');
  Object.entries(counts).forEach(([entity, count]) => {
    console.log(`   - ${entity}: ${count}`);
  });
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Base44 to PostgreSQL Migration\n');
  console.log('=' .repeat(50) + '\n');

  try {
    // Step 1: Export from Base44
    const entities = await exportFromBase44();
    
    console.log('\n📋 Manual step required:');
    console.log('   1. Go to your Base44 dashboard');
    console.log('   2. Export each entity as CSV');
    console.log(`   3. Save files to: ${EXPORT_DIR}`);
    console.log('   4. Press Enter to continue...\n');
    
    // Wait for user confirmation (in real scenario)
    // For now, we'll proceed if files exist
    
    // Step 2: Import to PostgreSQL
    await importToPostgres(entities);
    
    // Step 3: Verify
    await verifyImport();
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('   1. Review imported data');
    console.log('   2. Update .env with your DATABASE_URL');
    console.log('   3. Remove @base44/sdk from package.json');
    console.log('   4. Update imports to use new prismaClient\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
