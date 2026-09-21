# Age Band Migration: Quick Start Guide

## Summary

**Goal**: Replace rigid age band enums with flexible numeric ranges across all products  
**Scope**: 5,428 non-Gem Pick products (catalogue + Shopify uploads)  
**Timeline**: 8-12 hours (including AI processing)

---

## Current Status ✅

### Phase 1: Export (COMPLETE)

**Products exported**: 5,428  
**Export files**:
- JSON: `age-band-exports/non-gem-pick-products-2026-09-21T10-08-18.json`
- CSV: `age-band-exports/non-gem-pick-products-2026-09-21T10-08-18.csv`

**Breakdown**:
- CURATED_RETAILER: 2,098 products
- SHOPIFY_UPLOAD: 3,330 products
- All products have age bands set

**Current age band formats** (mixed):
- ✅ Already flexible: `"5-10"`, `"Under 5"` 
- ❌ Old enums: `"EIGHTEEN_TO_30"`, `"ELEVEN_TO_17"`, `"FIFTY_ONE_PLUS"`, `"THIRTY_ONE_TO_50"`

---

## Next Steps

### Step 1: Send to Grok AI (MANUAL - 1-2 hours)

1. **Upload the JSON file** to Grok AI:
   ```
   age-band-exports/non-gem-pick-products-2026-09-21T10-08-18.json
   ```

2. **Use this prompt**:
   ```
   age-band-exports/AI_PROMPT_AGE_RECLASSIFICATION.md
   ```

3. **AI will**:
   - Analyze each product (name, description, category)
   - Replace enum age bands with flexible ranges
   - Add `new_age_bands` (e.g., `["18-30", "31-50"]`)
   - Add `reasoning` (explanation for age band choice)

4. **Save AI output as**:
   ```
   age-band-exports/non-gem-pick-products-reclassified.json
   ```

---

### Step 2: Update Database (10 minutes)

```bash
node scripts/update-age-bands-flexible.js age-band-exports/non-gem-pick-products-reclassified.json
```

**What it does**:
- Validates new age bands format (`"1-2"`, `"18-30"`, `"51+"`)
- Creates backup before updating
- Updates `suitableAgeBands` in database for all 5,428 products
- Shows summary and distribution

---

### Step 3: Update Codebase (4-6 hours)

See detailed plan: `AGE_BAND_MIGRATION_PLAN.md`

**Critical files to update**:

#### 1. Age Matching Logic (HIGH PRIORITY)
- `server/services/gifts/product-matcher.js` - Add flexible range overlap logic
- `src/components/onboarding/options.jsx` - Remove enum mapping functions
- `src/components/admin/CatalogSwapPicker.jsx` - Use range overlap check

#### 2. UI Components (MEDIUM PRIORITY)
- `src/components/admin/ProductAddForm.jsx` - Allow flexible age band input
- `src/components/admin/ProductEditForm.jsx` - Same as ProductAddForm
- `src/components/admin/ApprovalDetail.jsx` - Remove enum label mapping
- `src/lib/format.js` - Remove/update AGE_BAND_LABEL

#### 3. Constants (LOW PRIORITY)
- Search and remove old enum constants (`UNDER_5`, `EIGHTEEN_TO_30`, etc.)

---

### Step 4: Testing (2-3 hours)

**Test cases**:
1. ✅ Generate gift list → products match recipient age correctly
2. ✅ Add new product with custom age bands → saves correctly
3. ✅ Edit existing product → age bands display and update
4. ✅ Admin products table → age bands display correctly
5. ✅ Approval queue → recipient age bands show correctly

---

## Age Range Overlap Logic

**Key function to implement**:

```javascript
/**
 * Check if recipient's age band overlaps with product age bands.
 * 
 * @param {string} recipientBand - e.g., "18-30", "5-10", "51+"
 * @param {string[]} productBands - e.g., ["18-30", "31-50"]
 * @returns {boolean} - true if any overlap
 */
function doAgeRangesOverlap(recipientBand, productBands) {
  // Implementation in AGE_BAND_MIGRATION_PLAN.md
}
```

