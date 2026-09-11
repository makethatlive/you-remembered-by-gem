import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function checkMateRequirements() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('MATE GIFT GENERATION - REQUIREMENTS CHECK');
    console.log('='.repeat(80));

    // Get Mate's profile
    const mate = await prisma.recipient.findUnique({
      where: { id: 'cmtwtxwg1000812fmmnod41pm' }
    });

    console.log('\n📋 MATE\'S PROFILE:');
    console.log('  Interests:', mate.interests?.join(', '));
    console.log('  Budget: £' + mate.budgetMin + ' - £' + mate.budgetMax);
    console.log('  Age Range:', mate.ageRange);
    console.log('  Gender:', mate.gender);

    console.log('\n\n📊 CURRENT CATALOGUE STATUS:\n');

    // Check products for each interest
    for (const interest of mate.interests) {
      console.log(`\n--- ${interest.toUpperCase()} ---`);
      
      // Count total products with this interest tag
      const totalCount = await prisma.product.count({
        where: {
          status: 'ACTIVE',
          interestTags: { has: interest }
        }
      });

      // Count products in budget
      const inBudgetCount = await prisma.product.count({
        where: {
          status: 'ACTIVE',
          price: {
            gte: mate.budgetMin,
            lte: mate.budgetMax
          },
          interestTags: { has: interest }
        }
      });

      // Count quality products in budget (quality score 50+)
      const qualityCount = await prisma.product.count({
        where: {
          status: 'ACTIVE',
          price: {
            gte: mate.budgetMin,
            lte: mate.budgetMax
          },
          qualityScore: { gte: 50 },
          interestTags: { has: interest }
        }
      });

      console.log(`  Total products: ${totalCount}`);
      console.log(`  In budget (£${mate.budgetMin}-£${mate.budgetMax}): ${inBudgetCount}`);
      console.log(`  Quality products (score 50+): ${qualityCount}`);

      if (qualityCount === 0) {
        console.log(`  ❌ ISSUE: No quality products available for "${interest}"`);
      } else if (qualityCount < 5) {
        console.log(`  ⚠️  WARNING: Only ${qualityCount} quality products (5+ recommended)`);
      } else {
        console.log(`  ✅ Good: ${qualityCount} quality products available`);
      }

      // Show sample products if any exist
      if (inBudgetCount > 0) {
        const samples = await prisma.product.findMany({
          where: {
            status: 'ACTIVE',
            price: {
              gte: mate.budgetMin,
              lte: mate.budgetMax
            },
            interestTags: { has: interest }
          },
          include: {
            retailer: true
          },
          take: 3
        });

        if (samples.length > 0) {
          console.log(`\n  Sample products:`);
          samples.forEach((p, i) => {
            console.log(`    ${i + 1}. ${p.name} - £${p.price} (Quality: ${p.qualityScore || 'N/A'})`);
            console.log(`       Retailer: ${p.retailer?.name}`);
            console.log(`       Tags: ${p.interestTags?.join(', ')}`);
          });
        }
      }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('REQUIREMENTS FOR SUCCESSFUL GENERATION:');
    console.log('='.repeat(80));

    // Calculate overall requirements
    const totalQualityProducts = await prisma.product.count({
      where: {
        status: 'ACTIVE',
        price: {
          gte: mate.budgetMin,
          lte: mate.budgetMax
        },
        qualityScore: { gte: 50 },
        interestTags: {
          hasSome: mate.interests
        }
      }
    });

    console.log('\n✅ MINIMUM REQUIREMENTS:');
    console.log('  - At least 3 quality products matching interests');
    console.log('  - Products must have:');
    console.log('    • status = "ACTIVE"');
    console.log('    • price between £' + mate.budgetMin + ' - £' + mate.budgetMax);
    console.log('    • qualityScore >= 50');
    console.log('    • interestTags includes one of: ' + mate.interests.join(', '));
    console.log('    • Valid name (not null, not "undefined", length > 3)');
    console.log('    • Description > 10 characters');
    console.log('    • Product URL exists');

    console.log('\n📊 CURRENT STATUS:');
    console.log(`  Quality products matching ANY interest: ${totalQualityProducts}`);

    if (totalQualityProducts < 3) {
      console.log('\n❌ CANNOT GENERATE - Need at least 3 quality products');
      console.log('\n💡 SOLUTION:');
      console.log('  Import products with these interestTags:');
      mate.interests.forEach(interest => {
        console.log(`    - "${interest}"`);
      });
    } else if (totalQualityProducts < 5) {
      console.log('\n⚠️  CAN GENERATE but quality may be low');
      console.log('   Recommended: Add 5+ more products for better results');
    } else {
      console.log('\n✅ READY TO GENERATE!');
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('HOW TO ADD PRODUCTS:');
    console.log('='.repeat(80));
    console.log('\n1. Via CSV Import:');
    console.log('   npm run import:csv');
    console.log('   Make sure CSV has these columns:');
    console.log('   - name, description, retailer, url, price, interestTags');
    console.log('   - interestTags format: "Cooking & food;Music;Gaming (video games)"');
    
    console.log('\n2. Via Admin UI:');
    console.log('   - Go to Products → Add Product');
    console.log('   - Set interestTags to match recipient interests');
    console.log('   - Ensure qualityScore >= 50');
    
    console.log('\n3. Via Database:');
    console.log('   - Update existing products to add missing interestTags');
    console.log('   - Example SQL:');
    console.log('     UPDATE "Product" SET "interestTags" = \'{"Music"}\' WHERE ...');

    console.log('\n\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMateRequirements();
