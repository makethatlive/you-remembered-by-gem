/**
 * Export All Products for Grok AI Classification
 * 
 * Exports products with their current tags for Grok to correct/enrich
 * 
 * Usage: node scripts/export-products-for-grok.js
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

async function exportProductsForGrok() {
  try {
    console.log('📦 Exporting all products for Grok AI classification...\n');

    // Fetch all products EXCEPT Gem's Picks (CURATED_PRODUCT)
    const products = await prisma.product.findMany({
      where: {
        sourceType: {
          not: 'CURATED_PRODUCT'  // Exclude Gem's Picks - already manually curated
        }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        interestTags: true,
        giftTypeTags: true,
        searchKeywords: true,
        suitableAgeBands: true,
        genderAppliesTo: true,
        sourceType: true,
        productUrl: true,
        retailer: {
          select: {
            name: true,
            category: true,
          }
        }
      }
    });

    console.log(`✅ Found ${products.length} products\n`);

    // Format for Grok
    const grokFormat = products.map(p => ({
      // IDENTIFIERS (Don't change these)
      id: p.id,
      name: p.name,
      
      // INPUT DATA (For Grok to analyze)
      description: p.description || '',
      price: p.price,
      productUrl: p.productUrl || '',
      retailer: p.retailer?.name || '',
      retailerCategory: p.retailer?.category || '',
      sourceType: p.sourceType,
      
      // CURRENT VALUES (For reference only)
      current_interestTags: p.interestTags || [],
      current_giftTypeTags: p.giftTypeTags || [],
      current_searchKeywords: p.searchKeywords || [],
      
      // CORRECTED VALUES (Grok will fill ONLY these 3 fields)
      corrected_interestTags: [],
      corrected_giftTypeTags: [],
      corrected_searchKeywords: [],
    }));

    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `d:/you-remembered-by-gem/grok-exports/products-for-grok-${timestamp}.json`;

    // Save to file
    writeFileSync(filename, JSON.stringify(grokFormat, null, 2));

    console.log(`\n✅ Exported ${products.length} products to:`);
    console.log(`   ${filename}\n`);

    // Generate statistics
    const stats = {
      total: products.length,
      withInterestTags: products.filter(p => p.interestTags && p.interestTags.length > 0).length,
      withGiftTypeTags: products.filter(p => p.giftTypeTags && p.giftTypeTags.length > 0).length,
      withSearchKeywords: products.filter(p => p.searchKeywords && p.searchKeywords.length > 0).length,
      emptyInterestTags: products.filter(p => !p.interestTags || p.interestTags.length === 0).length,
      emptyGiftTypeTags: products.filter(p => !p.giftTypeTags || p.giftTypeTags.length === 0).length,
      emptySearchKeywords: products.filter(p => !p.searchKeywords || p.searchKeywords.length === 0).length,
    };

    console.log('📊 CURRENT STATE (Excluding Gem\'s Picks):');
    console.log(`   Total Products: ${stats.total}`);
    console.log(`   With interestTags: ${stats.withInterestTags} (${Math.round(stats.withInterestTags/stats.total*100)}%)`);
    console.log(`   With giftTypeTags: ${stats.withGiftTypeTags} (${Math.round(stats.withGiftTypeTags/stats.total*100)}%)`);
    console.log(`   With searchKeywords: ${stats.withSearchKeywords} (${Math.round(stats.withSearchKeywords/stats.total*100)}%)`);
    console.log(`\n   NEEDS CORRECTION:`);
    console.log(`   Missing interestTags: ${stats.emptyInterestTags}`);
    console.log(`   Missing giftTypeTags: ${stats.emptyGiftTypeTags}`);
    console.log(`   Missing searchKeywords: ${stats.emptySearchKeywords}\n`);

    // Create Grok prompt file
    const promptFilename = `d:/you-remembered-by-gem/grok-exports/GROK_PROMPT_${timestamp}.md`;
    const grokPrompt = generateGrokPrompt();
    writeFileSync(promptFilename, grokPrompt);
    
    console.log(`✅ Grok prompt saved to:`);
    console.log(`   ${promptFilename}\n`);

    console.log('📋 NEXT STEPS:');
    console.log('   1. Open the JSON file in your editor');
    console.log('   2. Copy the GROK_PROMPT.md content');
    console.log('   3. Paste into Grok AI chat');
    console.log('   4. Upload the JSON file to Grok');
    console.log('   5. Grok will return corrected JSON');
    console.log('   6. Run: node scripts/import-grok-corrections.js <grok-output-file.json>\n');

  } catch (error) {
    console.error('❌ Error exporting products:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function generateGrokPrompt() {
  return `# Grok AI: Product Classification Task (3 Fields Only)

## Your Mission
You are an expert product classifier for a UK gift recommendation system. I'm sending you a JSON file with products (excluding Gem's Picks) that need proper classification.

⚠️ **IMPORTANT: Only fill these 3 fields:**
1. corrected_interestTags
2. corrected_giftTypeTags
3. corrected_searchKeywords

**DO NOT fill or change:**
- category
- age bands
- genders

## What You Need to Do

### 1. **corrected_interestTags**
Array of ALL relevant interest categories. Choose from this EXACT list (case-sensitive):

**Food & Drink:**
- Cooking & food
- Wine & drinks
- Spirits & cocktails
- Coffee & tea

**Lifestyle & Wellbeing:**
- Travel & adventure
- Wellness & self-care
- Beauty & skincare
- Sustainability & eco living
- Spirituality

**Sport & Fitness:**
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
- Fitness & sport

**Creative & Culture:**
- Reading & books
- Art & culture
- Music
- Theatre & performing arts
- Photography
- Crafts & making things
- Film & TV
- Podcasts & audiobooks

**Home, Style & Objects:**
- Fashion & accessories
- Watches
- Jewellery
- Home & interiors
- Gardening
- DIY & tools

**Tech, Games & Curiosity:**
- Tech & gadgets
- Gaming
- Board games & puzzles
- Science & nature
- History & politics

**Family & Pets:**
- Children & family activities
- Pets

**Examples:**
- "Gin Tasting Set" → ["Spirits & cocktails"]
- "Le Creuset Casserole" → ["Cooking & food", "Home & interiors"]
- "Running Watch" → ["Tech & gadgets", "Running", "Fitness & sport"]
- "Yoga Mat" → ["Yoga & Pilates", "Wellness & self-care", "Fitness & sport"]

---

### 2. **corrected_giftTypeTags**
Array of applicable gift types. Choose from this EXACT list (case-sensitive):

- Experiences
- Things to eat or drink
- Beautiful objects for the home
- Something to wear or carry
- Books or creative content
- Personalised or bespoke items
- Subscriptions or memberships
- Pampering and self-care
- Practical but high quality
- Designer items — they only want recognisable, premium brands
- Quirky and unexpected
- Toys, games, or activities

**Examples:**
- "Gin Tasting Experience" → ["Experiences", "Things to eat or drink"]
- "Le Creuset Pan" → ["Practical but high quality", "Beautiful objects for the home"]
- "Luxury Scented Candle" → ["Beautiful objects for the home", "Pampering and self-care"]
- "Children's LEGO Set" → ["Toys, games, or activities"]

---

### 3. **corrected_searchKeywords**
Array of 5-15 relevant search terms (lowercase, single words or short phrases).

**Extract from:**
- Product name (important words)
- Brand names
- Key features
- Material types
- Style descriptors

**Examples:**
- "Le Creuset Cast Iron Casserole 24cm" → ["le creuset", "casserole", "cast iron", "cookware", "oven", "pot", "cooking", "french"]
- "Premium Gin Tasting Experience" → ["gin", "tasting", "experience", "spirits", "craft", "premium", "cocktail"]
- "Handcrafted Ceramic Vase" → ["vase", "ceramic", "handcrafted", "pottery", "home", "decor"]

**Tips:**
- Include brand name if recognizable
- Add material/construction terms
- Include usage context
- Add style descriptors (handcrafted, premium, vintage)
- 5-15 keywords per product

---

## Input Format
Each product has:
- **id**: Don't change
- **name**: Product name
- **description**: Product description
- **price**: Price in GBP
- **retailer**: Retailer name
- **category**: Current category (for reference)
- **current_interestTags**: Current tags (may be wrong/empty)
- **current_giftTypeTags**: Current tags (may be wrong/empty)
- **current_searchKeywords**: Current keywords (may be wrong/empty)

## Output Format
Return the EXACT same JSON with ONLY these 3 fields filled:
- **corrected_interestTags**
- **corrected_giftTypeTags**
- **corrected_searchKeywords**

Keep all other fields unchanged.

## Quality Standards
✅ Use EXACT category/tag names (copy-paste from lists above)
✅ Be comprehensive - multiple interests/gift types are good
✅ Extract meaningful keywords (5-15 per product)
✅ Think like a gift buyer - what would they search for?
✅ Default to multiple tags when product fits several categories

## Critical Rules
1. **Never invent tags** - only use the exact lists provided
2. **Never leave corrected fields empty** - always provide best guess
3. **Be consistent** - similar products should have similar tags
4. **Think context** - "mug" could be Cooking, Home, or Office depending on style

---

**Ready? Upload the JSON file and return corrected version!**`;
}

// Run export
exportProductsForGrok()
  .then(() => {
    console.log('✅ Export complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Export failed:', error);
    process.exit(1);
  });
