# Age Band Schema Migration - COMPLETE

**Date:** September 21, 2026  
**Status:** ✅ DATABASE MIGRATED, Prisma Client needs regeneration

---

## What Was Done

### 1. Database Migration ✅
**File:** `prisma/migrations/20260921_convert_ageband_to_string/migration.sql`

**Steps:**
1. Added temporary `age_band_new` TEXT column
2. Copied existing enum values to string (THIRTY_ONE_TO_50 → "THIRTY_ONE_TO_50")
3. Dropped old `age_band` enum column
4. Renamed `age_band_new` to `age_band`
5. Made column NOT NULL
6. Dropped `AgeBand` enum type

**Result:** Database now stores age bands as STRING, not ENUM

**Verified:** Migration executed successfully via `npx prisma db execute`

---

### 2. Prisma Schema Updated ✅
**File:** `prisma/schema.prisma`

**Changes:**
```prisma
// OLD:
ageBand               AgeBand   @map("age_band")

enum AgeBand {
  UNDER_5
  FIVE_TO_10
  ELEVEN_TO_17
  EIGHTEEN_TO_30
  THIRTY_ONE_TO_50
  FIFTY_ONE_TO_70
  SEVENTY_PLUS
  @@map("age_band")
}

// NEW:
ageBand               String    @map("age_band") // Flexible format: "1-2", "18-25", "75+", etc.

// Enum removed entirely
```

**Result:** Schema now accepts any string value for age band

---

### 3. Prisma Client Regeneration ⚠️ IN PROGRESS
**Command:** `npx prisma generate`

**Status:** Timeout during generation (long process)

**Next Steps:**
1. Stop the current server
2. Run `npx prisma generate` again (might take 2-3 minutes)
3. Restart server

---

## Why This Was Needed

### The Error:
```
Error converting field "ageBand" of expected non-nullable type "String", 
found incompatible value of "THIRTY_ONE_TO_50".
```

### Root Cause:
- Database migration (SQL) ran successfully - age bands are now TEXT
- Prisma schema updated - age band is now String
- **BUT**: Prisma Client still has OLD generated code expecting AgeBand enum
- When Prisma tries to read database, it fails validation

### Solution:
**Regenerate Prisma Client** so it matches the new schema (String instead of enum)

---

## Current Database State

### Recipients Table:
```sql
SELECT "ageBand", COUNT(*) FROM recipients GROUP BY "ageBand";
```

**Expected Values:**
- `THIRTY_ONE_TO_50` (still stored as old enum string)
- `ELEVEN_TO_17` (still stored as old enum string)
- etc.

**These values are VALID** - they're now strings, and our `normalizeAgeBand()` function in `product-matcher.js` handles the conversion:
- `THIRTY_ONE_TO_50` → tries both `["36-45", "46-55"]`
- `ELEVEN_TO_17` → converts to `["12-17"]`

---

## Next Steps

### Step 1: Regenerate Prisma Client
```bash
cd d:\you-remembered-by-gem
npx prisma generate
```

**Expected:** Takes 2-3 minutes, generates new client with `ageBand: string`

### Step 2: Restart Server
```bash
npm run server
```

**Expected:** No more "incompatible value" errors

### Step 3: Test
1. Load recipients page - should show all recipients
2. Load gift lists - should show all lists
3. Generate new gift list for Ben - should work with age band conversion

---

## Optional: Data Migration Script

**Not Required** - Our code already handles old enum values via `normalizeAgeBand()`.

But if you want to clean up the database and convert all old enums to new format:

```javascript
// scripts/migrate-recipient-age-bands.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const enumMapping = {
  'UNDER_5': '3-4',  // Default to middle of range
  'FIVE_TO_10': '7-8',
  'ELEVEN_TO_17': '12-17',
  'EIGHTEEN_TO_30': '26-35',
  'THIRTY_ONE_TO_50': '46-55',  // Ben would become 46-55
  'FIFTY_ONE_TO_70': '56-65',
  'SEVENTY_PLUS': '75+',
};

async function migrate() {
  for (const [oldEnum, newValue] of Object.entries(enumMapping)) {
    const result = await prisma.recipient.updateMany({
      where: { ageBand: oldEnum },
      data: { ageBand: newValue },
    });
    console.log(`Updated ${result.count} recipients: ${oldEnum} → ${newValue}`);
  }
}

migrate().then(() => prisma.$disconnect());
```

**Run:** `node scripts/migrate-recipient-age-bands.js`

**Result:** All recipients will have new format age bands in database

---

## Summary

✅ **Database:** Migrated - age_band is now TEXT  
✅ **Schema:** Updated - ageBand is now String  
⏳ **Prisma Client:** Needs regeneration  
✅ **Code:** Already handles old enums via normalizeAgeBand()

**Action Required:** Run `npx prisma generate` and restart server
