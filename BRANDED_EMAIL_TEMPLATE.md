# Branded Email Templates - "You Remembered by Gem"

**Date:** 2026-09-10  
**Source:** Extracted from base44 original email functions

---

## 🎨 **BRAND THEME:**

### **Colors:**

```javascript
{
  primary: '#164E63',      // Deep Teal (header, buttons)
  accent: '#C9A96E',       // Gold (divider, accents)
  background: '#FDFAF5',   // Cream (body background)
  text: '#1a1a2e',         // Dark text
}
```

### **Color Names:**
- **Deep Teal** - Header background, CTA buttons
- **Gold** - Divider line, link colors
- **Cream** - Email body background
- **Dark Charcoal** - Main text color

---

## 📧 **EMAIL STRUCTURE:**

```
┌─────────────────────────────────────┐
│  DEEP TEAL HEADER (#164E63)        │
│  "You Remembered, by Gem"           │
│  (Cormorant Garamond font)          │
├─────────────────────────────────────┤
│  GOLD DIVIDER (#C9A96E) - 4px      │
├─────────────────────────────────────┤
│                                      │
│  CREAM BACKGROUND (#FDFAF5)         │
│                                      │
│  Heading (Cormorant Garamond)       │
│                                      │
│  Body content (Arial)                │
│                                      │
│  CTA Button (Deep Teal)              │
│                                      │
├─────────────────────────────────────┤
│  SUBTLE DIVIDER (Gold 30% opacity)  │
├─────────────────────────────────────┤
│  Footer text                         │
└─────────────────────────────────────┘
```

---

## 📝 **TYPOGRAPHY:**

