/**
 * Daily Occasion Checker - Multi-Occasion Cron Job
 * 
 * Runs every 10 minutes to check all recipient occasions
 * Handles: Birthday, Christmas, Eid, Diwali, Custom occasions, etc.
 * 
 * Triggers:
 * - ≤42 days: Immediate gift generation + email
 * - Exactly 14 days: 2-week reminder
 * - 2 days after: Post-occasion feedback
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import {
  resolveOccasionDate,
  getAllRecipientOccasions,
  daysUntil,
  daysSince,
  hasEmailBeenSent,
  logEmailSend
} from '../utils/occasion-resolver.js';

const prisma = new PrismaClient();

console.log('\n📅 ========================================');
console.log('📅 Daily Occasion Checker Starting...');
console.log('📅 ========================================\n');

/**
 * Multi-Occasion Check - Runs every 10 minutes
 * Checks ALL occasions for ALL recipients
 */
cron.schedule('*/10 * * * *', async () => {
  const jobName = 'Multi-Occasion Check';
  const timestamp = new Date().toISOString();
  
  console.log(`\n🔍 [${timestamp}] ${jobName}: Starting...`);
  
  try {
    const recipients = await prisma.recipient.findMany({
      include: {
        subscriber: true
      }
    });
    
    const currentYear = new Date().getFullYear();
    let emailsSent = 0;
    
    console.log(`   📊 Scanning ${recipients.length} recipients...\n`);
    
    for (const recipient of recipients) {
      // Skip if no subscriber email
      if (!recipient.subscriber?.email) {
        console.log(`   ⏭️  ${recipient.name} - no subscriber email`);
        continue;
      }
      
      // Get all occasions for this recipient
      const occasions = await getAllRecipientOccasions(recipient, currentYear);
      
      if (occasions.length === 0) {
        continue;
      }
      
      console.log(`\n   👤 ${recipient.name} - ${occasions.length} occasion(s)`);
      
      for (const occasion of occasions) {
        const until = daysUntil(occasion.date);
        const since = daysSince(occasion.date);
        const occasionLabel = occasion.customLabel || occasion.type;
        
        console.log(`      📅 ${occasionLabel}: ${occasion.date.toDateString()} (${until} days)`);
        
        // ===== 6-WEEK TRIGGER: Exactly 42 days =====
        // NOTE: Immediate generation for <42 days is handled by autoGenerateOnRecipient at signup
        if (until === 42) {
          // Check if gift list already exists for this recipient + occasion date
          const existingGiftList = await prisma.giftList.findFirst({
            where: {
              recipientId: recipient.id,
              birthdayDate: occasion.date,
              status: {
                in: ['PENDING_APPROVAL', 'APPROVED', 'SENT']
              }
            }
          });
          
          if (existingGiftList) {
            console.log(`         ⏭️  Gift list already exists (${existingGiftList.status})`);
            continue;
          }
          
          const alreadySent = await hasEmailBeenSent(
            recipient.id,
            occasion.type,
            'SIX_WEEK_REMINDER',
            currentYear
          );
          
          if (!alreadySent) {
            console.log(`         ✉️  Sending 6-week reminder email (exactly 42 days)`);
            
            try {
              // Generate gift list with occasion date
              const giftListResponse = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/api/generate-gift-list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipient_id: recipient.id,
                  list_type: 'curated',
                  days_until: 42,
                  occasion_date: occasion.date.toISOString().split('T')[0]
                })
              });
              
              if (!giftListResponse.ok) {
                throw new Error(`Gift list generation failed: ${giftListResponse.statusText}`);
              }
              
              const giftList = await giftListResponse.json();
              
              // Send email
              await sendOccasionEmail({
                to: recipient.subscriber.email,
                recipientName: recipient.name,
                subscriberName: recipient.subscriber.firstName || recipient.subscriber.name || 'there',
                occasionLabel,
                occasionDate: occasion.date,
                daysUntil: 42,
                giftListId: giftList.id,
                type: 'immediate'
              });
              
              // Log email
              await logEmailSend({
                subscriberId: recipient.subscriberId,
                recipientId: recipient.id,
                giftListId: giftList.id,
                emailType: 'SIX_WEEK_REMINDER',
                occasionType: occasion.type,
                occasionYear: currentYear,
                occasionDate: occasion.date,
                status: 'SENT'
              });
              
              emailsSent++;
              console.log(`         ✅ 6-week email sent + gift list generated`);
            } catch (error) {
              console.error(`         ❌ Failed:`, error.message);
            }
          } else {
            console.log(`         ⏭️  Already sent`);
          }
        }
        
        // ===== 2-WEEK REMINDER: Exactly 14 days =====
        else if (until === 14) {
          const alreadySent = await hasEmailBeenSent(
            recipient.id,
            occasion.type,
            'FOURTEEN_DAY',
            currentYear
          );
          
          if (!alreadySent) {
            console.log(`         ✉️  Sending 2-week reminder`);
            
            try {
              await sendOccasionEmail({
                to: recipient.subscriber.email,
                recipientName: recipient.name,
                subscriberName: recipient.subscriber.firstName || recipient.subscriber.name || 'there',
                occasionLabel,
                occasionDate: occasion.date,
                daysUntil: 14,
                type: 'reminder'
              });
              
              await logEmailSend({
                subscriberId: recipient.subscriberId,  // FIX: Use subscriberId field
                recipientId: recipient.id,
                emailType: 'FOURTEEN_DAY',
                occasionType: occasion.type,
                occasionYear: currentYear,
                occasionDate: occasion.date,
                status: 'SENT'
              });
              
              emailsSent++;
              console.log(`         ✅ Reminder sent`);
            } catch (error) {
              console.error(`         ❌ Failed:`, error.message);
            }
          }
        }
        
        // ===== POST-OCCASION FEEDBACK: 2 days after =====
        else if (since === 2) {
          const alreadySent = await hasEmailBeenSent(
            recipient.id,
            occasion.type,
            'POST_OCCASION',
            currentYear
          );
          
          if (!alreadySent) {
            console.log(`         ✉️  Sending post-occasion feedback`);
            
            try {
              await sendOccasionEmail({
                to: recipient.subscriber.email,
                recipientName: recipient.name,
                subscriberName: recipient.subscriber.firstName || recipient.subscriber.name || 'there',
                occasionLabel,
                type: 'feedback'
              });
              
              await logEmailSend({
                subscriberId: recipient.subscriberId,  // FIX: Use subscriberId field
                recipientId: recipient.id,
                emailType: 'POST_OCCASION',
                occasionType: occasion.type,
                occasionYear: currentYear,
                occasionDate: occasion.date,
                status: 'SENT'
              });
              
              emailsSent++;
              console.log(`         ✅ Feedback request sent`);
            } catch (error) {
              console.error(`         ❌ Failed:`, error.message);
            }
          }
        }
      }
    }
    
    console.log(`\n   ✅ ${jobName} Complete: ${emailsSent} emails sent\n`);
    
  } catch (error) {
    console.error(`\n   ❌ ${jobName} Error:`, error);
  }
});

