import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function updateMateInterests() {
  try {
    console.log('\n=== UPDATING MATE\'S INTERESTS ===\n');
    
    const newInterests = [
      'Fashion & accessories',
      'Art & culture', 
      'Cooking & food',
      'Beauty & skincare'
    ];

    const updated = await prisma.recipient.update({
      where: { id: 'cmtwtxwg1000812fmmnod41pm' },
      data: {
        interests: newInterests
      }
    });

    console.log('✅ Updated successfully!');
    console.log('\nOLD interests: Cooking & food, Music, Gaming (video games), Pets');
    console.log('NEW interests:', updated.interests.join(', '));
    console.log('\nReason: These interests have 33+ products in catalogue (£100-£230 budget)');
    console.log('Expected: 10+ high-quality gift recommendations');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMateInterests();
