/**
 * Update Children Age Bands from AI-Corrected Data
 * 
 * Uses child-specific age format: 1-2, 3-4, 5-6, 7-8, 9-11
 * Updates suitable_age_bands array in database
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Valid children age bands (specific format)
const VALID_CHILD_AGE_BANDS = [
  '1-2',
  '3-4',
  '5-6',
  '7-8',
  '9-11',
  '12-17'  // Teens still count as children category
];

async function updateChildrenAgeBands(correctedDataPath) {
  console.log('📥 Reading corrected children data from:', correctedDataPath, '\n');

  try {
    // Read corrected data
    const correctedData = JSON.parse(fs.readFileSync(correctedDataPath, 'utf8'));
    
    console.log(`✅ Loaded ${correctedData.length} children products\n`);
    
    // Validate and prepare updates
    const updates = [];
    const skipped = [];
    const errors = [];
    
    for (const item of correctedData) {
      // Validate product ID exists
      if (!item.id) {
        errors.push({ item, reason: 'Missing product ID' });
        continue;
      }
      
      // Validate corrected_child_age_bands
      if (!item.corrected_child_age_bands || !Array.isArray(item.corrected_child_age_bands)) {
        skipped.push({ id: item.id, name: item.name, reason: 'No corrected_child_age_bands provided' });
        continue;
      }
      
      if (item.corrected_child_age_bands.length === 0) {
        skipped.push({ id: item.id, name: item.name, reason: 'Empty corrected_child_age_bands array' });
        continue;
      }
      
      // Validate age bands are valid child formats
      const invalidBands = item.corrected_child_age_bands.filter(band => !VALID_CHILD_AGE_BANDS.includes(band));
      if (invalidBands.length > 0) {
        errors.push({ 
          id: item.id, 
          name: item.name, 
          reason: `Invalid child age bands: ${invalidBands.join(', ')}. Valid: ${VALID_CHILD_AGE_BANDS.join(', ')}` 
        });
        continue;
      }
      
      updates.push({
        id: item.id,
        name: item.name,
        oldBands: item.current_age_bands || [],
        newBands: item.corrected_child_age_bands,
        reasoning: item.correction_reasoning || 'No reasoning provided'
      });
    }
    
    console.log('📊 Validation Results:');
    console.log(`   ✅ Valid updates: ${updates.length}`);
    console.log(`   ⚠️  Skipped: ${skipped.length}`);
    console.log(`   ❌ Errors: ${errors.length}\n`);
    
    if (errors.length > 0) {
      console.log('❌ Errors found:');
      errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err.name || err.item?.name || 'Unknown'}: ${err.reason}`);
      });
      console.log('');
    }
    
    if (skipped.length > 0) {
      console.log('⚠️  Skipped products:');
      skipped.slice(0, 10).forEach((skip, i) => {
        console.log(`   ${i + 1}. ${skip.name}: ${skip.reason}`);
      });
      if (skipped.length > 10) {
        console.log(`   ... and ${skipped.length - 10} more\n`);
      }
    }
    
    if (updates.length === 0) {
      console.log('⚠️  No valid updates to apply. Exiting.\n');
      return;
    }
    
    // Show preview
    console.log('\n📋 Preview of changes:');
    console.log('─────────────────────────────────────────────────────────────');
    updates.slice(0, 5).forEach((update, i) => {
      console.log(`\n${i + 1}. ${update.name}`);
      console.log(`   Old: ${update.oldBands.join(', ') || 'None'}`);
      console.log(`   New: ${update.newBands.join(', ')}`);
      console.log(`   Reason: ${update.reasoning.substring(0, 80)}...`);
    });
    if (updates.length > 5) {
      console.log(`\n... and ${updates.length - 5} more products`);
    }
    console.log('─────────────────────────────────────────────────────────────\n');
    
    // Confirm before updating
    console.log(`🚀 Ready to update ${updates.length} children products.`);
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Perform updates
    console.log('🔄 Updating database...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const update of updates) {
      try {
        await prisma.product.update({
          where: { id: update.id },
          data: {
            suitableAgeBands: update.newBands,
            updatedAt: new Date()
          }
        });
        
        successCount++;
        
        // Log all changes
        console.log(`   ✓ ${update.name}`);
        console.log(`     Old: ${update.oldBands.join(', ') || 'None'}`);
        console.log(`     New: ${update.newBands.join(', ')}`);
        if (update.reasoning) {
          console.log(`     ${update.reasoning.substring(0, 100)}...`);
        }
        console.log('');
        
      } catch (error) {
        failCount++;
        console.error(`   ❌ Failed to update ${update.name}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Update Complete!');
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`   Skipped: ${skipped.length}\n`);
    
    // Show age band distribution
    const ageBandStats = {};
    updates.forEach(update => {
      update.newBands.forEach(band => {
        ageBandStats[band] = (ageBandStats[band] || 0) + 1;
      });
    });
    
    console.log('📊 Final Age Band Distribution:');
    Object.entries(ageBandStats)
      .sort((a, b) => {
        const order = ['1-2', '3-4', '5-6', '7-8', '9-11', '12-17'];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      })
      .forEach(([band, count]) => {
        console.log(`   ${band}: ${count} products`);
      });
    console.log('');
    
    // Create backup of changes
    const backupDir = path.join(__dirname, '..', 'age-band-exports', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupPath = path.join(backupDir, `children-age-band-updates-${timestamp}.json`);
    
    fs.writeFileSync(backupPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalUpdates: updates.length,
      successCount,
      failCount,
      ageBandStats,
      updates: updates.map(u => ({
        id: u.id,
        name: u.name,
        oldBands: u.oldBands,
        newBands: u.newBands,
        reasoning: u.reasoning
      }))
    }, null, 2));
    
    console.log(`📁 Backup saved to: ${backupPath}\n`);

  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get file path from command line argument
const correctedFilePath = process.argv[2];

if (!correctedFilePath) {
  console.error('❌ Error: Please provide path to corrected data file\n');
  console.log('Usage: node update-children-age-bands.js <path-to-corrected-file.json>\n');
  console.log('Example:');
  console.log('  node update-children-age-bands.js age-band-exports/children-products-corrected.json\n');
  process.exit(1);
}

// Check file exists
if (!fs.existsSync(correctedFilePath)) {
  console.error(`❌ Error: File not found: ${correctedFilePath}\n`);
  process.exit(1);
}

// Run update
updateChildrenAgeBands(correctedFilePath)
  .then(() => {
    console.log('🎉 Children age band updates applied successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Update failed:', error);
    process.exit(1);
  });
