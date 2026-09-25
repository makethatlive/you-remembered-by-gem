/**
 * Export Products for AI Categorization
 * 
 * Exports scraped products (non-Gem's Picks) in a format suitable for
 * Claude AI to categorize correctly
 * 
 * Usage: node scripts/export-for-categorization.js
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function exportForCategorization() {
  console.log('📤 Exporting products for AI categorization...\n');
  
  try {
    // Fetch all non-CURATED_PRODUCT products (scraped catalogue)
    console.log('📊 Fetching scraped products (excluding Gem\'s Picks)...');
    const products = await prisma.product.findMany({
      where: {
        sourceType: {
          not: 'CURATED_PRODUCT'
        }
      },
      include: {
        retailer: {
          select: {
            name: true,
            websiteUrl: true
          }
        }
      },
      orderBy: {
        addedDate: 'desc'
      }
    });
    
    console.log(`   ✅ Found ${products.length} scraped products\n`);
    
    if (products.length === 0) {
      console.log('   ℹ️  No scraped products to export');
      return;
    }
    
    // Create export directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const exportDir = path.join(__dirname, '..', 'categorization-exports', `export-${timestamp}`);
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    console.log(`💾 Export location: ${exportDir}\n`);
    
    // Format for Claude
    console.log('📝 Formatting data for Claude AI...');
    
    const formattedData = products.map((p, index) => ({
      row_number: index + 1,
      product_id: p.id,
      name: p.name || '',
      product_url: p.productUrl || '',
      description: p.description || '', // FULL description, no truncation
      current_category: p.category || '',
      retailer: p.retailer?.name || '',
      retailer_url: p.retailer?.websiteUrl || '',
      price: p.price || '',
      gender: p.genderAppliesTo || '',
      suitable_age_bands: p.suitableAgeBands || [],
      interest_tags: p.interestTags || [],
      gift_type_tags: p.giftTypeTags || [],
      search_keywords: p.searchKeywords || [],
    }));
    
    // Save as JSON for easy processing
    const jsonPath = path.join(exportDir, 'products-for-categorization.json');
    fs.writeFileSync(jsonPath, JSON.stringify(formattedData, null, 2));
    console.log(`   ✅ Saved JSON: products-for-categorization.json (${products.length} products)\n`);
    
    // Save as CSV for easy viewing
    const csvPath = path.join(exportDir, 'products-for-categorization.csv');
    const csvHeaders = [
      'Row',
      'Product ID',
      'Name',
      'Product URL',
      'Description',
      'Current Category',
      'Retailer',
      'Price',
      'Gender',
      'Age Bands'
    ].join('\t');
    
    const csvRows = formattedData.map(p => [
      p.row_number,
      p.product_id,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.product_url,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      `"${(p.current_category || '').replace(/"/g, '""')}"`,
      `"${(p.retailer || '').replace(/"/g, '""')}"`,
      p.price,
      p.gender,
      `"${(p.suitable_age_bands || []).join(', ')}"`,
    ].join('\t'));
    
    fs.writeFileSync(csvPath, [csvHeaders, ...csvRows].join('\n'));
    console.log(`   ✅ Saved CSV: products-for-categorization.csv\n`);
    
    // Create Claude prompt template
    console.log('📋 Creating Claude prompt template...');
    const promptPath = path.join(exportDir, 'CLAUDE_PROMPT.md');
    
    const validCategories = `
## Valid Categories (3-Level Structure)

### Food & Drink
- Cooking & food
- Wine & Drinks
  - Wine
  - Beer
  - Cocktails
  - Whisky
  - Gin
  - Rum
  - Tequila
  - No particular preference
- Coffee & tea

### Lifestyle & Wellbeing
- Travel & adventure
- Wellness & self-care
- Beauty & skincare
- Sustainability & eco living
- Spirituality

### Sport & Fitness
- Running
- Yoga & Pilates
- Swimming
- Football
- Rugby
- Cricket
- Motorsports
- Tennis
- Golf
- Cycling
- Outdoor pursuits

### Creative & Culture
- Reading & books
- Art & culture
- Music
  - Listening
  - Playing an instrument
  - Vinyl collecting
  - Concerts & live music
- Theatre & performing arts
- Photography
- Crafts & making things
- Film & TV
- Podcasts & audiobooks

### Home, Style & Objects
- Fashion & accessories
- Watches
- Jewellery
- Home & interiors
- Gardening
- DIY & tools
- Tech & gadgets

### Children & Family
- Children & family activities
- Toys, games & activities
`;
    
    const promptTemplate = `# Product Categorization Task

## Task Overview
Review ${products.length} products and assign correct 3-level categories based on product name, URL, and description.

## Product Data
See: products-for-categorization.json or products-for-categorization.csv

## Instructions

1. **Review each product** (name, URL, description, retailer)
2. **Assign correct category** using 3-level format: "Category 1 > Category 2 > Category 3"
3. **Return results** in JSON format shown below

## Category Format

Use this exact format:
- 1 level: "Food & Drink"
- 2 levels: "Food & Drink > Wine & Drinks"
- 3 levels: "Food & Drink > Wine & Drinks > Whisky"

${validCategories}

## Example Issues to Fix

**Current:** "Fashion & accessories"
**Product:** Dom Perignon 2013 (Champagne)
**URL:** https://hedonism.co.uk/product/dom-perignon-2013
**Correct:** "Food & Drink > Wine & Drinks > Wine"

**Current:** "UNISEX_ADULT" (not a category!)
**Product:** Coffee maker
**Correct:** "Food & Drink > Coffee & tea"

## Output Format

Return JSON array with this structure:

\`\`\`json
[
  {
    "product_id": "abc123",
    "row_number": 1,
    "name": "Dom Perignon 2013",
    "current_category": "Fashion & accessories",
    "corrected_category": "Food & Drink > Wine & Drinks > Wine",
    "confidence": "high",
    "reasoning": "Champagne product from wine retailer"
  },
  {
    "product_id": "xyz789",
    "row_number": 2,
    "name": "Coffee Maker",
    "current_category": "UNISEX_ADULT",
    "corrected_category": "Food & Drink > Coffee & tea",
    "confidence": "high",
    "reasoning": "Kitchen appliance for making coffee"
  }
]
\`\`\`

## Confidence Levels
- **high**: Clear category from name/URL/description
- **medium**: Reasonable guess based on context
- **low**: Unclear, needs human review

## Notes
- If product doesn't fit any category, use "corrected_category": null
- If current category is already correct, keep it
- Use exact spelling from valid categories list
- Focus on main product function, not brand or style

## Total Products: ${products.length}

Process all products and return complete JSON array.
`;
    
    fs.writeFileSync(promptPath, promptTemplate);
    console.log(`   ✅ Created: CLAUDE_PROMPT.md\n`);
    
    // Create sample for testing (first 50 products)
    if (products.length > 50) {
      console.log('📋 Creating sample file (first 50 products) for testing...');
      const sampleData = formattedData.slice(0, 50);
      const sampleJsonPath = path.join(exportDir, 'sample-50-products.json');
      fs.writeFileSync(sampleJsonPath, JSON.stringify(sampleData, null, 2));
      console.log(`   ✅ Saved: sample-50-products.json (50 products)\n`);
    }
    
    // Summary
    console.log('✅ Export Complete!\n');
    console.log('📊 Summary:');
    console.log(`   📁 Export location: ${exportDir}`);
    console.log(`   📦 Total products: ${products.length}`);
    console.log(`   📄 Files created:`);
    console.log(`      - products-for-categorization.json (full data)`);
    console.log(`      - products-for-categorization.csv (human readable)`);
    console.log(`      - CLAUDE_PROMPT.md (instructions for Claude)`);
    if (products.length > 50) {
      console.log(`      - sample-50-products.json (test with first 50)`);
    }
    console.log('\n📋 Next Steps:');
    console.log('   1. Open CLAUDE_PROMPT.md');
    console.log('   2. Copy prompt to Claude');
    console.log('   3. Attach products-for-categorization.json (or sample for testing)');
    console.log('   4. Claude will return corrected categories');
    console.log('   5. Use import-categorization-results.js to update database');
    console.log('');
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportForCategorization();
