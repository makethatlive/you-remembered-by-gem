# Children Age Bands - Quick Start

**Status:** ✅ **Ready to Process**  
**Total Products:** 83 Children products only  
**Location:** `age-band-exports/`

---

## 📊 What Was Exported

**File:** `children-products-for-age-correction-2026-09-21T08-42-08.json`

**Products:**
- Total: 83 children products
- Category: All marked as "Children"
- UNISEX: 35 products
- FEMALE: 22 products (girls)
- MALE: 26 products (boys)

---

## 🎯 Goal

Update age bands for children products using specific format:

**Age Bands to Use:**
- `1-2` (Toddlers)
- `3-4` (Preschoolers)
- `5-6` (Early primary)
- `7-8` (Primary school)
- `9-11` (Upper primary)
- `12-17` (Teenagers)

**Format:** Hyphenated (e.g., `1-2` NOT `1_2` or `1,2`)

---

## 🚀 Process (3 Simple Steps)

### Step 1: Open AI Tool

Go to: https://claude.ai (or ChatGPT/Gemini)

---

### Step 2: Upload Files & Send Prompt

**Upload these 2 files:**
1. `children-products-for-age-correction-2026-09-21T08-42-08.json`
2. `AI_PROMPT_CHILDREN_ONLY.md`

**Paste this prompt:**

```
Please correct age bands for all 83 CHILDREN products following AI_PROMPT_CHILDREN_ONLY.md rules.

For each product fill:
- corrected_child_age_bands: Array using EXACT hyphenated format
  (1-2, 3-4, 5-6, 7-8, 9-11, 12-17)
- correction_reasoning: Brief explanation

Key Rules:
✓ Most products need 2-3 age bands (be inclusive!)
✓ Simple toys (soft toys, rattles) → 1-2, 3-4
✓ Building blocks → 3-4, 5-6, 7-8
✓ LEGO (standard) → 5-6, 7-8, 9-11
✓ Advanced/tech → 9-11, 12-17
✓ Respect manufacturer age guidance
✓ Check for small parts (no 1-2 if choking hazard)

IMPORTANT: Use hyphen format "1-2" NOT "1_2" or "1,2"

Return complete JSON with corrections for all 83 products.
```

**Wait:** 5-15 minutes (AI processing time)

---

### Step 3: Apply Updates

**Download AI output and save as:**
```
age-band-exports/children-products-corrected.json
```

**Run update script:**
```bash
cd d:\you-remembered-by-gem
node scripts/update-children-age-bands.js age-band-exports/children-products-corrected.json
```

**What happens:**
1. Validates format (checks for `1-2` format)
2. Shows preview of changes
3. Waits 5 seconds (Ctrl+C to cancel)
4. Updates database
5. Shows statistics
6. Creates backup

**Done!** ✅

---

## 📋 Expected Output Example

**Before:**
```json
{
  "id": "prod_xyz",
  "name": "LEGO Classic Building Set",
  "current_age_bands": ["18+"],  // Wrong!
  "corrected_child_age_bands": []
}
```

**After AI:**
```json
{
  "id": "prod_xyz",
  "name": "LEGO Classic Building Set",
  "current_age_bands": ["18+"],
  "corrected_child_age_bands": ["5-6", "7-8", "9-11"],
  "correction_reasoning": "Classic LEGO suitable for ages 5-11. Manufacturer recommends 4+, complex enough to engage up to age 11."
}
```

**After Database Update:**
```sql
UPDATE products 
SET suitable_age_bands = ARRAY['5-6', '7-8', '9-11']
WHERE id = 'prod_xyz';
```

---

## 📊 Expected Statistics

### Before (Current):
```
Most products: ["18+"] (wrong for children!)
```

### After (Expected):
```
1-2: ~15 products (baby/toddler items)
3-4: ~25 products (preschool toys)
5-6: ~40 products (primary school)
7-8: ~45 products (primary school)
9-11: ~35 products (older kids)
12-17: ~20 products (teens)
```

**Note:** Products can have multiple bands, so totals > 83

---

## ✅ Quick Examples

### Soft Toy
**Name:** "Plush Teddy Bear"  
**Age Bands:** `["1-2", "3-4", "5-6"]`  
**Reason:** Safe for toddlers, appeals to young children

### Building Blocks
**Name:** "Wooden Blocks Set"  
**Age Bands:** `["3-4", "5-6", "7-8"]`  
**Reason:** Building blocks for preschool through early primary

### LEGO
**Name:** "LEGO City Set"  
**Age Bands:** `["7-8", "9-11", "12-17"]`  
**Reason:** Complex build suitable for older kids

### Picture Book
**Name:** "First Words Book"  
**Age Bands:** `["1-2", "3-4"]`  
**Reason:** Simple book for toddlers and preschoolers

---

## 🚨 Common Issues & Solutions

### Issue 1: AI Uses Wrong Format
**Problem:** AI returns `"1_2"` or `"1,2"`  
**Solution:** Remind AI: "Use hyphen format: 1-2, 3-4, 5-6, etc."

### Issue 2: Too Restrictive
**Problem:** AI assigns only 1 age band to everything  
**Solution:** Tell AI: "Most products need 2-3 age bands. Be more inclusive!"

### Issue 3: Too Broad
**Problem:** AI assigns `["1-2", "3-4", "5-6", "7-8", "9-11", "12-17"]` to everything  
**Solution:** Tell AI: "Consider complexity. Simple toys for younger ages, complex for older."

---

## ⏱️ Time Estimate

- ✅ Export: **Done** (1 minute)
- ⏭️ AI Processing: **5-15 minutes** (automated)
- ⏭️ Apply Updates: **2 minutes** (validation + update)
- **Total: ~15 minutes**

---

## 📁 Files Overview

```
age-band-exports/
├── AI_PROMPT_CHILDREN_ONLY.md                    ← AI instructions
├── children-products-for-age-correction...json   ← Export (83 products)
├── children-products-for-age-correction...csv    ← CSV for review
└── children-products-corrected.json              ← You create this (AI output)

scripts/
├── export-children-products.js                   ← ✅ Already ran
└── update-children-age-bands.js                  ← Ready to run
```

---

## ✅ Verification

After update, check:

```bash
# Verify age bands updated
SELECT 
  name,
  suitable_age_bands
FROM products
WHERE category = 'Children'
LIMIT 10;
```

**Expected:**
```
LEGO Set         | {5-6, 7-8, 9-11}
Soft Toy         | {1-2, 3-4, 5-6}
Picture Book     | {1-2, 3-4}
Craft Kit        | {7-8, 9-11, 12-17}
```

---

**Ready?** Go to Step 2 and start processing! 🚀

**Questions?** Check `AI_PROMPT_CHILDREN_ONLY.md` for detailed examples
