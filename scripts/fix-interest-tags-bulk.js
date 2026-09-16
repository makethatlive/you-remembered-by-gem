import { PrismaClient } from '@prisma/client';
import { CANONICAL_INTERESTS } from '../src/components/shared/taxonomy.js';

const prisma = new PrismaClient();

/**
 * Keyword-based interest detection
 * Maps product name/description keywords to correct interest tags
 */
const INTEREST_DETECTION_RULES = [
  // Cooking & Food
  {
    interest: 'Cooking & food',
    keywords: ['coffee', 'tea', 'espresso', 'moka', 'cafetiere', 'teapot', 'kettle', 
               'pan', 'pot', 'wok', 'skillet', 'cookware', 'kitchen', 'chef', 'cook',
               'utensil', 'spatula', 'whisk', 'grater', 'peeler', 'cutting board',
               'chopping board', 'knife', 'cutlery', 'plate', 'bowl', 'mug', 'cup',
               'food', 'recipe', 'bake', 'baking', 'oven', 'grill', 'bbq', 'hamper',
               'dining', 'tableware', 'dinnerware', 'serving', 'meal', 'gourmet',
               'pizza', 'pasta', 'bread', 'cake', 'chocolate', 'snack'],
    priority: 10
  },
  
  // Wine & Drinks
  {
    interest: 'Wine & drinks',
    keywords: ['wine', 'champagne', 'prosecco', 'beer', 'ale', 'lager', 'cider',
               'cocktail', 'whisky', 'whiskey', 'gin', 'vodka', 'rum', 'spirit',
               'bar', 'barware', 'decanter', 'glass', 'tumbler', 'bottle opener',
               'corkscrew', 'wine rack', 'sommelier', 'brewery', 'distillery'],
    priority: 10
  },
  
  // Gardening
  {
    interest: 'Gardening',
    keywords: ['garden', 'gardening', 'plant', 'planter', 'pot', 'seed', 'flower',
               'herb', 'grow', 'botanical', 'fork', 'spade', 'trowel', 'rake',
               'hose', 'watering', 'pruning', 'secateurs', 'greenhouse', 'compost',
               'soil', 'fertilizer', 'outdoor', 'lawn', 'hedge'],
    priority: 10
  },
  
  // Tech & Gadgets
  {
    interest: 'Tech & gadgets',
    keywords: ['tech', 'gadget', 'charger', 'charging', 'wireless', 'bluetooth',
               'usb', 'cable', 'adapter', 'speaker', 'headphone', 'earphone',
               'smart', 'digital', 'electronic', 'device', 'tablet', 'phone',
               'laptop', 'computer', 'mouse', 'keyboard', 'screen', 'monitor',
               'camera', 'drone', 'robot', 'led', 'light strip'],
    priority: 10
  },
  
  // DIY & Tools
  {
    interest: 'DIY & tools',
    keywords: ['tool', 'toolkit', 'toolbox', 'drill', 'hammer', 'screwdriver',
               'wrench', 'pliers', 'saw', 'sander', 'measuring', 'tape measure',
               'level', 'diy', 'handyman', 'repair', 'fix', 'build', 'workshop'],
    priority: 10
  },
  
  // Watches
  {
    interest: 'Watches',
    keywords: ['watch', 'wristwatch', 'timepiece', 'chronograph', 'watch strap',
               'watch band', 'smartwatch', 'analog', 'digital watch', 'clock'],
    priority: 10
  },
  
  // Home & Interiors
  {
    interest: 'Home & interiors',
    keywords: ['home', 'interior', 'decor', 'decoration', 'vase', 'ornament',
               'cushion', 'pillow', 'throw', 'blanket', 'lamp', 'lighting',
               'candle', 'candle holder', 'picture frame', 'mirror', 'rug',
               'mat', 'storage', 'organizer', 'shelf', 'basket', 'homeware'],
    priority: 5
  },
  
  // Beauty & Skincare
  {
    interest: 'Beauty & skincare',
    keywords: ['beauty', 'skincare', 'moisturizer', 'cleanser', 'serum', 'cream',
               'lotion', 'balm', 'oil', 'scrub', 'mask', 'facial', 'shampoo',
               'conditioner', 'hair', 'grooming', 'shave', 'shaving', 'razor',
               'beard', 'cologne', 'perfume', 'fragrance', 'aftershave', 'soap'],
    priority: 8
  },
  
  // Wellness & Self-care
  {
    interest: 'Wellness & self-care',
    keywords: ['wellness', 'wellbeing', 'spa', 'massage', 'relax', 'meditation',
               'yoga', 'aromatherapy', 'essential oil', 'diffuser', 'bath',
               'self care', 'self-care', 'stress relief', 'calm', 'mindfulness'],
    priority: 8
  },
  
  // Fitness & Sport
  {
    interest: 'Fitness & sport',
    keywords: ['fitness', 'sport', 'gym', 'workout', 'exercise', 'training',
               'running', 'jogging', 'cycling', 'swimming', 'yoga mat',
               'dumbbell', 'weights', 'resistance', 'athletic', 'sportswear'],
    priority: 8
  },
  
  // Reading & Books
  {
    interest: 'Reading & books',
    keywords: ['book', 'reading', 'novel', 'story', 'author', 'literary',
               'bookmark', 'book light', 'library', 'journal', 'diary',
               'notebook', 'writing', 'pen', 'pencil'],
    priority: 8
  },
  
  // Fashion & Accessories (LOWEST priority - default fallback)
  {
    interest: 'Fashion & accessories',
    keywords: ['fashion', 'clothing', 'shirt', 'trouser', 'pyjama', 'robe',
               'dress', 'skirt', 'jacket', 'coat', 'scarf', 'hat', 'cap',
               'glove', 'sock', 'tie', 'belt', 'bag', 'wallet', 'purse',
               'accessory', 'jewellery', 'jewelry', 'necklace', 'bracelet',
               'earring', 'ring', 'brooch', 'cufflink'],
    priority: 1 // LOWEST - only if nothing else matches
  }
];

