/**
 * Fix Interest Tags - Split comma-separated values into separate array items
 * 
 * Problem: interestTags contains ['Cooking & food, Wine & drinks'] 
 * Should be: ['Cooking & food', 'Wine & drinks']
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixInterestTags() {
  console.log('\n🔧 FIXING INTEREST TAGS');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // Get all products with interest tags
    const allProducts = await prisma.product.findMany({
      where: {
        interestTags: {
          isEmpty: false
        }
      },
      select: {
        id: true,
        name: true,
        interestTags: true,
        status: true
      }
    });

    console.log(`📊 Found ${allProducts.length} products with interest tags\n`);

    let fixed = 0;
    let alreadyGood = 0;
    let errors = 0;

    for (const product of allProducts) {
      try {
        const originalTags = product.interestTags || [];
        
        // Split any tags that contain commas
        const fixedTags = [];
        let needsFix = false;

        for (const tag of originalTags) {
          if (tag.includes(',')) {
            // This tag needs splitting
            needsFix = true;
            const splitTags = tag.split(',').map(t => t.trim()).filter(t => t.length > 0);
            fixedTags.push(...splitTags);
          } else {
            fixedTags.push(tag.trim());
          }
        }

        // Remove duplicates and empty strings
        const uniqueTags = [...new Set(fixedTags)].filter(t => t.length > 0);

        if (needsFix) {
          // Update the product
          await prisma.product.update({
            where: { id: product.id },
            data: { interestTags: uniqueTags }
          });

          console.log(`✅ Fixed: ${product.name.substring(0, 60)}`);
          console.log(`   Before: [${originalTags.join(' | ')}]`);
          console.log(`   After:  [${uniqueTags.join(' | ')}]\n`);
          
          fixed++;
        } else {
          alreadyGood++;
        }
      } catch (error) {
        console.error(`❌ Error fixing ${product.name}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ INTEREST TAGS FIXED!');
    console.log('═══════════════════════════════════════════════\n');
    console.log(`📊 Summary:`);
    console.log(`   Total products checked: ${allProducts.length}`);
    console.log(`   Fixed (split comma-separated): ${fixed}`);
    console.log(`   Already correct: ${alreadyGood}`);
    console.log(`   Errors: ${errors}\n`);

    // Show examples of fixed tags
    if (fixed > 0) {
      console.log('🔍 Verifying fix - sample products with "Cooking & food":\n');
      
      const verifyProducts = await prisma.product.findMany({
        where: {
          interestTags: { has: 'Cooking & food' },
          status: 'ACTIVE'
        },
        select: {
          name: true,
          interestTags: true
        },
        take: 5
      });

      verifyProducts.forEach(p => {
        console.log(`  ✓ ${p.name.substring(0, 60)}`);
        console.log(`    Tags: [${p.interestTags.join(', ')}]\n`);
      });
    }

    console.log('💡 Next: Regenerate Ben\'s gift list to see if Tier 1/Tier 2 products now appear\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixInterestTags();
