import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAgeBandTags() {
  try {
    console.log('🔧 Fixing Age Band Tags\n');

    // Get all products
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        suitableAgeBands: true
      }
    });

    console.log(`📦 Total products: ${products.length}\n`);

    let fixed = 0;
    let skipped = 0;
    const updates = [];

    // Prepare all updates first
    for (const product of products) {
      const currentTags = product.suitableAgeBands || [];
      const newTags = [];

      // Map old format to new format
      currentTags.forEach(tag => {
        const tagLower = tag.toLowerCase();

        // Kids (0-10)
        if (tagLower.includes('0-10') || tagLower.includes('kids') || tagLower.includes('children')) {
          if (!newTags.includes('ZERO_TO_10')) newTags.push('ZERO_TO_10');
        }

        // Teens (11-17)
        if (tagLower.includes('11-17') || tagLower.includes('teen') || tagLower.includes('youth')) {
          if (!newTags.includes('ELEVEN_TO_17')) newTags.push('ELEVEN_TO_17');
        }

        // Young Adults (18-30)
        if (tagLower.includes('18-30') || tagLower.includes('young adult')) {
          if (!newTags.includes('EIGHTEEN_TO_30')) newTags.push('EIGHTEEN_TO_30');
        }

        // Adults (30-50)
        if (tagLower.includes('30-50') || tagLower.includes('31-50')) {
          if (!newTags.includes('THIRTY_ONE_TO_50')) newTags.push('THIRTY_ONE_TO_50');
        }

        // Seniors (50+)
        if (tagLower.includes('50+') || tagLower.includes('51+')) {
          if (!newTags.includes('FIFTY_ONE_PLUS')) newTags.push('FIFTY_ONE_PLUS');
        }

        // Generic "18+" → all adult age bands
        if (tagLower === '18+' || tagLower === 'adult') {
          if (!newTags.includes('EIGHTEEN_TO_30')) newTags.push('EIGHTEEN_TO_30');
          if (!newTags.includes('THIRTY_ONE_TO_50')) newTags.push('THIRTY_ONE_TO_50');
          if (!newTags.includes('FIFTY_ONE_PLUS')) newTags.push('FIFTY_ONE_PLUS');
        }

        // Keep original enum values if already correct
        if (['ZERO_TO_10', 'ELEVEN_TO_17', 'EIGHTEEN_TO_30', 'THIRTY_ONE_TO_50', 'FIFTY_ONE_PLUS'].includes(tag)) {
          if (!newTags.includes(tag)) newTags.push(tag);
        }
      });

      // Queue update if changed
      if (newTags.length > 0 && JSON.stringify(newTags.sort()) !== JSON.stringify(currentTags.sort())) {
        updates.push({
          id: product.id,
          name: product.name,
          oldTags: currentTags,
          newTags: newTags
        });
      } else {
        skipped++;
      }
    }

    console.log(`Prepared ${updates.length} updates\n`);

    // Batch update in chunks of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(update =>
          prisma.product.update({
            where: { id: update.id },
            data: { suitableAgeBands: update.newTags }
          })
        )
      );

      fixed += batch.length;
      console.log(`✅ Updated ${fixed}/${updates.length} products...`);

      // Show first 10 examples
      if (i === 0) {
        batch.slice(0, 10).forEach(u => {
          console.log(`   ${u.name.substring(0, 50)}`);
          console.log(`   ${u.oldTags.join(', ')} → ${u.newTags.join(', ')}\n`);
        });
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   Total: ${products.length}`);

    // Show distribution after fix
    const updatedProducts = await prisma.product.findMany({
      select: { suitableAgeBands: true }
    });

    const ageCounts = {
      'ZERO_TO_10': 0,
      'ELEVEN_TO_17': 0,
      'EIGHTEEN_TO_30': 0,
      'THIRTY_ONE_TO_50': 0,
      'FIFTY_ONE_PLUS': 0
    };

    updatedProducts.forEach(p => {
      (p.suitableAgeBands || []).forEach(band => {
        if (ageCounts[band] !== undefined) {
          ageCounts[band]++;
        }
      });
    });

    console.log(`\n📊 Age Band Distribution After Fix:`);
    Object.entries(ageCounts).forEach(([band, count]) => {
      console.log(`   ${band}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAgeBandTags();
