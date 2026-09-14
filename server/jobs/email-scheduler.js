/**
 * Email Scheduler - Standalone Cron Jobs
 * 
 * Handles scheduled emails:
 * - Onboarding emails (30 min after signup)
 * - Birthday/occasion reminders (6 weeks, 2 weeks, post-occasion)
 * 
 * This replaces Base44 scheduled functions with native Node.js cron jobs
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendWelcomeEmail, sendApprovalEmail, sendBirthdayReminder } from '../services/email/resend-client.js';
import { startAutoGenerationJob } from './auto-gift-generation.js';

const prisma = new PrismaClient();

console.log('📅 ========================================');
console.log('📅 Email Scheduler Starting...');
console.log('📅 ========================================');

// Start Auto Gift Generation Job (runs daily at 9:00 AM)
startAutoGenerationJob();

/**
 * Onboarding Email Job
 * Runs every 10 minutes
 * Sends onboarding email to subscribers 30 minutes after signup
 */
cron.schedule('*/10 * * * *', async () => {
  const jobName = 'Onboarding Emails';
  console.log(`\n🔍 [${new Date().toISOString()}] ${jobName}: Checking...`);
  
  try {
    const now = new Date();
    const cutoff30min = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    // Find subscribers created between 30 minutes and 24 hours ago
    const subscribers = await prisma.subscriber.findMany({
      where: {
        createdAt: {
          gte: cutoff24h,
          lte: cutoff30min
        }
      }
    });
    
    console.log(`   Found ${subscribers.length} subscribers in 30min-24hr window`);
    
    let sent = 0;
    let skipped = 0;
    
    for (const subscriber of subscribers) {
      // Check if onboarding email already sent
      const existing = await prisma.emailLog.findFirst({
        where: {
          subscriberId: subscriber.id,
          emailType: 'ONBOARDING_REMINDER'
        }
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      console.log(`   📧 Sending onboarding email to ${subscriber.email}`);
      
      // Create onboarding email HTML
      const html = createOnboardingEmail(subscriber.firstName || subscriber.name || 'there');
      
      // Send email
      const result = await sendEmail({
        to: subscriber.email,
        subject: 'Now, tell me about the people who matter most to you 🎁',
        html
      });
      
      if (result.success && !result.disabled) {
        // Log the email
        await prisma.emailLog.create({
          data: {
            subscriberId: subscriber.id,
            emailType: 'ONBOARDING_REMINDER',
            sentAt: new Date(),
            status: 'SENT'
          }
        });
        
        sent++;
        console.log(`   ✅ Sent to ${subscriber.email}`);
      } else {
        console.log(`   ⚠️  Failed to send to ${subscriber.email}: ${result.error || 'Unknown error'}`);
      }
    }
    
    console.log(`✅ [${jobName}] Complete: ${sent} sent, ${skipped} skipped`);
    
  } catch (error) {
    console.error(`❌ [${jobName}] Error:`, error);
  }
});

/**
 * Birthday/Occasion Reminder Job
 * Runs daily at 9:00 AM
 * Sends 6-week, 2-week, and post-occasion reminders
 */
cron.schedule('0 9 * * *', async () => {
  const jobName = 'Birthday Reminders';
  console.log(`\n🔍 [${new Date().toISOString()}] ${jobName}: Checking...`);
  
  try {
    const recipients = await prisma.recipient.findMany({
      include: {
        subscriber: true
      }
    });
    
    console.log(`   Found ${recipients.length} recipients to check`);
    
    const today = new Date();
    const currentYear = today.getFullYear();
    let sent = 0;
    
    for (const recipient of recipients) {
      if (!recipient.birthday) continue;
      
      // Parse birthday (format: --MM-DD or YYYY-MM-DD)
      const birthdayMatch = recipient.birthday.match(/(\d{2})-(\d{2})$/);
      if (!birthdayMatch) continue;
      
      const [_, month, day] = birthdayMatch;
      const birthdayThisYear = new Date(currentYear, parseInt(month) - 1, parseInt(day));
      birthdayThisYear.setHours(0, 0, 0, 0);
      
      const todayNormalized = new Date(today);
      todayNormalized.setHours(0, 0, 0, 0);
      
      // Calculate days until birthday
      const diffTime = birthdayThisYear - todayNormalized;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      // Check for: 6-week (42 days), 2-week (14 days), or 2 days after (-2)
      let emailType = null;
      let emailSubject = null;
      let emailHtml = null;
      
      if (diffDays === 42) {
        emailType = 'SIX_WEEK_REMINDER';
        emailSubject = `It's nearly time to find something special for ${recipient.name} 🎁`;
        emailHtml = createSixWeekReminderEmail(
          recipient.subscriber.firstName || recipient.subscriber.name || 'there',
          recipient.name,
          birthdayThisYear,
          recipient
        );
      } else if (diffDays === 14) {
        emailType = 'TWO_WEEK_REMINDER';
        emailSubject = `A quick nudge — ${recipient.name}'s ${recipient.occasion || 'occasion'} is in 2 weeks 🔔`;
        emailHtml = createTwoWeekReminderEmail(
          recipient.subscriber.firstName || recipient.subscriber.name || 'there',
          recipient.name,
          recipient.occasion || 'occasion',
          birthdayThisYear
        );
      } else if (diffDays === -2) {
        emailType = 'POST_OCCASION';
        emailSubject = 'How did it go? 🎉';
        emailHtml = createPostOccasionEmail(
          recipient.subscriber.firstName || recipient.subscriber.name || 'there',
          recipient.name,
          recipient.occasion || 'occasion'
        );
      } else {
        continue; // Not a reminder day
      }
      
      // Check if already sent this year
      const existing = await prisma.emailLog.findFirst({
        where: {
          recipientId: recipient.id,
          emailType: emailType,
          occasionYear: currentYear
        }
      });
      
      if (existing) {
        continue; // Already sent
      }
      
      console.log(`   📧 Sending ${emailType} for ${recipient.name} to ${recipient.subscriber.email}`);
      
      // Send email
      const result = await sendEmail({
        to: recipient.subscriber.email,
        subject: emailSubject,
        html: emailHtml
      });
      
      if (result.success && !result.disabled) {
        // Log the email
        await prisma.emailLog.create({
          data: {
            subscriberId: recipient.subscriber.id,
            recipientId: recipient.id,
            emailType: emailType,
            occasionYear: currentYear,
            sentAt: new Date(),
            status: 'SENT'
          }
        });
        
        sent++;
        console.log(`   ✅ Sent ${emailType} for ${recipient.name}`);
      } else {
        console.log(`   ⚠️  Failed to send ${emailType} for ${recipient.name}`);
      }
    }
    
    console.log(`✅ [${jobName}] Complete: ${sent} sent`);
    
  } catch (error) {
    console.error(`❌ [${jobName}] Error:`, error);
  }
});

/**
 * Helper: Send email wrapper with retry
 */
async function sendEmail({ to, subject, html }) {
  // Use the Resend client
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  if (process.env.ENABLE_EMAILS !== 'true') {
    console.log(`   📧 [DISABLED] Would send: ${subject} to ${to}`);
    return { success: true, disabled: true };
  }
  
  try {
    const response = await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME || 'You Remembered By Gem'} <${process.env.RESEND_FROM_EMAIL || 'noreply@yourememberedbygem.com'}>`,
      to,
      subject,
      html
    });
    
    return { success: true, id: response.id };
  } catch (error) {
    console.error(`   ❌ Email send error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Email Templates
 */

function createOnboardingEmail(name) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FDFAF5;">
<div style="max-width:520px;margin:0 auto;">
  <div style="background:#164E63;padding:28px 24px 22px;text-align:center;">
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#FDFAF5;margin:0;">You Remembered, <span style="font-style:italic;">by Gem</span></p>
  </div>
  <div style="height:4px;background:#C9A96E;"></div>
  <div style="padding:32px 24px;font-family:Arial,Helvetica,sans-serif;">
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#1a1a2e;margin:0 0 16px;">Now for the fun part</h1>
    <div style="color:#1a1a2e;font-size:15px;line-height:1.6;">
      <p>Hi ${name},</p>
      <p>You're all set up — now the fun part.</p>
      <p>Head to your dashboard and add the people you'd like me to remember. For each person, I'll ask a few simple questions: their relationship to you, their age, their upcoming occasion, their interests, and your budget. The more detail you give me, the more personal your gift ideas will be.</p>
      <p style="margin:24px 0;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/people" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">Add your people →</a></p>
      <p>You can add up to 10 people and come back to update their profiles any time.</p>
      <p>Gem<br/>You Remembered, by Gem</p>
    </div>
  </div>
  <div style="height:1px;background:rgba(201,169,110,0.3);margin:0 24px;"></div>
  <div style="padding:16px 24px 32px;">
    <p style="font-size:12px;color:#1a1a2e;opacity:0.5;margin:0;">You Remembered, by Gem</p>
  </div>
</div>
</body></html>`;
}

function createSixWeekReminderEmail(subscriberName, recipientName, occasionDate, recipient) {
  const dateLabel = `${occasionDate.getDate()} ${['January','February','March','April','May','June','July','August','September','October','November','December'][occasionDate.getMonth()]}`;
  const occasion = recipient.occasion || 'occasion';
  
  // Calculate gift ideas date (4 weeks before = 28 days before)
  const giftIdeasDate = new Date(occasionDate);
  giftIdeasDate.setDate(giftIdeasDate.getDate() - 28);
  const giftIdeasLabel = `${giftIdeasDate.getDate()} ${['January','February','March','April','May','June','July','August','September','October','November','December'][giftIdeasDate.getMonth()]}`;
  
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FDFAF5;">
<div style="max-width:520px;margin:0 auto;">
  <div style="background:#164E63;padding:28px 24px 22px;text-align:center;">
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#FDFAF5;margin:0;">You Remembered, <span style="font-style:italic;">by Gem</span></p>
  </div>
  <div style="height:4px;background:#C9A96E;"></div>
  <div style="padding:32px 24px;font-family:Arial,Helvetica,sans-serif;">
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#1a1a2e;margin:0 0 16px;">Six weeks to go</h1>
    <div style="color:#1a1a2e;font-size:15px;line-height:1.6;">
      <p>Hi ${subscriberName},</p>
      <p>${recipientName}'s ${occasion} is coming up on ${dateLabel} — which means it's time to start finding something truly special for them.</p>
      <p>Here's what I've got noted down for ${recipientName} so far — have a quick look and see if anything's changed:</p>
      <p><strong>Does anything need updating?</strong><br/>Life moves fast — and the best gift ideas often come from small details. Has anything changed recently? A new hobby? A big life moment? Something they've mentioned wanting?</p>
      <p style="margin:24px 0;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/people?edit=${recipient.id}" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">Update ${recipientName}'s profile →</a></p>
      <p>If everything looks good and you're happy for me to go ahead, you don't need to do a thing.</p>
      <p>Your gift ideas will land in your inbox on ${giftIdeasLabel}.</p>
      <p>Gem<br/>You Remembered, by Gem<br/>yourememberedbygem.com<br/>@yourememberedbygem</p>
    </div>
  </div>
  <div style="height:1px;background:rgba(201,169,110,0.3);margin:0 24px;"></div>
  <div style="padding:16px 24px 32px;">
    <p style="font-size:12px;color:#1a1a2e;opacity:0.5;margin:0;">You Remembered, by Gem</p>
    <p style="font-size:11px;color:#1a1a2e;opacity:0.4;margin:8px 0 0;">You're receiving this because ${recipientName}'s ${occasion} is coming up. To manage your account or unsubscribe, click <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color:#164E63;">here</a>.</p>
  </div>
</div>
</body></html>`;
}

function createTwoWeekReminderEmail(subscriberName, recipientName, occasion, occasionDate) {
  const dateLabel = `${occasionDate.getDate()} ${['January','February','March','April','May','June','July','August','September','October','November','December'][occasionDate.getMonth()]}`;
  
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FDFAF5;">
<div style="max-width:520px;margin:0 auto;">
  <div style="background:#164E63;padding:28px 24px 22px;text-align:center;">
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#FDFAF5;margin:0;">You Remembered, <span style="font-style:italic;">by Gem</span></p>
  </div>
  <div style="height:4px;background:#C9A96E;"></div>
  <div style="padding:32px 24px;font-family:Arial,Helvetica,sans-serif;">
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#1a1a2e;margin:0 0 16px;">Two weeks to go</h1>
    <div style="color:#1a1a2e;font-size:15px;line-height:1.6;">
      <p>Hi ${subscriberName},</p>
      <p>Just a quick one — ${recipientName}'s ${occasion} is two weeks away, on ${dateLabel}. I know life is busy, so this is just a gentle reminder to make sure the gift ideas I sent over weren't missed.</p>
      <p>Here they are again, ready when you are:</p>
      <p style="margin:24px 0;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/gifts" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">View ${recipientName}'s gift ideas →</a></p>
      <p><strong>Not quite right?</strong><br/>If none of these feel like the one, just email me directly at concierge@yourememberedbygem.com with a little more detail on ${recipientName} and I'll personally look for alternatives — there's still time.</p>
      <p><strong>A gentle note on timing:</strong><br/>Most retailers can deliver within a week, so there's still time to order comfortably — just worth not leaving it much longer if you'd like anything personalised.</p>
      <p>Here if you need me,</p>
      <p>Gem<br/>You Remembered, by Gem<br/>yourememberedbygem.com<br/>@yourememberedbygem</p>
    </div>
  </div>
  <div style="height:1px;background:rgba(201,169,110,0.3);margin:0 24px;"></div>
  <div style="padding:16px 24px 32px;">
    <p style="font-size:12px;color:#1a1a2e;opacity:0.5;margin:0;">You Remembered, by Gem</p>
    <p style="font-size:11px;color:#1a1a2e;opacity:0.4;margin:8px 0 0;">You're receiving this as part of your You Remembered, by Gem subscription. To manage your account or unsubscribe, click <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color:#164E63;">here</a>.</p>
  </div>
</div>
</body></html>`;
}

function createPostOccasionEmail(subscriberName, recipientName, occasion) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FDFAF5;">
<div style="max-width:520px;margin:0 auto;">
  <div style="background:#164E63;padding:28px 24px 22px;text-align:center;">
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#FDFAF5;margin:0;">You Remembered, <span style="font-style:italic;">by Gem</span></p>
  </div>
  <div style="height:4px;background:#C9A96E;"></div>
  <div style="padding:32px 24px;font-family:Arial,Helvetica,sans-serif;">
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#1a1a2e;margin:0 0 16px;">How did it go?</h1>
    <div style="color:#1a1a2e;font-size:15px;line-height:1.6;">
      <p>Hi ${subscriberName},</p>
      <p>${recipientName}'s ${occasion} was 2 days ago — and I've been thinking about you.</p>
      <p><strong>Did the gift land well?</strong></p>
      <p>I ask partly because I genuinely want to know, and partly because your feedback makes next year's suggestions even better. It only takes a minute — just tap below:</p>
      <p style="margin:24px 0;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/feedback?recipient=${recipientName}" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">Share how it went →</a></p>
      <p>You'll be able to tell me whether you went with one of my suggestions, how ${recipientName} reacted, and anything that didn't feel quite right — all of which helps me get next year's ideas even closer to perfect.</p>
      <p><strong>One small favour</strong><br/>If You Remembered, by Gem made a difference — if it saved you time, helped you give something truly thoughtful, or simply meant you didn't have to panic — I'd be so grateful if you'd share it with one person who might love it too.</p>
      <p>A personal recommendation from you means more than any advertising I could ever do. And if they subscribe, I'll add an extra bonus gift consultation to your account as a thank you.</p>
      <p style="margin:24px 0;"><a href="https://yourememberedbygem.com" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">Share You Remembered, by Gem →</a></p>
      <p>And if anything didn't hit the mark this time, please tell me. This is a personal service and I'd rather know — it's the only way to make sure next year is even better.</p>
      <p>Gem<br/>You Remembered, by Gem<br/>yourememberedbygem.com<br/>@yourememberedbygem</p>
    </div>
  </div>
  <div style="height:1px;background:rgba(201,169,110,0.3);margin:0 24px;"></div>
  <div style="padding:16px 24px 32px;">
    <p style="font-size:12px;color:#1a1a2e;opacity:0.5;margin:0;">You Remembered, by Gem</p>
    <p style="font-size:11px;color:#1a1a2e;opacity:0.4;margin:8px 0 0;">You're receiving this as part of your You Remembered, by Gem subscription. To manage your account or unsubscribe, click <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color:#164E63;">here</a>.</p>
  </div>
</div>
</body></html>`;
}

// Start message
console.log('✅ Email scheduler is running');
console.log('📅 Onboarding emails: every 10 minutes');
console.log('📅 Birthday reminders: daily at 9:00 AM');
console.log('📅 Auto gift generation: daily at 9:00 AM');
console.log('📅 Press Ctrl+C to stop\n');
