/**
 * Resend Email Client
 * 
 * Professional email service using Resend API
 * Handles transactional emails for the application
 */

import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';
import { welcomeEmail } from './email-template.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const prisma = new PrismaClient();

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@yourememberedbygem.com';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'You Remembered By Gem';

/**
 * Create email log in database
 * @param {Object} logData - Email log data
 */
async function createEmailLog(logData) {
  try {
    await prisma.emailLog.create({
      data: {
        subscriberId: logData.subscriberId,
        recipientId: logData.recipientId || null,
        giftListId: logData.giftListId || null,
        emailType: logData.emailType,
        occasionYear: logData.occasionYear || null,
        sentAt: new Date(),
        status: logData.status || 'SENT',
      },
    });
  } catch (error) {
    console.error('❌ Error creating email log:', error);
    // Don't throw - email log failure shouldn't break email sending
  }
}

/**
 * Send an email using Resend
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @param {string} options.text - Plain text email content (optional)
 * @returns {Promise<Object>} Resend response
 */
export async function sendEmail({ to, subject, html, text }) {
  // Check if emails are enabled
  if (process.env.ENABLE_EMAILS !== 'true') {
    console.log(`📧 [DISABLED] Would send email to ${to}: ${subject}`);
    console.log(`ℹ️  Email sending is disabled. Set ENABLE_EMAILS="true" in .env to enable.`);
    return {
      success: true,
      disabled: true,
      message: 'Email sending is disabled via ENABLE_EMAILS environment variable',
    };
  }

  try {
    console.log(`📧 Sending email to ${to}: ${subject}`);
    
    const response = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: text || stripHtml(html),
    });

    console.log(`✅ Email sent successfully:`, response);
    return {
      success: true,
      id: response.id,
      data: response,
    };
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Simple HTML stripper for plain text fallback
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Send welcome email to new subscriber
 * Uses branded template matching base44 original + client spec
 */
