# Testing Instructions: Multiple Occasions Feature

**Status:** ✅ Ready for Local Testing  
**Date:** September 25, 2026

## 🎯 What Was Implemented

### 1. Database Changes ✅
- Added `global_occasion_dates` table
- Migration applied successfully
- Prisma schema updated

### 2. Backend API ✅
- `GET /api/admin/occasion-dates` - Fetch all occasion dates
- `POST /api/admin/occasion-dates` - Create/Update occasion date
- `DELETE /api/admin/occasion-dates/:id` - Delete occasion date

### 3. Admin UI ✅
- New **"Occasions"** tab in admin menu
- Full CRUD interface for managing occasion dates
- Grouped by occasion type
- Input validation

### 4. Base44 Entity ✅
- `GlobalOccasionDate.jsonc` entity definition

### 5. Seed Script ✅
- Pre-populated data for 2026-2029
- Includes: Eid, Diwali, Lunar New Year, Hanukkah, Rosh Hashanah

## 📋 Testing Checklist

### Step 1: Run Seed Script

```bash
node scripts/seed-global-occasions.js
```

**Expected Output:**
```
🌍 Seeding global occasion dates...

✅ Created: Eid 2026 → 4/10
✅ Created: Eid 2027 → 3/30
... (more occasions)

📊 Summary:
   Created: 15
   Updated: 0
   Skipped: 0
   Total:   15

✨ Seeding complete!
```

### Step 2: Start Development Server

```bash
npm run dev
```

### Step 3: Access Admin Panel

1. Navigate to: `http://localhost:3000/admin`
2. Login with admin credentials
3. Click on **"Occasions"** tab

### Step 4: Verify Seeded Data

**Expected UI:**

You should see occasions grouped like:

```
┌─ Eid ─────────────────────────────┐
│  2026: April 10                   │
│  2027: March 30                   │
│  2028: March 19                   │
│  2029: March 9                    │
└───────────────────────────────────┘

┌─ Diwali ──────────────────────────┐
│  2026: November 1                 │
│  2027: October 21                 │
│  2028: November 9                 │
│  2029: October 29                 │
└───────────────────────────────────┘

... (more occasions)
```

### Step 5: Test CRUD Operations

#### ✅ Test 1: Add New Occasion

1. Scroll to **"Add New Occasion Date"** card
2. Select:
   - Occasion Type: `Eid`
   - Year: `2030`
   - Month: `February`
   - Day: `27`
   - Notes: `Eid al-Fitr 2030 (estimated)`
3. Click **"Save Occasion Date"**

**Expected:**
- Success toast: "Eid 2030 saved successfully"
- New entry appears in Eid group
- Form resets

#### ✅ Test 2: Add Duplicate (should update)

1. Try adding same occasion again: `Eid 2030`
2. Change day to `28`
3. Click **"Save Occasion Date"**

**Expected:**
- Entry is updated (not duplicated)
- Toast: "Eid 2030 saved successfully"
- Only one `Eid 2030` entry exists with day = 28

#### ✅ Test 3: Delete Occasion

1. Find `Eid 2030` entry
2. Click trash icon (🗑️)
3. Confirm deletion

**Expected:**
- Confirmation dialog appears
- After confirming: "Occasion date removed" toast
- Entry disappears from UI

#### ✅ Test 4: Validation

Try adding with invalid data:

**Test 4a: Missing Occasion Type**
- Leave occasion type empty
- Try to save

**Expected:** Button disabled

**Test 4b: Invalid Month**
- Manually type month = 13 (if possible)

**Expected:** Validation error

**Test 4c: Invalid Day**
- Set day = 32
- Try to save

**Expected:** API error: "Day must be between 1 and 31"

### Step 6: Test API Directly (Optional)

#### Get All Occasions:
```bash
curl http://localhost:3001/api/admin/occasion-dates
```

**Expected Response:**
```json
[
  {
    "id": "clxxx...",
    "occasionType": "Eid",
    "year": 2026,
    "month": 4,
    "day": 10,
    "notes": "Eid al-Fitr 2026 (estimated)",
    "createdAt": "2026-09-25T...",
    "updatedAt": "2026-09-25T..."
  },
  ...
]
```

#### Create New Occasion:
```bash
curl -X POST http://localhost:3001/api/admin/occasion-dates \
  -H "Content-Type: application/json" \
  -d '{
    "occasionType": "Test Occasion",
    "year": 2026,
    "month": 12,
    "day": 31,
    "notes": "Testing"
  }'
```

#### Delete Occasion:
```bash
curl -X DELETE http://localhost:3001/api/admin/occasion-dates/clxxx...
```

## 🐛 Potential Issues & Solutions

### Issue 1: Prisma Client Not Generated

**Error:**
```
Cannot find module '@prisma/client'
```

**Solution:**
```bash
npx prisma generate
```

### Issue 2: Table Doesn't Exist

**Error:**
```
relation "global_occasion_dates" does not exist
```

**Solution:**
Run migration manually:
```bash
npx prisma db push
```

### Issue 3: Port Already in Use

**Error:**
```
Port 3001 is already in use
```

**Solution:**
```bash
# Kill existing process
taskkill /F /IM node.exe

# Or change port in .env
PORT=3002
```

### Issue 4: CORS Error in Browser

**Error:**
```
CORS policy: No 'Access-Control-Allow-Origin' header
```

**Solution:**
Check `server/index.js` has CORS enabled:
```javascript
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

## 📸 Screenshots to Verify

Please take screenshots of:

1. ✅ Seeded data showing in UI
2. ✅ Successfully adding a new occasion
3. ✅ Delete confirmation dialog
4. ✅ Validation error (invalid day)

## 🚀 Next Steps After Testing

Once local testing passes:

1. ✅ Verify all CRUD operations work
2. ✅ Check console for errors
3. ✅ Test on different browsers (Chrome, Firefox)
4. ✅ Review code changes
5. ✅ Push to GitHub

## 📝 Files Changed (DO NOT PUSH YET)

```
✅ New Files:
   - prisma/schema.prisma (appended GlobalOccasionDate model)
   - prisma/migrations/20260925_add_global_occasion_dates/migration.sql
   - base44/entities/GlobalOccasionDate.jsonc
   - src/components/admin/OccasionCalendar.jsx
   - scripts/seed-global-occasions.js
   - MULTIPLE_OCCASIONS_FIX.md
   - TESTING_OCCASIONS_FEATURE.md

✅ Modified Files:
   - server/index.js (added 3 API endpoints)
   - src/components/admin/AdminView.jsx (added OccasionCalendar tab)
   - src/components/admin/AdminNav.jsx (added Occasions menu item)
```

## ⚠️ Known Limitations (Phase 1)

This is **Phase 1** - Admin UI only. The following are NOT yet implemented:

- ❌ `dailyBirthdayCheck` does not use global occasions yet
- ❌ Gift list generation still uses only `recipient.birthday`
- ❌ Email reminders don't loop through multiple occasions
- ❌ Occasion resolver utility not created yet

**These will be implemented in Phase 2** after admin UI testing passes.

## 🎯 Success Criteria

Testing is successful when:

- ✅ Seed script runs without errors
- ✅ All 15 occasions appear in admin UI
- ✅ Can add new occasions
- ✅ Can update existing occasions (no duplicates)
- ✅ Can delete occasions
- ✅ Validation works (month 1-12, day 1-31)
- ✅ No console errors
- ✅ UI is responsive and looks good

---

**Ready to test!** Let me know if you encounter any issues.
