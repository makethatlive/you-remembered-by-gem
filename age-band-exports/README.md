# Age Band Correction - Complete Process

**Total Products:** 614 Gem's curated products  
**Export Date:** September 21, 2026  
**Status:** ✅ Ready for AI processing

---

## 📊 Current State

### Gender Distribution:
- UNISEX: 329 products (54%)
- FEMALE: 190 products (31%)
- MALE: 95 products (15%)

### Age Band Distribution:
⚠️ **Problem Detected:**
- **18+: 597 products (97%)**
- 5-10: 17 products (3%)
- 11-17: 17 products (same 17 overlapping)

**Issue:** Almost all products marked as "18+" only. This is too restrictive!

**Example Problems:**
- Coffee makers → Should be 18-70, not just "18+"
- Gardening tools → Should include seniors (70+)
- LEGO sets → Should include kids AND adults
- Simple home decor → Should include all adults

---

## 🎯 Goal

Correct age bands so products are **appropriately broad** while respecting actual restrictions (like alcohol = 18+ only).

**Target Distribution (Ideal):**
- Most adult products → Multiple bands (18-30, 31-50, 51-70, sometimes 70+)
- Age-restricted (alcohol) → All adult bands (18+)
- Kids products → Appropriate child bands + sometimes teens/adults (e.g., LEGO)
- Tech gadgets → Younger adults (18-50), exclude seniors if complex

---

## 📝 Process Steps

### Step 1: Review AI Prompt Guide ✅ DONE

File: `AI_PROMPT_FOR_AGE_CORRECTION.md`

This explains:
- Age band definitions
- Assignment rules
- Examples
- Common mistakes

---

### Step 2: Load Exported Data

**Main File (for AI processing):**
```
gems-products-for-age-correction-2026-09-21T08-34-13.json
```

**CSV File (for manual review):**
```
gems-products-for-age-correction-2026-09-21T08-34-13.csv
```

Each product has:
```json
{
  "id": "prod_xyz",
  "index": 1,
  "name": "Product Name",
  "description": "Product description...",
  "category": "Category",
  "retailer": "Retailer Name",
  "price": 45.99,
  "current_gender": "UNISEX",
  "current_age_bands": ["18+"],  // ← To be corrected
  "interest_tags": ["Cooking & food"],
  
  // Fill these with AI:
  "corrected_age_bands": [],     // ← AI fills this
  "correction_reasoning": ""     // ← AI fills this
}
```

---

### Step 3: Send to AI for Correction

**Option A: Claude (Recommended)**

