/**
 * Export Low Confidence Products for Manual Review
 * 
 * Extracts products with "low" confidence from categorization results
 * 
 * Usage: node scripts/export-low-confidence.js path/to/categorized_products.json
 */

import fs from 'fs';
import path from 'path';

const resultsPath = process.argv[2] || 'D:\\you-remembered-by-gem\\categorization-exports\\categorized_products.json';

if (!fs.existsSync(resultsPath)) {
  console.error('❌ File not found:', resultsPath);
  process.exit(1);
}

console.log('📤 Extracting low confidence products...\n');

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

// Filter low confidence
const lowConfidence = results.filter(r => r.confidence === 'low');

console.log(`   ✅ Found ${lowConfidence.length} low confidence products\n`);

// Save to separate file
const outputPath = resultsPath.replace('.json', '-low-confidence.json');
fs.writeFileSync(outputPath, JSON.stringify(lowConfidence, null, 2));

console.log(`   💾 Saved to: ${outputPath}\n`);

// Create CSV for easy review
const csvPath = outputPath.replace('.json', '.csv');
const csvHeaders = ['Row', 'Product ID', 'Name', 'Current', 'Corrected', 'Reasoning'].join('\t');
const csvRows = lowConfidence.map(p => [
  p.row_number,
  p.product_id,
  `"${p.name}"`,
  `"${p.current_category || ''}"`,
  `"${p.corrected_category || ''}"`,
  `"${p.reasoning || ''}"`
].join('\t'));

fs.writeFileSync(csvPath, [csvHeaders, ...csvRows].join('\n'));

console.log(`   📄 CSV saved to: ${csvPath}\n`);

// Show examples
console.log('📋 Examples:\n');
lowConfidence.slice(0, 5).forEach((p, i) => {
  console.log(`${i + 1}. ${p.name}`);
  console.log(`   Current: ${p.current_category || '—'}`);
  console.log(`   Corrected: ${p.corrected_category || '—'}`);
  console.log(`   Reasoning: ${p.reasoning || '—'}`);
  console.log('');
});

console.log(`✅ Export complete! Review and correct these ${lowConfidence.length} products.`);
