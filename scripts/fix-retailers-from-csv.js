/**
 * Fix Retailers Category and Age Restricted Fields
 * Updates database retailers to match original CSV data
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, '..', 'database-csv', 'Retailer_export.csv');

// Map CSV categories to Prisma enum values
const CATEGORY_MAP = {
  'Men': 'MEN',
  'Women': 'WOMEN',
  'Unisex (Adult)': 'UNISEX_ADULT',
  'Unisex + Kids': 'UNISEX_KIDS',
  'Kids': 'KIDS'
};

async function fixRetailers() {
  console.log(`\n🔧 FIXING RETAILERS FROM CSV`);
  console.log(`════════════════════════════════════════════\n`);

  try {
    // Read and parse CSV
    console.log(`📂 Reading CSV: ${CSV_PATH}\n`);
    const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`   Found ${records.length} retailers in CSV\n`);

    // Get current retailers from database
    const dbRetailers = await prisma.retailer.findMany({
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        category: true,
        containsAgeRestrictedItems: true
      }
    });

    console.log(`   Found ${dbRetailers.length} retailers in database\n`);

    // Create mapping by website URL (normalized)
    const csvByUrl = new Map();
    records.forEach(rec => {
      const url = rec.website_url || '';
      const category = rec.category || '';
      
      if (url && category && CATEGORY_MAP[category]) {
        const normalized = url.toLowerCase().replace(/\/$/, '');
        csvByUrl.set(normalized, {
          category: CATEGORY_MAP[category],
          categoryDisplay: category,
          containsAgeRestrictedItems: rec.contains_age_restricted_items === 'true'
        });
      }
    });

    console.log(`🔄 Updating retailers...\n`);
    
    let updated = 0;
    let skipped = 0;

    for (const retailer of dbRetailers) {
      const url = retailer.websiteUrl?.toLowerCase().replace(/\/$/, '');
      
      if (!url || !csvByUrl.has(url)) {
        skipped++;
        continue;
      }

      const csvData = csvByUrl.get(url);
      
      // Check if update needed
      const needsUpdate = 
        retailer.category !== csvData.category ||
        retailer.containsAgeRestrictedItems !== csvData.containsAgeRestrictedItems;

      if (needsUpdate) {
        await prisma.retailer.update({
          where: { id: retailer.id },
          data: {
            category: csvData.category,
            containsAgeRestrictedItems: csvData.containsAgeRestrictedItems
          }
        });

        console.log(`   ✅ ${retailer.name}`);
        console.log(`      Category: ${retailer.category} → ${csvData.category} (${csvData.categoryDisplay})`);
        console.log(`      Age Restricted: ${retailer.containsAgeRestrictedItems} → ${csvData.containsAgeRestrictedItems}\n`);
        
        updated++;
      }
    }

    console.log(`════════════════════════════════════════════`);
    console.log(`✅ RETAILERS UPDATED!`);
    console.log(`════════════════════════════════════════════\n`);
    console.log(`📊 Summary:`);
    console.log(`   Total retailers in DB: ${dbRetailers.length}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (no match): ${skipped}`);
    console.log(`   No changes needed: ${dbRetailers.length - updated - skipped}\n`);

    // Show category distribution
    const categories = await prisma.retailer.groupBy({
      by: ['category'],
      _count: true,
      orderBy: { category: 'asc' }
    });

    console.log(`📁 Category Distribution:\n`);
    categories.forEach(cat => {
      const displayNames = {
        'MEN': 'Men',
        'WOMEN': 'Women',
        'UNISEX_ADULT': 'Unisex (Adult)',
        'UNISEX_KIDS': 'Unisex + Kids',
        'KIDS': 'Kids'
      };
      console.log(`   ${displayNames[cat.category] || cat.category}: ${cat._count}`);
    });

    const ageRestricted = await prisma.retailer.count({ 
      where: { containsAgeRestrictedItems: true } 
    });
    console.log(`\n🔞 Age Restricted: ${ageRestricted} retailers\n`);

    console.log(`💡 Next step: Check Admin Dashboard → Retailers to verify\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixRetailers();
