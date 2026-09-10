import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function setPassword(email, newPassword) {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    const user = await prisma.user.update({
      where: { email },
      data: { 
        password: hashedPassword,
        isEmailVerified: true  // Mark as verified since you're setting it manually
      }
    });

    console.log('✅ Password set successfully!');
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Password:', newPassword);
    console.log('\n🔐 You can now login at http://localhost:5173/login');
    console.log('   Email:', email);
    console.log('   Password:', newPassword);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email and password from command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node scripts/set-user-password.js <email> <password>');
  console.log('Example: node scripts/set-user-password.js pph2shoaib@gmail.com MyPassword123');
  process.exit(1);
}

if (password.length < 8) {
  console.log('❌ Password must be at least 8 characters');
  process.exit(1);
}

setPassword(email, password);
