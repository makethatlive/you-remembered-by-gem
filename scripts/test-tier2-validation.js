import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test with NEW validation logic
function isValidProduct(product) {
  // Must have name
  if (!product.name || product.name === 'undefined' || product.name.length < 3) {
    return false;
  }

  // ✅ RELAXED: Description not required for CURATED_PRODUCT
  // CURATED products are manually selected so quality is pre-verified
  // Only block if description is clearly invalid (e.g., "sss")
  if (product.sourceType !== 'CURATED_PRODUCT') {
    if (!product.description || product.description.length < 10 || /^s+$/.test(product.description)) {
      return false;
    }
  }

  // Must have interest tags or gift type tags
  const hasTags = (product.interestTags && product.interestTags.length > 0) ||
                  (product.giftTypeTags && product.giftTypeTags.length > 0);
  if (!hasTags) {
    return false;
  }

  // Must have product URL
  if (!product.productUrl || product.productUrl === 'N/A') {
    return false;
  }

  // Must not have critical data quality flags
  if (product.dataQualityFlags && product.dataQualityFlags.includes('missing_description')) {
    return false;
  }

  return true;
}

async function testTier2Validation() {
  try {
    console.log('🔍 Testing TIER 2 (Scraped Products) Validation...\n');
    
    // Tier 2 products (non-CURATED)
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
        productUrl: true,
        sourceType: true,
        interestTags: true,
        giftTypeTags: true,
        dataQualityFlags: true
      },
      take: 300
    });
    
    console.log(`📊 Fetched ${tier2Products.length} TIER 2 products\n`);
    
    // Group by source type
    const bySource = {};
    tier2Products.forEach(p => {
      bySource[p.sourceType] = (bySource[p.sourceType] || 0) + 1;
    });
    
    console.log('📂 By source type:');
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`   ${source}: ${count}`);
    });
    console.log('');
    
    const validProducts = tier2Products.filter(p => isValidProduct(p));
    const invalidProducts = tier2Products.filter(p => !isValidProduct(p));
    
    console.log(`✅ VALID: ${validProducts.length} products (${Math.round(validProducts.length/tier2Products.length*100)}%)`);
    console.log(`❌ INVALID: ${invalidProducts.length} products (${Math.round(invalidProducts.length/tier2Products.length*100)}%)\n`);
    
    if (invalidProducts.length > 0) {
      // Analyze rejection reasons
      const reasons = {
        'No name': 0,
        'Invalid name': 0,
        'No description': 0,
        'Description too short': 0,
        'No tags': 0,
        'No URL': 0,
        'Quality flag': 0
      };
      
      invalidProducts.forEach(p => {
        if (!p.name) reasons['No name']++;
        else if (p.name === 'undefined' || p.name.length < 3) reasons['Invalid name']++;
        
        if (p.sourceType !== 'CURATED_PRODUCT') {
          if (!p.description) reasons['No description']++;
          else if (p.description.length < 10) reasons['Description too short']++;
        }
        
        const hasTags = (p.interestTags && p.interestTags.length > 0) ||
                        (p.giftTypeTags && p.giftTypeTags.length > 0);
        if (!hasTags) reasons['No tags']++;
        
        if (!p.productUrl || p.productUrl === 'N/A') reasons['No URL']++;
        
        if (p.dataQualityFlags && p.dataQualityFlags.includes('missing_description')) {
          reasons['Quality flag']++;
        }
      });
      
      console.log('📊 REJECTION REASONS:\n');
      Object.entries(reasons).forEach(([reason, count]) => {
        if (count > 0) {
          console.log(`   ${reason}: ${count} products`);
        }
      });
      console.log('');
      
      console.log(`❌ INVALID PRODUCTS (first 10):\n`);
      invalidProducts.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name?.substring(0, 60) || 'NO NAME'}...`);
        console.log(`   Source: ${p.sourceType}`);
        
        // Check each validation rule
        const issues = [];
        if (!p.name || p.name === 'undefined' || p.name.length < 3) {
          issues.push('Invalid name');
        }
        if (p.sourceType !== 'CURATED_PRODUCT') {
          if (!p.description) {
            issues.push('No description');
          } else if (p.description.length < 10) {
            issues.push(`Description too short (${p.description.length} chars)`);
          }
        }
        const hasTags = (p.interestTags && p.interestTags.length > 0) ||
                        (p.giftTypeTags && p.giftTypeTags.length > 0);
        if (!hasTags) {
          issues.push('No tags');
        }
        if (!p.productUrl || p.productUrl === 'N/A') {
          issues.push('No URL');
        }
        if (p.dataQualityFlags && p.dataQualityFlags.includes('missing_description')) {
          issues.push('Quality flag: missing_description');
        }
        
        console.log(`   Issues: ${issues.join(', ')}`);
        console.log('');
      });
    }
    
    if (validProducts.length > 0) {
      console.log(`\n✅ VALID TIER 2 PRODUCTS (first 10):\n`);
      validProducts.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name.substring(0, 60)}...`);
        console.log(`   Source: ${p.sourceType}`);
        console.log(`   Tags: ${p.interestTags?.slice(0, 3).join(', ')}`);
        console.log('');
      });
    }
    
    // Check interest matching
    const benInterests = ['Cooking & food', 'Watches', 'DIY & tools', 'Gardening', 'Tech & gadgets'];
    
    console.log('\n🔍 Checking interest matches for Ben...\n');
    
    const withInterestMatch = validProducts.filter(p => {
      return p.interestTags?.some(tag => {
        return benInterests.some(interest => 
          tag.toLowerCase().includes(interest.toLowerCase()) ||
          interest.toLowerCase().includes(tag.toLowerCase())
        );
      });
    });
    
    console.log(`📊 Valid products WITH interest match: ${withInterestMatch.length}`);
    console.log(`📊 Valid products WITHOUT interest match: ${validProducts.length - withInterestMatch.length}`);
    
    if (withInterestMatch.length > 0) {
      console.log(`\n✅ PRODUCTS WITH INTEREST MATCH (first 5):\n`);
      withInterestMatch.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name.substring(0, 60)}...`);
        const matchingTags = p.interestTags?.filter(tag =>
          benInterests.some(interest =>
            tag.toLowerCase().includes(interest.toLowerCase()) ||
            interest.toLowerCase().includes(tag.toLowerCase())
          )
        );
        console.log(`   Matching tags: ${matchingTags?.join(', ')}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTier2Validation();
