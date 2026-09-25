# Quick Start: Testing Occasions Feature

**⚡ Fast track to testing the new admin feature**

## Step 1: Seed Database (30 seconds)

```bash
node scripts/seed-global-occasions.js
```

Wait for: ✅ **"Seeding complete!"**

## Step 2: Start Dev Server (1 minute)

```bash
npm run dev
```

Wait for both servers to start:
- ✅ React dev server: `http://localhost:3000`
- ✅ API server: `http://localhost:3001`

## Step 3: Open Admin Panel (10 seconds)

1. Navigate to: `http://localhost:3000/admin`
2. Click **"Occasions"** tab (⏰ icon)

## Step 4: Quick Test (2 minutes)

### ✅ Test 1: View Seeded Data
- You should see 5 occasion groups
- Each with multiple years
- Total: 15 occasions

### ✅ Test 2: Add New
1. Scroll to "Add New Occasion Date"
2. Select: Eid / 2030 / February / 27
3. Click "Save Occasion Date"
4. ✅ Should appear in Eid group

### ✅ Test 3: Delete
1. Find the new Eid 2030 entry
2. Click trash icon 🗑️
3. Confirm
4. ✅ Should disappear

## ✅ Success!

If all 3 tests pass, the feature is working correctly.

## 🐛 Issues?

See `TESTING_OCCASIONS_FEATURE.md` for detailed troubleshooting.

---

**Total Time:** ~4 minutes  
**Status:** Ready to test!
