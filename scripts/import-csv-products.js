import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

function parseCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const products = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => products.push(row))
      .on('end', () => resolve(products))
      .on('error', reject);
  });
}

function parseJSONField(value) {
  if (!value || value === '[]') return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function parseDate(value) {
  if (!value || value === '') return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function normalizeEnum(value, allowedValues) {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (allowedValues.includes(upper)) return upper;
  return null;
}

async function importProducts() {
  try {
    console.log('Reading CSV file...');
    const csvPath = path.join(__dirname, '../database-csv/Product_export.csv');
    
    console.log('Parsing CSV...');
    const products = await parseCSV(csvPath);
    console.log(`Found ${products.length} products in CSV`);
    
    // Get existing product URLs
    console.log('Checking for existing products...');
    const existingProducts = await prisma.product.findMany({
      select: { productUrl: true }
    });
    const existingUrls = new Set(existingProducts.map(p => p.productUrl));
    console.log(`Found ${existingUrls.size} existing products in database`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    const validStatuses = ['NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'INACTIVE', 'ACTIVE'];
    const validGenders = ['MALE', 'FEMALE', 'UNISEX_KIDS', 'UNISEX'];
    const validSourceTypes = ['CURATED_PRODUCT', 'CURATED_RETAILER', 'SHOPIFY_UPLOAD', 'LEGACY_UNKNOWN'];
    const validCategories = [
      '1.1 - JEWELLERY',
      '1.2 - WATCHES',
      '1.3 - FASHION ACCESSORIES',
      '2.1 - BARWARE',
      '2.2 - KITCHENWARE',
      '2.3 - TABLEWARE',
      '2.4 - CANDLES AND HOLDERS',
      '2.5 - HOME DECOR',
      '3.1 - TECH GADGETS',
      '3.2 - STATIONERY',
      '3.3 - BOOKS',
      '4.1 - OUTDOOR AND SPORTS',
      '4.2 - WELLNESS',
      '4.3 - GROOMING',
      '5.1 - GAMES',
      '5.2 - EXPERIENCES',
      '5.3 - HOBBY KITS',
      'FOOD_DRINK',
      'LIFESTYLE',
      'ALL PRODUCTS EXC. FOOD & DRINKS'
    ];
    
    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      
      // Skip if already exists
      if (existingUrls.has(prod.product_url)) {
        skipped++;
        continue;
      }
      
      try {
        // Parse and normalize the data
        const productData = {
          productUrl: prod.product_url || '',
          name: prod.name || '',
          description: prod.description || '',
          price: prod.price ? parseFloat(prod.price) : 0,
          imageUrl: prod.image_url || null,
          affiliateUrl: prod.affiliate_url || null,
          category: normalizeEnum(prod.category, validCategories) || 'LIFESTYLE',
          canonicalCategory: prod.canonical_category || null,
          status: normalizeEnum(prod.status, validStatuses) || 'NEEDS_REVIEW',
          retailerId: prod.retailer_id || null,
          sourceType: normalizeEnum(prod.source_type, validSourceTypes) || 'LEGACY_UNKNOWN',
          genderAppliesTo: normalizeEnum(prod.gender_applies_to?.replace('+', '_')?.replace(/\s/g, '_'), validGenders) || 'UNISEX_KIDS',
          qualityScore: prod.quality_score ? parseFloat(prod.quality_score) : null,
          ageRestricted: prod.age_restricted === 'true',
          interestTags: parseJSONField(prod.interest_tags),
          giftTypeTags: parseJSONField(prod.gift_type_tags),
          searchKeywords: parseJSONField(prod.search_keywords),
          suitableAgeBands: parseJSONField(prod.suitable_age_bands),
          aiClassifications: parseJSONField(prod.ai_classifications),
          dataQualityFlags: parseJSONField(prod.data_quality_flags),
          notes: prod.notes || null,
          lastChecked: parseDate(prod.last_checked),
          lastVerified: parseDate(prod.last_verified),
          addedDate: parseDate(prod.added_date) || new Date(),
          catalogueEnrichedAt: parseDate(prod.catalogue_enriched_at),
          reportedBrokenAt: parseDate(prod.reported_broken_at)
        };
        
        await prisma.product.create({ data: productData });
        imported++;
        
        if (imported % 100 === 0) {
          console.log(`Progress: ${imported} imported, ${skipped} skipped, ${errors} errors`);
        }
      } catch (error) {
        errors++;
        if (errors <= 10) {
          console.error(`Error importing product ${prod.name}:`, error.message);
        }
      }
    }
    
    console.log('\n=== Import Complete ===');
    console.log(`Total products in CSV: ${products.length}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Skipped (duplicates): ${skipped}`);
    console.log(`Errors: ${errors}`);
    
    // Final count
    const totalInDb = await prisma.product.count();
    console.log(`\nTotal products now in database: ${totalInDb}`);
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importProducts();
