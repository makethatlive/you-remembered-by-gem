/**
 * Test script to debug abayabuth.com currency conversion
 */

import { extractFromProductPage } from '../server/services/scraper/extraction/product-extractor.js';

// Test with actual abayabuth.com product URLs (check their site first)
const testUrls = [
  'https://abayabuth.com/products/luxurious-abayabuth-keepsake-gift-box-ramadan-mubarak',
  'https://abayabuth.com/products/raya-butterfly-abaya-bronze',
  'https://abayabuth.com/products/soft-luxury-georgette-hijab-butterscotch',
];

console.log('🧪 Testing currency conversion for abayabuth.com');
console.log('Testing', testUrls.length, 'product URLs');
console.log('');

for (const testUrl of testUrls) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Testing:', testUrl);
  console.log('');

  try {
    const result = await extractFromProductPage(testUrl);
    
    console.log('📊 Extraction Result:');
    console.log('Success:', result.success);
    
    if (result.success && result.product) {
      console.log('Product Name:', result.product.name);
      console.log('Price:', result.product.price);
      console.log('Currency: GBP (should be converted)');
      console.log('');
      
      // Check if price is reasonable for GBP
      if (result.product.price > 1000) {
        console.error('❌ ERROR: Price seems too high for GBP!');
        console.error('   Expected: ~£42-237 depending on product');
        console.error('   Got: £' + result.product.price);
      } else if (result.product.price >= 30 && result.product.price <= 300) {
        console.log('✅ SUCCESS: Price looks correct after conversion!');
        console.log('   Price: £' + result.product.price);
      } else {
        console.warn('⚠️  WARNING: Price might be incorrect');
        console.warn('   Got: £' + result.product.price);
      }
    } else if (result.rejected) {
      console.error('❌ Product rejected:', result.rejected);
    } else if (result.error) {
      console.error('❌ Extraction error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Script error:', error.message);
  }
}
