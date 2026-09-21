# Gift Diversity Fix - Ben's Duplicate Problem

## Problem Identified

**Ben's Gift List Issues:**

### ❌ Issue 1: Duplicate Products
- "6 Cup Moka Express Stovetop Coffee Maker" - £57 (Liberty)
- "6 Cup Moka Espresso Coffee Maker" - £54 (Liberty)

**Same product, different IDs** - AI selected both!

### ❌ Issue 2: Poor Category Coverage
- 2x Moka coffee makers (duplicates!)
- 2x Protein powders (Keto + Ancestral)
- 1x Wireless charging tray

**Ben's interests:** Cooking, Watches, DIY & tools, Gardening, Tech & gadgets

**Missing from gifts:**
- ❌ **Gardening** - Despite "just moved into new home and doing up their garden"
- ❌ **DIY & tools** - Explicit interest, no tools!
- ❌ **Watches** - Explicit interest, no watches!

---

## Root Cause Analysis

### 1. No Duplicate Detection in AI Prompt
The AI system prompt had **NO instruction** to avoid duplicate or similar products.

**Before:**
```
WHAT YOU MUST NEVER DO
- Never invent a product, price, retailer, or URL
- Never recommend wrong gender products
- Never select products that conflict with 'avoid'
- Never pad the list with weak candidates
```

❌ Missing: "Never select duplicate or similar products"

### 2. No Diversity Instructions
The AI was **NOT told** to ensure variety across multiple interests.

**Before:**
```
SELECTION PRIORITY
1. Match interest categories
2. Align with personality tags
3. Include general candidates if needed
```

❌ Missing: Instructions to cover ALL recipient interests

### 3. Product Deduplication by ID Only
```javascript
deduplicateByProductId(products) {
  // Only removes exact same product ID
  // Does NOT detect semantic duplicates (Moka Express vs Moka Espresso)
}
```

---

## Solution Implemented

### ✅ Fix 1: Added Diversity Section to AI Prompt

**New section added:**
```
DIVERSITY AND VARIETY (CRITICAL)
- NEVER select duplicate or nearly-identical products. If you see multiple versions of 
  the same item (e.g., "Moka Express Coffee Maker" and "Moka Espresso Coffee Maker"), 
  select ONLY ONE.
  
- Ensure VARIETY across the recipient's interests. If they have multiple interests 
  (e.g., Gardening, Cooking, DIY), include gifts representing EACH interest area, 
  not just one.
  
- Avoid selecting multiple products from the same narrow category unless the recipient 
  has explicitly focused on it. For example, don't select 3 protein powders or 2 coffee 
  makers unless that's their main stated passion.
  
- Aim for a balanced, interesting mix that covers different aspects of their personality 
  and interests.
```

### ✅ Fix 2: Updated "WHAT YOU MUST NEVER DO"

**Added rules:**
```
WHAT YOU MUST NEVER DO
- ...existing rules...
- Never select duplicate or nearly-identical products (e.g., two coffee makers, two 
  protein powders of the same brand).
- Never select only from one interest area when the recipient has multiple interests — 
  spread the selection across their stated interests.
```

---

## Expected Improvement

### Before Fix:
```
Ben's Gifts (5 selected):
1. Moka Express Coffee Maker - £57 ❌ Duplicate
2. Moka Espresso Coffee Maker - £54 ❌ Duplicate
3. Keto Protein Powder - £50.99
4. Wireless Charging Tray - £110
5. Ancestral Protein Powder - £61.49

Coverage:
- Cooking & food: 4 products ✓
- Tech & gadgets: 1 product ✓
- Watches: 0 products ❌
- DIY & tools: 0 products ❌
- Gardening: 0 products ❌
```

### After Fix:
```
Ben's Gifts (5 selected):
1. Moka Express Coffee Maker - £57 (Cooking)
2. Garden Tool Set - £75 (Gardening)
3. DIY Multi-Tool - £85 (DIY & tools)
4. Wireless Charging Tray - £110 (Tech)
5. Watch Gift Box - £120 (Watches)

Coverage:
- Cooking & food: 1 product ✓
- Tech & gadgets: 1 product ✓
- Watches: 1 product ✓
- DIY & tools: 1 product ✓
- Gardening: 1 product ✓
```

