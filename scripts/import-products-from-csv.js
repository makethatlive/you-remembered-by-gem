/**
 * Import Products from CSV
 * 
 * Safely imports products from CSV export without creating duplicates.
 * Uses product_url as unique identifier to prevent duplicates.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Parse CSV line handling quoted fields with commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

// Parse CSV value (handle quotes, nulls, arrays, etc.)
function parseValue(value, fieldName) {
  if (!value || value === '""' || value === 'null') return null;
  
  // Remove surrounding quotes
  value = value.replace(/^"(.*)"$/, '$1');
  
  // Handle arrays (JSON format)
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.warn(`Failed to parse array for ${fieldName}:`, value);
      return [];
    }
  }
  
  // Handle booleans
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  return value;
}

async function importProducts() {
  console.log('🔧 Starting CSV product import...\n');
  
  try {
    // Read CSV file
    const csvPath = path.join(__dirname, '../database-csv/Product_export.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log(`📊 Found ${lines.length - 1} products in CSV\n`);
    
    // Parse header
    const headers = parseCSVLine(lines[0]);
    console.log('📋 CSV Headers:', headers.slice(0, 10).join(', '), '...\n');
    
    // Get existing product URLs to avoid duplicates
    const existingProducts = await prisma.product.findMany({
      select: { productUrl: true, id: true }
    });
    const existingUrls = new Set(existingProducts.map(p => p.productUrl));
    console.log(`✓ Found ${existingProducts.length} existing products in database\n`);
    
    // Stats
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each product
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const product = {};
      
      // Map CSV fields to product object
      headers.forEach((header, index) => {
        product[header] = parseValue(values[index], header);
      });
      
      // Skip if product_url already exists
      if (existingUrls.has(product.product_url)) {
        skipped++;
        continue;
      }
      
      try {
        // Create product in database
        await prisma.product.create({
          data: {
            name: product.name || 'Untitled Product',
            description: product.description,
            retailerId: product.retailer_id,
            productUrl: product.product_url,
            affiliateUrl: product.affiliate_url,
            imageUrl: product.image_url,
            price: product.price ? parseFloat(product.price) : 0,
            category: product.category,
            genderAppliesTo: product.gender_applies_to,
            ageRestricted: product.age_restricted === 'true' || product.age_restricted === true,
            suitableAgeBands: product.suitable_age_bands || [],
            sourceType: (product.source_type || 'LEGACY_UNKNOWN').toUpperCase(),
            status: (product.status || 'NEEDS_REVIEW').toUpperCase(),
            reportedBrokenAt: product.reported_broken_at ? new Date(product.reported_broken_at) : null,
            lastChecked: product.last_checked ? new Date(product.last_checked) : null,
            lastVerified: product.last_verified ? new Date(product.last_verified) : null,
            addedDate: product.added_date ? new Date(product.added_date) : null,
            notes: product.notes,
            interestTags: product.interest_tags || [],
            giftTypeTags: product.gift_type_tags || [],
            searchKeywords: product.search_keywords || [],
            qualityScore: product.quality_score ? parseFloat(product.quality_score) : null,
            catalogueEnrichedAt: product.catalogue_enriched_at ? new Date(product.catalogue_enriched_at) : null,
            dataQualityFlags: product.data_quality_flags || [],
            canonicalCategory: product.canonical_category,
            aiClassifications: product.ai_classifications ? JSON.parse(product.ai_classifications) : null,
          },
        });
        
        imported++;
        
        // Progress update every 100 products
        if (imported % 100 === 0) {
          console.log(`   ✓ Imported ${imported} products...`);
        }
      } catch (error) {
        errors++;
        if (errors <= 5) {
          console.error(`   ✗ Error importing product ${product.name}: ${error.message}`);
        }
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`   ✓ Imported: ${imported} products`);
    console.log(`   ⊘ Skipped (duplicates): ${skipped} products`);
    console.log(`   ✗ Errors: ${errors} products`);
    console.log(`\n✅ Total products in database: ${existingProducts.length + imported}`);
    
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importProducts()
  .then(() => {
    console.log('\n✅ Import complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
