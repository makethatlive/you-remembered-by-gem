import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * SMART Interest Detection Rules
 * More precise keyword matching with word boundaries
 */
const INTEREST_RULES = [
  // Cooking & Food (HIGH CONFIDENCE)
  {
    interest: 'Cooking & food',
    mustMatch: [
      /\b(coffee|espresso|moka|cafetiere)\b/i,
      /\b(tea|teapot|kettle)\b/i,
      /\b(pan|wok|skillet|cookware)\b/i,
      /\b(kitchen|chef|cook|cooking)\b/i,
      /\b(chopping board|cutting board)\b/i,
      /\b(plate|bowl|mug|cup|tableware)\b/i,
      /\b(recipe|bake|baking|oven)\b/i,
      /\b(hamper|gourmet)\b/i,
      /\b(pasta|pizza|bread maker)\b/i
    ],
    priority: 10
  },
  
  // Wine & Drinks
  {
    interest: 'Wine & drinks',
    mustMatch: [
      /\b(wine|champagne|prosecco)\b/i,
      /\b(beer|ale|lager|cider|brew)\b/i,
      /\b(whisky|whiskey|gin|vodka|rum)\b/i,
      /\b(cocktail|spirit)\b/i,
      /\b(decanter|sommelier|corkscrew)\b/i,
      /\b(wine rack|wine glass)\b/i
    ],
    priority: 10
  },
  
  // Gardening (HIGH CONFIDENCE)
  {
    interest: 'Gardening',
    mustMatch: [
      /\b(garden|gardening)\b/i,
      /\b(garden fork|spade|trowel|rake)\b/i,
      /\b(plant|planter|seed|flower)\b/i,
      /\b(greenhouse|compost)\b/i,
      /\b(pruning|secateurs)\b/i,
      /\b(watering|hose)\b/i
    ],
    priority: 10
  },
  
  // Tech & Gadgets
  {
    interest: 'Tech & gadgets',
    mustMatch: [
      /\b(charger|charging|wireless charg)\b/i,
      /\b(bluetooth|usb|cable)\b/i,
      /\b(speaker|headphone|earphone)\b/i,
      /\b(smart home|smart device)\b/i,
      /\b(gadget|electronic device)\b/i,
      /\b(tablet|laptop|computer)\b/i,
      /\b(led|light strip)\b/i
    ],
    priority: 10
  },
  
  // DIY & Tools
  {
    interest: 'DIY & tools',
    mustMatch: [
      /\b(tool|toolkit|toolbox)\b/i,
      /\b(drill|hammer|screwdriver|wrench)\b/i,
      /\b(diy|handyman)\b/i,
      /\b(workshop|repair kit)\b/i
    ],
    priority: 10
  },
  
  // Watches
  {
    interest: 'Watches',
    mustMatch: [
      /\b(watch|wristwatch|timepiece)\b/i,
      /\b(chronograph|smartwatch)\b/i,
      /\b(watch strap|watch band)\b/i
    ],
    priority: 10
  },
  
  // Beauty & Skincare
  {
    interest: 'Beauty & skincare',
    mustMatch: [
      /\b(skincare|skin care|moisturizer|cleanser|serum)\b/i,
      /\b(shampoo|conditioner|hair care)\b/i,
      /\b(shaving|razor|beard oil)\b/i,
      /\b(cologne|perfume|fragrance|aftershave)\b/i,
      /\b(grooming set|grooming kit)\b/i
    ],
    priority: 9
  },
  
  // Home & Interiors
  {
    interest: 'Home & interiors',
    mustMatch: [
      /\b(vase|ornament|decoration)\b/i,
      /\b(cushion|pillow|throw blanket)\b/i,
      /\b(lamp|candle holder)\b/i,
      /\b(picture frame|mirror|rug)\b/i,
      /\b(storage box|organizer)\b/i
    ],
    priority: 5
  }
];

/**
 * Detect interest tags with high confidence
 */
function detectInterestTags(product) {
  const text = [product.name, product.description]
    .filter(Boolean)
    .join(' ');
  
  const matches = [];
  
  INTEREST_RULES.forEach(rule => {
    let matchedPatterns = 0;
    
    rule.mustMatch.forEach(pattern => {
      if (pattern.test(text)) {
        matchedPatterns++;
      }
    });
    
    if (matchedPatterns > 0) {
      matches.push({
        interest: rule.interest,
        confidence: matchedPatterns,
        priority: rule.priority
      });
    }
  });
  
  // Sort by confidence and priority
  matches.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return b.priority - a.priority;
  });
  
  return matches.slice(0, 2); // Return top 2 matches
}

/**
 * Main function
 */
async function fixInterestTags() {
  try {
    console.log('🔍 Finding products with incorrect interest tags...\n');
    
    // Focus on products tagged as "Fashion & accessories" only
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        interestTags: {
          has: 'Fashion & accessories'
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        interestTags: true
      }
    });
    
    console.log(`📊 Analyzing ${products.length} products tagged with "Fashion & accessories"...\n`);
    
    const updates = [];
    
    for (const product of products) {
      const detectedMatches = detectInterestTags(product);
      
      if (detectedMatches.length === 0) continue;
      
      const currentTags = product.interestTags || [];
      const topMatch = detectedMatches[0];
      
      // Only update if we have HIGH CONFIDENCE match
      if (topMatch.interest !== 'Fashion & accessories' && 
          topMatch.confidence >= 1) {
        
        // Build new tag list
        const newTags = [topMatch.interest];
        if (detectedMatches[1]) {
          newTags.push(detectedMatches[1].interest);
        }
        
        updates.push({
          id: product.id,
          name: product.name,
          oldTags: currentTags,
          newTags: newTags
        });
      }
    }
    
    console.log(`✅ Found ${updates.length} products to fix\n`);
    
    if (updates.length === 0) {
      console.log('✅ No updates needed!');
      return;
    }
    
    // Preview
    console.log('📋 PREVIEW (first 30):\n');
    updates.slice(0, 30).forEach((u, i) => {
      console.log(`${i + 1}. ${u.name.substring(0, 65)}...`);
      console.log(`   ${u.oldTags.join(', ')} → ${u.newTags.join(', ')}`);
      console.log('');
    });
    
    console.log(`\n💾 Updating ${updates.length} products...\n`);
    
    // Batch update
    let updated = 0;
    const batchSize = 50;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(u => 
          prisma.product.update({
            where: { id: u.id },
            data: { interestTags: u.newTags }
          })
        )
      );
      
      updated += batch.length;
      console.log(`Progress: ${updated}/${updates.length}`);
    }
    
    console.log(`\n✅ Updated ${updated} products!\n`);
    
    // Breakdown
    const breakdown = {};
    updates.forEach(u => {
      const key = u.newTags[0];
      breakdown[key] = (breakdown[key] || 0) + 1;
    });
    
    console.log('📊 BREAKDOWN:\n');
    Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tag, count]) => {
        console.log(`   ${tag}: ${count} products`);
      });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixInterestTags();
