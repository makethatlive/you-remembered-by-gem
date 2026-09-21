# Gift Quality Checks After AI Generation

## Overview

After AI generates gift recommendations, the system runs **multiple quality checks** before showing gifts to users. This ensures gifts meet quality standards and are appropriate for the recipient.

## Quality Check Pipeline

```
AI Generates Gifts
      ↓
Step 1: AI Response Validation
      ↓
Step 2: Pre-Save Quality Validation
      ↓
Step 3: Gift List Saved to Database
      ↓
Step 4: Post-Save Quality Monitoring
      ↓
Decision: APPROVE or REJECT
```

---

## Step 1: AI Response Validation

**Location:** `server/services/gifts/ai-gift-selector.js` → `validateAndMapSelections()`

### Checks:
1. ✅ **Product ID matching**: Every AI recommendation must match a real product from candidates
2. ✅ **Response structure**: AI must return valid JSON with required fields
3. ✅ **Confidence levels**: Each gift must have confidence indicator (interest_match/general/fallback)

### What Happens:
- Valid products mapped to gift items
- Invalid product IDs logged as warnings
- If **0 valid selections**, falls back to score-based selection

### Example Output:
```
ℹ️  AI returned 10 recommendations (5 primary, 5 backup)
⚠️  Recommendation 8: product_id xyz123 not found in candidates
```

---

## Step 2: Pre-Save Quality Validation

**Location:** `server/services/gifts/gift-list-generator.js` → `validateGiftListQuality()`

### Checks Performed:

#### Check 2.1: Gift Count
- **Critical**: Must have at least 3 gifts
- **Warning**: Less than 5 gifts (thin catalogue coverage)
- **Ideal**: 10 gifts (5 primary + 5 backup)

```javascript
if (gifts.length < 3) {
  reasons.push('Only 2 gifts available (ideal is 5, may reflect thin catalogue coverage)');
}
```

#### Check 2.2: AI Reasoning Present
- **Critical**: Every gift must have `whyThisGift` reasoning
- **Length**: At least 20 characters
- **Purpose**: Explains to user why this gift was chosen

```javascript
const missingReasoning = gifts.filter(g => !g.whyThisGift || g.whyThisGift.length < 20);
if (missingReasoning.length > 0) {
  reasons.push('X gifts missing proper reasoning');
}
```

#### Check 2.3: Average Relevance Score
- **Threshold**: Average score must be ≥15
- **Calculation**: Sum of all product scores ÷ gift count
- **Lowered**: Previously 30, now 15 to allow fallback products

```javascript
avgScore = gifts.reduce((sum, g) => sum + (g.score || 0), 0) / gifts.length;
if (avgScore < 15) {
  reasons.push('Average relevance quite low: 14.2 (may be general fallback products)');
}
```

#### Check 2.4: Interest Matching
- **Threshold**: At least 40% of gifts should match recipient interests
- **Skip**: Not required if recipient has no interests (kids, minimal profiles)
- **Calculation**: Gifts with matching interest tags ÷ total gifts

```javascript
matchPercentage = (matchingGifts.length / gifts.length) * 100;
if (matchPercentage < 40) {
  reasons.push('Only 35% of gifts are strong interest matches');
}
```

#### Check 2.5: Retailer Diversity
- **Threshold**: No single retailer should have >70% of gifts
- **Purpose**: Ensures variety, avoids "all from Liberty" lists
- **Skip**: If less than 5 gifts

```javascript
if (retailerPercentage > 70) {
  reasons.push('75% of gifts from one retailer (may limit variety)');
}
```

### Outcome:
- **isValid: true** → Proceed to save
- **isValid: false** → Log warnings but **still proceed** (graceful degradation)

---

## Step 3: Post-Save Quality Monitoring

**Location:** `server/services/gifts/gift-quality-monitor.js` → `checkGiftListQuality()`

This is the **comprehensive quality check** after saving to database. It generates a full quality report.

### Check 3.1: Gift Count (Critical)
```javascript
✅ PASS: 10 gifts
⚠️  WARNING: 3-9 gifts (below target)
❌ FAIL: <3 gifts (insufficient)
```

