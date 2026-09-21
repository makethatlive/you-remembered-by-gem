# Quality Check Issues & Fixes

**Date:** September 21, 2026  
**Priority:** HIGH - Wasting money on AI calls before quality rejection

---

## 🚨 Critical Issues Found

### Issue 1: Old Age Band Format in Database
**Problem:**
```
Age Band: THIRTY_ONE_TO_50  ❌ OLD ENUM
```

**Impact:**
- Products have new format: `["36-45", "46-55"]`
- Recipient has old format: `THIRTY_ONE_TO_50`
- Age overlap check fails → No products match
- AI gets sent 10 products but with poor matches

**Solution:**
Need to migrate ALL recipient age bands from old enums to new format.

**Old Enums → New Format Mapping:**
```
UNDER_5          → "1-2" or "3-4"
FIVE_TO_TEN      → "5-6", "7-8", or "9-11"
ELEVEN_TO_17     → "12-17"
EIGHTEEN_TO_30   → "18-25" or "26-35"
THIRTY_ONE_TO_50 → "36-45" or "46-55"
FIFTY_TO_SIXTY_FIVE → "56-65"
SIXTY_FIVE_PLUS  → "66-75" or "75+"
```

---

### Issue 2: Quality Check AFTER AI Call
**Problem:**
```
Flow: Product Matcher → AI Selection ($0.042) → Quality Check → REJECT
```

**Impact:**
- AI call costs $0.042
- Quality check rejects after payment
- Money wasted on every rejection

**Current Cost Example:**
- Ben's list: $0.042 wasted (rejected for 0% interest match)
- If 50% rejection rate: Half of AI costs wasted

**Solution:**
Move quality checks BEFORE AI call:

1. **Pre-AI Quality Gate:**
   - Check if candidates have good interest match
   - Check if candidates have good quality scores
   - Check if enough retailer diversity
   - Only send to AI if quality threshold met

2. **Post-AI Quality Check:** (Keep for final validation)
   - Check AI reasoning quality
   - Check gift diversity
   - Check budget compliance

---

### Issue 3: Interest Match Calculation Wrong
**Problem:**
```
Product Matcher Log: "Found 125 premium curated with interest match"
Quality Monitor Result: "0% interest match"
```

**Root Cause:**
Quality monitor checks `product.interestTags[]` but:
- Old/migrated products may not have `interestTags` populated
- Product matcher uses multiple sources: `interestTags`, `giftTypeTags`, `searchKeywords`, `category`
- Quality monitor is too strict

**Solution:**
Make quality monitor use same logic as product matcher:
- Check `interestTags` (exact match)
- Check `giftTypeTags` (gift type match)
- Check `category` (category match)
- Check `searchKeywords` (keyword match)

Or better: Store the match signals from product matcher in gift items.

---

## 🛠️ Proposed Fixes

### Fix 1: Migrate Recipient Age Bands
**Script:** `scripts/migrate-recipient-age-bands.js`

**Logic:**
```javascript
// For each recipient with old enum:
// THIRTY_ONE_TO_50 → Ask user to specify exact range
// Or use smart detection:
// - If age 31-40 → "36-45"
// - If age 41-50 → "46-55"
// - If age data not available → default to middle of range
```

**Impact:** All recipients will have new format age bands

---

### Fix 2: Add Pre-AI Quality Gate
**Location:** `server/services/gifts/gift-list-generator.js`

**New Flow:**
```javascript
async generateGiftList(params) {
  // ... existing code ...
  
  // Step 3: Find matching products
  const candidates = await this.productMatcher.findMatchingProducts(...);
  
  // ✅ NEW: Pre-AI Quality Gate
  const preAIQuality = this.validateCandidatesQuality(candidates, recipient);
  
  if (!preAIQuality.passesThreshold) {
    console.warn('⚠️  Candidates quality below threshold:');
    console.warn(`   - Interest match: ${preAIQuality.interestMatchRate}% (need 30%+)`);
    console.warn(`   - Avg quality score: ${preAIQuality.avgQualityScore} (need 60+)`);
    
    // Option 1: Return error immediately (no AI call)
    return {
      status: 'insufficient_quality',
      message: 'Candidate products do not meet quality threshold',
      qualityIssues: preAIQuality.issues
    };
    
    // Option 2: Flag as "low quality" but proceed (for thin catalogues)
    // Mark list as "needs_review" upfront
  }
  
  // Step 4: AI selection (only if quality gate passed)
  const selectedGifts = await this.giftSelector.selectGifts(candidates, recipient);
  
  // Step 5: Post-AI quality check (for final validation)
  // ... existing code ...
}
```

