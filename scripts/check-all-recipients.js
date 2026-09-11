import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function checkAllRecipients() {
  try {
    console.log('\n=== ALL RECIPIENTS ===\n');
    
    const recipients = await prisma.recipient.findMany({
      include: {
        subscriber: true,
        giftLists: {
          include: {
            giftItems: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`Found ${recipients.length} recipients:\n`);
    
    recipients.forEach((r, index) => {
      console.log(`${index + 1}. ${r.name} (ID: ${r.id})`);
      console.log(`   Subscriber: ${r.subscriber?.email || 'N/A'}`);
      console.log(`   Relationship: ${r.relationship}`);
      console.log(`   Gift Lists: ${r.giftLists.length}`);
      if (r.giftLists.length > 0) {
        r.giftLists.forEach(list => {
          console.log(`     - List ${list.id}: ${list.status}, ${list.giftItems.length} items`);
        });
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllRecipients();
