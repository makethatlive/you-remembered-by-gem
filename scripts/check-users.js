import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    include: {
      subscribers: true,
    }
  });
  
  console.log(`✅ Users in database: ${users.length}\n`);
  
  users.forEach(user => {
    console.log(`📧 ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Subscribers: ${user.subscribers.length}`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

checkUsers();
