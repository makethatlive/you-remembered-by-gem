/**
 * Trace the complete scraping flow for Abayabuth
 * Shows exactly how currency and price are detected
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function traceScrapingFlow() {
  console.log('🔍 TRACING SCRAPING FLOW FOR ABAYABUTH\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Step 1: Find retailer
  console.log('STEP 1: Finding Abayabuth retailer in database...');
  const retailer = await prisma.retailer.findFirst({
    where: { name: { contains: 'Abayabuth', mode: 'insensitive' } }
  });
  
  if (!retailer) {
    console.log('❌ Retailer not found!\n');
    process.exit(0);
  }
  
  console.log('✅ Found retailer:');
  console.log('   ID:', retailer.id);
  console.log('   Name:', retailer.name);
  console.log('   Website:', retailer.websiteUrl);
  console.log('   Last Discovery Method:', retailer.lastDiscoveryMethod);
  console.log('');
  
  // Step 2: Test Shopify detection
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('STEP 2: Testing Shopify detection...');
  const origin = retailer.websiteUrl.replace(/\/$/, '');
  
  try {
    const shopifyTest = await fetch(`${origin}/products.json?limit=1`);
    if (shopifyTest.ok) {
      console.log('✅ Shopify store detected!');
      console.log('   Endpoint: ' + origin + '/products.json');
      console.log('');
    } else {
      console.log('❌ Not a Shopify store (HTTP ' + shopifyTest.status + ')');
      process.exit(0);
    }
  } catch (error) {
    console.log('❌ Failed to connect:', error.message);
    process.exit(0);
  }
  
  // Step 3: Fetch homepage to detect currency
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('STEP 3: Fetching homepage to detect currency...');
  console.log('URL:', origin);
  console.log('');
  
  const homeResponse = await fetch(origin);
  const html = await homeResponse.text();
  
  console.log('✅ Homepage fetched (' + html.length + ' chars)');
  console.log('');
  
  // Currency detection logic (same as in shopify-discovery.js)
  console.log('🔍 Detecting currency from homepage HTML...\n');
  
  let detectedCurrency = null;
  let detectionMethod = null;
  
  // Method 1: Shopify.currency
  const shopifyCurrencyMatch = html.match(/Shopify\.currency\s*=\s*[{"']([A-Z]{3})["']/i);
  if (shopifyCurrencyMatch) {
    detectedCurrency = shopifyCurrencyMatch[1];
    detectionMethod = 'Shopify.currency in JavaScript';
    console.log('✅ Method 1: Found Shopify.currency = "' + detectedCurrency + '"');
  }
  
  // Method 2: Meta tags
  if (!detectedCurrency) {
    const metaMatch = html.match(/<meta[^>]+currency["'][^>]+content=["']([A-Z]{3})["']/i);
    if (metaMatch) {
      detectedCurrency = metaMatch[1];
      detectionMethod = 'Meta tag';
      console.log('✅ Method 2: Found in meta tag: ' + detectedCurrency);
    }
  }
  
  // Method 3: Currency in scripts
  if (!detectedCurrency) {
    const scriptMatch = html.match(/currency["\s:]+([A-Z]{3})/i);
    if (scriptMatch) {
      detectedCurrency = scriptMatch[1];
      detectionMethod = 'Script/JSON';
      console.log('✅ Method 3: Found in script: ' + detectedCurrency);
    }
  }
  
  // Method 4: PKR symbols
  if (!detectedCurrency) {
    if (/[₨Rs]\s*\d+[,\d]+/.test(html) || /PKR/i.test(html)) {
      detectedCurrency = 'PKR';
      detectionMethod = 'PKR symbols (₨/Rs/PKR) in HTML';
      console.log('✅ Method 4: Found PKR symbols in HTML');
      
      // Show examples
      const pkrMatches = html.match(/(?:PKR|₨|Rs\.?)\s*[\d,]+/gi);
      if (pkrMatches) {
        console.log('   Examples:');
        pkrMatches.slice(0, 3).forEach((m, i) => {
          console.log('      ' + (i + 1) + '. ' + m);
        });
      }
    }
  }
  
  if (!detectedCurrency) {
    detectedCurrency = 'GBP';
    detectionMethod = 'Default fallback';
    console.log('⚠️  No currency detected, defaulting to GBP');
  }
  
  console.log('');
  console.log('🎯 DETECTED CURRENCY: ' + detectedCurrency);
  console.log('   Detection method: ' + detectionMethod);
  console.log('');
  
  // Step 4: Fetch exchange rate
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('STEP 4: Fetching exchange rate...');
  
  let exchangeRate = null;
  
  if (detectedCurrency !== 'GBP') {
    console.log('Currency is not GBP, fetching exchange rate...');
    console.log('API: https://api.exchangerate-api.com/v4/latest/' + detectedCurrency);
    console.log('');
    
    try {
      const rateResponse = await fetch(`https://api.exchangerate-api.com/v4/latest/${detectedCurrency}`);
      const rateData = await rateResponse.json();
      
      if (rateData.rates && rateData.rates.GBP) {
        exchangeRate = rateData.rates.GBP;
        console.log('✅ Exchange rate fetched successfully!');
        console.log('   ' + detectedCurrency + ' → GBP = ' + exchangeRate.toFixed(6));
        console.log('   Last updated: ' + rateData.date);
        console.log('');
      }
    } catch (error) {
      console.log('❌ Failed to fetch exchange rate:', error.message);
      console.log('');
    }
  } else {
    console.log('Currency is already GBP, no conversion needed');
    console.log('');
  }
  
  // Step 5: Fetch first product from Shopify API
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('STEP 5: Fetching first product from Shopify API...');
  console.log('Endpoint: ' + origin + '/products.json?limit=1');
  console.log('');
  
  const productsResponse = await fetch(`${origin}/products.json?limit=1`);
  const productsData = await productsResponse.json();
  
  if (!productsData.products || productsData.products.length === 0) {
    console.log('❌ No products found!');
    process.exit(0);
  }
  
  const firstProduct = productsData.products[0];
  const firstVariant = firstProduct.variants[0];
  
  console.log('✅ Product fetched from Shopify API:');
  console.log('');
  console.log('📦 Product Data (from Shopify API):');
  console.log('   Title: ' + firstProduct.title);
  console.log('   Handle: ' + firstProduct.handle);
  console.log('   Product Type: ' + firstProduct.product_type);
  console.log('');
  console.log('💰 Variant Data (from Shopify API):');
  console.log('   Variant ID: ' + firstVariant.id);
  console.log('   Price: ' + firstVariant.price);
  console.log('   Available: ' + firstVariant.available);
  console.log('   SKU: ' + (firstVariant.sku || '(none)'));
  console.log('');
  
  console.log('🔑 Currency Info in API Response:');
  console.log('   variant.currency: ' + (firstVariant.currency || '(not present)'));
  console.log('   variant.currency_code: ' + (firstVariant.currency_code || '(not present)'));
  console.log('   product.currency: ' + (firstProduct.currency || '(not present)'));
  console.log('   variant.presentment_prices: ' + (firstVariant.presentment_prices ? 'Present' : '(not present)'));
  console.log('');
  
  console.log('⚠️  NOTE: Shopify API does NOT include currency in basic response!');
  console.log('   This is why we detect currency from homepage HTML.');
  console.log('');
  
  // Step 6: Show conversion
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('STEP 6: Currency conversion for this product...');
  console.log('');
  
  const originalPrice = parseFloat(firstVariant.price);
  let finalPrice = originalPrice;
  
  console.log('📊 Price Conversion:');
  console.log('   Original price (from API): ' + originalPrice);
  console.log('   Detected currency: ' + detectedCurrency);
  
  if (detectedCurrency !== 'GBP' && exchangeRate) {
    finalPrice = Math.round(originalPrice * exchangeRate * 100) / 100;
    console.log('   Exchange rate: ' + exchangeRate.toFixed(6));
    console.log('   Calculation: ' + originalPrice + ' × ' + exchangeRate.toFixed(6) + ' = ' + finalPrice);
    console.log('   ✅ Final price (GBP): £' + finalPrice);
  } else {
    console.log('   No conversion needed');
    console.log('   Final price: £' + finalPrice);
  }
  console.log('');
  
  // Step 7: Show what gets stored in database
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('STEP 7: What gets stored in database...');
  console.log('');
  
  console.log('💾 Product Record:');
  console.log('   name: "' + firstProduct.title + '"');
  console.log('   price: ' + finalPrice + ' (stored as GBP)');
  console.log('   product_url: "' + origin + '/products/' + firstProduct.handle + '"');
  console.log('   category: "' + (firstProduct.product_type || '') + '"');
  console.log('   retailer_id: "' + retailer.id + '"');
  console.log('   source: "SHOPIFY_UPLOAD"');
  console.log('');
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 SUMMARY OF SCRAPING FLOW:\n');
  console.log('1. Scraper detects Abayabuth is a Shopify store');
  console.log('   ✅ Uses /products.json API endpoint\n');
  
  console.log('2. Fetches homepage HTML to detect currency');
  console.log('   ✅ Detected: ' + detectedCurrency);
  console.log('   ✅ Method: ' + detectionMethod + '\n');
  
  console.log('3. Fetches exchange rate (once per retailer)');
  if (exchangeRate) {
    console.log('   ✅ Rate: ' + detectedCurrency + ' → GBP = ' + exchangeRate.toFixed(6) + '\n');
  } else {
    console.log('   ℹ️  No conversion needed (already GBP)\n');
  }
  
  console.log('4. Fetches products from Shopify API');
  console.log('   ✅ API provides: title, price, variants, images');
  console.log('   ❌ API does NOT provide: currency code\n');
  
  console.log('5. Converts prices using cached rate');
  console.log('   ✅ Example: ' + detectedCurrency + ' ' + originalPrice + ' → £' + finalPrice + '\n');
  
  console.log('6. Stores converted prices in database');
  console.log('   ✅ All prices stored in GBP\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ TRACE COMPLETE!\n');
  
  await prisma.$disconnect();
}

traceScrapingFlow().catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
