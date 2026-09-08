import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001';

async function sendTestWelcomeEmails() {
  try {
    console.log('🔍 Fetching subscribers from database...\n');
    
    const subscribers = await prisma.subscriber.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    if (subscribers.length === 0) {
      console.log('❌ No subscribers found in database');
      return;
    }
    
    console.log(`Found ${subscribers.length} subscribers:\n`);
    
    for (const subscriber of subscribers) {
      console.log(`📧 Sending welcome email to: ${subscriber.email} (${subscriber.name})`);
      
      try {
        const response = await fetch(`${API_URL}/api/email/welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: subscriber.email,
            name: subscriber.name,
            subscriberId: subscriber.id
          })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          console.log(`   ✅ Success: ${result.message}`);
          if (result.id) {
            console.log(`   📬 Email ID: ${result.id}`);
          }
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      console.log(''); // Empty line for readability
      
      // Wait 1 second between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Check email logs count
    const emailLogCount = await prisma.emailLog.count();
    console.log(`\n✨ Email logs in database: ${emailLogCount}`);
    console.log('\n🎉 Done! Check the "Sent History" tab in the admin dashboard.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if server is running first
async function checkServer() {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

console.log('🚀 Test Welcome Email Sender\n');
console.log('This script will send welcome emails to existing subscribers');
console.log('and create email logs that will appear in Sent History.\n');

// Check if server is running
const serverRunning = await checkServer();
if (!serverRunning) {
  console.error('❌ Error: Server is not running at', API_URL);
  console.error('Please start the server first: npm run server');
  process.exit(1);
}

sendTestWelcomeEmails();
