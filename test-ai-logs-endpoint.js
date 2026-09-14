import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAILogsEndpoint() {
  console.log('🧪 Testing AI Logs Endpoint Logic\n');
  
  try {
    // Test 1: Check if AIApiCallLog table exists and can be queried
    console.log('Test 1: Count AI API call logs in database');
    const count = await prisma.aIApiCallLog.count();
    console.log(`   ✅ Found ${count} AI API call logs\n`);
    
    // Test 2: Query logs (like the endpoint does)
    console.log('Test 2: Query logs with pagination');
    const logs = await prisma.aIApiCallLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        recipient: {
          select: {
            id: true,
            name: true,
          }
        },
        giftList: {
          select: {
            id: true,
            status: true,
          }
        }
      }
    });
    console.log(`   ✅ Retrieved ${logs.length} logs\n`);
    
    if (logs.length > 0) {
      console.log('Sample log:');
      console.log(JSON.stringify(logs[0], null, 2));
    } else {
      console.log('   ℹ️  No logs in database yet (this is normal if no AI calls have been made)');
    }
    
    console.log('\n✅ All tests passed!');
    console.log('   The database schema is correct and queries work.');
    console.log('   The issue must be with Express route registration.\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAILogsEndpoint();
