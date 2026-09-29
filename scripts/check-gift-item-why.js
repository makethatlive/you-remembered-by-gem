import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  try {
    const item = await prisma.giftItem.findFirst({
      where: { title: { contains: 'Montessori Colour Puzzle' } },
      select: {
        id: true,
        title: true,
        whyThisGift: true,
        productId: true
      }
    });
    
    console.log('\n=== GiftItem whyThisGift Check ===');
    console.log('GiftItem ID:', item?.id);
    console.log('GiftItem Title:', item?.title);
    console.log('GiftItem whyThisGift:', item?.whyThisGift || '(empty)');
    console.log('GiftItem ProductId:', item?.productId);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
