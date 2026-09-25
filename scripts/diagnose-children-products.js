/**
 * Diagnose Children Products Coverage
 * 
 * Checks what children products exist and their age band distribution
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('\n🔍 ===== CHILDREN PRODUCTS DIAGNOSIS =====\n');

  // Get all Gem's Picks in Children category
  const childrenProducts = await prisma.product.findMany({
    where: {
      sourceType: 'CURATED_PRODUCT',
      category: { startsWith: 'Children' },
      status: 'ACTIVE'
    },
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      genderAppliesTo: true,
      suitableAgeBands: true
    }
  });

  console.log(`📦 Total Children Products (Gem's Picks): ${childrenProducts.length}\n`);

  // Group by age band
  const ageBandCounts = {
    '1-2': 0,
    '3-4': 0,
    '5-6': 0,
    '7-8': 0,
    '9-11': 0,
    '12-17': 0,
    'NONE': 0
  };

  const byGender = {
    'Female': 0,
    'Male': 0,
    'Unisex': 0,
    'None': 0
  };

  childrenProducts.forEach(p => {
    // Count by age band
    if (!p.suitableAgeBands || p.suitableAgeBands.length === 0) {
      ageBandCounts['NONE']++;
    } else {
      p.suitableAgeBands.forEach(band => {
        if (ageBandCounts[band] !== undefined) {
          ageBandCounts[band]++;
        }
      });
    }

    // Count by gender
    const gender = p.genderAppliesTo || 'None';
    if (byGender[gender] !== undefined) {
      byGender[gender]++;
    } else {
      byGender['None']++;
    }
  });

  console.log('📊 Age Band Distribution:');
  Object.entries(ageBandCounts).forEach(([band, count]) => {
    const bar = '█'.repeat(Math.ceil(count / 2));
    console.log(`   ${band.padEnd(8)} : ${count.toString().padStart(3)} ${bar}`);
  });

  console.log('\n📊 Gender Distribution:');
  Object.entries(byGender).forEach(([gender, count]) => {
    const bar = '█'.repeat(Math.ceil(count / 2));
    console.log(`   ${gender.padEnd(8)} : ${count.toString().padStart(3)} ${bar}`);
  });

  console.log('\n📊 Price Range:');
  const prices = childrenProducts.map(p => p.price).filter(p => p);
  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    console.log(`   Min: £${min}`);
    console.log(`   Max: £${max}`);
    console.log(`   Avg: £${avg.toFixed(2)}`);
  }

  // Show products specifically for 7-8 age band
  console.log('\n\n🎯 Products Suitable for Age 7-8:\n');
  const age78Products = childrenProducts.filter(p => 
    p.suitableAgeBands && p.suitableAgeBands.includes('7-8')
  );

  if (age78Products.length === 0) {
    console.log('   ❌ NO PRODUCTS FOUND FOR AGE 7-8!');
    console.log('   This is why Alexa\'s gift generation failed.\n');
  } else {
    age78Products.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   £${p.price} | ${p.genderAppliesTo || 'No gender'} | Age: ${p.suitableAgeBands.join(', ')}`);
      console.log(`   Category: ${p.category}\n`);
    });
  }

  // Show recommendations
  console.log('\n💡 RECOMMENDATIONS:\n');
  if (age78Products.length === 0) {
    console.log('   To fix Alexa\'s generation failure:');
    console.log('   1. Add children products suitable for age 7-8');
    console.log('   2. Or edit existing children products to include "7-8" age band');
    console.log('   3. Ensure they are:');
    console.log('      - sourceType: CURATED_PRODUCT');
    console.log('      - category: Children (any subcategory)');
    console.log('      - gender: Female or Unisex');
    console.log('      - price: £100-£500 range');
  } else if (age78Products.length < 5) {
    console.log(`   ⚠️  Only ${age78Products.length} products for age 7-8. Recommend adding more for better variety.`);
  } else {
    console.log(`   ✅ Good coverage: ${age78Products.length} products for age 7-8`);
  }

  console.log('\n==========================================\n');

  await prisma.$disconnect();
}

diagnose().catch(console.error);
