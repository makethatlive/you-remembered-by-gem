/**
 * Backup Current Product Categories
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function backupCategories() {
  console.log('📦 Backing up current product categories...\n');
  
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        productUrl: true,
        category: true,
        sourceType: true
      }
    });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(__dirname, '..', 'database-backups', `backup-before-recategorization-${timestamp}`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, 'product-categories.json');
    fs.writeFileSync(backupPath, JSON.stringify(products, null, 2));
    
    console.log(`✅ Backup complete!`);
    console.log(`📁 Location: ${backupPath}`);
    console.log(`📊 Products backed up: ${products.length}\n`);
    
    return backupPath;
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupCategories();
