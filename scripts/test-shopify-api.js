/**
 * Test what data Shopify API returns for abayabuth.com
 */

async function testShopifyAPI() {
  const origin = 'https://abayabuth.com';
  
  console.log('🧪 Testing Shopify API for abayabuth.com\n');
  
  try {
    // Test products.json
    console.log('1️⃣  Testing /products.json?limit=1');
    const response = await fetch(`${origin}/products.json?limit=1`);
    
    if (!response.ok) {
      console.error('❌ Request failed:', response.status);
      return;
    }
    
    const data = await response.json();
    
    console.log('\n📦 First product data:');
    const product = data.products[0];
    
    console.log('Title:', product.title);
    console.log('Handle:', product.handle);
    console.log('Product Type:', product.product_type);
    console.log('\n🏷️  Variant data:');
    const variant = product.variants[0];
    console.log('Price:', variant.price);
    console.log('Available:', variant.available);
    
    // Check for currency fields
    console.log('\n💱 Currency fields:');
    console.log('variant.currency:', variant.currency || '(not present)');
    console.log('variant.currency_code:', variant.currency_code || '(not present)');
    console.log('product.currency:', product.currency || '(not present)');
    console.log('product.currency_code:', product.currency_code || '(not present)');
    
    if (variant.presentment_prices) {
      console.log('\n💰 Presentment prices:', JSON.stringify(variant.presentment_prices, null, 2));
    } else {
      console.log('\npresentment_prices: (not present)');
    }
    
    // Full variant object
    console.log('\n📋 Full variant object keys:', Object.keys(variant));
    
    // Full product object keys
    console.log('📋 Full product object keys:', Object.keys(product));
    
    // Try to get shop currency from another endpoint
    console.log('\n2️⃣  Trying to detect currency from HTML...');
    const htmlResponse = await fetch(origin);
    const html = await htmlResponse.text();
    
    // Look for Shopify.currency
    const currencyMatch = html.match(/Shopify\.currency\s*=\s*[{"']([A-Z]{3})["']/i);
    if (currencyMatch) {
      console.log('✅ Found currency in HTML:', currencyMatch[1]);
    } else {
      console.log('❌ No Shopify.currency found in HTML');
    }
    
    // Look for currency symbols
    if (html.includes('₨') || html.includes('Rs.') || html.includes('PKR')) {
      console.log('✅ Found PKR currency symbols in HTML');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testShopifyAPI();
