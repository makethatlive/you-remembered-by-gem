/**
 * Check for duplicate products in Gem's Picks
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicates() {
  console.log('🔍 Checking for duplicates in Gem\'s Picks...\n');
  
  try {
    // Get all Gem's Picks
    const gemsPicks = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT'
      },
      select: {
        id: true,
        name: true,
        productUrl: true,
        price: true,
        retailerId: true,
        retailer: {
          select: {
            name: true
          }
        },
        createdAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`📊 Total Gem's Picks: ${gemsPicks.length}\n`);
    
    // Check for duplicates by name
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('1️⃣  Checking duplicates by NAME:\n');
    
    const nameMap = new Map();
    gemsPicks.forEach(product => {
      const name = product.name.trim().toLowerCase();
      if (!nameMap.has(name)) {
        nameMap.set(name, []);
      }
      nameMap.get(name).push(product);
    });
    
    const nameDuplicates = Array.from(nameMap.entries())
      .filter(([name, products]) => products.length > 1)
      .sort((a, b) => b[1].length - a[1].length);
    
    if (nameDuplicates.length === 0) {
      console.log('✅ No duplicates found by name!\n');
    } else {
      console.log(`⚠️  Found ${nameDuplicates.length} duplicate product names:\n`);
      
      let totalDuplicateProducts = 0;
      nameDuplicates.forEach(([name, products], index) => {
        totalDuplicateProducts += products.length - 1; // -1 because one is original
        
        console.log(`${index + 1}. "${products[0].name}" (${products.length} copies)`);
        products.forEach((p, i) => {
          console.log(`   ${i + 1}. ID: ${p.id}`);
          console.log(`      Retailer: ${p.retailer?.name || '(none)'}`);
          console.log(`      Price: £${p.price}`);
          console.log(`      URL: ${p.productUrl || '(none)'}`);
        });
        console.log('');
      });
      
      console.log(`📊 Total duplicate products (extra copies): ${totalDuplicateProducts}\n`);
    }
    
    // Check for duplicates by URL
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('2️⃣  Checking duplicates by PRODUCT URL:\n');
    
    const urlMap = new Map();
    gemsPicks.forEach(product => {
      if (product.productUrl) {
        const url = product.productUrl.trim().toLowerCase();
        if (!urlMap.has(url)) {
          urlMap.set(url, []);
        }
        urlMap.get(url).push(product);
      }
    });
    
    const urlDuplicates = Array.from(urlMap.entries())
      .filter(([url, products]) => products.length > 1)
      .sort((a, b) => b[1].length - a[1].length);
    
    if (urlDuplicates.length === 0) {
      console.log('✅ No duplicates found by URL!\n');
    } else {
      console.log(`⚠️  Found ${urlDuplicates.length} duplicate product URLs:\n`);
      
      let totalUrlDuplicates = 0;
      urlDuplicates.forEach(([url, products], index) => {
        totalUrlDuplicates += products.length - 1;
        
        console.log(`${index + 1}. ${products.length} products with same URL:`);
        console.log(`   URL: ${url}`);
        products.forEach((p, i) => {
          console.log(`   ${i + 1}. "${p.name}" (ID: ${p.id})`);
          console.log(`      Retailer: ${p.retailer?.name || '(none)'}`);
          console.log(`      Price: £${p.price}`);
        });
        console.log('');
      });
      
      console.log(`📊 Total URL duplicates (extra copies): ${totalUrlDuplicates}\n`);
    }
    
    // Check for exact duplicates (same name AND same retailer)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('3️⃣  Checking EXACT duplicates (same name + same retailer):\n');
    
    const exactMap = new Map();
    gemsPicks.forEach(product => {
      const key = `${product.name.trim().toLowerCase()}::${product.retailerId}`;
      if (!exactMap.has(key)) {
        exactMap.set(key, []);
      }
      exactMap.get(key).push(product);
    });
    
    const exactDuplicates = Array.from(exactMap.entries())
      .filter(([key, products]) => products.length > 1)
      .sort((a, b) => b[1].length - a[1].length);
    
    if (exactDuplicates.length === 0) {
      console.log('✅ No exact duplicates found!\n');
    } else {
      console.log(`⚠️  Found ${exactDuplicates.length} exact duplicate products:\n`);
      
      let totalExactDuplicates = 0;
      exactDuplicates.forEach(([key, products], index) => {
        totalExactDuplicates += products.length - 1;
        
        console.log(`${index + 1}. "${products[0].name}" at ${products[0].retailer?.name}`);
        console.log(`   ${products.length} copies found:`);
        products.forEach((p, i) => {
          console.log(`   ${i + 1}. ID: ${p.id}, Price: £${p.price}, URL: ${p.product_url || '(none)'}`);
        });
        console.log('');
      });
      
      console.log(`📊 Total exact duplicates (extra copies): ${totalExactDuplicates}\n`);
    }
    
    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 SUMMARY:\n');
    console.log(`Total Gem's Picks: ${gemsPicks.length}`);
    console.log(`Duplicate names: ${nameDuplicates.length} groups`);
    console.log(`Duplicate URLs: ${urlDuplicates.length} groups`);
    console.log(`Exact duplicates: ${exactDuplicates.length} groups`);
    console.log('');
    
    if (exactDuplicates.length > 0) {
      console.log('💡 RECOMMENDATION:');
      console.log('   Keep the oldest product (first created) and delete the rest.');
      console.log('   Run: node scripts/remove-gems-picks-duplicates.js');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
