/**
 * Check existing abayabuth.com products in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  // Find the retailer
  const retailer = await prisma.retailer.findFirst({
    where: {
      OR: [
        { websiteUrl: { contains: 'abayabuth.com' } },
        { name: { contains: 'Abayabuth', mode: 'insensitive' } },
        { name: { contains: 'AbayaButh', mode: 'insensitive' } }
      ]
    }
  });
  
  if (!retailer) {
    console.log('❌ Abayabuth retailer not found in database');
    process.exit(0);
  }
  
  console.log('✅ Found retailer:');
  console.log('   ID:', retailer.id);
  console.log('   Name:', retailer.name);
  console.log('   URL:', retailer.websiteUrl);
  console.log('');
  
  // Get products
  const products = await prisma.product.findMany({
    where: { retailerId: retailer.id },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`Found ${products.length} products (showing first 10):`);
  console.log('');
  
  products.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   Price: £${p.price}`);
    console.log(`   URL: ${p.product_url}`);
    console.log(`   Created: ${p.createdAt}`);
    console.log('');
  });
  
  // Check price range
  const priceStats = await prisma.product.aggregate({
    where: { retailerId: retailer.id },
    _avg: { price: true },
    _min: { price: true },
    _max: { price: true },
    _count: true
  });
  
  console.log('📊 Price Statistics:');
  console.log(`   Total products: ${priceStats._count}`);
  console.log(`   Min price: £${priceStats._min.price}`);
  console.log(`   Max price: £${priceStats._max.price}`);
  console.log(`   Average price: £${priceStats._avg.price?.toFixed(2)}`);
  console.log('');
  
  if (priceStats._min.price > 1000) {
    console.log('⚠️  WARNING: Minimum price is > £1000!');
    console.log('   This suggests PKR prices are NOT being converted to GBP');
  }
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await prisma.$disconnect();
}