### Check 3.2: AI Reasoning (Critical)
```javascript
❌ FAIL if ANY gift missing reasoning or reasoning < 20 chars
```

### Check 3.3: Interest Matching (Critical)

| Match % | Status | Action |
|---------|--------|--------|
| <25% | ❌ FAIL | Critical issue |
| 25-40% | ⚠️ WARNING | Moderate match |
| 40-60% | ✅ PASS | Good match |
| 60%+ | ✅ EXCELLENT | Ideal |

**Relaxed threshold**: 25% minimum (previously 40%) to accommodate LEGACY products with incomplete tags

### Check 3.4: Product Data Quality (Critical)

Each product checked for:
- ✅ Has name
- ✅ Has product URL
- ✅ Has description (≥20 chars) **EXCEPT** CURATED_PRODUCT (manually curated, pre-verified)
- ✅ Quality score ≥50 (if available)

```javascript
❌ FAIL if ANY product missing required fields
```

### Check 3.5: Relevance Scores

| Avg Score | Status | Action |
|-----------|--------|--------|
| <15 | ❌ FAIL | Too low |
| 15-30 | ⚠️ WARNING | Moderate relevance |
| 30+ | ✅ PASS | Good relevance |

### Check 3.6: Retailer Diversity (Warning Only)

```javascript
⚠️  WARNING if >50% gifts from single retailer
```

### Check 3.7: Budget Compliance (Warning Only)

```javascript
⚠️  WARNING if any gift outside recipient's budget range
```

---

## Quality Score Calculation

**Formula:**
```javascript
Score = 100
Score -= (critical_issues × 20)  // -20 points per critical issue
Score -= (warnings × 5)           // -5 points per warning
Score -= gift_count_penalty       // Penalty if <10 gifts

Final Score: 0-100
```

**Score Interpretation:**
- **90-100**: Excellent quality
- **70-89**: Good quality (acceptable)
- **50-69**: Moderate quality (review recommended)
- **<50**: Poor quality (likely rejected)

---

## Quality Report Example

```javascript
{
  giftListId: "abc123",
  recipientName: "Sarah Johnson",
  status: "acceptable",          // excellent | acceptable | failed
  qualityScore: 85,               // 0-100
  giftCount: 8,
  
  issues: [],                     // Critical issues (empty = good!)
  
  warnings: [
    {
      severity: "warning",
      code: "BELOW_TARGET_COUNT",
      message: "Generated 8 gifts (target is 10)"
    }
  ],
  
  stats: {
    interestMatchPercentage: "75.0",
    avgRelevanceScore: "34.2",
    retailerDiversity: 5,
    budgetCompliance: "100"
  },
  
  recommendation: "APPROVE"        // APPROVE | REVIEW | REJECT
}
```

---

## Decision Logic

### After Quality Monitoring:

```javascript
if (qualityReport.status === 'failed' && !isFallbackList) {
  // REJECT: Mark gift list as REJECTED
  status = 'REJECTED'
  visibleToSubscriber = false
  
  // Admin must review in approval queue
  return { status: 'rejected_quality', qualityReport }
}

if (isFallbackList && qualityReport.status === 'failed') {
  // EXCEPTION: Accept fallback lists even if quality fails
  // Reason: Better to offer something than nothing
  status = 'PENDING_APPROVAL'
  
  return { status: 'pending_approval', qualityReport }
}

if (qualityReport.status === 'acceptable' || qualityReport.status === 'excellent') {
  // APPROVE: Send to approval queue
  status = 'PENDING_APPROVAL'
  
  return { status: 'pending_approval', qualityReport }
}
```

### Fallback List Exception

**What is a fallback list?**
- >50% of gifts are from Tier 3 (GENERAL_FALLBACK)
- Means AI struggled to find interest-matching products
- Catalogue coverage is thin for this recipient profile

**Why allow lower quality?**
- Per client spec: "Better to offer 1-5 options than nothing"
- Graceful degradation instead of hard failure
- Admin can still review and improve

---

## Status Flow

