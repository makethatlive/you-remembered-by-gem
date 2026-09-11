import { PrismaClient } from '@prisma/client';
import ProductMatcher from '../server/services/gifts/product-matcher.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function diagnoseMateGeneration() {
  try {
    // Load Mate's recipient profile
    const recipient = await prisma.recipient.findUnique({
      where: { id: 'cmtwtxwg1000812fmmnod41pm' },
      include: {
        owner: true
      }
    });

    console.log('\n=== MATE\'S PROFILE ===');
    console.log('Interests:', recipient.interests);
    console.log('Personality:', recipient.personality);
    console.log('Budget:', recipient.budgetMin, '-', recipient.budgetMax);
    console.log('Age Band:', recipient.ageRange);
    console.log('Gender:', recipient.gender);

    // Simulate product matching
    const matcher = new ProductMatcher();
    console.log('\n=== RUNNING PRODUCT MATCHER ===');
    const candidates = await matcher.findMatchingProducts(recipient, prisma);
    
    console.log(`\nFound ${candidates.length} matching products`);
    console.log('\n=== TOP 20 CANDIDATES ===\n');
    
    candidates.slice(0, 20).forEach((product, index) => {
      console.log(`${index + 1}. ${product.name || 'Unnamed'} - £${product.price}`);
      console.log(`   Score: ${product.score}`);
      console.log(`   Signals: ${product.matchSignals?.join(', ')}`);
      console.log(`   Retailer: ${product.retailer?.name}`);
      console.log(`   Interest Tags: ${product.interestTags?.join(', ') || 'None'}`);
      console.log(`   Gift Type Tags: ${product.giftTypeTags?.join(', ') || 'None'}`);
      console.log('');
    });

    // Check the actual products that were selected
    console.log('\n\n=== PRODUCTS ACTUALLY SELECTED FOR MATE ===\n');
    const selectedIds = [
      '6a5cf9a67b9e64322873d29d',
      '6a5cf9a67b9e64322873d298',
      '6a5cf9aa7b9e64322873d502',
      '6a5cf9a97b9e64322873d45d',
      '6a5cf9a97b9e64322873d455',
      '6a5cf9a97b9e64322873d444',
      '6a5cf9a97b9e64322873d47e'
    ];

    for (const productId of selectedIds) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { retailer: true }
      });

      if (product) {
        const scored = matcher.scoreProduct(product, recipient, {});
        console.log(`${product.name || 'Unnamed'} - £${product.price}`);
        console.log(`  SCORE: ${scored.score}`);
        console.log(`  Signals: ${scored.matchSignals?.join(', ')}`);
        console.log(`  Interest Tags: ${product.interestTags?.join(', ') || 'None'}`);
        console.log(`  Gift Type Tags: ${product.giftTypeTags?.join(', ') || 'None'}`);
        console.log(`  Would it pass threshold (10+)? ${scored.score >= 10 ? '✅ YES' : '❌ NO'}`);
        console.log('');
      }
    }

    // Check how many GOOD products exist for her interests
    console.log('\n\n=== CHECKING CATALOGUE FOR MATE\'S INTERESTS ===');
    const interests = ['Cooking & food', 'Music', 'Gaming (video games)', 'Pets'];
    
    for (const interest of interests) {
      const count = await prisma.product.count({
        where: {
          status: 'ACTIVE',
          price: { gte: 100, lte: 230 },
          interestTags: { has: interest }
        }
      });
      console.log(`${interest}: ${count} products in budget`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseMateGeneration();
