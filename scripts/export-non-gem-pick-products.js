/**
 * Export ALL products EXCEPT Gem's Picks for age band reclassification.
 * 
 * Exports products with source_type != 'CURATED_PRODUCT' (i.e., catalogue + legacy)
 * for AI reclassification with new flexible age band format (e.g., "1-7", "4-9", "18-30")
 * instead of current enum format (e.g., "EIGHTEEN_TO_30", "UNDER_5")
 * 
 * Usage:
 *   node scripts/export-non-gem-pick-products.js
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function exportProducts() {
  try {
    console.log('🔍 Fetching all non-Gem Pick products...');
    
    // Fetch all products EXCEPT curated (Gem's Picks)
    const products = await prisma.product.findMany({
      where: {
        sourceType: {
          not: 'CURATED_PRODUCT'
        }
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        productUrl: true,
        price: true,
        category: true,
        genderAppliesTo: true,
        suitableAgeBands: true,
        sourceType: true,
        status: true,
        retailerId: true
      }
    });

    console.log(`✅ Found ${products.length} non-Gem Pick products`);

    // Count by source type
    const sourceTypes = products.reduce((acc, p) => {
      acc[p.sourceType] = (acc[p.sourceType] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Breakdown by source type:');
    Object.entries(sourceTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    // Count by status
    const statuses = products.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Breakdown by status:');
    Object.entries(statuses).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // Count products with existing age bands
    const withAgeBands = products.filter(p => 
      Array.isArray(p.suitableAgeBands) && p.suitableAgeBands.length > 0
    );
    const withoutAgeBands = products.filter(p => 
      !Array.isArray(p.suitableAgeBands) || p.suitableAgeBands.length === 0
    );

    console.log('\n📊 Age band coverage:');
    console.log(`   With age bands: ${withAgeBands.length}`);
    console.log(`   Without age bands: ${withoutAgeBands.length}`);

    // Show sample of current age band formats
    const ageBandSamples = new Set();
    products.forEach(p => {
      if (Array.isArray(p.suitableAgeBands)) {
        p.suitableAgeBands.forEach(band => ageBandSamples.add(band));
      }
    });

    console.log('\n📋 Current age band formats found:');
    Array.from(ageBandSamples).sort().forEach(band => {
      console.log(`   "${band}"`);
    });

    // Format for AI processing
    const exportData = products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      url: p.productUrl,
      price: p.price,
      category: p.category || '',
      gender: p.genderAppliesTo || '',
      current_age_bands: p.suitableAgeBands || [],
      new_age_bands: [], // AI will fill this
      reasoning: '' // AI will explain the age band selection
    }));

    // Create export directory if it doesn't exist
    const exportDir = path.join(process.cwd(), 'age-band-exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Generate timestamp for filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    
    // Save JSON
    const jsonPath = path.join(exportDir, `non-gem-pick-products-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
    console.log(`\n✅ Exported ${products.length} products to JSON:`);
    console.log(`   ${jsonPath}`);

    // Also save CSV for easier AI processing
    const csvPath = path.join(exportDir, `non-gem-pick-products-${timestamp}.csv`);
    const headers = ['id', 'name', 'description', 'url', 'price', 'category', 'gender', 'current_age_bands', 'new_age_bands', 'reasoning'];
    const csvRows = [
      headers.join(','),
      ...exportData.map(p => [
        p.id,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.description || '').replace(/"/g, '""')}"`,
        p.url || '',
        p.price || '',
        `"${(p.category || '').replace(/"/g, '""')}"`,
        p.gender || '',
        `"${(p.current_age_bands || []).join('; ')}"`,
        '', // new_age_bands - AI fills
        '' // reasoning - AI fills
      ].join(','))
    ];
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`✅ Exported ${products.length} products to CSV:`);
    console.log(`   ${csvPath}`);

    console.log('\n📝 Next steps:');
    console.log('   1. Send the JSON file to Grok AI for age band reclassification');
    console.log('   2. Use the AI prompt in age-band-exports/AI_PROMPT_AGE_RECLASSIFICATION.md');
    console.log('   3. AI will add flexible age ranges (e.g., "1-7", "18-30", "31-50")');
    console.log('   4. Run update script to save corrected age bands back to database');

  } catch (error) {
    console.error('❌ Error exporting products:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportProducts();