**New Function:**
```javascript
validateCandidatesQuality(candidates, recipient) {
  const recipientInterests = recipient.interests || [];
  
  // Check 1: Interest match rate in candidates
  const matchingCandidates = candidates.filter(c => {
    return this.productMatcher.matcher.hasInterestMatch(c, recipient);
  });
  const interestMatchRate = (matchingCandidates.length / candidates.length) * 100;
  
  // Check 2: Average quality score
  const avgQualityScore = candidates.reduce((sum, c) => 
    sum + (c.qualityScore || 0), 0) / candidates.length;
  
  // Check 3: Retailer diversity
  const retailers = new Set(candidates.map(c => c.retailerId));
  
  const passesThreshold = 
    interestMatchRate >= 30 && // At least 30% interest match
    avgQualityScore >= 60 &&   // Average quality 60+
    retailers.size >= 2;       // At least 2 different retailers
  
  return {
    passesThreshold,
    interestMatchRate,
    avgQualityScore,
    retailerCount: retailers.size,
    issues: !passesThreshold ? [
      interestMatchRate < 30 ? 'Low interest match in candidates' : null,
      avgQualityScore < 60 ? 'Low quality scores' : null,
      retailers.size < 2 ? 'Low retailer diversity' : null
    ].filter(Boolean) : []
  };
}
```

**Impact:**
- Saves $0.042 per rejected list
- If 50% rejection rate: Saves 50% of AI costs
- Faster feedback to user (no AI delay before rejection)

---

### Fix 3: Improve Interest Match Detection in Quality Monitor
**Location:** `server/services/gifts/gift-quality-monitor.js`

**Current Code:**
```javascript
// Check 3: Interest matching
const recipientInterests = (recipient.interests || []).map(i => i.toLowerCase());
const matchingGifts = gifts.filter(gift => {
  const productTags = (gift.product?.interestTags || []).map(t => t.toLowerCase());
  return recipientInterests.some(ri => productTags.includes(ri));
});
```

**Problem:** Only checks `interestTags`, ignores other signals

**New Code:**
```javascript
// Check 3: Interest matching (comprehensive)
const recipientInterests = (recipient.interests || []).map(i => i.toLowerCase());
const matchingGifts = gifts.filter(gift => {
  const product = gift.product;
  if (!product) return false;
  
  // Check multiple sources (same as product matcher)
  const productTags = (product.interestTags || []).map(t => t.toLowerCase());
  const giftTypeTags = (product.giftTypeTags || []).map(t => t.toLowerCase());
  const searchKeywords = (product.searchKeywords || []).map(k => k.toLowerCase());
  const category = (product.category || '').toLowerCase();
  
  // Match if found in any source
  return recipientInterests.some(ri => 
    productTags.includes(ri) ||
    giftTypeTags.includes(ri) ||
    searchKeywords.includes(ri) ||
    category.includes(ri)
  );
});
```

**Better Solution:** Store match signals in gift items during AI selection:
```javascript
// In ai-gift-selector.js, when saving gifts:
await prisma.giftItem.create({
  data: {
    // ... existing fields ...
    matchedInterests: matchedInterests, // NEW: Store which interests matched
    matchSignals: product.matchSignals, // NEW: Store match reasoning from product-matcher
  }
});

// Then in quality monitor:
const matchingGifts = gifts.filter(g => 
  g.matchedInterests && g.matchedInterests.length > 0
);
```

**Impact:**
- Accurate interest match detection
- Fewer false rejections
- Better quality reports

---

## 📊 Expected Improvements

### Before Fixes:
- ❌ 50% lists rejected AFTER AI call
- ❌ $0.042 wasted per rejection
- ❌ 0% interest match false positives
- ❌ Old age bands causing mismatches

### After Fixes:
- ✅ Pre-AI quality gate saves AI costs on bad candidates
- ✅ Accurate interest match detection
- ✅ All recipients with new age band format
- ✅ Better quality reports

### Cost Savings (Example):
If 100 lists generated per month:
- Before: 50 rejected × $0.042 = **$2.10 wasted/month**
- After: 10 rejected × $0.042 = **$0.42 wasted/month**
- **Savings: $1.68/month** (80% reduction in wasted AI costs)

---

## 🚀 Implementation Priority

1. **HIGH:** Fix recipient age bands (blocking current generation)
2. **HIGH:** Add pre-AI quality gate (saves money immediately)
3. **MEDIUM:** Improve interest match detection (better accuracy)

---

## 📝 Notes

- Fix 1 requires database migration (can be done via script)
- Fix 2 requires code changes in gift-list-generator.js
- Fix 3 requires code changes in gift-quality-monitor.js
- All fixes are backward compatible
