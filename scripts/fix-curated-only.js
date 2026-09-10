import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find all curated-only retailers
  const curatedRetailers = await prisma.retailer.findMany({
    where: { curatedOnly: true },
    select: { id: true, name: true, websiteUrl: true, curatedOnly: true }
  });
  
  console.log('\n📋 Curated-only retailers:');
  curatedRetailers.forEach(r => {
    console.log(`   - ${r.name} (ID: ${r.id})`);
  });
  
  // Update "Aire Baths" to allow scraping
  const aireBaths = await prisma.retailer.findFirst({
    where: { name: { contains: 'Aire', mode: 'insensitive' } }
  });
  
  if (aireBaths) {
    console.log(`\n✅ Found retailer: ${aireBaths.name}`);
    console.log(`   Current curatedOnly: ${aireBaths.curatedOnly}`);
    
    if (aireBaths.curatedOnly) {
      await prisma.retailer.update({
        where: { id: aireBaths.id },
        data: { curatedOnly: false }
      });
      console.log(`   ✅ Updated "${aireBaths.name}" to allow scraping (curatedOnly = false)`);
    } else {
      console.log(`   ℹ️ Already allows scraping`);
    }
  } else {
    console.log('\n❌ "Aire Baths" retailer not found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
