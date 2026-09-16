import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMissingImages() {
  try {
    console.log('🔍 Checking products with missing images...\n');
    
    // Find products without images
    const productsNoImage = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { imageUrl: null },
          { imageUrl: '' },
          { imageUrl: 'N/A' }
        ]
      },
      select: {
        id: true,
        name: true,
        sourceType: true,
        productUrl: true,
        imageUrl: true,
        retailer: {
          select: {
            name: true
          }
        }
      },
      take: 50
    });
    
    console.log(`📊 Found ${productsNoImage.length} ACTIVE products without images\n`);
    
    if (productsNoImage.length === 0) {
      console.log('✅ All active products have images!');
      return;
    }
    
    // Group by sourceType
    const bySource = {};
    productsNoImage.forEach(p => {
      bySource[p.sourceType] = (bySource[p.sourceType] || 0) + 1;
    });
    
    console.log('📊 BREAKDOWN BY SOURCE TYPE:\n');
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} products`);
    });
    
    console.log('\n📋 PRODUCTS WITHOUT IMAGES (first 20):\n');
    productsNoImage.slice(0, 20).forEach((p, i) => {
      console.log(`${i + 1}. ${p.name.substring(0, 65)}...`);
      console.log(`   Source: ${p.sourceType}`);
      console.log(`   Retailer: ${p.retailer?.name || 'Unknown'}`);
      console.log(`   Product URL: ${p.productUrl ? 'Yes' : 'NO - MISSING!'}`);
      console.log(`   Image URL: ${p.imageUrl || 'MISSING'}`);
      console.log('');
    });
    
    // Check specific product
    const accurist = await prisma.product.findFirst({
      where: {
        name: {
          contains: 'Accurist Everyday Blue'
        }
      },
      select: {
        id: true,
        name: true,
        sourceType: true,
        productUrl: true,
        imageUrl: true,
        status: true
      }
    });
    
    if (accurist) {
      console.log('\n🔍 SPECIFIC CHECK: Accurist Everyday Blue Dial Mens Watch\n');
      console.log(`   Name: ${accurist.name}`);
      console.log(`   Status: ${accurist.status}`);
      console.log(`   Source: ${accurist.sourceType}`);
      console.log(`   Product URL: ${accurist.productUrl || 'MISSING'}`);
      console.log(`   Image URL: ${accurist.imageUrl || 'MISSING'}`);
    } else {
      console.log('\n⚠️  Accurist watch not found in database');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMissingImages();