/**
 * Detect correct interest tags based on product name and description
 */
function detectInterestTags(product) {
  const text = [product.name, product.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  
  const matches = [];
  
  INTEREST_DETECTION_RULES.forEach(rule => {
    let matchCount = 0;
    const matchedKeywords = [];
    
    rule.keywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    });
    
    if (matchCount > 0) {
      matches.push({
        interest: rule.interest,
        matchCount,
        matchedKeywords,
        priority: rule.priority
      });
    }
  });
  
  // Sort by match count (more matches = more relevant), then by priority
  matches.sort((a, b) => {
    if (b.matchCount !== a.matchCount) {
      return b.matchCount - a.matchCount;
    }
    return b.priority - a.priority;
  });
  
  // Return top 3 interests (or fewer if not enough matches)
  return matches.slice(0, 3);
}

/**
 * Main function to fix interest tags
 */
async function fixInterestTags() {
  try {
    console.log('🔍 Finding products with incorrect interest tags...\n');
    
    // Get all ACTIVE products
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        description: true,
        interestTags: true,
        sourceType: true
      }
    });
    
    console.log(`📊 Analyzing ${products.length} active products...\n`);
    
    const updates = [];
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const product of products) {
      const currentTags = product.interestTags || [];
      
      // Skip if no current tags
      if (currentTags.length === 0) {
        skippedCount++;
        continue;
      }
      
      // Detect correct tags
      const detectedMatches = detectInterestTags(product);
      
      if (detectedMatches.length === 0) {
        skippedCount++;
        continue;
      }
      
      const detectedTags = detectedMatches.map(m => m.interest);
      
      // Check if tags need updating
      const needsUpdate = 
        // Current has only "Fashion & accessories" but better matches exist
        (currentTags.length === 1 && 
         currentTags[0] === 'Fashion & accessories' && 
         detectedTags[0] !== 'Fashion & accessories') ||
        // Or detected tags are significantly different
        (!currentTags.includes(detectedTags[0]));
      
      if (needsUpdate) {
        updates.push({
          id: product.id,
          name: product.name,
          sourceType: product.sourceType,
          oldTags: currentTags,
          newTags: detectedTags,
          matches: detectedMatches
        });
        fixedCount++;
      } else {
        skippedCount++;
      }
    }
    
    console.log(`✅ Found ${fixedCount} products needing tag updates`);
    console.log(`⏸️  Skipped ${skippedCount} products (already correct)\n`);
    
    if (updates.length === 0) {
      console.log('✅ All products have correct tags!');
      return;
    }
    
    // Show preview
    console.log('📋 PREVIEW OF CHANGES (first 20):\n');
    updates.slice(0, 20).forEach((update, i) => {
      console.log(`${i + 1}. ${update.name.substring(0, 60)}...`);
      console.log(`   Source: ${update.sourceType}`);
      console.log(`   OLD: ${update.oldTags.join(', ')}`);
      console.log(`   NEW: ${update.newTags.join(', ')}`);
      console.log(`   Matched keywords: ${update.matches[0].matchedKeywords.slice(0, 5).join(', ')}`);
      console.log('');
    });
    
    // Ask for confirmation (in production, you might want to skip this)
    console.log(`\n💾 Ready to update ${updates.length} products in database...`);
    console.log('Applying updates...\n');
    
    // Apply updates in batches
    let updated = 0;
    for (const update of updates) {
      await prisma.product.update({
        where: { id: update.id },
        data: {
          interestTags: update.newTags
        }
      });
      updated++;
      
      if (updated % 100 === 0) {
        console.log(`Progress: ${updated}/${updates.length} products updated`);
      }
    }
    
    console.log(`\n✅ Successfully updated ${updated} products!\n`);
    
    // Show breakdown by change type
    console.log('📊 BREAKDOWN BY CHANGE TYPE:\n');
    const changeTypes = {};
    updates.forEach(u => {
      const key = `${u.oldTags[0]} → ${u.newTags[0]}`;
      changeTypes[key] = (changeTypes[key] || 0) + 1;
    });
    
    Object.entries(changeTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([change, count]) => {
        console.log(`   ${change}: ${count} products`);
      });
    
    console.log('\n✅ Interest tag fix complete!');
    console.log('💡 TIP: Review changes in admin dashboard if needed\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixInterestTags();