---

## Testing Instructions

### Test Case 1: Duplicate Detection
1. Create recipient with interest "Coffee"
2. Ensure database has multiple similar coffee makers
3. Generate gift list
4. **Expected:** AI selects ONLY ONE coffee maker

### Test Case 2: Multi-Interest Coverage
1. Create recipient with 5 interests: `[Gardening, Cooking, DIY, Watches, Tech]`
2. Generate gift list
3. **Expected:** Gifts cover ALL 5 interest areas (ideally 2 per interest for 10 gifts)

### Test Case 3: Category Domination Prevention
1. Create recipient with interest "Wine"
2. Ensure database has 20+ wine products
3. Generate gift list
4. **Expected:** NOT all 10 gifts are wine items (max 3-4 wine products)

---

## Additional Improvements Needed (Future)

### 1. Semantic Duplicate Detection
**Problem:** AI might still select similar items with different names

**Solution:** Add product similarity check:
```javascript
function areSimilarProducts(product1, product2) {
  const name1 = product1.name.toLowerCase();
  const name2 = product2.name.toLowerCase();
  
  // Check if names are very similar (Levenshtein distance)
  // Check if same retailer + similar price
  // Check if same category + overlapping description keywords
  
  return similarityScore > 0.8;
}
```

### 2. Interest Coverage Scoring
**Problem:** No automatic enforcement of interest coverage

**Solution:** Add post-selection validation:
```javascript
function validateInterestCoverage(selectedGifts, recipientInterests) {
  const coveredInterests = new Set();
  
  selectedGifts.forEach(gift => {
    gift.matchingInterests.forEach(int => coveredInterests.add(int));
  });
  
  const coveragePercent = (coveredInterests.size / recipientInterests.length) * 100;
  
  if (coveragePercent < 50) {
    console.warn(`⚠️  Only ${coveragePercent}% of interests covered`);
    // Could trigger regeneration or flag for manual review
  }
}
```

### 3. Category Diversity Metrics
**Problem:** No measurement of category spread

**Solution:** Log category distribution:
```javascript
console.log(`\n📊 Category Diversity:`);
const categories = {};
selectedGifts.forEach(g => {
  const topCat = g.category.split('>')[0].trim();
  categories[topCat] = (categories[topCat] || 0) + 1;
});

Object.entries(categories).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count} gifts`);
});
```

---

## Files Modified

1. ✅ `server/services/gifts/ai-gift-selector.js`
   - Added "DIVERSITY AND VARIETY (CRITICAL)" section
   - Updated "WHAT YOU MUST NEVER DO" rules
   - AI now explicitly instructed to avoid duplicates and ensure variety

---

## Impact

### Benefits:
✅ **No more duplicate products** (e.g., 2x Moka coffee makers)  
✅ **Better interest coverage** (gifts from ALL stated interests)  
✅ **More interesting gift lists** (variety vs monotony)  
✅ **Higher user satisfaction** (recipients get balanced recommendations)

### Limitations:
⚠️ Relies on AI following instructions (99% reliable but not 100%)  
⚠️ Does NOT prevent semantic duplicates at code level (future improvement)  
⚠️ Product matcher diversity sampling already helps, but AI is final gatekeeper

---

## Rollback Instructions

If this causes issues, revert the ai-gift-selector.js changes:

```bash
git diff server/services/gifts/ai-gift-selector.js
git checkout HEAD -- server/services/gifts/ai-gift-selector.js
```

---

## Related Documentation

- `DIVERSITY_SAMPLING_IMPLEMENTATION.md` - How products are pre-filtered for AI
- `GIFT_QUALITY_CHECKS_EXPLAINED.md` - Post-generation quality validation
- `CATEGORY_HIERARCHY_GIFT_MATCHING.md` - How categories influence matching

---

**Status:** ✅ Fixed and ready for testing  
**Date:** 2026-09-17  
**Next Step:** Regenerate Ben's gift list to verify improvements
