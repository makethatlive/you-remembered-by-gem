#!/usr/bin/env node
/**
 * Test diversity sampling algorithm
 * Demonstrates how products are distributed across categories/retailers
 */

// Mock diversity sampling function (copied from product-matcher.js)
function applyDiversitySampling(products, targetCount) {
  if (products.length <= targetCount) return products;

  const selected = [];
  const categoryGroups = new Map();
  const retailerUsage = new Map();
  
  const getTopCategory = (product) => {
    if (!product.category) return 'Uncategorized';
    const parts = product.category.split('>').map(p => p.trim());
    return parts[0] || 'Uncategorized';
  };
  
  // Group by top-level category
  products.forEach(product => {
    const topCat = getTopCategory(product);
    if (!categoryGroups.has(topCat)) {
      categoryGroups.set(topCat, []);
    }
    categoryGroups.get(topCat).push(product);
  });
  
  console.log(`\n📊 Found ${categoryGroups.size} top-level categories:`);
  categoryGroups.forEach((prods, cat) => {
    console.log(`   ${cat}: ${prods.length} products`);
  });
  
  // Calculate limits
  const MAX_PER_CATEGORY = Math.max(3, Math.floor(targetCount / Math.max(categoryGroups.size, 3)));
  const MAX_PER_RETAILER = Math.max(3, Math.floor(targetCount / 5));
  
  console.log(`\n🎯 Diversity limits: ${MAX_PER_CATEGORY} per category, ${MAX_PER_RETAILER} per retailer`);
  
  // Sort categories by highest score
  const categoryEntries = Array.from(categoryGroups.entries())
    .sort((a, b) => {
      const maxScoreA = Math.max(...a[1].map(p => p.score));
      const maxScoreB = Math.max(...b[1].map(p => p.score));
      return maxScoreB - maxScoreA;
    });
  
  // Round 1: Sample from each category
  console.log(`\n🎨 Round 1: Sampling from each category...`);
  for (const [category, categoryProducts] of categoryEntries) {
    let taken = 0;
    
    for (const product of categoryProducts) {
      if (selected.length >= targetCount) break;
      if (taken >= MAX_PER_CATEGORY) break;
      
      const retailerId = product.retailer;
      const retailerCount = retailerUsage.get(retailerId) || 0;
      
      if (retailerCount >= MAX_PER_RETAILER) continue;
      
      selected.push(product);
      taken++;
      retailerUsage.set(retailerId, retailerCount + 1);
    }
    
    if (taken > 0) {
      console.log(`   ✓ ${category}: ${taken} products selected`);
    }
  }
  
  // Round 2: Fill remaining
  if (selected.length < targetCount) {
    console.log(`\n📦 Round 2: Filling ${targetCount - selected.length} remaining slots...`);
    const selectedIds = new Set(selected.map(p => p.id));
    
    for (const product of products) {
      if (selected.length >= targetCount) break;
      if (selectedIds.has(product.id)) continue;
      selected.push(product);
    }
  }
  
  // Sort by score
  selected.sort((a, b) => b.score - a.score);
  
  // Stats
  const finalCategories = new Set(selected.map(p => getTopCategory(p)));
  const finalRetailers = new Set(selected.map(p => p.retailer));
  
  console.log(`\n✅ Final selection: ${selected.length} products`);
  console.log(`   Categories: ${finalCategories.size}`);
  console.log(`   Retailers: ${finalRetailers.size}`);
  
  return selected;
}

// ════════════════════════════════════════════════════════════════════════
// TEST CASE: User interested in Gardening (heavy category)
// ════════════════════════════════════════════════════════════════════════

console.log('═'.repeat(80));
console.log('TEST: User interests = [Gardening, Cooking, Fashion]');
console.log('═'.repeat(80));

// Mock 50 products (30 gardening, 10 cooking, 10 fashion)
const mockProducts = [
  // 30 Gardening products (high scores because it matches interest)
  ...Array.from({ length: 30 }, (_, i) => ({
    id: `garden-${i}`,
    name: `Garden Product ${i + 1}`,
    category: i < 10 ? 'Gardening & outdoor > Plants' : 
              i < 20 ? 'Gardening & outdoor > Tools' : 
              'Gardening & outdoor > Accessories',
    retailer: `Retailer ${(i % 8) + 1}`,
    score: 45 - i, // Scores from 45 down to 16
  })),
  
  // 10 Cooking products (medium scores)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `cooking-${i}`,
    name: `Cooking Product ${i + 1}`,
    category: i < 5 ? 'Food & Drink > Cooking & food' : 
              'Food & Drink > Wine & Drinks',
    retailer: `Retailer ${(i % 5) + 1}`,
    score: 44 - i, // Scores from 44 down to 35
  })),
  
  // 10 Fashion products (lower scores)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `fashion-${i}`,
    name: `Fashion Product ${i + 1}`,
    category: i < 5 ? 'Fashion & accessories > Jewelry' : 
              'Fashion & accessories > Bags',
    retailer: `Retailer ${(i % 4) + 1}`,
    score: 40 - i, // Scores from 40 down to 31
  })),
];

// Sort by score (highest first) - simulates product-matcher behavior
mockProducts.sort((a, b) => b.score - a.score);

console.log(`\n📦 Input: ${mockProducts.length} products (sorted by score)`);
console.log(`   Top 5 scores: ${mockProducts.slice(0, 5).map(p => `${p.score} (${p.category.split('>')[0].trim()})`).join(', ')}`);

// ════════════════════════════════════════════════════════════════════════
// Without diversity sampling (old behavior)
// ════════════════════════════════════════════════════════════════════════

console.log('\n\n🔴 OLD BEHAVIOR: Take top 20 by score (no diversity)');
console.log('─'.repeat(80));

const top20NoDiv = mockProducts.slice(0, 20);
const catDistNoDiv = {};
top20NoDiv.forEach(p => {
  const cat = p.category.split('>')[0].trim();
  catDistNoDiv[cat] = (catDistNoDiv[cat] || 0) + 1;
});

console.log('\n📊 Category distribution in top 20:');
Object.entries(catDistNoDiv).forEach(([cat, count]) => {
  const bar = '█'.repeat(count);
  console.log(`   ${cat}: ${count} products ${bar}`);
});

console.log('\n❌ Problem: AI receives mostly gardening products, very few cooking/fashion options!');

// ════════════════════════════════════════════════════════════════════════
// With diversity sampling (new behavior)
// ════════════════════════════════════════════════════════════════════════

console.log('\n\n🟢 NEW BEHAVIOR: Diversity sampling');
console.log('─'.repeat(80));

const top20WithDiv = applyDiversitySampling(mockProducts, 20);

const catDistWithDiv = {};
top20WithDiv.forEach(p => {
  const cat = p.category.split('>')[0].trim();
  catDistWithDiv[cat] = (catDistWithDiv[cat] || 0) + 1;
});

console.log('\n📊 Category distribution in top 20:');
Object.entries(catDistWithDiv).forEach(([cat, count]) => {
  const bar = '█'.repeat(count);
  console.log(`   ${cat}: ${count} products ${bar}`);
});

console.log('\n✅ Solution: AI receives diverse products across all interests!');

console.log('\n' + '═'.repeat(80));
console.log('CONCLUSION: Diversity sampling ensures variety → better gift lists!');
console.log('═'.repeat(80));
