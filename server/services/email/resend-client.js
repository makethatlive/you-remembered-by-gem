/**
 * Resend Email Client
 * 
 * Professional email service using Resend API
 * Handles transactional emails for the application
 */

import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';

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
 */
export async function sendWelcomeEmail(subscriberEmail, subscriberName, subscriberId) {
  const subject = '🎁 Welcome to You Remembered By Gem!';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D5C63; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
          .button { display: inline-block; background: #0D5C63; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎁 Welcome to You Remembered By Gem!</h1>
          </div>
          <div class="content">
            <p>Hi ${subscriberName || 'there'},</p>
            
            <p>Thank you for joining You Remembered By Gem! We're thrilled to help you find the perfect gifts for your loved ones.</p>
            
            <p><strong>What's next?</strong></p>
            <ul>
              <li>Add the important people in your life</li>
              <li>Tell us about their interests and preferences</li>
              <li>Let our AI find personalized gift suggestions</li>
              <li>Never miss a special occasion again!</li>
            </ul>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Get Started</a>
            
            <p>If you have any questions, just reply to this email - we're here to help!</p>
            
            <p>Best regards,<br>The Gem Team</p>
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
 */
export async function sendApprovalEmail(subscriberEmail, subscriberName, recipientName, giftCount, subscriberId, recipientId, giftListId) {
  const subject = `🎉 Your gift list for ${recipientName} is ready!`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0D5C63; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
          .button { display: inline-block; background: #D4AF37; color: #0D5C63; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .highlight { background: #FFF8E7; padding: 15px; border-left: 4px solid #D4AF37; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Your Gift List is Ready!</h1>
          </div>
          <div class="content">
            <p>Hi ${subscriberName || 'there'},</p>
            
            <p>Great news! We've curated ${giftCount} special gift suggestions for <strong>${recipientName}</strong>.</p>
            
            <div class="highlight">
              <p><strong>✨ Handpicked just for ${recipientName}</strong></p>
              <p>Our AI has selected gifts that match their personality, interests, and your budget.</p>
            </div>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/gifts" class="button">View Gift Suggestions</a>
            
            <p>You can review the suggestions, save your favorites, or request a refresh if you'd like different options.</p>
            
            <p>Happy gifting!<br>The Gem Team</p>
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
    await createEmailLog({
      subscriberId,
      recipientId: recipientId || null,
      giftListId: giftListId || null,
      emailType: 'THIRTY_DAY', // Using THIRTY_DAY as closest match for approval notification
      status: 'SENT',
    });
  }

  return result;
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
