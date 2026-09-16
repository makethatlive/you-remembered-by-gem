import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkActiveStatus() {
  try {
    console.log('🔍 Checking product STATUS field...\n');
    
    // Check all statuses
    const allStatuses = await prisma.product.groupBy({
      by: ['status'],
      _count: true
    });
    
    console.log('📊 Product status breakdown:');
    allStatuses.forEach(s => {
      console.log(`   ${s.status}: ${s._count} products`);
    });
    
    console.log('\n🔍 Checking CURATED products specifically...\n');
    
    const curatedByStatus = await prisma.product.groupBy({
      by: ['status'],
      where: {
        sourceType: 'CURATED_PRODUCT',
        price: { gte: 47.5, lte: 157.5 },
        genderAppliesTo: {
          in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT']
        }
      },
      _count: true
    });
    
    console.log('📊 CURATED products in Ben\'s budget & gender:');
    curatedByStatus.forEach(s => {
      console.log(`   ${s.status}: ${s._count} products`);
    });
    
    // Check ACTIVE specifically
    const activeCount = await prisma.product.count({
      where: {
        sourceType: 'CURATED_PRODUCT',
        status: 'ACTIVE',
        price: { gte: 47.5, lte: 157.5 },
        genderAppliesTo: {
          in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT']
        }
      }
    });
    
    console.log(`\n✅ ACTIVE curated products in budget: ${activeCount}`);
    
    // Check with different status values
    const alternativeStatuses = ['APPROVED', 'approved', 'Active', 'active'];
    
    console.log('\n🔍 Checking alternative status values...\n');
    for (const status of alternativeStatuses) {
      const count = await prisma.product.count({
        where: {
          sourceType: 'CURATED_PRODUCT',
          status: status,
          price: { gte: 47.5, lte: 157.5 },
          genderAppliesTo: {
            in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT']
          }
        }
      });
      
      if (count > 0) {
        console.log(`   ${status}: ${count} products`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActiveStatus();
