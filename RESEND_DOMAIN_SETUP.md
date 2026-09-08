# Resend Domain Verification Guide

## ⚠️ Current Issue

Your Resend API key is in **test mode** and can only send emails to: `gem@yourememberedbygem.com`

To send emails to any user (customers/subscribers), you need to **verify a domain**.

---

## 🚀 How to Verify Your Domain

### Step 1: Go to Resend Dashboard
1. Visit: https://resend.com/domains
2. Log in with your Resend account

### Step 2: Add Your Domain
1. Click **"Add Domain"** button
2. Enter your domain name (e.g., `yourememberedbygem.com`)
3. Click **"Add"**

### Step 3: Get DNS Records
Resend will provide you with DNS records to add. You'll typically need to add:

**Example DNS Records:**
```
Type: TXT
Name: resend._domainkey
Value: [Resend will provide this value]

Type: TXT
Name: @
Value: [SPF record - Resend will provide]
```

### Step 4: Add DNS Records to Your Domain

#### If using Cloudflare:
1. Log in to Cloudflare
2. Select your domain
3. Go to **DNS** → **Records**
4. Click **"Add record"**
5. Add each record provided by Resend
6. Save

#### If using GoDaddy:
1. Log in to GoDaddy
2. Go to **My Products** → **DNS**
3. Select your domain
4. Click **"Add"** under DNS records
5. Add each record provided by Resend
6. Save

#### If using Namecheap:
1. Log in to Namecheap
2. Go to **Domain List** → **Manage**
3. Go to **Advanced DNS**
4. Add records provided by Resend
5. Save

### Step 5: Wait for Verification
- DNS propagation can take **5 minutes to 48 hours**
- Usually works within **10-30 minutes**
- Resend will automatically verify once DNS records are detected

### Step 6: Update .env File
Once verified, update your `.env` file:

```env
RESEND_FROM_EMAIL="noreply@yourememberedbygem.com"
# or
RESEND_FROM_EMAIL="hello@yourememberedbygem.com"
# or
RESEND_FROM_EMAIL="gem@yourememberedbygem.com"
```

**Important**: The email domain must match your verified domain!

---

## 🧪 Testing Before Domain Verification

### Option 1: Test with Owner Email
Temporarily change test subscriber email to `gem@yourememberedbygem.com` to test email functionality.

### Option 2: Use Resend Test Mode
In test mode, emails will only go to the account owner's email, but you can verify the email content and flow works correctly.

---

## 📋 What Domain Should You Verify?

If your website is `yourememberedbygem.com`, verify:
- ✅ `yourememberedbygem.com` (root domain)

Then you can send from:
- `noreply@yourememberedbygem.com`
- `hello@yourememberedbygem.com`
- `gem@yourememberedbygem.com`
- `support@yourememberedbygem.com`
- Any `@yourememberedbygem.com` address

---

## 🔍 Troubleshooting

### "Domain not verified" error
- **Solution**: Wait longer for DNS propagation (up to 48 hours)
- Check DNS records are added correctly
- Use DNS checker: https://mxtoolbox.com/

### "You can only send to your own email"
- **Solution**: Verify your domain first
- Or use the owner's email for testing

### Emails not arriving
- Check spam folder
- Verify DNS records are correct
- Check Resend dashboard for delivery status

---

## 💰 Resend Pricing

- **Free Tier**: 100 emails/day, 3,000 emails/month
- **Pro Plan**: Starting at $20/month for 50,000 emails
- Check: https://resend.com/pricing

---

## ✅ Verification Checklist

- [ ] Go to https://resend.com/domains
- [ ] Click "Add Domain"
- [ ] Enter domain name
- [ ] Copy DNS records from Resend
- [ ] Add DNS records to your domain provider
- [ ] Wait for verification (10-30 minutes typically)
- [ ] Update `.env` with verified email address
- [ ] Restart server: `npm run server`
- [ ] Test email sending

---

## 📞 Need Help?

- **Resend Support**: https://resend.com/support
- **Resend Docs**: https://resend.com/docs
- **DNS Help**: Contact your domain registrar's support

---

## 🎯 Quick Start for Production

1. Verify domain at https://resend.com/domains
2. Update `.env`:
   ```env
   RESEND_FROM_EMAIL="noreply@yourememberedbygem.com"
   ```
3. Restart server
4. Test with any email address
5. ✅ Done!
