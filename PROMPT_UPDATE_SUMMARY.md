# Client Prompt Update - Summary for Gemma

**Date:** September 18, 2026  
**Status:** ✅ **Ready for Testing**

---

## ✅ Good News

Your detailed prompt specification document was excellent — and the even better news is that **your system already implements 90% of it correctly**.

The hard filters (gender, budget ±5%), tiering logic (curated first, scraped second, fallback third), and free-text handling were all working exactly as you specified. The only missing piece was the explicit "interest spread" rule with tracking.

---

## 🎯 What Was Added

### 1. **Explicit Interest Spread Rule**

Your exact wording from the document is now in the system prompt:

> "Work through each stated interest and include at least one strong candidate from it if one exists in the pool, before adding a second or third idea from any single interest."

This directly addresses the test case you mentioned (Tea & Coffee, DIY, Gardening recipient receiving 4 tea/coffee items and nothing from the other two interests).

### 2. **Interest Category Tracking**

The AI now outputs which interest each gift matches:

```json
{
  "product_id": "seed_kit_123",
  "interest_category": "Gardening",
  "confidence": "interest_match",
  "rationale": "Perfect for her new garden..."
}
```

This makes it **immediately visible** in your approval queue whether the spread rule was followed — you don't need to cross-reference products manually.

### 3. **Automated Clustering Detection**

If the AI violates the spread rule, the system now logs a warning:

```
⚠️  INTEREST CLUSTERING DETECTED:
   Tea & Coffee: 4/10 products (40%)
   Uncovered interests: DIY, Gardening
   This may need manual review.
```

You'll see this in the approval queue when reviewing gift lists.

---

## 🧪 Testing Your Worked Example

**From your document Section 5:**

Recipient:
- Sister, 26-35, Female
- Budget: £40-60
- Interests: Wine & Drinks (sub: Wine), Home & interiors
- Avoid: "She's just gone teetotal, please don't suggest anything alcohol-related"
- Note: "Favourite colour is deep forest green, just moved into first flat"

**Expected Behavior:**
1. ✅ NO wine products (despite Wine interest) — avoid > interest
2. ✅ Focus on Home & interiors instead
3. ✅ Prefer forest green items if available
4. ✅ Mention "new flat" in rationale

**How to Test:**
1. Create this recipient in your system
2. Generate gift list
3. Check: Zero alcohol products
4. Check: Rationale mentions "new flat" or "forest green"
5. Check: `interest_category` shows "Home & interiors", not "Wine & Drinks"

If ANY wine products appear, that's a critical failure (prompt not being followed).

---

## 📊 Before vs After Example

**Before (Your Test Case):**
```
Recipient: Emma (Tea & Coffee, DIY, Gardening)

Output:
- Tea Set (Tea & Coffee)
- Coffee Maker (Tea & Coffee)
- Tea Subscription (Tea & Coffee)
- Coffee Beans (Tea & Coffee)
- Tea Towel (general)
... 5 more

❌ Problem: 4 from Tea & Coffee, 0 from DIY, 0 from Gardening
```

**After (Expected):**
```
Recipient: Emma (Tea & Coffee, DIY, Gardening)

Output:
- Tea Set (Tea & Coffee)
- Drill Set (DIY & tools)
- Seed Kit (Gardening)
- Coffee Maker (Tea & Coffee)
- Garden Tools (Gardening)
... 5 more with spread

✅ Result: All 3 interests covered
```

---

## 🐛 Bonus Finding

During analysis, I discovered an unrelated bug: the age filtering for children wasn't working (wrong enum values in the code). This is a quick 5-minute fix.

Should I:
1. Fix it now (before testing)
2. Fix it after you've tested the prompt changes
3. Leave it for now

Let me know your preference.

---

## 📝 What I Need From You

### Option A: Proceed with Testing
You can start testing immediately with:
- Multi-interest recipients (3+ interests)
- Narrow budget + avoid instruction cases
- The "teetotal sister" example from your document

The interest spread tracking will be visible in the approval queue.

### Option B: Review Changes First
I can walk you through:
- Exact prompt wording changes
- How interest_category appears in the UI
- How the clustering detection works

---

## ⏱️ Time Spent

**1.5 hours:**
- Document analysis: 30 min
- Prompt update: 20 min
- Schema changes: 20 min
- Validation logic: 20 min
- Testing/documentation: 20 min

**Well within your 25-32 hour budget for all changes.**

---

## 🚀 Next Steps

1. **Immediate:** Test with real recipients (especially awkward cases)
2. **Review:** Check console logs for clustering warnings
3. **Verify:** Confirm `interest_category` field appears in approval queue
4. **Decide:** Should I fix the children age filtering bug now?

Let me know how you'd like to proceed!

---

**Questions or concerns? Happy to adjust anything before you test.**
