/**
 * Update products with new flexible age band format from AI reclassification.
 * 
 * Takes the AI-corrected JSON file and updates suitableAgeBands in the database
 * with new flexible format (e.g., ["1-7", "18-30"]) instead of old enums.
 * 
 * Usage:
 *   node scripts/update-age-bands-flexible.js <path-to-corrected-json>
 * 
 * Example:
 *   node scripts/update-age-bands-flexible.js age-band-exports/non-gem-pick-products-reclassified.json
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Allowed age band ranges (from onboarding form)
const ALLOWED_AGE_BANDS = [
  // Children/Youth
  "1-2", "3-4", "5-6", "7-8", "9-11", "12-17",
  // Adults
  "18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"
];

// Validation: Age band must be from allowed list
function isValidAgeBand(band) {
  return ALLOWED_AGE_BANDS.includes(band);
}

function validateAgeBands(bands) {
  const errors = [];
  
  if (!Array.isArray(bands)) {
    return ['Age bands must be an array'];
  }
  
  if (bands.length === 0) {
    return ['Age bands array is empty (should have at least one range)'];
  }
  
  bands.forEach(band => {
    if (typeof band !== 'string') {
      errors.push(`Invalid band type: ${typeof band}`);
    } else if (!isValidAgeBand(band)) {
      errors.push(`Invalid band: "${band}" (must be one of: ${ALLOWED_AGE_BANDS.join(', ')})`);
    }
  });
  
  return errors;
}

async function updateAgeBands(filePath) {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    // Read corrected data
    console.log(`📖 Reading corrected age bands from: ${filePath}`);
    const correctedProducts = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`✅ Loaded ${correctedProducts.length} products`);

    // Validate structure
    const productsToUpdate = [];
    const validationErrors = [];
    
    correctedProducts.forEach((product, index) => {
      if (!product.id) {
        validationErrors.push(`Product at index ${index}: Missing id`);
        return;
      }
      
      if (!product.new_age_bands) {
        validationErrors.push(`Product ${product.id}: Missing new_age_bands field`);
        return;
      }
      
      const errors = validateAgeBands(product.new_age_bands);
      if (errors.length > 0) {
        validationErrors.push(`Product ${product.id} (${product.name}): ${errors.join(', ')}`);
        return;
      }
      
      productsToUpdate.push(product);
    });

    if (validationErrors.length > 0) {
      console.error('\n❌ Validation errors found:');
      validationErrors.forEach(err => console.error(`   ${err}`));
      console.error(`\n❌ Found ${validationErrors.length} validation errors. Please fix and try again.`);
      process.exit(1);
    }

    console.log(`✅ All ${productsToUpdate.length} products passed validation`);

    // Create backup before updating
    const backupDir = path.join(process.cwd(), 'age-band-exports', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupPath = path.join(backupDir, `age-band-updates-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(productsToUpdate, null, 2));
    console.log(`\n💾 Backup created: ${backupPath}`);

    // Update database in batches for better performance
    console.log('\n🔄 Updating database in batches...');
    let successCount = 0;
    let failCount = 0;
    const updateErrors = [];
    const batchSize = 100;

    for (let i = 0; i < productsToUpdate.length; i += batchSize) {
      const batch = productsToUpdate.slice(i, i + batchSize);
      
      // Update batch in parallel
      const results = await Promise.allSettled(
        batch.map(product => 
          prisma.product.update({
            where: { id: product.id },
            data: { suitableAgeBands: product.new_age_bands }
          })
        )
      );

      // Count successes and failures
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
          const product = batch[idx];
          updateErrors.push({
            id: product.id,
            name: product.name,
            error: result.reason.message
          });
        }
      });

      // Progress indicator
      console.log(`   ✓ Processed ${Math.min(i + batchSize, productsToUpdate.length)}/${productsToUpdate.length}...`);
    }

    console.log('\n📊 Update Summary:');
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);

    if (updateErrors.length > 0) {
      console.log('\n⚠️  Failed updates:');
      updateErrors.forEach(err => {
        console.log(`   ${err.id} (${err.name}): ${err.error}`);
      });
    }

    // Show sample of updated age bands
    console.log('\n📋 Sample of new age bands:');
    const samples = productsToUpdate.slice(0, 5);
    samples.forEach(p => {
      console.log(`   ${p.name}`);
      console.log(`      Old: [${p.current_age_bands.join(', ')}]`);
      console.log(`      New: [${p.new_age_bands.join(', ')}]`);
      console.log(`      Why: ${p.reasoning}`);
      console.log('');
    });

    // Age band distribution
    const ageBandCounts = {};
    productsToUpdate.forEach(p => {
      p.new_age_bands.forEach(band => {
        ageBandCounts[band] = (ageBandCounts[band] || 0) + 1;
      });
    });

    console.log('📊 New age band distribution:');
    Object.entries(ageBandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([band, count]) => {
        console.log(`   ${band}: ${count} products`);
      });

    console.log('\n✅ Age band update complete!');
    console.log('\n📝 Next step: Review code that uses age bands and update to new format');

  } catch (error) {
    console.error('❌ Error updating age bands:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get file path from command line
const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ Usage: node scripts/update-age-bands-flexible.js <path-to-corrected-json>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/update-age-bands-flexible.js age-band-exports/non-gem-pick-products-reclassified.json');
  process.exit(1);
}

updateAgeBands(filePath);
