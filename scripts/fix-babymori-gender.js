import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBabyMoriGender() {
  try {
    console.log('🔧 Fixing babymori.com Gender Tags\n');

    // Get babymori retailer
    const retailer = await prisma.retailer.findFirst({
      where: {
        name: { contains: 'babymori', mode: 'insensitive' }
      }
    });

    if (!retailer) {
      console.log('❌ babymori.com not found');
      return;
    }

    console.log(`✅ Found: ${retailer.name}`);

    // Count products by gender
    const femaleCount = await prisma.product.count({
      where: {
        retailerId: retailer.id,
        status: 'ACTIVE',
        genderAppliesTo: { in: ['FEMALE', 'WOMEN'] }
      }
    });

    const unisexCount = await prisma.product.count({
      where: {
        retailerId: retailer.id,
        status: 'ACTIVE',
        genderAppliesTo: 'UNISEX'
      }
    });

    console.log(`\nCurrent gender distribution:`);
    console.log(`  FEMALE/WOMEN: ${femaleCount}`);
    console.log(`  UNISEX: ${unisexCount}`);

    if (femaleCount === 0) {
      console.log('\n✅ Already fixed!');
      return;
    }

    console.log(`\n🔄 Updating ${femaleCount} products to UNISEX...\n`);

    // Update all FEMALE/WOMEN products to UNISEX
    const result = await prisma.product.updateMany({
      where: {
        retailerId: retailer.id,
        status: 'ACTIVE',
        genderAppliesTo: { in: ['FEMALE', 'WOMEN', 'Female', 'Women'] }
      },
      data: {
        genderAppliesTo: 'UNISEX'
      }
    });

    console.log(`✅ Updated ${result.count} products to UNISEX`);

    // Verify
    const afterUnisex = await prisma.product.count({
      where: {
        retailerId: retailer.id,
        status: 'ACTIVE',
        genderAppliesTo: 'UNISEX'
      }
    });

    console.log(`\nAfter fix:`);
    console.log(`  UNISEX: ${afterUnisex} ✅`);

    // Check how many now match Devis
    const devisMatches = await prisma.product.count({
      where: {
        retailerId: retailer.id,
        status: 'ACTIVE',
        price: { gte: 19, lte: 104 },
        genderAppliesTo: 'UNISEX'
      }
    });

    console.log(`\n📊 Products now available for Devis (age 11-17, £20-£99):`);
    console.log(`   ${devisMatches} products ✅`);

    console.log('\n✅ Fix complete! Restart server to apply changes.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBabyMoriGender();
