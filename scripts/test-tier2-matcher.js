import { PrismaClient } from '@prisma/client';
import { IntelligentMatcher } from '../server/services/gifts/intelligent-matcher.js';

const prisma = new PrismaClient();
const matcher = new IntelligentMatcher();

async function testTier2Matcher() {
  try {
    console.log('🔍 Testing INTELLIGENT MATCHER on Tier 2 products...\n');
    
    // Ben's profile
    const recipient = {
      interests: ['Cooking & food', 'Watches', 'DIY & tools', 'Gardening', 'Tech & gadgets']
    };
    
    console.log(`📝 Ben's interests: ${recipient.interests.join(', ')}\n`);
    
    // Get Tier 2 products
    const tier2Products = await prisma.product.findMany({
      where: {
        sourceType: { in: ['CURATED_RETAILER', 'SHOPIFY_UPLOAD', 'LEGACY_UNKNOWN'] },
        status: 'ACTIVE',
        price: { gte: 47.5, lte: 157.5 },
        genderAppliesTo: {
          in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT']
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        interestTags: true,
        sourceType: true
      },
      take: 300
    });
    
    console.log(`📊 Fetched ${tier2Products.length} Tier 2 products\n`);
    
    // Test intelligent matcher
    const matchedProducts = tier2Products.filter(p => 
      matcher.hasInterestMatch(p, recipient)
    );
    
    console.log(`✅ INTELLIGENT MATCHER: ${matchedProducts.length} products matched`);
    console.log(`❌ NO MATCH: ${tier2Products.length - matchedProducts.length} products\n`);
    
    if (matchedProducts.length > 0) {
      console.log(`✅ MATCHED PRODUCTS (first 20):\n`);
      
      matchedProducts.slice(0, 20).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name.substring(0, 60)}...`);
        console.log(`   Tags: ${p.interestTags?.join(', ')}`);
        
        // Show match details
        const matches = matcher.getMatchingTagsWithScores(p, recipient);
        if (matches.length > 0) {
          matches.forEach(m => {
            console.log(`   ✓ ${m.productTag} ≈ ${m.recipientInterest} (${m.matchQuality}, score: ${m.score})`);
          });
        }
        console.log('');
      });
    }
    
    // Analyze unmatched products
    const unmatched = tier2Products.filter(p => 
      !matcher.hasInterestMatch(p, recipient)
    );
    
    if (unmatched.length > 0) {
      console.log(`\n❌ UNMATCHED PRODUCTS (first 10):\n`);
      
      unmatched.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name.substring(0, 60)}...`);
        console.log(`   Tags: ${p.interestTags?.join(', ') || 'NO TAGS'}`);
        console.log('');
      });
    }
    
    // Check tag distribution
    console.log('\n📊 INTEREST TAG DISTRIBUTION IN TIER 2:\n');
    const tagCounts = {};
    tier2Products.forEach(p => {
      p.interestTags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    sortedTags.forEach(([tag, count]) => {
      console.log(`   ${tag}: ${count} products`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTier2Matcher();
