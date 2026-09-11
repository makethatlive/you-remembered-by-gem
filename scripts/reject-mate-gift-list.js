import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function rejectMateGiftList() {
  try {
    const giftListId = 'cmtwv2bf900039mxnnn3po9ue';
    
    console.log('\n=== REJECTING MATE\'S GIFT LIST ===\n');
    console.log('Gift List ID:', giftListId);
    console.log('Reason: Quality check failed - gifts do not match recipient interests\n');

    // Update gift list status to REJECTED
    const updatedList = await prisma.giftList.update({
      where: { id: giftListId },
      data: {
        status: 'REJECTED',
        visibleToSubscriber: false,
        updatedAt: new Date(),
      },
      include: {
        recipient: true,
        giftItems: true,
      }
    });

    console.log('✅ Gift list rejected successfully');
    console.log('Status:', updatedList.status);
    console.log('Visible to subscriber:', updatedList.visibleToSubscriber);
    console.log('Recipient:', updatedList.recipient.name);
    console.log('Items in list:', updatedList.giftItems.length);
    console.log('\n❌ This list will NOT be sent to subscriber.');
    console.log('⚠️  A new gift list needs to be generated with fixed logic.\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

rejectMateGiftList();
