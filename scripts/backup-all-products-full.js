#!/usr/bin/env node
/**
 * Backup all products (excluding GEM picks) with ALL fields
 * Exports complete product data for backup purposes
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function backupAllProducts() {
  try {
    console.log('🔍 Fetching all products (excluding GEM picks)...\n');

    // Fetch all products that are NOT curated (GEM picks)
    const products = await prisma.product.findMany({
      where: {
        sourceType: {
          not: 'CURATED_PRODUCT'
        }
      },
      include: {
        retailer: true, // Include retailer details
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Found ${products.length} products (excluding GEM picks)\n`);

    // Create backup directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(__dirname, '..', 'product-backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `all-products-backup-${timestamp}.json`);

    // Write to file with pretty formatting
    fs.writeFileSync(backupFile, JSON.stringify(products, null, 2), 'utf-8');

    console.log(`💾 Backup saved to: ${backupFile}`);
    console.log(`📊 Total products backed up: ${products.length}`);
    
    // Show some statistics
    const sourceStats = products.reduce((acc, p) => {
      acc[p.sourceType] = (acc[p.sourceType] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📈 Products by source:');
    Object.entries(sourceStats).forEach(([source, count]) => {
      console.log(`   ${source}: ${count}`);
    });

    const activeCount = products.filter(p => p.status === 'active').length;
    const inactiveCount = products.length - activeCount;
    
    console.log('\n📊 Product status:');
    console.log(`   Active: ${activeCount}`);
    console.log(`   Inactive: ${inactiveCount}`);

    // Retailer statistics
    const retailerStats = products.reduce((acc, p) => {
      const retailerName = p.retailer?.name || 'Unknown';
      acc[retailerName] = (acc[retailerName] || 0) + 1;
      return acc;
    }, {});

    console.log(`\n🏪 Products by retailer (top 10):`);
    Object.entries(retailerStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([retailer, count]) => {
        console.log(`   ${retailer}: ${count}`);
      });

    console.log('\n✅ Backup complete!\n');

  } catch (error) {
    console.error('❌ Error during backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backup
backupAllProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
