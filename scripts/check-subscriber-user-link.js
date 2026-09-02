import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLinks() {
  console.log('🔗 Checking User → Subscriber Links\n');
  
  const users = await prisma.user.findMany({
    include: {
      subscribers: true,
    }
  });
  
  users.forEach(user => {
    console.log(`👤 User: ${user.email} (ID: ${user.id})`);
    console.log(`   Role: ${user.role}`);
    if (user.subscribers.length > 0) {
      user.subscribers.forEach(sub => {
        console.log(`   📧 Subscriber: ${sub.email} (ID: ${sub.id})`);
        console.log(`      Status: ${sub.subscriptionStatus}`);
      });
    } else {
      console.log(`   ⚠️  No subscribers linked to this user`);
    }
    console.log('');
  });
  
  // Check recipients
  const recipients = await prisma.recipient.findMany({
    include: {
      subscriber: true,
      owner: true,
    }
  });
  
  console.log(`\n📋 Recipients in Database: ${recipients.length}\n`);
  recipients.forEach(r => {
    console.log(`👶 Recipient: ${r.name}`);
    console.log(`   Subscriber: ${r.subscriber?.email || 'N/A'} (ID: ${r.subscriberId})`);
    console.log(`   Owner: ${r.owner?.email || 'N/A'} (ID: ${r.createdById})`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

checkLinks();
