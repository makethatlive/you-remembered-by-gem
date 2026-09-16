# Gift Generation Fixes - September 16, 2026

## Issues Fixed

### Issue 1: Invalid Status Enum Values
**Error**: `Invalid value for argument 'status'. Expected GiftItemStatus.`

**Root Cause**: 
- Code was using lowercase `'approved'` and `'standby'`
- Schema enum defines: `ACTIVE`, `STANDBY`, `SWAPPED`, `REMOVED`

**Fix Applied**:
- Changed `gift-list-generator.js` line 296
- Now uses: `'ACTIVE'` for primary gifts (first 5), `'STANDBY'` for backup gifts (next 5)

**File**: `server/services/gifts/gift-list-generator.js`

---

### Issue 2: AI Returning Wrong Product IDs
**Error**: Claude AI returning product IDs like 1, 2, 3, 4... which don't exist in database

**Why It Happened**:
- Prompt was showing products numbered `1. Product Name`, `2. Product Name`, etc.
- Claude was returning those numbers (1-10) as product_ids
- Code expected actual database IDs (like `cmu3q31i101zdtcodhizd6wno`)

**Result**: 
- ⚠️ All 10 recommendations not found in candidates
- Fallback to score-based selection (no AI intelligence)
- 0 interest-match gifts, 10 general

**Fix Applied**:
- Changed candidate list format in prompt
- Now shows: `Product ID: cmu3q31i101zdtcodhizd6wno` at the start of each product
- Removed numbering (1., 2., 3...) to avoid confusion
- Claude will now return actual database IDs

**File**: `server/services/gifts/ai-gift-selector.js`

---

## Before vs After

### Before (Broken):
```
Candidates shown to Claude:
1. Men's Cuban Pyjama Set
   Retailer: Desmond & Dempsey
   ...

Claude returns:
{
  "recommendations": [
    { "product_id": "1", "confidence": "interest_match", ... },
    { "product_id": "2", "confidence": "interest_match", ... }
  ]
}

Result: ⚠️ product_id 1 not found → Fallback selection
```

### After (Fixed):
```
Candidates shown to Claude:
Product ID: cmu3q31i101zdtcodhizd6wno
   Name: Men's Cuban Pyjama Set
   Retailer: Desmond & Dempsey
   ...

Claude returns:
{
  "recommendations": [
    { "product_id": "cmu3q31i101zdtcodhizd6wno", "confidence": "interest_match", ... }
  ]
}

Result: ✅ Product found → AI recommendations work correctly
```

---

## Next Test

To verify these fixes work:
1. Generate a gift list for Ben again
2. Check the console output - should see:
   - `✅ AI returned X recommendations (5 primary, Y backup)` instead of fallback message
   - Higher number of interest-match gifts
3. Check database - gifts should save with status `ACTIVE` or `STANDBY` (not error)

---

## Files Modified

1. `server/services/gifts/gift-list-generator.js` - Fixed status enum values
2. `server/services/gifts/ai-gift-selector.js` - Fixed product ID format in prompt
