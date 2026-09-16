import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDevisProfile() {
  try {
    const recipient = await prisma.recipient.findFirst({
      where: { name: 'Devis' }
    });

    if (!recipient) {
      console.log('❌ Devis not found');
      return;
    }

    console.log('👤 Devis Profile:\n');
    console.log(`Name: ${recipient.name}`);
    console.log(`Gender: ${recipient.gender}`);
    console.log(`Age Band: ${recipient.ageBand}`);
    console.log(`Budget: £${recipient.budgetMin}-£${recipient.budgetMax}`);
    console.log(`\nInterests: ${recipient.interests?.join(', ') || 'None'}`);
    console.log(`Gift Types: ${recipient.giftTypes?.join(', ') || 'None'}`);
    console.log(`Personality: ${recipient.personality?.join(', ') || 'None'}`);
    console.log(`\nHobbies & Interests: ${recipient.hobbiesAndInterests || 'None'}`);
    console.log(`Who They Are: ${recipient.whoTheyAre || 'None'}`);
    console.log(`Things You Know: ${recipient.thingsYouKnow || 'None'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDevisProfile();
