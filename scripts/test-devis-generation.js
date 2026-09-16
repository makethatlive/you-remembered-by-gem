import { PrismaClient } from '@prisma/client';
import ProductMatcher from '../server/services/gifts/product-matcher.js';

const prisma = new PrismaClient();

async function testDevisGeneration() {
  try {
    console.log('🧪 Testing Devis Gift Generation\n');

    const recipient = await prisma.recipient.findFirst({
      where: { name: 'Devis' },
      include: { subscriber: true }
    });

    if (!recipient) {
      console.log('❌ Devis not found');
      return;
    }

    console.log('✅ Found Devis');
    console.log(`   Budget: £${recipient.budgetMin}-£${recipient.budgetMax}`);
    console.log(`   Gender: ${recipient.gender}`);
    console.log(`   Age: ${recipient.ageBand}`);
    console.log(`   Interests: ${recipient.interests?.join(', ') || 'None'}\n`);

    const matcher = new ProductMatcher();
    
    console.log('🔍 Running product matcher...\n');
    const products = await matcher.findMatchingProducts(recipient, prisma);

    console.log(`\n📊 RESULT: ${products.length} products returned\n`);

    if (products.length > 0) {
      console.log('✅ SUCCESS! Top 5 products:');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   £${p.price} | Score: ${p.score} | Quality: ${p.qualityScore || 'NULL'}`);
      });
    } else {
      console.log('❌ FAILURE: No products returned!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testDevisGeneration();
