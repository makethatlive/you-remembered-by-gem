/**
 * Backfill generatedAt timestamps for existing GiftList records
 * 
 * For existing records where generatedAt is NULL, set it to createdAt
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillGeneratedAt() {
  console.log('🔧 Starting backfill of generatedAt timestamps...');
  
  try {
    // Find all gift lists without generatedAt
    const listsWithoutGeneratedAt = await prisma.giftList.findMany({
      where: {
        generatedAt: null,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    console.log(`📊 Found ${listsWithoutGeneratedAt.length} gift lists without generatedAt`);

    if (listsWithoutGeneratedAt.length === 0) {
      console.log('✅ No records to update');
      return;
    }

    // Update each record
    let updated = 0;
    for (const list of listsWithoutGeneratedAt) {
      await prisma.giftList.update({
        where: { id: list.id },
        data: { generatedAt: list.createdAt },
      });
      updated++;
      
      if (updated % 10 === 0) {
        console.log(`   Updated ${updated}/${listsWithoutGeneratedAt.length}...`);
      }
    }

    console.log(`✅ Successfully backfilled ${updated} gift list records`);
    
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillGeneratedAt()
  .then(() => {
    console.log('✅ Backfill complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  });