export async function sendWelcomeEmail(subscriberEmail, subscriberName, subscriberId) {
  // Check if welcome email already sent to this EMAIL (deduplication)
  try {
    // Find any subscriber with this email
    const subscriber = await prisma.subscriber.findFirst({
      where: { email: subscriberEmail },
      include: {
        emailLogs: {
          where: { emailType: 'WELCOME' },
          take: 1
        }
      }
    });
    
    if (subscriber && subscriber.emailLogs.length > 0) {
      console.log(`ℹ️  Welcome email already sent to ${subscriberEmail}, skipping`);
      return {
        success: true,
        skipped: true,
        reason: 'already_sent'
      };
    }
  } catch (error) {
    console.error('Error checking email log:', error);
    // Continue anyway - better to send duplicate than not send at all
  }
  
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`;
  const emailData = welcomeEmail({ firstName: subscriberName, email: subscriberEmail }, dashboardUrl);

  const result = await sendEmail({
    to: subscriberEmail,
    subject: emailData.subject,
    html: emailData.html,
  });

  // Create email log
  if (result.success && !result.disabled && subscriberId) {
    await createEmailLog({
      subscriberId,
      emailType: 'WELCOME',
      status: 'SENT',
    });
  }

  return result;
}

/**
 * Send gift list approval notification
 * Matches client's Email #4 template exactly
 */
export async function sendApprovalEmail(subscriberEmail, subscriberName, recipientName, giftCount, subscriberId, recipientId, giftListId) {
  try {
    // Fetch complete data for email
    const giftList = await prisma.giftList.findUnique({
      where: { id: giftListId },
      include: {
        recipient: true,
        subscriber: true
      }
    });

    if (!giftList) {
      console.error('Gift list not found:', giftListId);
      return { success: false, error: 'Gift list not found' };
    }

    // Fetch gift items (ACTIVE only, top 5)
    const giftItems = await prisma.giftItem.findMany({
      where: {
        giftListId: giftListId,
        status: 'ACTIVE'
      },
      take: 5,
      orderBy: { createdAt: 'asc' }
    });

    const recipient = giftList.recipient;
    const occasion = (recipient?.occasion || 'occasion').toLowerCase();
    
    // Format occasion date
    const formatOccasionDate = (date) => {
      if (!date) return 'coming up soon';
      const d = new Date(date);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
      return `${d.getDate()} ${months[d.getMonth()]}`;
    };

    const occasionDate = formatOccasionDate(giftList.birthdayDate);
    
    // Build recipient summary from their profile
    const buildRecipientSummary = (recipient) => {
      const parts = [];
      if (recipient.whoTheyAre) parts.push(recipient.whoTheyAre);
      if (recipient.hobbiesAndInterests) parts.push(recipient.hobbiesAndInterests);
      if (recipient.interests && recipient.interests.length > 0) {
        parts.push(`who loves ${recipient.interests.slice(0, 2).join(' and ')}`);
      }
      if (recipient.thingsYouKnow) parts.push(recipient.thingsYouKnow);
      
      return parts.length > 0 
        ? parts.join(', ').substring(0, 150) 
        : 'someone truly special';
    };

    const recipientSummary = buildRecipientSummary(recipient);
    
    // Format budget
    const formatBudget = (min, max) => {
      if (!min && !max) return '';
      return `£${min || 0}–£${max || 100}`;
    };
    
    const budgetText = formatBudget(recipient?.budgetMin, recipient?.budgetMax);
    
    // Build individual gift HTML matching client template
    const renderGiftItems = (items) => {
      return items.map((item, index) => {
        const retailer = item.retailerName || 'the retailer';
        const price = item.price ? `£${parseFloat(item.price).toFixed(2)}` : '£0.00';
        const productLink = item.affiliateUrl || item.productUrl || '#';
        const reasoning = item.whyThisGift || item.description || '';
        
        return `
          <div style="margin: 0 0 28px 0;">
            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; font-size: 16px; font-weight: 700;">
              ${index + 1}. ${item.title}
            </p>
            <p style="margin: 6px 0 0; color: #164E63; font-size: 14px; font-weight: 600;">
              ${retailer} — ${price}
            </p>
            ${reasoning ? `
            <p style="margin: 10px 0 0; color: #1a1a2e; opacity: 0.85; font-size: 15px; line-height: 1.6;">
              ${reasoning}
            </p>
            ` : ''}
            <p style="margin: 12px 0 0;">
              <a href="${productLink}" 
                 style="color: #164E63; font-size: 14px; font-weight: 600; text-decoration: underline;"
                 target="_blank" rel="noopener noreferrer">
                View at ${retailer} →
              </a>
            </p>
          </div>
        `;
      }).join('');
    };

    const giftsHtml = renderGiftItems(giftItems);
    const relationship = recipient?.relationship || 'person';
    
    // Client template exact match
    const subject = `Five ideas for ${recipientName}'s ${occasion} — chosen just for them ✨`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              margin: 0; 
              padding: 0; 
              background: #FDFAF5; 
              font-family: Arial, Helvetica, sans-serif;
            }
            .container { max-width: 560px; margin: 0 auto; }
            .header { 
              background: #164E63; 
              padding: 28px 24px 22px; 
              text-align: center; 
            }
            .header-title {
              font-family: 'Cormorant Garamond', Georgia, serif;
              font-size: 26px;
              color: #FDFAF5;
              margin: 0;
            }
            .divider { height: 4px; background: #C9A96E; }
            .content { 
              padding: 32px 24px; 
              color: #1a1a2e; 
              font-size: 15px; 
              line-height: 1.6; 
            }
            .content h1 {
              font-family: 'Cormorant Garamond', Georgia, serif;
              font-size: 22px;
              color: #1a1a2e;
              margin: 0 0 16px;
            }
            .section-title {
              font-family: 'Cormorant Garamond', Georgia, serif;
              font-size: 19px;
              color: #1a1a2e;
              margin: 32px 0 20px;
            }
            .footer-divider { 
              height: 1px; 
              background: rgba(201, 169, 110, 0.3); 
              margin: 0 24px; 
            }
            .footer { padding: 16px 24px 32px; }
            .footer-text {
              font-size: 12px;
              color: #1a1a2e;
              opacity: 0.5;
              margin: 0;
            }
            .footer-note {
              font-size: 11px;
              color: #1a1a2e;
              opacity: 0.4;
              margin: 8px 0 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <p class="header-title">
                You Remembered, <span style="font-style: italic;">by Gem</span>
              </p>
            </div>
            <div class="divider"></div>
            
            <!-- Content -->
            <div class="content">
              <h1>Chosen just for them</h1>
              
              <p>Hi ${subscriberName || 'there'},</p>
              
              <p>${recipientName}'s ${occasion} is on <strong>${occasionDate}</strong> — so here are five ideas I've chosen with them specifically in mind.</p>
              
              <p>Each one reflects what you've told me about them: ${recipientSummary}.${budgetText ? ` I've kept everything within your ${budgetText} budget.` : ''}</p>
              
              <p>Take your time browsing — every link goes directly to the retailer.</p>
              
              <p class="section-title">Five ideas for ${recipientName}</p>
              
              ${giftsHtml}
              
              <p style="margin: 32px 0 0;"><strong>A thought before you buy</strong></p>
              <p>These are five ideas I genuinely think ${recipientName} would love — but you'll always know your ${relationship} better than I do. Have a browse through what I've suggested, and if something's not quite right — a different colour, a slightly different style — feel free to have a look around the retailer's site for an alternative. Spending just a few minutes tailoring my suggestions to what you know about them will make the end result even more perfect.</p>
              
              <p style="margin: 24px 0 0;"><strong>Not quite right?</strong></p>
              <p>If none of these feel quite right, just email me directly at <a href="mailto:concierge@yourememberedbygem.com" style="color: #164E63; text-decoration: underline;">concierge@yourememberedbygem.com</a> with a little more detail on ${recipientName} — anything at all that might help — and I'll personally look for alternatives. That's genuinely what I'm here for.</p>
              
              <p style="margin: 24px 0 0;"><strong>Worth knowing:</strong></p>
              <p>Most retailers can deliver within a week, so if something needs a personal touch added — engraving, wrapping, a handwritten note — it's worth ordering in good time.</p>
              
              <p style="margin: 32px 0 8px;">Enjoy giving,</p>
              <p style="margin: 0;">Gem</p>
              <p style="margin: 4px 0 0; font-size: 13px; color: #1a1a2e; opacity: 0.7;">
                You Remembered, by Gem<br>
                yourememberedbygem.com<br>
                @yourememberedbygem
              </p>
            </div>
            
            <!-- Footer -->
            <div class="footer-divider"></div>
            <div class="footer">
              <p class="footer-text">You Remembered, by Gem</p>
              <p class="footer-note">
                You're receiving this as part of your You Remembered, by Gem subscription. 
                To update ${recipientName}'s profile for next year, visit 
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/people?edit=${recipientId}" style="color: #164E63;">this link</a>. 
                To manage your account or unsubscribe, click 
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color: #164E63;">here</a>.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await sendEmail({
      to: subscriberEmail,
      subject,
      html,
    });

    // Create email log
    if (result.success && !result.disabled && subscriberId) {
      await createEmailLog({
        subscriberId,
        recipientId: recipientId || null,
        giftListId: giftListId || null,
        emailType: 'THIRTY_DAY',
        status: 'SENT',
      });
    }

    return result;
  } catch (error) {
    console.error('Error in sendApprovalEmail:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send birthday reminder email
 */
export async function sendBirthdayReminder(subscriberEmail, subscriberName, recipientName, daysUntil, subscriberId, recipientId) {
  const subject = `🎂 ${recipientName}'s birthday is ${daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`}!`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #D4AF37; color: #0D5C63; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
          .button { display: inline-block; background: #0D5C63; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .reminder-box { background: #FFF8E7; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎂 Birthday Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${subscriberName || 'there'},</p>
            
            <div class="reminder-box">
              <h2 style="margin: 0 0 10px 0; color: #0D5C63;">
                ${recipientName}'s birthday is ${daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`}!
              </h2>
            </div>
            
            <p>Don't forget to check out the gift suggestions we've prepared for ${recipientName}.</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/gifts" class="button">View Gift Ideas</a>
            
            <p>Need something last-minute? We've got you covered with gifts that can be delivered quickly!</p>
            
            <p>Best wishes,<br>The Gem Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} You Remembered By Gem. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const result = await sendEmail({
    to: subscriberEmail,
    subject,
    html,
  });

  // Create email log
  if (result.success && !result.disabled && subscriberId) {
    const occasionYear = new Date().getFullYear();
    const emailType = daysUntil === 0 ? 'POST_BIRTHDAY_FEEDBACK' : 
                      daysUntil <= 7 ? 'SEVEN_DAY' : 
                      daysUntil <= 14 ? 'FOURTEEN_DAY' : 'THIRTY_DAY';
    
    await createEmailLog({
      subscriberId,
      recipientId: recipientId || null,
      emailType,
      occasionYear,
      status: 'SENT',
    });
  }

  return result;
}

export default {
  sendEmail,
  sendWelcomeEmail,
  sendApprovalEmail,
  sendBirthdayReminder,
};
