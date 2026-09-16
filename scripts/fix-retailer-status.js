import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRetailerStatus() {
  try {
    console.log('🔧 Fixing Retailer Active Status\n');

    // Count retailers with active = false or null
    const allRetailers = await prisma.retailer.findMany({
      select: {
        id: true,
        name: true,
        active: true
      }
    });

    const inactive = allRetailers.filter(r => !r.active);

    console.log(`Total retailers: ${allRetailers.length}`);
    console.log(`Inactive or NULL: ${inactive.length}\n`);

    if (inactive.length === 0) {
      console.log('✅ All retailers already active!');
      return;
    }

    console.log('Setting all retailers to active = true...\n');

    const result = await prisma.retailer.updateMany({
      where: {
        active: { not: true }
      },
      data: {
        active: true
      }
    });

    console.log(`✅ Updated ${result.count} retailers to active = true\n`);

    // Verify
    const afterUpdate = await prisma.retailer.count({
      where: { active: true }
    });

    console.log('📊 Status After Update:');
    console.log(`  Active: ${afterUpdate}`);
    console.log(`  Total: ${allRetailers.length}`);

    console.log('\n✅ Retailer activation complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRetailerStatus();
