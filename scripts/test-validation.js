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

async function testValidation() {
  try {
    console.log('🔍 Testing NEW isValidProduct() logic...\n');
    
    const products = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT',
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
      take: 100
    });
    
    console.log(`📊 Fetched ${products.length} products\n`);
    
    const validProducts = products.filter(p => isValidProduct(p));
    const invalidProducts = products.filter(p => !isValidProduct(p));
    
    console.log(`✅ VALID: ${validProducts.length} products`);
    console.log(`❌ INVALID: ${invalidProducts.length} products\n`);
    
    if (validProducts.length > 0) {
      console.log(`✅ VALID PRODUCTS (first 10):\n`);
      validProducts.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name.substring(0, 60)}...`);
        console.log(`   Tags: ${p.interestTags?.join(', ')}`);
        console.log('');
      });
    }
    
    if (invalidProducts.length > 0) {
      console.log(`\n❌ INVALID PRODUCTS (first 5):\n`);
      invalidProducts.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name?.substring(0, 60) || 'NO NAME'}...`);
        
        // Check each validation rule
        const reasons = [];
        if (!p.name || p.name === 'undefined' || p.name.length < 3) {
          reasons.push('Invalid name');
        }
        const hasTags = (p.interestTags && p.interestTags.length > 0) ||
                        (p.giftTypeTags && p.giftTypeTags.length > 0);
        if (!hasTags) {
          reasons.push('No tags');
        }
        if (!p.productUrl || p.productUrl === 'N/A') {
          reasons.push('No URL');
        }
        if (p.dataQualityFlags && p.dataQualityFlags.includes('missing_description')) {
          reasons.push('Quality flag: missing_description');
        }
        
        console.log(`   Reasons: ${reasons.join(', ')}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testValidation();
