/**
 * Check why Alexa's generation failed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('\n🔍 ===== CHECKING ALEXA GENERATION FAILURE =====\n');

  // Check Alexa's details
  const alexa = await prisma.recipient.findFirst({
    where: { name: 'Alexa' },
    select: {
      id: true,
      name: true,
      ageBand: true,
      gender: true,
      budgetMin: true,
      budgetMax: true
    }
  });

  console.log('👧 Alexa Details:');
  console.log(JSON.stringify(alexa, null, 2));
  console.log('');

  // Check products matching ALL criteria
  const products = await prisma.product.findMany({
    where: {
      sourceType: 'CURATED_PRODUCT',
      category: { startsWith: 'Children' },
      status: 'ACTIVE',
      suitableAgeBands: { has: '7-8' },
      price: { gte: 95, lte: 525 }
    },
    select: {
      id: true,
      name: true,
      price: true,
      genderAppliesTo: true,
      suitableAgeBands: true
    }
  });

  console.log(`📦 Products matching criteria (except gender): ${products.length}\n`);

  // Count by gender
  const genderCounts = {};
  products.forEach(p => {
    const g = p.genderAppliesTo || 'NULL';
    genderCounts[g] = (genderCounts[g] || 0) + 1;
  });

  console.log('📊 Gender Distribution in Matching Products:');
  Object.entries(genderCounts).forEach(([g, count]) => {
    console.log(`   ${g}: ${count}`);
  });
  console.log('');

  // Check case-insensitive female/unisex
  const femaleOrUnisex = products.filter(p => {
    const g = (p.genderAppliesTo || '').toLowerCase();
    return g === 'female' || g === 'unisex';
  });

  console.log(`✅ Products for FEMALE or UNISEX (case-insensitive): ${femaleOrUnisex.length}\n`);

  if (femaleOrUnisex.length > 0) {
    console.log('First 10 examples:');
    femaleOrUnisex.slice(0, 10).forEach((p, i) => {
      console.log(`${i+1}. ${p.name}`);
      console.log(`   £${p.price} | Gender: "${p.genderAppliesTo}" | Ages: ${p.suitableAgeBands.join(', ')}\n`);
    });
  } else {
    console.log('❌ NO PRODUCTS FOUND FOR FEMALE OR UNISEX!\n');
    console.log('This is why generation failed.\n');
  }

  // Check exact case matching
  console.log('📋 Checking case sensitivity:');
  const exactFemale = products.filter(p => p.genderAppliesTo === 'FEMALE');
  const lowerFemale = products.filter(p => p.genderAppliesTo === 'female');
  const upperFemale = products.filter(p => p.genderAppliesTo === 'Female');
  const exactUnisex = products.filter(p => p.genderAppliesTo === 'UNISEX');
  const lowerUnisex = products.filter(p => p.genderAppliesTo === 'unisex');
  const upperUnisex = products.filter(p => p.genderAppliesTo === 'Unisex');
  
  console.log(`   "FEMALE" (uppercase): ${exactFemale.length}`);
  console.log(`   "female" (lowercase): ${lowerFemale.length}`);
  console.log(`   "Female" (capitalized): ${upperFemale.length}`);
  console.log(`   "UNISEX" (uppercase): ${exactUnisex.length}`);
  console.log(`   "unisex" (lowercase): ${lowerUnisex.length}`);
  console.log(`   "Unisex" (capitalized): ${upperUnisex.length}`);

  console.log('\n==========================================\n');

  await prisma.$disconnect();
}

check().catch(console.error);