1. Open Claude (https://claude.ai)
2. Upload the JSON file
3. Paste this prompt:

```
I have 614 products that need age band corrections. Please review each product and assign appropriate age bands based on the rules in AI_PROMPT_FOR_AGE_CORRECTION.md.

For each product, fill in:
- corrected_age_bands: Array of appropriate age bands
- correction_reasoning: Brief explanation (1-2 sentences)

Use these exact age band values:
- UNDER_5 (0-4 years)
- FIVE_TO_10 (5-10 years)
- ELEVEN_TO_17 (11-17 years)
- EIGHTEEN_TO_30 (18-30 years)
- THIRTY_ONE_TO_50 (31-50 years)
- FIFTY_ONE_TO_70 (51-70 years)
- SEVENTY_PLUS (71+ years)

Rules:
1. Most products should have MULTIPLE age bands (not just one)
2. Coffee/tea/home decor → All adult bands (18+)
3. Alcohol → All adult bands (18+)
4. Tech gadgets → Younger adults (exclude seniors if complex)
5. Kids products → Appropriate child bands (can include adults for LEGO/toys)
6. Seniors → Include SEVENTY_PLUS for simple, traditional items

Process all 614 products and return the complete JSON with corrections.
```

4. Wait for AI to process (15-30 minutes)
5. Download corrected JSON

**Option B: ChatGPT**

Same process, but may need to split into batches (ChatGPT has file upload limits).

**Option C: Gemini**

Same process, but verify output format matches expected JSON structure.

---

### Step 4: Save Corrected Data

Save AI's output as:
```
gems-products-corrected-[DATE].json
```

**Verify format:**
```json
[
  {
    "id": "prod_xyz",
    "name": "Coffee Maker",
    "corrected_age_bands": ["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50", "FIFTY_ONE_TO_70"],
    "correction_reasoning": "Suitable for coffee-drinking adults. Excluded seniors due to digital controls."
  },
  ...
]
```

---

### Step 5: Review Corrections (Optional)

Quick sanity checks:

```bash
# Count products per age band
grep -o '"EIGHTEEN_TO_30"' gems-products-corrected.json | wc -l
grep -o '"SEVENTY_PLUS"' gems-products-corrected.json | wc -l
```

**Expected:**
- EIGHTEEN_TO_30: 500+ products
- SEVENTY_PLUS: 200-300 products (simple items)
- UNDER_5: ~20 products (baby items)

---

### Step 6: Apply Updates to Database

**Run update script:**

```bash
cd d:\you-remembered-by-gem
node scripts/update-age-bands.js age-band-exports/gems-products-corrected-[DATE].json
```

**What it does:**
1. Validates corrected data
2. Shows preview of changes
3. Waits 5 seconds (gives you time to cancel with Ctrl+C)
4. Updates database
5. Creates backup of changes

**Output:**
```
📥 Reading corrected data from: gems-products-corrected.json

✅ Loaded 614 products

📊 Validation Results:
   ✅ Valid updates: 614
   ⚠️  Skipped: 0
   ❌ Errors: 0

🚀 Ready to update 614 products.
   Press Ctrl+C to cancel, or wait 5 seconds to proceed...

🔄 Updating database...

   ✓ Coffee Maker
     Added: THIRTY_ONE_TO_50, FIFTY_ONE_TO_70
     Removed: None
     Reason: Suitable for adults who drink coffee...

   ✓ Garden Tool Set
     Added: FIFTY_ONE_TO_70, SEVENTY_PLUS
     Removed: None
     Reason: Simple garden tools appropriate for all adults...

✅ Update Complete!
   Successful: 614
   Failed: 0

📁 Backup saved to: backups/age-band-updates-2026-09-21.json
```

---

### Step 7: Verify in Database

```bash
# Check updated age bands
node scripts/verify-age-bands.js
```

Or manually query:

```sql
SELECT 
  COUNT(*) as total,
  unnest(suitable_age_bands) as age_band
FROM products
WHERE source_type = 'CURATED_PRODUCT'
GROUP BY age_band
ORDER BY total DESC;
```

**Expected output:**
```
EIGHTEEN_TO_30:     550 products
THIRTY_ONE_TO_50:   500 products
FIFTY_ONE_TO_70:    450 products
SEVENTY_PLUS:       250 products
ELEVEN_TO_17:       50 products
FIVE_TO_10:         30 products
UNDER_5:            20 products
```

---

## 🚨 Troubleshooting

### Issue 1: AI Output Format Wrong

**Problem:** AI returned markdown or incomplete JSON

**Solution:**
```
Tell AI: "Return ONLY valid JSON. No markdown, no explanations outside the JSON object."
```

### Issue 2: Invalid Age Band Values

**Problem:** AI used "18-30" instead of "EIGHTEEN_TO_30"

**Solution:**
```bash
# Fix with find/replace in JSON:
sed -i 's/"18-30"/"EIGHTEEN_TO_30"/g' gems-products-corrected.json
```

### Issue 3: Missing Fields

**Problem:** Some products missing `corrected_age_bands`

**Solution:**
```
Run validation before update:
node scripts/validate-corrections.js gems-products-corrected.json
```

### Issue 4: Too Many/Too Few Age Bands

**Problem:** AI assigned 1 band to everything OR 7 bands to everything

**Solution:**
- Review AI_PROMPT_FOR_AGE_CORRECTION.md
- Retry with clearer examples
- Manually review outliers

---

## 📦 Files Overview

```
age-band-exports/
├── README.md (this file)
├── AI_PROMPT_FOR_AGE_CORRECTION.md (AI instructions)
├── gems-products-for-age-correction-2026-09-21T08-34-13.json (export)
├── gems-products-for-age-correction-2026-09-21T08-34-13.csv (for review)
├── gems-products-corrected-[DATE].json (AI output - you create this)
└── backups/
    └── age-band-updates-[DATE].json (created after update)
```

---

## ✅ Success Criteria

After update, verify:
- [ ] Most adult products have 2-4 age bands
- [ ] Alcohol products include all adult bands (18+)
- [ ] Kids products have appropriate child bands
- [ ] Tech products exclude seniors if complex
- [ ] Simple items (tea sets, gardening) include SEVENTY_PLUS
- [ ] No products with ZERO age bands
- [ ] Database backup created successfully

---

## 🎉 Next Steps After Update

1. **Test gift matching:**
   - Create test recipients of different ages
   - Generate gift lists
   - Verify age-appropriate products appear

2. **Fix the age filtering bug:**
   ```bash
   # This will make age filtering actually work
   node scripts/fix-age-filtering-bug.js
   ```

3. **Monitor results:**
   - Check admin approval queue
   - Review gift lists for different age groups
   - Adjust if needed

---

**Questions? Issues? Check the troubleshooting section above or review the AI prompt guide.**

Good luck! 🚀