### **Header Brand Name:**
- **Font:** 'Cormorant Garamond', Georgia, serif
- **Size:** 26px
- **Color:** Cream (#FDFAF5)
- **Style:** Italic on "by Gem"

### **Email Heading:**
- **Font:** 'Cormorant Garamond', Georgia, serif
- **Size:** 22px
- **Color:** Dark text (#1a1a2e)

### **Body Text:**
- **Font:** Arial, Helvetica, sans-serif
- **Size:** 15px
- **Line Height:** 1.6
- **Color:** Dark text (#1a1a2e)

### **CTA Button:**
- **Font:** Arial, Helvetica, sans-serif
- **Size:** 14px
- **Weight:** 600 (semi-bold)
- **Background:** Deep Teal (#164E63)
- **Text Color:** Cream (#FDFAF5)
- **Border Radius:** 999px (pill shape)
- **Padding:** 13px 28px

---

## 🎯 **BEFORE vs AFTER:**

### **Before (Generic Purple):**
```css
Header: No branded header
Button: #7c3aed (Purple)
Background: White
Font: Generic Arial
Style: Basic modern
```

### **After (Branded Theme):**
```css
Header: Deep Teal (#164E63) with brand name
Button: Deep Teal (#164E63) with pill shape
Background: Cream (#FDFAF5)
Font: Cormorant Garamond + Arial
Style: Elegant, sophisticated
```

---

## 📦 **NEW FILE STRUCTURE:**

### **Created:**
```
server/services/email/email-template.js
```

**Contains:**
- `wrapBrandedEmail()` - Main wrapper function
- `ctaButton()` - Styled button helper
- `passwordResetEmail()` - Password reset template
- `emailVerificationEmail()` - Email verification template
- `welcomeEmail()` - Welcome email template

### **Updated:**
```
server/services/auth/password-service.js
```

**Changes:**
- Imports branded templates
- Uses `passwordResetEmail()` function
- Uses `emailVerificationEmail()` function
- Removed inline HTML templates

---

## 🎨 **VISUAL COMPARISON:**

### **Password Reset Email:**

#### **OLD (Generic):**
```
┌────────────────────────┐
│  No Header             │
├────────────────────────┤
│  🔐 Password Reset     │
│  Hi there,             │
│  [Purple Button]       │
│  Link in purple text   │
└────────────────────────┘
```

#### **NEW (Branded):**
```
┌────────────────────────────┐
│  DEEP TEAL HEADER          │
│  You Remembered, by Gem    │
├════════════════════════════┤ Gold line
│  CREAM BACKGROUND          │
│                            │
│  Password Reset Request    │
│  (Cormorant Garamond)      │
│                            │
│  Hi FirstName,             │
│                            │
│  [Deep Teal Pill Button]   │
│                            │
│  Link in teal color        │
│                            │
├────────────────────────────┤ Subtle gold
│  Footer text               │
└────────────────────────────┘
```

---

## 💻 **USAGE EXAMPLES:**

### **1. Password Reset:**
```javascript
import { passwordResetEmail } from '../email/email-template.js';

const emailData = passwordResetEmail(user, resetUrl);

await sendEmail({
  to: user.email,
  subject: emailData.subject,
  html: emailData.html,
});
```

### **2. Email Verification:**
```javascript
import { emailVerificationEmail } from '../email/email-template.js';

const emailData = emailVerificationEmail(user, verificationUrl);

await sendEmail({
  to: user.email,
  subject: emailData.subject,
  html: emailData.html,
});
```

### **3. Welcome Email:**
```javascript
import { welcomeEmail } from '../email/email-template.js';

const emailData = welcomeEmail(user, dashboardUrl);

await sendEmail({
  to: user.email,
  subject: emailData.subject,
  html: emailData.html,
});
```

### **4. Custom Email:**
```javascript
import { wrapBrandedEmail, ctaButton } from '../email/email-template.js';

const innerHtml = `
  <p>Hi ${user.firstName},</p>
  <p>Your custom message here...</p>
  ${ctaButton('Click Here', 'https://example.com')}
`;

const html = wrapBrandedEmail('Custom Heading', innerHtml);

await sendEmail({
  to: user.email,
  subject: 'Custom Subject',
  html: html,
});
```

---

## 🎨 **CUSTOMIZATION:**

### **Change Colors:**

Edit `email-template.js`:

```javascript
const THEME = {
  primary: '#164E63',     // Change to your primary color
  accent: '#C9A96E',      // Change to your accent color
  background: '#FDFAF5',  // Change to your background
  text: '#1a1a2e',        // Change to your text color
};
```

### **Change Fonts:**

Replace in template:
```javascript
font-family: 'Cormorant Garamond', Georgia, serif;  // Header font
font-family: Arial, Helvetica, sans-serif;          // Body font
```

---

## 📱 **RESPONSIVE DESIGN:**

The template is responsive:
- **Max width:** 520px (centers on desktop)
- **Padding:** Adjusts for mobile
- **Font sizes:** Readable on all devices
- **Button:** Touch-friendly (44px+ height)

---

## ✅ **FEATURES:**

- ✅ **XSS Protection** - `escapeHtml()` for user content
- ✅ **Theme Consistency** - Centralized color constants
- ✅ **Reusable Components** - Button, wrapper functions
- ✅ **Mobile Responsive** - Works on all screen sizes
- ✅ **Brand Aligned** - Matches website theme
- ✅ **Professional Look** - Elegant serif + sans-serif combo

---

## 🚀 **DEPLOYMENT:**

### **Changes Required:**

1. ✅ Created: `server/services/email/email-template.js`
2. ✅ Updated: `server/services/auth/password-service.js`
3. ⏳ **Railway env vars** (separate issue):
   - `FRONTEND_URL=https://you-remembered-by-gem-production-c03e.up.railway.app`

### **To Deploy:**

```bash
git add server/services/email/email-template.js
git add server/services/auth/password-service.js
git commit -m "Add branded email templates with theme"
git push origin main
```

Railway will auto-deploy! 🎉

---

## 📸 **SCREENSHOT COMPARISON:**

### **Brand Colors Reference:**

```
Deep Teal (#164E63)   ██████████
Gold (#C9A96E)        ██████████
Cream (#FDFAF5)       ██████████
Dark Text (#1a1a2e)   ██████████
```

### **Base44 Original Email:**
- Header: Deep Teal with brand name
- Divider: 4px Gold line
- Body: Cream background
- Button: Deep Teal pill shape
- Text: Cormorant Garamond headings

### **Your New Email:**
- ✅ Matches base44 original exactly!

---

## 🎯 **BENEFITS:**

1. **Professional** - Matches website brand
2. **Consistent** - All emails same theme
3. **Reusable** - Easy to create new templates
4. **Maintainable** - Change colors in one place
5. **Secure** - XSS protection built-in
6. **Elegant** - Sophisticated serif font
7. **Mobile-friendly** - Responsive design

---

**Your emails now match the original base44 branded style perfectly!** ✨

