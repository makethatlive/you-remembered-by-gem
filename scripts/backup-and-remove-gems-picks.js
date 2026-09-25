/**
 * Backup and Remove Gem's Pick Products
 * 
 * This script:
 * 1. Backs up all CURATED_PRODUCT (Gem's Pick) products
 * 2. Backs up their associated retailers
 * 3. Removes CURATED_PRODUCT products
 * 4. Removes retailers that have NO other products
 * 
 * Usage: node scripts/backup-and-remove-gems-picks.js
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function backupAndRemove() {
  console.log('🔄 Starting Gem\'s Pick backup and removal...\n');
  
  try {
    // Step 1: Fetch all CURATED_PRODUCT products
    console.log('📊 Fetching Gem\'s Pick products...');
    const gemsPickProducts = await prisma.product.findMany({
      where: {
        sourceType: 'CURATED_PRODUCT'
      },
      include: {
        retailer: true
      }
    });
    
    console.log(`   ✅ Found ${gemsPickProducts.length} Gem\'s Pick products\n`);
    
    if (gemsPickProducts.length === 0) {
      console.log('   ℹ️  No Gem\'s Pick products to remove');
      return;
    }
    
    // Step 2: Get unique retailers
    const retailerIds = [...new Set(gemsPickProducts.map(p => p.retailerId).filter(Boolean))];
    console.log(`   📊 Found ${retailerIds.length} unique retailers\n`);
    
    // Step 3: Create backup directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(__dirname, '..', 'database-backups', `gems-picks-backup-${timestamp}`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log(`💾 Creating backup in: ${backupDir}\n`);
    
    // Step 4: Save products backup
    console.log('💾 Backing up products...');
    const productsBackupPath = path.join(backupDir, 'curated-products.json');
    fs.writeFileSync(productsBackupPath, JSON.stringify(gemsPickProducts, null, 2));
    console.log(`   ✅ Saved ${gemsPickProducts.length} products to curated-products.json\n`);
    
    // Step 5: Fetch and save retailers
    console.log('💾 Backing up retailers...');
    const retailers = await prisma.retailer.findMany({
      where: {
        id: { in: retailerIds }
      }
    });
    
    const retailersBackupPath = path.join(backupDir, 'retailers.json');
    fs.writeFileSync(retailersBackupPath, JSON.stringify(retailers, null, 2));
    console.log(`   ✅ Saved ${retailers.length} retailers to retailers.json\n`);
    
    // Step 6: Create restore script
    console.log('📝 Creating restore script...');
    const restoreScriptPath = path.join(backupDir, 'RESTORE.md');
    const restoreInstructions = `# Restore Gem's Pick Products

## Backup Information
- **Created:** ${new Date().toISOString()}
- **Products:** ${gemsPickProducts.length}
- **Retailers:** ${retailers.length}

## Files Backed Up
- \`curated-products.json\` - All CURATED_PRODUCT products
- \`retailers.json\` - Associated retailers

## Restore Command

To restore this backup, run:

\`\`\`bash
node scripts/restore-gems-picks.js "${backupDir}"
\`\`\`

## Manual Restore (if script fails)

1. Import retailers first:
\`\`\`javascript
const retailers = JSON.parse(fs.readFileSync('${retailersBackupPath}'));
for (const retailer of retailers) {
  await prisma.retailer.upsert({
    where: { id: retailer.id },
    update: retailer,
    create: retailer
  });
}
\`\`\`

2. Then import products:
\`\`\`javascript
const products = JSON.parse(fs.readFileSync('${productsBackupPath}'));
for (const product of products) {
  await prisma.product.upsert({
    where: { id: product.id },
    update: product,
    create: product
  });
}
\`\`\`

## Product Details

### Products by Retailer:
${Object.entries(
  gemsPickProducts.reduce((acc, p) => {
    const name = p.retailer?.name || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {})
).map(([name, count]) => `- ${name}: ${count} products`).join('\n')}

### Total Value: £${Number(gemsPickProducts.reduce((sum, p) => sum + (Number(p.price) || 0), 0)).toFixed(2)}
`;
    
    fs.writeFileSync(restoreScriptPath, restoreInstructions);
    console.log(`   ✅ Created RESTORE.md with instructions\n`);
    
    // Step 7: Confirm before deletion
    console.log('⚠️  DELETION CONFIRMATION\n');
    console.log('   About to DELETE:');
    console.log(`   - ${gemsPickProducts.length} Gem's Pick products`);
    console.log(`   - Retailers with NO other products\n`);
    console.log('   Backup saved to:', backupDir);
    console.log('\n   Type "DELETE" to proceed (or anything else to cancel):');
    
    // Wait for confirmation (in real use, you'd use readline)
    // For now, auto-proceed (remove this in production)
    const confirmDelete = process.argv[2] === '--confirm';
    
    if (!confirmDelete) {
      console.log('\n   ⚠️  Add --confirm flag to proceed with deletion');
      console.log('   Example: node scripts/backup-and-remove-gems-picks.js --confirm\n');
      console.log('   ✅ Backup completed - no deletion performed');
      return;
    }
    
    console.log('\n🗑️  Proceeding with deletion...\n');
    
    // Step 8: Delete products
    console.log('🗑️  Deleting Gem\'s Pick products...');
    const deletedProducts = await prisma.product.deleteMany({
      where: {
        sourceType: 'CURATED_PRODUCT'
      }
    });
    console.log(`   ✅ Deleted ${deletedProducts.count} products\n`);
    
    // Step 9: Find and delete orphaned retailers
    console.log('🔍 Finding orphaned retailers...');
    const orphanedRetailers = [];
    
    for (const retailerId of retailerIds) {
      const productCount = await prisma.product.count({
        where: { retailerId }
      });
      
      if (productCount === 0) {
        orphanedRetailers.push(retailerId);
      }
    }
    
    console.log(`   📊 Found ${orphanedRetailers.length} retailers with no products\n`);
    
    if (orphanedRetailers.length > 0) {
      console.log('🗑️  Deleting orphaned retailers...');
      
      // Get retailer names for logging
      const retailersToDelete = await prisma.retailer.findMany({
        where: { id: { in: orphanedRetailers } },
        select: { id: true, name: true }
      });
      
      for (const retailer of retailersToDelete) {
        console.log(`   🗑️  Deleting: ${retailer.name}`);
      }
      
      const deletedRetailers = await prisma.retailer.deleteMany({
        where: {
          id: { in: orphanedRetailers }
        }
      });
      
      console.log(`   ✅ Deleted ${deletedRetailers.count} orphaned retailers\n`);
    } else {
      console.log('   ℹ️  No orphaned retailers to delete\n');
    }
    
    // Step 10: Summary
    console.log('✅ Operation Complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Backup location: ${backupDir}`);
    console.log(`   ✅ Products deleted: ${deletedProducts.count}`);
    console.log(`   ✅ Retailers deleted: ${orphanedRetailers.length}`);
    console.log(`   ✅ Remaining retailers: ${retailerIds.length - orphanedRetailers.length}`);
    console.log('\n💡 To restore, run:');
    console.log(`   node scripts/restore-gems-picks.js "${backupDir}"\n`);
    
    // Step 11: Verify database state
    console.log('🔍 Verifying database state...');
    const remainingCurated = await prisma.product.count({
      where: { sourceType: 'CURATED_PRODUCT' }
    });
    const totalProducts = await prisma.product.count();
    const totalRetailers = await prisma.retailer.count();
    
    console.log(`   📊 CURATED_PRODUCT remaining: ${remainingCurated}`);
    console.log(`   📊 Total products: ${totalProducts}`);
    console.log(`   📊 Total retailers: ${totalRetailers}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
backupAndRemove();
