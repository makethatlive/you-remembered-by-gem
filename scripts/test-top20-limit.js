import { PrismaClient } from '@prisma/client';
import ProductMatcher from '../server/services/gifts/product-matcher.js';

const prisma = new PrismaClient();

async function testTop20Limit() {
  try {
    console.log('🧪 Testing Top 20 Product Limit for AI\n');

    // Get Izzy's recipient data
    const recipient = await prisma.recipient.findFirst({
      where: {
        name: 'Izzy'
      },
      include: {
        subscriber: true
      }
    });

    if (!recipient) {
      console.log('❌ Recipient "Izzy" not found');
      return;
    }

    console.log(`✅ Found recipient: ${recipient.name}`);
    console.log(`   Interests: ${recipient.interests.join(', ')}`);
    console.log(`   Budget: £${recipient.budgetMin}-£${recipient.budgetMax}`);
    console.log(`   Gender: ${recipient.gender}\n`);

    const matcher = new ProductMatcher();
    
    console.log('🔍 Finding matching products...\n');
    const products = await matcher.findMatchingProducts(recipient, prisma);

    console.log('\n📊 RESULTS:');
    console.log(`   Total products returned: ${products.length}`);
    console.log(`   Expected: 20 (or less if not enough candidates)\n`);

    if (products.length > 0) {
      console.log('✅ TOP 5 PRODUCTS (by score):');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name}`);
        console.log(`      Score: ${p.score} | Tier: ${p.tier} | Price: £${p.price}`);
        console.log(`      Quality: ${p.qualityScore} | Relevance: ${p.relevanceScore}`);
      });

      console.log('\n📈 TOKEN COMPARISON:');
      const avgCharsPerProduct = 200; // Approximate
      const oldTokens = Math.ceil((28 * avgCharsPerProduct) / 4);
      const newTokens = Math.ceil((products.length * avgCharsPerProduct) / 4);
      
      console.log(`   Old (28 products): ~${oldTokens} tokens`);
      console.log(`   New (${products.length} products): ~${newTokens} tokens`);
      console.log(`   Savings: ~${oldTokens - newTokens} tokens (${Math.round(((oldTokens - newTokens) / oldTokens) * 100)}%)`);
    }

    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testTop20Limit();
