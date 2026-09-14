/**
 * Auto Gift Generation Scheduled Job
 * 
 * Runs daily at 9:00 AM to automatically generate gift lists for recipients
 * whose birthdays are exactly 6 weeks (42 days) away.
 * 
 * This ensures all recipients get their gift lists generated on time,
 * even if they were added more than 6 weeks before their birthday.
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import ClaudeClient from '../services/ai/claude-client.js';
import GiftListGenerator from '../services/gifts/gift-list-generator.js';

const prisma = new PrismaClient();

/**
 * Calculate days until next occurrence of a birthday
 * @param {number} day - Day of month (1-31)
 * @param {number} month - Month (1-12)
 * @returns {number|null} Days until birthday, or null if invalid date
 */
function calculateDaysUntilBirthday(day, month) {
  if (!day || !month) return null;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Create date for this year's birthday
  let nextBirthday = new Date(currentYear, month - 1, day);
  
  // If birthday has already passed this year, use next year
  if (nextBirthday < now) {
    nextBirthday = new Date(currentYear + 1, month - 1, day);
  }
  
  // Calculate difference in days
  const diffTime = nextBirthday.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Check if recipient already has a gift list for this year
 * @param {string} recipientId - Recipient ID
 * @param {object} prisma - Prisma client
 * @returns {Promise<boolean>} True if gift list exists
 */
async function hasGiftListThisYear(recipientId, prisma) {
  const currentYear = new Date().getFullYear();
  
  // Check for any approved or pending gift lists created this year
  const existingLists = await prisma.giftList.findMany({
    where: {
      recipientId: recipientId,
      status: {
        in: ['PENDING_APPROVAL', 'APPROVED', 'SENT']
      },
      createdAt: {
        gte: new Date(`${currentYear}-01-01`),
        lte: new Date(`${currentYear}-12-31`)
      }
    }
  });
  
  return existingLists.length > 0;
}

/**
 * Main job function - finds recipients at 6-week mark and generates gift lists
 */
async function autoGenerateJob() {
  console.log('\n🎁 ===== AUTO GIFT GENERATION JOB =====');
  console.log(`   Started: ${new Date().toISOString()}`);
  console.log(`   Target: Recipients with birthdays exactly 42 days away\n`);
  
  try {
    // Get API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('   ❌ ANTHROPIC_API_KEY not set - skipping job');
      return;
    }
    
    // Get all recipients with birthday dates
    const allRecipients = await prisma.recipient.findMany({
      where: {
        occasionDay: { not: null },
        occasionMonth: { not: null },
      },
      select: {
        id: true,
        name: true,
        occasionDay: true,
        occasionMonth: true,
        subscriberId: true,
      }
    });
    
    console.log(`   Found ${allRecipients.length} recipients with birthdays`);
    
    // Filter recipients who are exactly 42 days away
    const targetRecipients = [];
    
    for (const recipient of allRecipients) {
      const daysUntil = calculateDaysUntilBirthday(
        recipient.occasionDay, 
        recipient.occasionMonth
      );
      
      // Check if exactly 42 days away (allowing 41-43 range to account for timing)
      if (daysUntil >= 41 && daysUntil <= 43) {
        // Check if they already have a gift list this year
        const hasGiftList = await hasGiftListThisYear(recipient.id, prisma);
        
        if (!hasGiftList) {
          targetRecipients.push({ ...recipient, daysUntil });
        }
      }
    }
    
    console.log(`   ${targetRecipients.length} recipients need gift lists (6 weeks away, no existing list)\n`);
    
    if (targetRecipients.length === 0) {
      console.log('   ✅ No gift lists to generate today');
      console.log('==========================================\n');
      return;
    }
    
    // Initialize Claude client and generator
    const claudeClient = new ClaudeClient(apiKey, prisma);
    const generator = new GiftListGenerator(claudeClient, prisma);
    
    // Generate gift lists for each recipient
    let successCount = 0;
    let failCount = 0;
    
    for (const recipient of targetRecipients) {
      console.log(`   📝 Generating for ${recipient.name} (${recipient.daysUntil} days until birthday)...`);
      
      try {
        const result = await generator.generateGiftList({
          recipientId: recipient.id,
          listType: 'curated',
          daysUntil: recipient.daysUntil,
        });
        
        if (result.status === 'pending_approval') {
          console.log(`      ✅ Success: Gift list ${result.giftListId} created`);
          successCount++;
        } else {
          console.log(`      ⚠️  Result: ${result.status} - ${result.message || 'See details above'}`);
          failCount++;
        }
      } catch (error) {
        console.error(`      ❌ Failed: ${error.message}`);
        failCount++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n   📊 SUMMARY:`);
    console.log(`      Success: ${successCount}`);
    console.log(`      Failed: ${failCount}`);
    console.log(`      Total: ${targetRecipients.length}`);
    console.log('==========================================\n');
    
  } catch (error) {
    console.error(`\n   ❌ JOB ERROR: ${error.message}`);
    console.error(error.stack);
    console.log('==========================================\n');
  }
}

/**
 * Schedule the job to run daily at 9:00 AM
 * Cron format: minute hour day month weekday
 * '0 9 * * *' = At 9:00 AM every day
 */
export function startAutoGenerationJob() {
  console.log('🚀 Starting Auto Gift Generation Job');
  console.log('   Schedule: Daily at 9:00 AM');
  console.log('   Task: Auto-generate gift lists for recipients at 6-week mark\n');
  
  // Schedule the job
  cron.schedule('0 9 * * *', () => {
    autoGenerateJob();
  }, {
    timezone: "Europe/London" // Adjust to your timezone
  });
  
  console.log('✅ Auto Gift Generation Job scheduled\n');
}

// Export for manual testing
export { autoGenerateJob };