**Examples**:
- `doAgeRangesOverlap("25-35", ["18-40"])` → `true` (subset)
- `doAgeRangesOverlap("5-10", ["1-7", "8-12"])` → `true` (overlap)
- `doAgeRangesOverlap("18-30", ["51+"])` → `false` (no overlap)

---

## Age Band Format Reference

### **EXACT ONBOARDING FORM RANGES** (Use these only):

### Children (1-17)
```javascript
"1-2"    // Babies/toddlers
"3-4"    // Preschoolers
"5-6"    // Early school
"7-8"    // School age
"9-11"   // Pre-teens
"12-17"  // Teenagers
```

### Adults (18+)
```javascript
"18-25"  // Young adults
"26-35"  // Young professionals
"36-45"  // Mid-career
"46-55"  // Established adults
"56-65"  // Pre-retirement
"66-75"  // Active retirees
"75+"    // Seniors
```

### ⚠️ IMPORTANT:
- ✅ **ONLY use these exact ranges** - no custom ranges allowed
- ✅ Products can have multiple ranges (e.g., `["5-6", "7-8", "9-11"]`)
- ❌ DO NOT use: `"18-30"`, `"18+"`, `"5-10"`, `"1-4"` (not in onboarding form)

### Common Enum → New Range Mappings:
```javascript
// Old enum → New onboarding ranges
"UNDER_5"         → ["1-2", "3-4"]
"FIVE_TO_10"      → ["5-6", "7-8", "9-11"]
"ELEVEN_TO_17"    → ["9-11", "12-17"] or ["12-17"]
"EIGHTEEN_TO_30"  → ["18-25", "26-35"]
"THIRTY_ONE_TO_50"→ ["36-45", "46-55"]
"FIFTY_ONE_PLUS"  → ["56-65", "66-75", "75+"]
```

---

## Files Created

### Scripts
- ✅ `scripts/export-non-gem-pick-products.js` - Export for AI
- ✅ `scripts/update-age-bands-flexible.js` - Update database

### Documentation
- ✅ `age-band-exports/AI_PROMPT_AGE_RECLASSIFICATION.md` - AI instructions
- ✅ `AGE_BAND_MIGRATION_PLAN.md` - Detailed plan
- ✅ `AGE_BAND_MIGRATION_QUICK_START.md` - This file

### Data Files
- ✅ `age-band-exports/non-gem-pick-products-2026-09-21T10-08-18.json` - Exported data
- ✅ `age-band-exports/non-gem-pick-products-2026-09-21T10-08-18.csv` - CSV format
- ⏳ `age-band-exports/non-gem-pick-products-reclassified.json` - AI output (pending)

---

## Important Notes

✅ **Children products already done**: 83 children products already have flexible format from previous migration

⚠️ **Mixed formats in export**: Some products already use flexible format (`"5-10"`), others use enums (`"EIGHTEEN_TO_30"`) - AI will normalize ALL to flexible format

✅ **No schema changes needed**: `suitableAgeBands String[]` already supports any format

✅ **Gem's Picks excluded**: Only non-curated products being updated (5,428 products)

✅ **Backup automatic**: Update script creates backup before any changes

---

## Rollback

If issues occur:

```bash
# Restore from backup (path shown in update script output)
node scripts/restore-age-bands.js age-band-exports/backups/age-band-updates-YYYY-MM-DDTHH-MM-SS.json

# Or revert code changes via git
git checkout HEAD -- <file-path>
```

---

## Timeline Estimate

| Task | Time |
|------|------|
| ✅ Export products | 5 min (DONE) |
| ⏳ AI reclassification | 1-2 hours |
| ⏳ Update database | 10 min |
| ⏳ Code updates | 4-6 hours |
| ⏳ Testing | 2-3 hours |
| **TOTAL** | **8-12 hours** |

---

## Contact & Support

**Questions?** Check:
- `AGE_BAND_MIGRATION_PLAN.md` - Detailed technical plan
- `age-band-exports/AI_PROMPT_AGE_RECLASSIFICATION.md` - AI prompt examples

**Status**: Phase 1 complete ✅ | Ready for AI reclassification  
**Date**: September 21, 2026
