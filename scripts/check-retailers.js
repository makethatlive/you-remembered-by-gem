import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRetailers() {
  const count = await prisma.retailer.count();
  console.log(`✅ Retailers in database: ${count}`);
  
  const retailers = await prisma.retailer.findMany({
    take: 10,
    select: {
      id: true,
      name: true,
      active: true,
    }
  });
  
  console.log('\n📋 Sample retailers:');
  retailers.forEach(r => {
    console.log(`   - ${r.name} (${r.active ? 'Active' : 'Inactive'})`);
  });
  
  await prisma.$disconnect();
}

checkRetailers();
