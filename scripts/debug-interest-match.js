import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugInterestMatch() {
  const p = await prisma.product.findFirst({
    where: { 
      name: { contains: 'BERNADOTTE Set' }
    },
    select: { 
      name: true,
      interestTags: true
    }
  });
  
  console.log('\nProduct:', p.name);
  console.log('Interest tags:', JSON.stringify(p.interestTags, null, 2));
  console.log('Type:', typeof p.interestTags);
  console.log('Is Array:', Array.isArray(p.interestTags));
  console.log('Length:', p.interestTags.length);
  
  // Test matching
  const recipientInterests = ['cooking & food', 'watches'];
  const productTags = p.interestTags.map(t => t.toLowerCase());
  console.log('\nProduct tags (lowercase):', productTags);
  console.log('Recipient interests:', recipientInterests);
  
  const matches = productTags.some(tag => recipientInterests.includes(tag));
  console.log('\nMatch result:', matches);
  
  // Try individual matches
  console.log('\nIndividual matches:');
  p.interestTags.forEach(tag => {
    const lower = tag.toLowerCase();
    const match = recipientInterests.includes(lower);
    console.log(`  "${tag}" -> "${lower}" -> Match: ${match}`);
  });
  
  await prisma.$disconnect();
}

debugInterestMatch().catch(console.error);
