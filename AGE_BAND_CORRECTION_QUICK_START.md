# Age Band Correction - Quick Start

**Status:** ✅ **Ready to Process**  
**Total Products:** 614  
**Location:** `age-band-exports/`

---

## 🎯 Problem

Current database has almost ALL products marked as "18+" only:
- 597 products → "18+" (too restrictive!)
- Only 17 products → Have specific age ranges

**This means:**
- ❌ Seniors (70+) don't see products meant for them
- ❌ Young adults (18-30) see same products as seniors
- ❌ Kids products mixed with adults

---

## ✅ Solution (3 Simple Steps)

### Step 1: Get Exported File

**Already exported:** ✅
```
age-band-exports/gems-products-for-age-correction-2026-09-21T08-34-13.json
```

**What's in it:** 614 products with:
- Product ID, name, description
- Current age bands (mostly wrong)
- Empty fields for corrections

---

### Step 2: Send to AI

**Upload to Claude/ChatGPT:**

1. Go to https://claude.ai (or ChatGPT)
2. Upload: `gems-products-for-age-correction-2026-09-21T08-34-13.json`
3. Also upload: `age-band-exports/AI_PROMPT_FOR_AGE_CORRECTION.md`

**Paste this prompt:**

```
Please correct the age bands for all 614 products following the rules in AI_PROMPT_FOR_AGE_CORRECTION.md.

For each product, fill in:
- corrected_age_bands: Array of age bands using these exact values:
  * UNDER_5, FIVE_TO_10, ELEVEN_TO_17
  * EIGHTEEN_TO_30, THIRTY_ONE_TO_50, FIFTY_ONE_TO_70, SEVENTY_PLUS

- correction_reasoning: Brief explanation

Key rules:
✓ Most products should have 2-4 age bands (be broad!)
✓ Coffee/tea/home decor → All adult bands
✓ Alcohol → All adult bands (18+)
✓ Tech gadgets → Younger adults only
✓ Simple items → Include SEVENTY_PLUS

Return the complete JSON with all corrections.
```

**Wait:** 15-30 minutes for AI to process

**Download:** Corrected JSON

---

### Step 3: Apply Updates

**Save AI output as:**
```
age-band-exports/gems-products-corrected.json
```

**Run update script:**
```bash
cd d:\you-remembered-by-gem
node scripts/update-age-bands.js age-band-exports/gems-products-corrected.json
```

**What happens:**
1. Validates corrections ✓
2. Shows preview
3. Waits 5 seconds (press Ctrl+C to cancel)
4. Updates database
5. Creates backup

**Done!** ✅

---

## 📊 Expected Results

### Before:
```
18+: 597 products (97%)
```

### After:
```
EIGHTEEN_TO_30:     550 products (90%)
THIRTY_ONE_TO_50:   500 products (81%)
FIFTY_ONE_TO_70:    450 products (73%)
SEVENTY_PLUS:       250 products (41%)
ELEVEN_TO_17:       50 products  (8%)
FIVE_TO_10:         30 products  (5%)
UNDER_5:            20 products  (3%)
```

**More overlap = Better matching!**

---

## 🎯 Real Examples

### Example 1: Coffee Maker
**Before:** `["18+"]`  
**After:** `["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50", "FIFTY_ONE_TO_70"]`  
**Why:** Suitable for coffee-drinking adults, but excluded seniors due to digital controls

### Example 2: Garden Tool Set
**Before:** `["18+"]`  
**After:** `["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50", "FIFTY_ONE_TO_70", "SEVENTY_PLUS"]`  
**Why:** Simple hand tools, perfect for all adults including seniors

### Example 3: Smart Watch
**Before:** `["18+"]`  
**After:** `["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50"]`  
**Why:** Tech gadget requiring smartphone setup, too complex for seniors

---

## ⏱️ Time Estimate

- Export: ✅ **Done** (2 minutes)
- AI Processing: **15-30 minutes** (automated)
- Apply Updates: **5 minutes** (validation + database update)
- **Total: ~30 minutes** (mostly waiting for AI)

---

## 🚨 Quick Troubleshooting

**Problem:** AI returns markdown instead of JSON
**Solution:** Tell AI: "Return ONLY valid JSON, no markdown"

**Problem:** AI uses wrong values like "18-30"
**Solution:** Remind AI to use exact values: `EIGHTEEN_TO_30`

**Problem:** Some products skipped
**Solution:** Check `corrected_age_bands` is not empty array

---

## 📁 Files You Need

✅ **Already Created:**
1. `age-band-exports/gems-products-for-age-correction-2026-09-21T08-34-13.json` (export)
2. `age-band-exports/AI_PROMPT_FOR_AGE_CORRECTION.md` (instructions for AI)
3. `scripts/update-age-bands.js` (update script)
4. `age-band-exports/README.md` (detailed guide)

🔜 **You Will Create:**
5. `age-band-exports/gems-products-corrected.json` (AI output)

---

## ✅ Next Steps

1. **Open Claude/ChatGPT**
2. **Upload 2 files:**
   - gems-products-for-age-correction-2026-09-21T08-34-13.json
   - AI_PROMPT_FOR_AGE_CORRECTION.md
3. **Paste prompt from Step 2 above**
4. **Wait for AI**
5. **Download corrected JSON**
6. **Run update script**
7. **Done!**

---

**Need help? Check:** `age-band-exports/README.md` for detailed troubleshooting

**Ready?** Start with Step 2! 🚀
