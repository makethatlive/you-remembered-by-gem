# Quick Phase 2 Test Guide

**⚡ 5-minute test of multi-occasion functionality**

## Prerequisites

✅ Phase 1 complete (occasions seeded)  
✅ Dev server running (`npm run dev`)  
✅ At least 1 test recipient in database  

## Test Steps

### 1. Restart Server (Load New Code)

```bash
# Stop dev server (Ctrl+C)
npm run dev
```

### 2. Navigate to Occasions Tab

1. Open: `http://localhost:3000/admin`
2. Click **"Occasions"** tab
3. You should see the **"🧪 Test Occasion Check"** button (top right)

### 3. Click Test Button

Click the button and observe:
- Button shows "Testing..." with spinner
- After ~2-5 seconds, toast notification appears
- Console logs detailed results

### 4. Check Console Output

**Expected in browser console:**
```
🔍 Starting occasion check...

👤 [Recipient Name] - X occasion(s)
   📅 [Occasion]: [Date] ([Days] days)
   
✅ Occasion check complete:
   Recipients scanned: X
   Emails sent: X
```

### 5. Verify in Database (Optional)

```sql
-- Check email logs
SELECT recipient_id, occasion_type, occasion_date, email_type, created_at
FROM email_logs
ORDER BY created_at DESC
LIMIT 10;
```

## ✅ Success Criteria

Test is **successful** if:
- ✅ Button works without errors
- ✅ Console shows occasion analysis
- ✅ Recipients with occasions are detected
- ✅ Days until/since calculated correctly
- ✅ Toast shows scan results

## 🐛 Common Issues

### Issue: Button doesn't work
**Fix:** Make sure server restarted after code changes

### Issue: No recipients found
**Solution:** Create a test recipient with occasions array

### Issue: Import error
**Fix:** Check `server/utils/occasion-resolver.js` exists

### Issue: "occasion_type" column doesn't exist
**Fix:** Run migration:
```bash
npx prisma db push
```

## 📝 What to Look For

1. **Correct occasion detection** - All occasions found
2. **Date resolution** - Personal vs global dates
3. **Days calculation** - Accurate days until/since
4. **Duplicate prevention** - Same email not sent twice
5. **Performance** - Completes in < 5 seconds

---

**Total Time:** ~5 minutes  
**Next:** Review results, then commit if working!
