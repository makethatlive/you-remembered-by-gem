import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function checkProduct() {
  try {
    const product = await prisma.product.findUnique({
      where: { id: '6a5cf9a67b9e64322873d29d' },
      include: {
        retailer: true
      }
    });

    console.log('\n=== RAW PRODUCT DATA ===\n');
    console.log(JSON.stringify(product, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProduct();
