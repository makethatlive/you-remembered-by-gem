#!/usr/bin/env node
/**
 * Export Gem's Pick products with image URLs and descriptions
 * Simple database export - NO web scraping
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function exportGemsPicks() {
  try {
    console.log('🔍 Fetching Gem\'s Pick products (CURATED_PRODUCT)...\n');

    // Fetch all Gem's Pick products
    const products = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT',
      },
      include: {
        retailer: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log(`✅ Found ${products.length} Gem's Pick products\n`);

    if (products.length === 0) {
      console.log('No products found. Exiting.');
      return;
    }

    // Transform data for export
    const exportData = products.map((product, index) => ({
      rowNumber: index + 1,
      productId: product.id,
      name: product.name,
      retailer: product.retailer?.name || 'Unknown',
      productUrl: product.productUrl,
      imageUrl: product.imageUrl || '',
      description: product.description || '',
      price: product.price?.toString() || '0',
      category: product.category || '',
      genderAppliesTo: product.genderAppliesTo || '',
      hasImage: !!product.imageUrl,
      hasDescription: !!product.description && product.description.length >= 50,
      descriptionLength: product.description?.length || 0,
    }));

    // Statistics
    const stats = {
      total: exportData.length,
      withImage: exportData.filter(p => p.hasImage).length,
      withoutImage: exportData.filter(p => !p.hasImage).length,
      withDescription: exportData.filter(p => p.hasDescription).length,
      withoutDescription: exportData.filter(p => !p.hasDescription).length,
      complete: exportData.filter(p => p.hasImage && p.hasDescription).length,
    };

    console.log('📊 Statistics:');
    console.log(`   Total products: ${stats.total}`);
    console.log(`   With image URL: ${stats.withImage} (${((stats.withImage/stats.total)*100).toFixed(1)}%)`);
    console.log(`   Without image URL: ${stats.withoutImage} (${((stats.withoutImage/stats.total)*100).toFixed(1)}%)`);
    console.log(`   With description: ${stats.withDescription} (${((stats.withDescription/stats.total)*100).toFixed(1)}%)`);
    console.log(`   Without description: ${stats.withoutDescription} (${((stats.withoutDescription/stats.total)*100).toFixed(1)}%)`);
    console.log(`   Complete (both): ${stats.complete} (${((stats.complete/stats.total)*100).toFixed(1)}%)\n`);

    // Create export directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const exportDir = path.join(__dirname, '..', 'gems-picks-export');
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Export as JSON
    const jsonPath = path.join(exportDir, `gems-picks-${timestamp}.json`);
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        stats,
        products: exportData,
      }, null, 2),
      'utf-8'
    );

    console.log(`💾 JSON export saved: ${jsonPath}`);

    // Export as CSV
    const csvPath = path.join(exportDir, `gems-picks-${timestamp}.csv`);
    const csvHeaders = [
      'Row',
      'Product ID',
      'Name',
      'Retailer',
      'Product URL',
      'Image URL',
      'Description',
      'Price',
      'Category',
      'Gender',
      'Has Image',
      'Has Description',
      'Description Length',
    ];

    const csvRows = exportData.map(p => [
      p.rowNumber,
      p.productId,
      `"${p.name.replace(/"/g, '""')}"`, // Escape quotes
      `"${p.retailer.replace(/"/g, '""')}"`,
      p.productUrl,
      p.imageUrl,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      p.price,
      `"${p.category.replace(/"/g, '""')}"`,
      p.genderAppliesTo,
      p.hasImage ? 'Yes' : 'No',
      p.hasDescription ? 'Yes' : 'No',
      p.descriptionLength,
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(',')),
    ].join('\n');

    fs.writeFileSync(csvPath, csvContent, 'utf-8');

    console.log(`📊 CSV export saved: ${csvPath}`);

    // Export products WITHOUT image URL (for fixing)
    const missingImages = exportData.filter(p => !p.hasImage);
    if (missingImages.length > 0) {
      const missingImagesPath = path.join(exportDir, `gems-picks-missing-images-${timestamp}.json`);
      fs.writeFileSync(
        missingImagesPath,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          count: missingImages.length,
          products: missingImages,
        }, null, 2),
        'utf-8'
      );
      console.log(`⚠️  Missing images list: ${missingImagesPath} (${missingImages.length} products)`);
    }

    // Export products WITHOUT description (for fixing)
    const missingDescriptions = exportData.filter(p => !p.hasDescription);
    if (missingDescriptions.length > 0) {
      const missingDescPath = path.join(exportDir, `gems-picks-missing-descriptions-${timestamp}.json`);
      fs.writeFileSync(
        missingDescPath,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          count: missingDescriptions.length,
          products: missingDescriptions,
        }, null, 2),
        'utf-8'
      );
      console.log(`⚠️  Missing descriptions list: ${missingDescPath} (${missingDescriptions.length} products)`);
    }

    console.log('\n✅ Export complete!\n');

    // Show sample of products missing data
    if (stats.withoutImage > 0 || stats.withoutDescription > 0) {
      console.log('📋 Sample products missing data:\n');
      
      const incomplete = exportData.filter(p => !p.hasImage || !p.hasDescription).slice(0, 5);
      incomplete.forEach(p => {
        console.log(`   ${p.rowNumber}. ${p.name}`);
        console.log(`      Product URL: ${p.productUrl}`);
        console.log(`      Image: ${p.hasImage ? '✅' : '❌'} ${p.imageUrl || '(missing)'}`);
        console.log(`      Description: ${p.hasDescription ? '✅' : '❌'} ${p.descriptionLength} chars`);
        console.log();
      });
      
      if (exportData.filter(p => !p.hasImage || !p.hasDescription).length > 5) {
        console.log(`   ... and ${exportData.filter(p => !p.hasImage || !p.hasDescription).length - 5} more\n`);
      }
    }

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the export
exportGemsPicks()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
