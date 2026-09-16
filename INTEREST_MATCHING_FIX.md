# Interest Matching Fix - September 16, 2026

## Problem Summary

When generating gift list for Ben:
- **Tier 1 (Curated + Interest Match): 0 products** ❌
- **Tier 2 (Scraped + Interest Match): 0 products** ❌  
- **Tier 3 (General Fallback): 10 products** ✅

Result: 0 interest matches, AI notes "limited catalogue" even though 24+ curated products exist with Ben's interests in his budget!

---

## Root Cause

Ben's interests: `Cooking & food, Watches, DIY & tools, Gardening, Tech & gadgets`

Database had **24 curated products** matching:
- ✅ Ben's budget (£50-£150)
- ✅ Ben's gender (MALE/UNISEX)  
- ✅ Ben's interests (Cooking & food)
- ✅ Status: ACTIVE
- ❌ **Quality Score: null**

**The Problem:**
```javascript
// Product Matcher Filter (Line 91-93)
qualityScore: { gte: 50 }  // Requires quality score >= 50
```

**Prisma behavior:** `{ gte: 50 }` does NOT match `null` values!

Result: All 24 products were excluded from Tier 1 even though they matched everything else.

---

## Products Affected

Sample of excluded products:
- BERNADOTTE Set: Teapot and Cups (£109, UNISEX) - Quality: `null`
- The Rare Tea Gift Collection (£124.99, UNISEX) - Quality: `null`
- Zalto Burgundy Wine Glasses (£105, UNISEX) - Quality: `null`
- Multi-Sensory Lab Wine Tasting Experience (£65, UNISEX) - Quality: `null`
- Whisky Blending Experience (£75, UNISEX) - Quality: `null`
- Perfect Draft Black Machine (£149, MALE) - Quality: `null`
... and 18 more!

Only 1 product had quality score set: "Wine Cases" (£50, Quality: 100)

---

## Fix Applied

**File:** `server/services/gifts/product-matcher.js`

**Before:**
```javascript
const baseFilters = {
  status: 'ACTIVE',
  price: { gte: budgetMinWithMargin, lte: budgetMaxWithMargin },
  qualityScore: { gte: 50 },  // ❌ Excludes null values
};
```

**After:**
```javascript
const baseFilters = {
  status: 'ACTIVE',
  price: { gte: budgetMinWithMargin, lte: budgetMaxWithMargin },
  OR: [
    { qualityScore: { gte: 50 } },      // Products with good quality score
    { qualityScore: null }               // ✅ Products without quality score (newly imported)
  ],
};
```

---

## Why Quality Score is Null

Products imported from CSV or newly scraped don't have quality scores yet. Quality scoring happens during enrichment:
- Enrichment analyzes product data
- Assigns quality score 0-100
- Stores in `qualityScore` field

Until enrichment runs, `qualityScore = null`.

---

## Expected Result After Fix

For Ben (Cooking & food interest, £50-£150 budget):

**Before Fix:**
- Tier 1: 0 products ❌
- Tier 2: 0 products ❌
- Total interest matches: 0

**After Fix:**
- Tier 1: ~24 products ✅ (all "Cooking & food" curated products)
- Tier 2: More scraped products ✅
- Total interest matches: Much higher

Gift list quality will improve:
- More interest-matched gifts
- Higher relevance scores
- Better AI recommendations (Claude will see relevant products)

---

## Testing

1. Regenerate gift list for Ben
2. Check console output:
   ```
   📦 TIER 1: Curated products with interest match
      Interests: Cooking & food, ...
      Found XX curated products with interest match  ✅ Should be 20+
   ```

3. Check gift list:
   - Should see wine, tea, coffee, experience gifts
   - Higher % of interest matches
   - Quality report should pass

---

## Files Modified

1. `server/services/gifts/product-matcher.js` - Changed quality score filter to allow null values
2. `package.json` - Added `fix:interests` script (though tags were already correct)

---

## Additional Notes

**Interest Tags Format:** Confirmed correct in database
```javascript
// ✅ Correct format (already in DB)
interestTags: ['Cooking & food', 'Wine & drinks']

// ❌ Would be wrong (not found in DB)
interestTags: ['Cooking & food, Wine & drinks']
```

Interest matching was working correctly - the only issue was quality score filtering.