```
AI Generates Gifts
      ↓
Quality Check Runs
      ↓
┌─────────────────────┬──────────────────────┐
│                     │                      │
│  ❌ REJECTED        │  ✅ PENDING_APPROVAL │
│  (quality failed)   │  (quality passed)    │
│                     │                      │
│  visibleToSub=false │  visibleToSub=false  │
│  Admin reviews      │  Admin reviews       │
│  in queue           │  in queue            │
│                     │                      │
│  Can regenerate     │  Can approve/reject  │
└─────────────────────┴──────────────────────┘
              ↓
      Admin Decision
              ↓
    ┌─────────────────┐
    │   ✅ APPROVED   │
    │                 │
    │ visibleToSub=   │
    │ true            │
    │                 │
    │ User sees gifts │
    └─────────────────┘
```

---

## Console Output Example

```
Finding products for Sarah Johnson...
   ✓ 143 candidates available

🎨 Applying diversity sampling to 143 products...
   ✅ Final diversity: 8 categories, 12 retailers
   ⚡ Selected 20 diverse products for AI (from 143 candidates)

Selecting best gifts from 20 candidates...
   ℹ️  AI returned 10 recommendations (5 primary, 5 backup)

Running quality monitoring check...
   ✅ Gift count: 10
   ✅ All gifts have reasoning
   ✅ Interest match: 80%
   ✅ Avg relevance: 42.3
   ✅ Retailer diversity: 6
   ✅ Budget compliance: 100%

Quality Score: 95/100
Recommendation: APPROVE
Status: pending_approval
```

---

## Quality Check Configuration

### Thresholds (can be adjusted):

| Check | Threshold | Configurable? |
|-------|-----------|---------------|
| Min gift count | 3 | ✅ Yes |
| Min reasoning length | 20 chars | ✅ Yes |
| Min interest match | 25% | ✅ Yes |
| Min avg score | 15 | ✅ Yes |
| Min quality score | 50 | ✅ Yes |
| Max retailer % | 50% | ✅ Yes |

### Where to Change:
- `gift-list-generator.js` → `validateGiftListQuality()` (pre-save checks)
- `gift-quality-monitor.js` → `checkGiftListQuality()` (post-save checks)

---

## Common Quality Issues & Fixes

### Issue 1: Low Interest Matching (<40%)
**Cause:** Product catalogue doesn't have enough items matching recipient interests  
**Fix:** Import more products in those categories, or relax threshold

### Issue 2: Missing Reasoning
**Cause:** AI response parsing failed or AI didn't provide rationale  
**Fix:** Check Claude API response format, ensure prompt requests reasoning

### Issue 3: Low Relevance Scores
**Cause:** Product matcher couldn't find good matches (thin catalogue)  
**Fix:** Fallback products accepted; admin can regenerate or curate manually

### Issue 4: Poor Retailer Diversity
**Cause:** One retailer dominates the catalogue  
**Fix:** Diversity sampling now enforces max 3-4 products per retailer

### Issue 5: Budget Mismatch
**Cause:** Product prices changed, or budget filter not working  
**Fix:** Re-scrape prices, check budget filter in product-matcher

---

## Related Files

- `server/services/gifts/ai-gift-selector.js` - AI response validation
- `server/services/gifts/gift-list-generator.js` - Pre-save validation
- `server/services/gifts/gift-quality-monitor.js` - Post-save monitoring
- `server/services/gifts/product-matcher.js` - Candidate selection & scoring

---

## Summary

The system runs **7 quality checks** after AI generates gifts:

1. ✅ **Product ID validation** (must match candidates)
2. ✅ **Gift count** (min 3, target 10)
3. ✅ **AI reasoning** (all gifts must have explanation)
4. ✅ **Interest matching** (min 25% match)
5. ✅ **Product data quality** (name, URL, description)
6. ✅ **Relevance scores** (avg ≥15)
7. ✅ **Retailer diversity** (no single retailer >50%)

**Result:** Quality score 0-100 → APPROVE, REVIEW, or REJECT

**Graceful degradation:** System accepts lower quality if catalogue is thin, per client spec: "Better to offer something than nothing"
