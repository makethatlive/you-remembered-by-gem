import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBabyMori() {
  try {
    console.log('🔍 Checking babymori.com Products\n');

    // Get the retailer
    const retailer = await prisma.retailer.findFirst({
      where: {
        name: { contains: 'babymori', mode: 'insensitive' }
      },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    if (!retailer) {
      console.log('❌ babymori.com not found');
      return;
    }

    console.log(`✅ Found retailer: ${retailer.name}`);
    console.log(`   Total products: ${retailer._count.products}\n`);

    // Check products in Devis's budget
    const productsInBudget = await prisma.product.findMany({
      where: {
        retailerId: retailer.id,
        status: 'ACTIVE',
        price: { gte: 19, lte: 104 },
        genderAppliesTo: { in: ['MALE', 'MEN', 'UNISEX'] }
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        price: true,
        genderAppliesTo: true
      },
      take: 20
    });

    console.log(`📦 Products in Devis's budget (£20-£99, MALE/UNISEX): ${productsInBudget.length}\n`);

    if (productsInBudget.length === 0) {
      console.log('❌ No products match Devis\'s criteria!\n');
      
      // Check why
      const allActive = await prisma.product.count({
        where: { retailerId: retailer.id, status: 'ACTIVE' }
      });
      
      const inBudgetNoGender = await prisma.product.count({
        where: {
          retailerId: retailer.id,
          status: 'ACTIVE',
          price: { gte: 19, lte: 104 }
        }
      });

      const withMaleGender = await prisma.product.count({
        where: {
          retailerId: retailer.id,
          status: 'ACTIVE',
          genderAppliesTo: { in: ['MALE', 'MEN', 'UNISEX'] }
        }
      });

      console.log('Analysis:');
      console.log(`  Active products: ${allActive}`);
      console.log(`  In budget range: ${inBudgetNoGender}`);
      console.log(`  With MALE/UNISEX gender: ${withMaleGender}`);
      
      return;
    }

    // Check if they have kid keywords
    console.log('🔍 Checking for kid keywords in products:\n');

    const kidKeywords = ['teen', 'youth', 'young', 'kid', 'child', 'toy', 'game', 'baby', 'toddler'];
    
    let matchCount = 0;
    productsInBudget.forEach((p, i) => {
      const text = `${p.name} ${p.description || ''} ${p.category || ''}`.toLowerCase();
      const matches = kidKeywords.filter(kw => text.includes(kw));
      
      if (matches.length > 0) {
        matchCount++;
        if (matchCount <= 5) {
          console.log(`${matchCount}. ${p.name}`);
          console.log(`   £${p.price} | Gender: ${p.genderAppliesTo}`);
          console.log(`   ✅ Matches: ${matches.join(', ')}\n`);
        }
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Total in budget: ${productsInBudget.length}`);
    console.log(`   With kid keywords: ${matchCount}`);
    console.log(`   Without keywords: ${productsInBudget.length - matchCount}`);

    if (matchCount === 0) {
      console.log('\n⚠️  NO PRODUCTS have kid keywords!');
      console.log('Sample products:');
      productsInBudget.slice(0, 5).forEach(p => {
        console.log(`- ${p.name} (${p.category || 'no category'})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBabyMori();
