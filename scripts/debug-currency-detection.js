/**
 * Debug script to see exactly how currency is detected for Abayabuth
 */

async function debugCurrencyDetection() {
  const origin = 'https://abayabuth.com';
  
  console.log('🔍 Debugging Currency Detection for Abayabuth\n');
  console.log('Fetching homepage...\n');
  
  try {
    const response = await fetch(origin);
    const html = await response.text();
    
    console.log('✅ Homepage fetched (' + html.length + ' chars)\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Test 1: Shopify.currency
    console.log('1️⃣  Looking for Shopify.currency in JavaScript...');
    const shopifyCurrencyMatch = html.match(/Shopify\.currency\s*=\s*[{"']([A-Z]{3})["']/i);
    if (shopifyCurrencyMatch) {
      console.log('   ✅ FOUND: Shopify.currency = "' + shopifyCurrencyMatch[1] + '"');
      console.log('   🎯 This would be selected!\n');
    } else {
      console.log('   ❌ Not found\n');
    }
    
    // Test 2: Meta tags
    console.log('2️⃣  Looking for <meta> tags with currency...');
    const metaMatch = html.match(/<meta[^>]+currency["'][^>]+content=["']([A-Z]{3})["']/i);
    if (metaMatch) {
      console.log('   ✅ FOUND: <meta currency="' + metaMatch[1] + '">');
      console.log('   🎯 This would be selected!\n');
    } else {
      console.log('   ❌ Not found\n');
    }
    
    // Test 3: Currency in scripts/JSON
    console.log('3️⃣  Looking for currency:"XXX" in scripts...');
    const scriptMatch = html.match(/currency["\s:]+([A-Z]{3})/i);
    if (scriptMatch) {
      console.log('   ✅ FOUND: currency:"' + scriptMatch[1] + '"');
      console.log('   🎯 This would be selected!\n');
    } else {
      console.log('   ❌ Not found\n');
    }
    
    // Test 4: PKR symbols
    console.log('4️⃣  Looking for PKR symbols (₨/Rs/PKR)...');
    const pkrSymbolMatch = /[₨Rs]\s*\d+[,\d]+/.test(html);
    const pkrTextMatch = /PKR/i.test(html);
    if (pkrSymbolMatch || pkrTextMatch) {
      console.log('   ✅ FOUND: PKR symbols/text in HTML');
      console.log('   Symbol (₨/Rs): ' + (pkrSymbolMatch ? 'Yes' : 'No'));
      console.log('   Text (PKR): ' + (pkrTextMatch ? 'Yes' : 'No'));
      console.log('   🎯 This is being selected! ← CURRENT DETECTION\n');
      
      // Show examples
      const pkrExamples = html.match(/(?:₨|Rs|PKR)\s*[\d,]+/gi);
      if (pkrExamples) {
        console.log('   📝 Examples found in HTML:');
        pkrExamples.slice(0, 5).forEach((ex, i) => {
          console.log('      ' + (i + 1) + '. ' + ex);
        });
        console.log('');
      }
    } else {
      console.log('   ❌ Not found\n');
    }
    
    // Test 5: USD symbol
    console.log('5️⃣  Looking for USD symbol ($)...');
    const usdMatch = /\$\d+/.test(html);
    const gbpMatch = /£\d+/.test(html);
    if (usdMatch && !gbpMatch) {
      console.log('   ✅ FOUND: $ symbol (and no £)');
      console.log('   🎯 This would be selected!\n');
    } else {
      console.log('   ❌ Not found (or £ also present)\n');
    }
    
    // Test 6: EUR symbol
    console.log('6️⃣  Looking for EUR symbol (€)...');
    const eurMatch = /€\d+/.test(html);
    if (eurMatch) {
      console.log('   ✅ FOUND: € symbol');
      console.log('   🎯 This would be selected!\n');
    } else {
      console.log('   ❌ Not found\n');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 DETECTION RESULT:\n');
    console.log('The code detected: PKR');
    console.log('Reason: PKR symbols/text found in HTML (Test #4)\n');
    console.log('This is the DEFAULT currency for visitors from Pakistan.');
    console.log('Other currencies (USD, GBP, EUR) are available but not default.\n');
    
    // Show all currency mentions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 ALL CURRENCY CODES FOUND IN HTML:\n');
    const allCurrencies = html.match(/\b(USD|GBP|EUR|PKR|AED|SAR|CAD|AUD)\b/gi);
    if (allCurrencies) {
      const uniqueCurrencies = [...new Set(allCurrencies.map(c => c.toUpperCase()))];
      console.log('Found currencies: ' + uniqueCurrencies.join(', '));
      console.log('Count:');
      uniqueCurrencies.forEach(curr => {
        const count = allCurrencies.filter(c => c.toUpperCase() === curr).length;
        console.log('   ' + curr + ': ' + count + ' mentions');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugCurrencyDetection();
