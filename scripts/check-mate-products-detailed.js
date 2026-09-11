import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function checkMateProducts() {
  try {
    const productIds = [
      '6a5cf9a67b9e64322873d29d',
      '6a5cf9a67b9e64322873d298',
      '6a5cf9aa7b9e64322873d502',
      '6a5cf9a97b9e64322873d45d',
      '6a5cf9a97b9e64322873d455',
      '6a5cf9a97b9e64322873d444',
      '6a5cf9a97b9e64322873d47e'
    ];

    console.log('\n=== MATE\'S PROFILE ===');
    console.log('Age: 18-25, Female, Daughter');
    console.log('Interests: Cooking & food, Music, Gaming (video games), Pets');
    console.log('Personality: Creative and expressive');
    console.log('Budget: £100 - £230');
    
    console.log('\n\n=== GENERATED GIFT PRODUCTS ===\n');

    for (const productId of productIds) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          retailer: true
        }
      });

      if (product) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`PRODUCT: ${product.title}`);
        console.log(`${'='.repeat(80)}`);
        console.log('Price:', product.price ? `£${product.price}` : 'N/A');
        console.log('Retailer:', product.retailer?.name || 'Unknown');
        console.log('URL:', product.url || 'N/A');
        console.log('Categories:', product.categories || []);
        console.log('Tags:', product.tags || []);
        console.log('Description:', (product.description || 'N/A').substring(0, 200));
        console.log('Provenance:', product.provenance);
        console.log('Status:', product.status);
        
        // Analyze relevance
        const title = (product.title || '').toLowerCase();
        const desc = (product.description || '').toLowerCase();
        const categories = (product.categories || []).map(c => c.toLowerCase());
        const tags = (product.tags || []).map(t => t.toLowerCase());
        
        const targetKeywords = ['cooking', 'food', 'kitchen', 'music', 'gaming', 'game', 'pet', 'dog', 'cat', 'creative', 'art'];
        const found = targetKeywords.filter(keyword => 
          title.includes(keyword) || 
          desc.includes(keyword) ||
          categories.some(cat => cat.includes(keyword)) ||
          tags.some(tag => tag.includes(keyword))
        );
        
        console.log('\n🎯 RELEVANCE CHECK:');
        if (found.length > 0) {
          console.log('✅ Matches:', found.join(', '));
        } else {
          console.log('❌ NO MATCH with recipient interests (Cooking, Music, Gaming, Pets)');
        }
      } else {
        console.log(`\n❌ Product ${productId} not found`);
      }
    }

    // Also check what the AI selector reasoning was
    console.log('\n\n=== CHECKING AI REASONING ===\n');
    const giftItems = await prisma.giftItem.findMany({
      where: {
        giftListId: 'cmtwv2bf900039mxnnn3po9ue'
      },
      include: {
        product: true
      },
      orderBy: {
        rank: 'asc'
      }
    });

    giftItems.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.product?.title || 'Unknown'}`);
      console.log('   AI Reasoning:', item.aiReasoning || 'N/A');
      console.log('   Relevance Score:', item.relevanceScore);
      console.log('   Match Categories:', item.matchCategories);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMateProducts();
