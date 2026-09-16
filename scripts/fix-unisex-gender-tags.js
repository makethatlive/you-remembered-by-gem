import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Gender Detection Keywords
 * These keywords help identify if a UNISEX-tagged product is actually gender-specific
 */
const WOMEN_KEYWORDS = [
  // Jewelry specific
  'necklace', 'bracelet', 'earring', 'anklet', 'choker', 'pendant',
  'jewelry', 'jewellery', 'chain',
  
  // Descriptive words
  'delicate', 'dainty', 'elegant', 'feminine', 'pretty', 'beautiful',
  'rose gold', 'pearl', 'crystal', 'sparkle', 'charm',
  
  // Clothing
  'dress', 'skirt', 'blouse', 'bra', 'lingerie', 'handbag', 'purse',
  'makeup', 'cosmetic', 'lipstick', 'nail polish',
  
  // Titles
  'women', 'womens', "women's", 'ladies', 'lady', 'girl', 'girls',
  'her', 'she', 'female', 'mum', 'mom', 'wife', 'girlfriend', 'sister', 'daughter'
];

const MEN_KEYWORDS = [
  // Clothing
  'tie', 'cufflink', 'wallet', 'belt',
  'beard', 'shaving', 'razor',
  
  // Descriptive
  'masculine', 'rugged', 'bold', 'leather wallet',
  
  // Titles
  'men', 'mens', "men's", 'gentleman', 'guy', 'guys', 'male',
  'him', 'he', 'dad', 'father', 'husband', 'boyfriend', 'brother', 'son'
];

/**
 * Detect gender from product data using keyword analysis
 */
function detectGenderFromProduct(product) {
  // Combine all searchable text
  const searchableText = [
    product.name,
    product.description,
    product.category,
    ...(product.interestTags || []),
    ...(product.giftTypeTags || []),
    ...(product.searchKeywords || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Count keyword matches
  let womenScore = 0;
  let menScore = 0;

  WOMEN_KEYWORDS.forEach(keyword => {
    if (searchableText.includes(keyword.toLowerCase())) {
      womenScore++;
    }
  });

  MEN_KEYWORDS.forEach(keyword => {
    if (searchableText.includes(keyword.toLowerCase())) {
      menScore++;
    }
  });

  // Decision logic
  if (womenScore > menScore && womenScore >= 2) {
    return 'FEMALE';
  } else if (menScore > womenScore && menScore >= 2) {
    return 'MALE';
  }

  // Default: keep as UNISEX if no strong signal
  return null; // null means "keep current value"
}

/**
 * Fix UNISEX products that should be gender-specific
 */
async function fixUnisexGenderTags() {
  try {
    console.log('🔍 Finding UNISEX products in database...\n');

    // Find all UNISEX products (including UNISEX_ADULT, UNISEX_KIDS variations)
    const unisexProducts = await prisma.product.findMany({
      where: {
        genderAppliesTo: {
          in: ['UNISEX', 'Unisex', 'UNISEX_ADULT', 'UNISEX_KIDS']
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        genderAppliesTo: true,
        interestTags: true,
        giftTypeTags: true,
        searchKeywords: true,
        retailer: {
          select: {
            name: true,
            category: true
          }
        }
      }
    });

    console.log(`📊 Found ${unisexProducts.length} UNISEX products\n`);
    console.log('🔧 Analyzing and fixing...\n');

    let fixedToFemale = 0;
    let fixedToMale = 0;
    let keptUnisex = 0;

    const updates = [];

    for (const product of unisexProducts) {
      const detectedGender = detectGenderFromProduct(product);

      if (detectedGender === 'FEMALE') {
        updates.push({
          id: product.id,
          name: product.name,
          current: product.genderAppliesTo,
          new: 'FEMALE',
          reason: 'Women-specific keywords detected'
        });
        fixedToFemale++;
      } else if (detectedGender === 'MALE') {
        updates.push({
          id: product.id,
          name: product.name,
          current: product.genderAppliesTo,
          new: 'MALE',
          reason: 'Men-specific keywords detected'
        });
        fixedToMale++;
      } else {
        keptUnisex++;
      }
    }

    // Show preview of changes
    console.log('📋 PREVIEW OF CHANGES:\n');
    console.log(`✅ Will fix ${fixedToFemale} products → FEMALE`);
    console.log(`✅ Will fix ${fixedToMale} products → MALE`);
    console.log(`⏸️  Will keep ${keptUnisex} as UNISEX (no strong signal)\n`);

    if (updates.length > 0) {
      console.log('🔍 SAMPLE CHANGES (first 10):\n');
      updates.slice(0, 10).forEach((update, i) => {
        console.log(`${i + 1}. "${update.name.substring(0, 60)}..."`);
        console.log(`   ${update.current} → ${update.new}`);
        console.log(`   Reason: ${update.reason}\n`);
      });

      console.log('💾 Applying updates to database...\n');

      // Apply all updates in batches (faster)
      const femaleIds = updates.filter(u => u.new === 'FEMALE').map(u => u.id);
      const maleIds = updates.filter(u => u.new === 'MALE').map(u => u.id);

      if (femaleIds.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: femaleIds } },
          data: { genderAppliesTo: 'FEMALE' }
        });
        console.log(`✅ Updated ${femaleIds.length} products to FEMALE`);
      }

      if (maleIds.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: maleIds } },
          data: { genderAppliesTo: 'MALE' }
        });
        console.log(`✅ Updated ${maleIds.length} products to MALE`);
      }

      console.log('\n✅ DATABASE UPDATED!\n');
    }

    // Final summary
    console.log('═══════════════════════════════════════');
    console.log('           SUMMARY REPORT              ');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total UNISEX products: ${unisexProducts.length}`);
    console.log(`👗 Fixed to FEMALE: ${fixedToFemale}`);
    console.log(`👔 Fixed to MALE: ${fixedToMale}`);
    console.log(`⚖️  Kept UNISEX: ${keptUnisex}`);
    console.log('═══════════════════════════════════════\n');

    // Show breakdown by category
    console.log('📂 BREAKDOWN BY ORIGINAL CATEGORY:\n');
    const categoryCounts = {};
    updates.forEach(u => {
      const cat = u.new;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    Object.entries(categoryCounts).forEach(([gender, count]) => {
      console.log(`   ${gender}: ${count} products`);
    });

    console.log('\n✅ Script complete!');
    console.log('💡 TIP: Review changes in admin dashboard and manually adjust if needed\n');

  } catch (error) {
    console.error('❌ Error fixing UNISEX products:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixUnisexGenderTags();
