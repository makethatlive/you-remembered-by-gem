/**
 * Branded Email Templates
 * Theme-based email wrapper matching "You Remembered by Gem" brand
 */

/**
 * Escape HTML to prevent XSS in user-controlled text
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

/**
 * Brand Theme Colors (from base44 original)
 */
const THEME = {
  // Deep Teal (header background, buttons)
  primary: '#164E63',
  
  // Gold (divider line, accents)
  accent: '#C9A96E',
  
  // Cream (body background)
  background: '#FDFAF5',
  
  // Dark text
  text: '#1a1a2e',
};

/**
 * Wrap email content in branded theme
 * @param {string} heading - Email heading
 * @param {string} innerHtml - Email body HTML
 * @param {string} footerNote - Optional footer note
 * @returns {string} Complete HTML email
 */
export function wrapBrandedEmail(heading, innerHtml, footerNote = '') {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:${THEME.background};">
<div style="max-width:520px;margin:0 auto;">
  <!-- Header with brand name -->
  <div style="background:${THEME.primary};padding:28px 24px 22px;text-align:center;">
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:${THEME.background};margin:0;">
      You Remembered, <span style="font-style:italic;">by Gem</span>
    </p>
  </div>
  
  <!-- Gold divider -->
  <div style="height:4px;background:${THEME.accent};"></div>
  
  <!-- Main content area -->
  <div style="padding:32px 24px;font-family:Arial,Helvetica,sans-serif;">
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:${THEME.text};margin:0 0 16px;">
      ${heading}
    </h1>
    <div style="color:${THEME.text};font-size:15px;line-height:1.6;">
      ${innerHtml}
    </div>
  </div>
  
  <!-- Subtle divider -->
  <div style="height:1px;background:rgba(201,169,110,0.3);margin:0 24px;"></div>
  
  <!-- Footer -->
  <div style="padding:16px 24px 32px;">
    <p style="font-size:12px;color:${THEME.text};opacity:0.5;margin:0;">
      You Remembered, by Gem
    </p>
    ${footerNote ? `<p style="font-size:11px;color:${THEME.text};opacity:0.4;margin:8px 0 0;">${footerNote}</p>` : ''}
  </div>
</div>
</body>
</html>`;
}

/**
 * Create a branded CTA button
 * @param {string} label - Button text
 * @param {string} href - Button URL
 * @returns {string} Button HTML
 */
export function ctaButton(label, href) {
  return `<p style="margin:24px 0;">
    <a href="${href}" style="background:${THEME.primary};color:${THEME.background};text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">
      ${label}
    </a>
  </p>`;
}

/**
 * Password Reset Email Template
 * @param {object} user - User object
 * @param {string} resetUrl - Password reset URL
 * @returns {object} Email data (subject, html)
 */
export function passwordResetEmail(user, resetUrl) {
  const greetName = escapeHtml(user.firstName || user.first_name || 'there');
  
  const innerHtml = `
    <p>Hi ${greetName},</p>
    <p>We received a request to reset your password for your You Remembered by Gem account.</p>
    <p>Click the button below to reset your password:</p>
    ${ctaButton('Reset Password', resetUrl)}
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: ${THEME.primary}; font-size: 13px;">
      ${resetUrl}
    </p>
    <p><strong>This link will expire in 1 hour.</strong></p>
    <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    <p>Best regards,<br/>The You Remembered by Gem Team</p>
  `;

  return {
    subject: '🔐 Reset Your Password',
    html: wrapBrandedEmail('Password Reset Request', innerHtml),
  };
}

/**
 * Email Verification Template
 * @param {object} user - User object
 * @param {string} verificationUrl - Verification URL
 * @returns {object} Email data (subject, html)
 */
export function emailVerificationEmail(user, verificationUrl) {
  const greetName = escapeHtml(user.firstName || user.first_name || 'there');
  
  const innerHtml = `
    <p>Hi ${greetName},</p>
    <p>Welcome to You Remembered by Gem! Please verify your email address to get started.</p>
    ${ctaButton('Verify Email', verificationUrl)}
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: ${THEME.primary}; font-size: 13px;">
      ${verificationUrl}
    </p>
    <p>If you didn't create an account, you can safely ignore this email.</p>
    <p>Best regards,<br/>The You Remembered by Gem Team</p>
  `;

  return {
    subject: '✉️ Verify Your Email Address',
    html: wrapBrandedEmail('Verify Your Email', innerHtml),
  };
}

/**
 * Welcome Email Template
 * @param {object} user - User object
 * @param {string} dashboardUrl - Dashboard URL
 * @returns {object} Email data (subject, html)
 */
export function welcomeEmail(user, dashboardUrl) {
  const greetName = escapeHtml(user.firstName || user.first_name || 'there');
  
  const footerNote = `You're receiving this because you recently subscribed to You Remembered, by Gem. To manage your account or unsubscribe, click <a href="${dashboardUrl}" style="color:#164E63;">here</a>.`;
  
  const innerHtml = `
    <p>Hi ${greetName},</p>
    
    <p>Welcome — and thank you for subscribing to You Remembered, by Gem. I'm genuinely delighted you're here.</p>
    
    <p>Here's the simple promise I'm making to you: you will never again forget someone who matters, or find yourself scrambling for a last-minute gift that doesn't really say what you wanted it to say.</p>
    
    <p>From now on, I've got that covered.</p>
    
    <p><strong>Here's how it works:</strong></p>
    
    <p><strong>1. Add your people</strong><br/>
    Log in and complete a profile for everyone you'd like to remember — up to 10 people. Add as much or as little detail as you like right now. The more you tell me, the better your ideas will be — but even the basics are enough to get started.</p>
    
    ${ctaButton('Add your people →', dashboardUrl)}
    
    <p><strong>2. Relax</strong><br/>
    Six weeks before each occasion, I'll email you to check in and give you a chance to add any fresh detail — a new hobby, a recent life moment, anything that might shape the perfect gift.</p>
    
    <p><strong>3. Receive five beautiful ideas</strong><br/>
    Four weeks before the occasion, five carefully chosen gift ideas land in your inbox — each one selected with that specific person in mind, with a direct link to buy. No faff, no generic suggestions, no last-minute panic.</p>
    
    <p>That's it.</p>
    
    <p><strong>And one more thing — your three bonus gift consultations</strong><br/>
    Life doesn't only happen on birthdays. As part of your subscription you have three bonus gift consultations each year — for a wedding, a new baby, a graduation, a first home, a new job, or simply a moment that deserves to be marked properly. Just drop me an email and I'll come back to you with five ideas. Think of them as your secret weapon for every unexpected celebration.</p>
    
    <p><strong>A note from me</strong><br/>
    You Remembered, by Gem is a personal service — there's a real human behind every set of recommendations. Profile updates, budgets, and adding new people are all quick to do any time in your account — just log in and edit directly. But if anything isn't working, or something doesn't feel right, email me directly and I'll come straight back to you.</p>
    
    <p>I'm so glad you've trusted me with the people who matter most to you.</p>
    
    <p>Gem<br/>
    You Remembered, by Gem<br/>
    yourememberedbygem.com<br/>
    @yourememberedbygem</p>
  `;

  return {
    subject: 'Welcome to You Remembered, by Gem — let's get started ✨',
    html: wrapBrandedEmail('Welcome', innerHtml, footerNote),
  };
}

