import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'pph2shoaib@gmail.com' }
    });

    if (user) {
      console.log('✅ User exists:');
      console.log('   Email:', user.email);
      console.log('   Role:', user.role);
      console.log('   Has Password:', !!user.password);
      console.log('   Email Verified:', user.isEmailVerified);
      console.log('   Created:', user.createdAt);
      console.log('\n💡 Use the "Forgot Password" feature to reset the password.');
    } else {
      console.log('❌ User NOT found');
      console.log('💡 Register a new account at http://localhost:5173/register');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
