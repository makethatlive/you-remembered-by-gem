# Gift Quality Checks - Quick Reference

## 🔍 Quality Check Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: AI GENERATES GIFTS (10 recommendations)               │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  ✓ Product IDs valid?                                           │
│  ✓ Response structure correct?                                  │
│  ✓ Each gift has reasoning?                                     │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: PRE-SAVE VALIDATION                                   │
│  ─────────────────────────────────────────────────────────      │
│  ⚠️  Gift count < 3?                                            │
│  ⚠️  Missing reasoning?                                         │
│  ⚠️  Average score < 15?                                        │
│  ⚠️  Interest match < 40%?                                      │
│  ⚠️  One retailer > 70%?                                        │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  SAVE TO DATABASE                                               │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3: POST-SAVE QUALITY MONITORING (Comprehensive)          │
│  ─────────────────────────────────────────────────────────      │
│  ❌ Gift count < 3?                          → CRITICAL FAIL    │
│  ❌ Missing reasoning?                        → CRITICAL FAIL    │
│  ❌ Interest match < 25%?                     → CRITICAL FAIL    │
│  ❌ Poor product data quality?                → CRITICAL FAIL    │
│  ❌ Average score < 15?                       → CRITICAL FAIL    │
│  ⚠️  Retailer diversity low?                 → WARNING          │
│  ⚠️  Budget mismatch?                        → WARNING          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  CALCULATE QUALITY SCORE (0-100)                                │
│  ────────────────────────────────────────────────────────       │
│  Score = 100                                                    │
│       - (critical issues × 20)                                  │
│       - (warnings × 5)                                          │
│       - gift count penalty                                      │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  DECISION:                                                      │
│                                                                 │
│  ❌ Score < 50 & not fallback → REJECTED                       │
│  ✅ Score ≥ 50 → PENDING_APPROVAL                              │
│  ⚠️  Fallback list → ACCEPT (even if score < 50)              │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN APPROVAL QUEUE                                           │
│  ────────────────────────────────────────────────────────       │
│  Admin reviews → APPROVE or REJECT                              │
│  If approved → visibleToSubscriber = true                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Quality Checks Summary

| # | Check | Severity | Threshold | Action if Failed |
|---|-------|----------|-----------|------------------|
| 1 | **Gift Count** | ❌ Critical | Min 3 gifts | REJECT |
| 2 | **AI Reasoning** | ❌ Critical | All gifts have reasoning (≥20 chars) | REJECT |
| 3 | **Interest Match** | ❌ Critical | ≥25% of gifts match interests | REJECT |
| 4 | **Product Quality** | ❌ Critical | Name, URL, description present | REJECT |
| 5 | **Relevance Score** | ❌ Critical | Average ≥15 | REJECT |
| 6 | **Retailer Diversity** | ⚠️ Warning | <50% from one retailer | WARNING |
| 7 | **Budget Compliance** | ⚠️ Warning | All within budget range | WARNING |

---

## 🎯 Quality Score Bands

| Score | Status | Recommendation |
|-------|--------|----------------|
| **90-100** | 🟢 Excellent | Auto-approve safe |
| **70-89** | 🟡 Good | Approve with confidence |
| **50-69** | 🟠 Moderate | Review recommended |
| **<50** | 🔴 Poor | Reject or regenerate |

---

## 📈 Interest Matching Levels

| Match % | Rating | Example |
|---------|--------|---------|
| **60%+** | 🟢 Excellent | 6-10 gifts match interests |
| **40-60%** | 🟡 Good | 4-6 gifts match interests |
| **25-40%** | 🟠 Moderate | 2-4 gifts match interests |
| **<25%** | 🔴 Poor | 0-2 gifts match interests |

---

## ⚠️ Common Rejection Reasons

### 1. "Only 2 gifts available (minimum 3 required)"
**Cause:** Catalogue too thin for this recipient profile  
**Fix:** Import more products or adjust recipient filters

### 2. "Only 20% of gifts match recipient interests (minimum 25%)"
**Cause:** Not enough products in recipient's interest categories  
**Fix:** Import products in those interest areas

### 3. "Average relevance score 12.4 is too low (minimum 15)"
**Cause:** AI selected low-scoring products (fallback tier)  
**Fix:** Check if this is a fallback list (accepted) or regenerate

### 4. "3 gifts missing AI reasoning"
**Cause:** AI response parsing failed  
**Fix:** Check Claude API response, ensure prompt requests reasoning

### 5. "2 products have poor data quality"
**Cause:** Missing name, URL, or description  
**Fix:** Re-scrape products or fix import data

---

## ✅ What Makes a Good Gift List?

### Excellent Quality (Score 90+):
```
✓ 10 gifts (5 primary, 5 backup)
✓ 80%+ match recipient interests
✓ Average relevance score 40+
✓ 5+ different retailers
✓ All gifts have detailed reasoning
✓ 100% within budget
✓ No data quality issues
```

### Acceptable Quality (Score 70-89):
```
✓ 5-9 gifts
✓ 40-80% match interests
✓ Average score 25-40
✓ 3-4 different retailers
✓ All gifts have reasoning
✓ Minor budget variations
```

### Rejected Quality (Score <50):
```
✗ <3 gifts
✗ <25% match interests
✗ Average score <15
✗ Most gifts from one retailer
✗ Missing reasoning
✗ Poor product data
```

---

## 🔄 Fallback List Exception

**What is it?**  
When >50% of gifts are from Tier 3 (GENERAL_FALLBACK), meaning AI couldn't find enough interest-matching products.

**Why accept lower quality?**  
Per client spec: "Better to offer something than nothing"

**What happens?**  
- Quality check may fail (score <50)
- BUT list is still marked PENDING_APPROVAL (not REJECTED)
- Admin can review and decide whether to approve or regenerate

```
if (isFallbackList && qualityReport.status === 'failed') {
  // Accept it anyway - graceful degradation
  status = 'PENDING_APPROVAL'
}
```

---

## 🛠️ Quality Check Files

| File | Purpose |
|------|---------|
| `ai-gift-selector.js` | AI response validation |
| `gift-list-generator.js` | Pre-save validation |
| `gift-quality-monitor.js` | Post-save comprehensive checks |
| `product-matcher.js` | Candidate selection & scoring |

---

## 📝 Example Quality Report

```javascript
{
  status: "excellent",
  qualityScore: 95,
  giftCount: 10,
  
  issues: [],  // No critical issues!
  
  warnings: [],  // No warnings!
  
  stats: {
    interestMatchPercentage: "80.0",
    avgRelevanceScore: "42.3",
    retailerDiversity: 6,
    budgetCompliance: "100"
  },
  
  recommendation: "APPROVE"
}
```

---

## 🚀 Next Steps After Quality Check

1. **If REJECTED**: Admin sees in approval queue with rejection reasons
2. **If PENDING_APPROVAL**: Admin reviews and approves/rejects
3. **If APPROVED**: User sees gift list with all recommendations
4. **If REGENERATED**: New candidate products fetched, AI tries again

---

**Full Documentation:** See `GIFT_QUALITY_CHECKS_EXPLAINED.md`