/**
 * Send occasion email using Resend
 */
async function sendOccasionEmail({ to, recipientName, subscriberName, occasionLabel, occasionDate, daysUntil, giftListId, type }) {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  let subject, heading, body;
  
  if (type === 'immediate') {
    const dateLabel = occasionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    subject = `${occasionLabel} Gift Ideas for ${recipientName} 🎁`;
    heading = `${occasionLabel} is coming up!`;
    body = `<p>Hi ${subscriberName},</p>
<p>${recipientName}'s ${occasionLabel.toLowerCase()} is coming up on ${dateLabel} — only ${daysUntil} days away!</p>
<p>I've curated a special collection of gift ideas based on what you've told me about ${recipientName}.</p>
<p style="margin:24px 0;"><a href="${APP_URL}/gifts/${giftListId}" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">View Gift Ideas →</a></p>
<p>All items are in stock and ready to order.</p>
<p>Gem<br/>You Remembered, by Gem</p>`;
  } else if (type === 'reminder') {
    const dateLabel = occasionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    subject = `Only 2 Weeks Until ${occasionLabel}! 🔔`;
    heading = `Two weeks to go`;
    body = `<p>Hi ${subscriberName},</p>
<p>Quick reminder — ${recipientName}'s ${occasionLabel.toLowerCase()} is just 2 weeks away on ${dateLabel}.</p>
<p>If you haven't ordered yet, now's the time to ensure delivery arrives on time.</p>
<p style="margin:24px 0;"><a href="${APP_URL}/gifts" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">View Your Gift Ideas →</a></p>
<p>Gem<br/>You Remembered, by Gem</p>`;
  } else if (type === 'feedback') {
    subject = `How Did ${occasionLabel} Go? 🎉`;
    heading = `How did it go?`;
    body = `<p>Hi ${subscriberName},</p>
<p>I hope ${recipientName} had a wonderful ${occasionLabel.toLowerCase()}!</p>
<p>I'd love to know — did you use any of the gift ideas I suggested? Your feedback helps me get even better at finding the perfect gifts.</p>
<p style="margin:24px 0;"><a href="${APP_URL}/feedback?recipient=${recipientName}" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">Share Feedback →</a></p>
<p>Thanks for trusting You Remembered by Gem!</p>
<p>Gem<br/>You Remembered, by Gem</p>`;
  }
  
  const html = wrapBrandedEmail(heading, body);
  
  // Check if emails enabled
  if (process.env.ENABLE_EMAILS !== 'true') {
    console.log(`         📧 [DISABLED] Would send: ${subject} to ${to}`);
    return;
  }
  
  try {
    await resend.emails.send({
      from: 'You Remembered, by Gem <concierge@yourememberedbygem.com>',
      to,
      subject,
      html
    });
  } catch (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}

/**
 * Branded email wrapper
 */
function wrapBrandedEmail(heading, innerHtml) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FDFAF5;">
<div style="max-width:520px;margin:0 auto;">
  <div style="background:#164E63;padding:28px 24px 22px;text-align:center;">
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#FDFAF5;margin:0;">You Remembered, <span style="font-style:italic;">by Gem</span></p>
  </div>
  <div style="height:4px;background:#C9A96E;"></div>
  <div style="padding:32px 24px;font-family:Arial,Helvetica,sans-serif;">
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#1a1a2e;margin:0 0 16px;">${heading}</h1>
    <div style="color:#1a1a2e;font-size:15px;line-height:1.6;">${innerHtml}</div>
  </div>
  <div style="height:1px;background:rgba(201,169,110,0.3);margin:0 24px;"></div>
  <div style="padding:16px 24px 32px;">
    <p style="font-size:12px;color:#1a1a2e;opacity:0.5;margin:0;">You Remembered, by Gem</p>
  </div>
</div>
</body></html>`;
}

console.log('✅ Daily Occasion Checker is running');
console.log('📅 Checking every 10 minutes');
console.log('📅 Press Ctrl+C to stop\n');
