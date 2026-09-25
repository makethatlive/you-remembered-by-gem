/**
 * Import Categorization Results from Claude AI
 * 
 * Takes Claude's corrected categories and updates products in database
 * 
 * Usage: node scripts/import-categorization-results.js path/to/claude-results.json
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function importCategorizationResults() {
  const resultsPath = process.argv[2];
  
  if (!resultsPath) {
    console.error('❌ Error: Please provide path to Claude results file');
    console.log('Usage: node scripts/import-categorization-results.js path/to/claude-results.json');
    process.exit(1);
  }
  
  if (!fs.existsSync(resultsPath)) {
    console.error('❌ Error: Results file not found:', resultsPath);
    process.exit(1);
  }
  
  console.log('📥 Importing categorization results...\n');
  console.log(`📂 Reading: ${resultsPath}\n`);
  
  try {
    // Read Claude's results
    const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    
    if (!Array.isArray(resultsData)) {
      console.error('❌ Error: Results file must contain a JSON array');
      process.exit(1);
    }
    
    console.log(`   ✅ Loaded ${resultsData.length} categorization results\n`);
    
    // Validate structure
    const requiredFields = ['product_id', 'corrected_category'];
    const invalidRows = resultsData.filter(row => 
      !requiredFields.every(field => field in row)
    );
    
    if (invalidRows.length > 0) {
      console.error('❌ Error: Some rows missing required fields (product_id, corrected_category)');
      console.error('   Invalid rows:', invalidRows.slice(0, 5));
      process.exit(1);
    }
    
    // Group by confidence
    const byConfidence = {
      high: resultsData.filter(r => r.confidence === 'high'),
      medium: resultsData.filter(r => r.confidence === 'medium'),
      low: resultsData.filter(r => r.confidence === 'low'),
      unknown: resultsData.filter(r => !r.confidence)
    };
    
    console.log('📊 Confidence Distribution:');
    console.log(`   🟢 High confidence: ${byConfidence.high.length}`);
    console.log(`   🟡 Medium confidence: ${byConfidence.medium.length}`);
    console.log(`   🔴 Low confidence: ${byConfidence.low.length}`);
    console.log(`   ⚪ Unknown: ${byConfidence.unknown.length}\n`);
    
    // Ask for confirmation
    console.log('⚠️  CONFIRMATION\n');
    console.log(`   About to UPDATE ${resultsData.length} products\n`);
    console.log('   Type "UPDATE" to proceed (or anything else to cancel):');
    
    // For automation, check for --confirm flag
    const autoConfirm = process.argv.includes('--confirm');
    
    if (!autoConfirm) {
      console.log('\n   ⚠️  Add --confirm flag to proceed with update');
      console.log('   Example: node scripts/import-categorization-results.js results.json --confirm\n');
      console.log('   ✅ Validation complete - no updates performed');
      return;
    }
    
    console.log('\n📝 Updating products in database...\n');
    
    // Update products in batches for better performance
    let updated = 0;
    let skipped = 0;
    let errors = [];
    
    const BATCH_SIZE = 100;
    const validResults = resultsData.filter(r => r.corrected_category && r.corrected_category.trim() !== '');
    
    console.log(`   📊 Processing ${validResults.length} products with valid categories...\n`);
    
    for (let i = 0; i < validResults.length; i += BATCH_SIZE) {
      const batch = validResults.slice(i, i + BATCH_SIZE);
      
      try {
        // Use Promise.all for parallel updates within batch
        await Promise.all(
          batch.map(result => 
            prisma.product.update({
              where: { id: result.product_id },
              data: { category: result.corrected_category }
            }).catch(error => {
              errors.push({
                product_id: result.product_id,
                name: result.name,
                error: error.message
              });
              return null;
            })
          )
        );
        
        updated += batch.length;
        console.log(`   ✅ Updated ${updated}/${validResults.length} products...`);
      } catch (error) {
        console.log(`   ⚠️  Batch error at ${i}: ${error.message}`);
      }
    }
    
    skipped = resultsData.length - validResults.length;
    
    console.log(`\n   ✅ Updated ${updated} products\n`);
    
    if (skipped > 0) {
      console.log(`   ⏭️  Skipped ${skipped} products (no category provided)\n`);
    }
    
    if (errors.length > 0) {
      console.log(`   ❌ Errors: ${errors.length}\n`);
      
      // Save errors to file
      const errorPath = resultsPath.replace('.json', '-errors.json');
      fs.writeFileSync(errorPath, JSON.stringify(errors, null, 2));
      console.log(`   💾 Errors saved to: ${errorPath}\n`);
    }
    
    // Summary
    console.log('✅ Import Complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Check products in Admin Dashboard');
    console.log('   2. Verify categories are correct');
    console.log('   3. Test gift generation with updated categories');
    console.log('');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importCategorizationResults();
