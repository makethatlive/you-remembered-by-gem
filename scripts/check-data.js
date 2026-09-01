import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('Checking database data...\n');
  
  const subscribers = await prisma.subscriber.findMany();
  console.log('Subscribers:', JSON.stringify(subscribers, null, 2));
  
  await prisma.$disconnect();
}

check();
