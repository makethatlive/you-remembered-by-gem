# Deployment Checklist - Auto Generation & AI Tracking

## ✅ Code Committed and Pushed
- **Commit**: `c233e54` - feat: Add auto gift generation at 6-week mark + AI API call tracking
- **Branch**: main
- **Files Changed**: 15 files, 1711 insertions
- **Pushed to**: https://github.com/makethatlive/you-remembered-by-gem.git

---

## 📋 Pre-Deployment Verification

### Database Schema
- [x] AIApiCallLog model added to schema.prisma
- [x] Schema pushed to database via `npx prisma db push`
- [ ] **ACTION REQUIRED**: Run `npx prisma db push` on production (or let Railway do it automatically)

### Environment Variables
- [x] ANTHROPIC_API_KEY - Already set (required for AI calls)
- [x] ADMIN_API_KEY - Already set (optional, for admin auth)
- [ ] No new environment variables needed

### Dependencies
- [x] All dependencies already in package.json (no new packages)
- [x] node-cron already installed (for scheduled jobs)

---

## 🚀 Railway Deployment

Railway will automatically deploy from the main branch push.

### Expected Deployment Steps:
1. Railway detects new commit on main branch
2. Pulls latest code
3. Installs dependencies (`npm install`)
4. Runs build (`npm run build`)
5. Runs Prisma migrations (`npx prisma generate` and potentially `npx prisma db push`)
6. Restarts server with new code

### Monitor Deployment:
- Check Railway dashboard for build logs
- Verify deployment status shows "Active"
- Check server logs for:
  - ✅ "Email scheduler is running"
  - ✅ "Auto gift generation: daily at 9:00 AM"
  - ✅ "Ready to serve data from your PostgreSQL database"

---

## 🧪 Post-Deployment Testing

### 1. Test AI Call Logging
```bash
# Check if logs are being created
curl https://your-app.railway.app/api/admin/ai-logs

# Should return: { logs: [...], pagination: {...} }
```

### 2. Test AI Stats Endpoint
```bash
curl https://your-app.railway.app/api/admin/ai-stats

# Should return: { overall: {...}, byCallType: {...}, ... }
```

### 3. Test Admin UI
1. Navigate to: `https://your-app.railway.app/admin?tab=ai-logs`
2. Verify dashboard loads with statistics cards
3. Test filters (status, call type, date range)
4. Check table displays logs properly

### 4. Test Auto-Generation on Recipient Create
**Test Case 1: Birthday ≤ 42 days away**
1. Add recipient with birthday in 30 days
2. Check server logs for: "⚡ Auto-generating gift list (≤ 6 weeks away)..."
3. Verify gift list created in database
4. Check AI logs for PROFILE_ANALYSIS and GIFT_SELECTION calls

**Test Case 2: Birthday > 42 days away**
1. Add recipient with birthday in 60 days
2. Check server logs for: "⏰ Gift list will auto-generate when recipient reaches 6 weeks"
3. Verify NO gift list created yet
4. Confirm daily job will handle it

### 5. Test Daily Auto-Generation Job
**Manual Test** (if needed):
```javascript
// Run this in Railway console or via API
import('./server/jobs/auto-gift-generation.js').then(m => m.autoGenerateJob())
```

**Expected Output**:
```
🎁 ===== AUTO GIFT GENERATION JOB =====
   Started: 2026-09-14T09:00:00.000Z
   Target: Recipients with birthdays exactly 42 days away
   Found X recipients with birthdays
   Y recipients need gift lists (6 weeks away, no existing list)
   ...
```

### 6. Verify Cron Job Scheduled
Check server logs on startup should show:
```
🚀 Starting Auto Gift Generation Job
   Schedule: Daily at 9:00 AM
   Task: Auto-generate gift lists for recipients at 6-week mark
✅ Auto Gift Generation Job scheduled
```

---

## 🔍 Monitoring After Deployment

### First 24 Hours
- [ ] Monitor AI Logs dashboard for API calls
- [ ] Check for any ERROR status calls
- [ ] Verify costs are being calculated correctly
- [ ] Monitor first auto-generation (if any recipients at 6-week mark)

### First Week
- [ ] Verify daily job runs at 9:00 AM (check logs)
- [ ] Confirm auto-generation works for recipients added
- [ ] Review AI costs and token usage
- [ ] Check success rate in AI stats

### Ongoing
- [ ] Weekly review of AI costs via admin dashboard
- [ ] Monitor error rates and investigate failures
- [ ] Verify all auto-generated lists are being approved/sent

---

## 🐛 Troubleshooting

### Issue: Daily job not running
**Check**:
- Server logs on startup (should show job scheduled)
- Timezone setting in `server/jobs/auto-gift-generation.js` (currently: "Europe/London")
- Cron expression: `'0 9 * * *'` = 9:00 AM daily

**Fix**: Adjust timezone or cron expression if needed

### Issue: Auto-generation not triggered on recipient create
**Check**:
- Server logs when creating recipient
- ANTHROPIC_API_KEY is set
- Recipient has `occasionDay` and `occasionMonth` set
- Birthday is within 42 days

**Debug**: Check console logs for "Days until birthday: X"

### Issue: AI logs not appearing in dashboard
**Check**:
- Database has `AIApiCallLog` table (run `npx prisma db push`)
- API endpoints accessible: `/api/admin/ai-logs` and `/api/admin/ai-stats`
- Claude client is receiving `prisma` instance in constructor

**Debug**: Check server logs for any errors during AI calls

### Issue: High AI costs
**Action**:
1. Review AI Logs dashboard → filter by callType
2. Check which operations are most expensive
3. Review tokens used per call
4. Consider optimizing prompts or reducing candidates

---

## 📊 Success Metrics

After 1 week, verify:
- ✅ At least 1 auto-generated gift list (if recipients exist at 6-week mark)
- ✅ AI logs showing successful PROFILE_ANALYSIS and GIFT_SELECTION calls
- ✅ Success rate > 95% in AI stats
- ✅ Total cost within expected budget
- ✅ Daily job running without errors
- ✅ Admin dashboard accessible and functional

---

## 📝 Documentation

- [x] AUTO_GENERATION_IMPLEMENTATION.md created (comprehensive feature documentation)
- [x] DEPLOYMENT_CHECKLIST.md created (this file)
- [x] test-auto-generation.js created (logic verification)

---

## 🎉 Deployment Complete!

Once Railway deployment finishes and all tests pass, the implementation is complete.

**Next Steps**:
1. Monitor first auto-generations
2. Review AI costs after first week
3. Gather feedback from administrators using AI Logs dashboard
4. Consider enhancements based on usage patterns
