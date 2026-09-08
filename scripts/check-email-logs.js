import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkEmailLogs() {
  try {
    console.log('Checking email logs in database...\n');
    
    const count = await prisma.emailLog.count();
    console.log(`Total email logs: ${count}`);
    
    if (count > 0) {
      const logs = await prisma.emailLog.findMany({
        take: 10,
        orderBy: { sentAt: 'desc' },
        include: {
          subscriber: true,
          recipient: true,
        }
      });
      
      console.log('\nRecent email logs:');
      logs.forEach(log => {
        console.log(`- ${log.emailType} to ${log.subscriber?.email} (${log.subscriber?.name}) - ${log.status} - ${log.sentAt}`);
      });
    } else {
      console.log('\n❌ No email logs found in database');
      console.log('\nPossible reasons:');
      console.log('1. No emails have been sent yet');
      console.log('2. Email sending might be disabled (check ENABLE_EMAILS in .env)');
      console.log('3. Email log creation might be failing silently');
    }
    
    // Check if we have subscribers
    const subCount = await prisma.subscriber.count();
    console.log(`\nTotal subscribers: ${subCount}`);
    
  } catch (error) {
    console.error('Error checking email logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmailLogs();
