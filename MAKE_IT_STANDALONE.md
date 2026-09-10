# Make It 100% Standalone - Quick Setup

## ✅ You're Already 95% There!

You already have:
- ✅ Complete email service (`server/services/email/resend-client.js`)
- ✅ PostgreSQL database with Prisma
- ✅ Express backend
- ✅ React frontend
- ✅ Authentication system
- ✅ Stripe integration

**All you need**: Email scheduler (I just created it for you!)

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install node-cron

```bash
npm install node-cron
```

### Step 2: Test the Scheduler

```bash
npm run jobs
```

You should see:
```
📅 ========================================
📅 Email Scheduler Starting...
📅 ========================================
✅ Email scheduler is running
📅 Onboarding emails: every 10 minutes
📅 Birthday reminders: daily at 9:00 AM
📅 Press Ctrl+C to stop
```

### Step 3: Run Everything Together

```bash
npm run dev:all
```

This runs:
- Frontend (Vite)
- Backend (Express)
- Email Jobs (Scheduler)

---

## 📧 What the Scheduler Does

### Every 10 Minutes
Checks for subscribers created **30 minutes ago** and sends onboarding email

### Daily at 9 AM
Checks all recipients and sends:
- **6-week reminder** (42 days before occasion)
- **2-week reminder** (14 days before occasion)
- **Post-occasion follow-up** (2 days after occasion)

---

## 🔧 Configuration

### Required Environment Variables

Make sure these are in your `.env`:

```env
# Email Service
ENABLE_EMAILS=true
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=concierge@yourememberedbygem.com
RESEND_FROM_NAME=You Remembered, by Gem

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://...
```

---

## 🧪 Testing

### Test Onboarding Email

1. Create a test subscriber 30 minutes ago:

```sql
-- Connect to your PostgreSQL database
UPDATE subscribers 
SET created_at = NOW() - INTERVAL '31 minutes'
WHERE email = 'test@example.com';
```

2. Wait for next scheduler run (every 10 min) or restart:

```bash
npm run jobs
```

3. Check email logs:

```sql
SELECT * FROM email_logs WHERE email_type = 'ONBOARDING_REMINDER';
```

### Test Birthday Reminder

1. Create a test recipient with birthday 42 days from today:

```sql
-- Get date 42 days from now
SELECT TO_CHAR(CURRENT_DATE + INTERVAL '42 days', '--MM-DD');

-- Update a recipient
UPDATE recipients
SET birthday = '--08-15'  -- Use result from above
WHERE name = 'Test Person';
```

2. Run scheduler (or wait until 9 AM):

```bash
npm run jobs
```

3. Check email logs:

```sql
SELECT * FROM email_logs WHERE email_type = 'SIX_WEEK_REMINDER';
```

---

## 🚀 Production Deployment

### Option 1: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start all services
pm2 start server/index.js --name "api"
pm2 start server/jobs/email-scheduler.js --name "jobs"

# Save configuration
pm2 save

# Auto-start on reboot
pm2 startup
```

### Option 2: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    command: node server/index.js
    ports:
      - "3000:3000"
    env_file: .env
    
  jobs:
    build: .
    command: node server/jobs/email-scheduler.js
    env_file: .env
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: youremembered
      POSTGRES_PASSWORD: ${DB_PASSWORD}
```

### Option 3: Separate Processes

```bash
# Terminal 1: API
npm run server

# Terminal 2: Jobs
npm run jobs

# Terminal 3: Frontend (dev)
npm run dev
```

---

## 📊 Monitoring

### Check Scheduler Status

```bash
# View logs
tail -f logs/email-scheduler.log

# Or with PM2
pm2 logs jobs
```

### Check Email Send History

```sql
-- Recent emails
SELECT 
  email_type,
  COUNT(*) as count,
  MAX(sent_at) as last_sent
FROM email_logs
WHERE sent_at > NOW() - INTERVAL '7 days'
GROUP BY email_type
ORDER BY last_sent DESC;

-- Failed emails
SELECT * FROM email_logs
WHERE status = 'FAILED'
ORDER BY sent_at DESC
LIMIT 10;
```

---

## ✅ You're Done!

Your system is now **100% standalone**:

- ✅ No Base44 dependency
- ✅ All emails sent via your own Resend account
- ✅ Scheduler runs on your own server
- ✅ Complete control over timing and content
- ✅ Lower costs (no Base44 subscription)

---

## 🎯 Next Steps

1. **Test locally**: `npm run dev:all`
2. **Monitor for 24 hours**: Check emails are sending correctly
3. **Deploy to production**: Use PM2 or Docker
4. **Cancel Base44 subscription**: (optional)

---

## 📞 Need Help?

If emails aren't sending:

1. Check `.env` has `ENABLE_EMAILS=true`
2. Verify `RESEND_API_KEY` is correct
3. Check scheduler logs: `npm run jobs`
4. Verify database connection
5. Check EmailLog table for error messages

---

Enjoy your fully standalone system! 🎉
