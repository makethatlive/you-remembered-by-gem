# Age Band Migration Plan: Enum → Flexible Ranges

## Overview

**Current State**: Age bands use rigid enums (e.g., `EIGHTEEN_TO_30`, `UNDER_5`)  
**Target State**: Flexible numeric ranges (e.g., `"18-30"`, `"1-4"`, `"51+"`)  
**Scope**: All non-Gem Pick products (catalogue + legacy) + full codebase updates

---

## Phase 1: Export & Reclassify (IN PROGRESS)

### Step 1: Export Products ✅
```bash
node scripts/export-non-gem-pick-products.js
```

**Output**: 
- `age-band-exports/non-gem-pick-products-YYYY-MM-DDTHH-MM-SS.json`
- `age-band-exports/non-gem-pick-products-YYYY-MM-DDTHH-MM-SS.csv`

### Step 2: AI Reclassification (MANUAL)
1. Send JSON to Grok AI
2. Use prompt: `age-band-exports/AI_PROMPT_AGE_RECLASSIFICATION.md`
3. AI fills `new_age_bands` and `reasoning` fields
4. Save as: `age-band-exports/non-gem-pick-products-reclassified.json`

### Step 3: Update Database ⏳
```bash
node scripts/update-age-bands-flexible.js age-band-exports/non-gem-pick-products-reclassified.json
```

---

## Phase 2: Codebase Updates (PENDING)

After database update, the following code locations need updates:

### 🔴 CRITICAL: Age Band Matching Logic

#### 1. `server/services/gifts/product-matcher.js`
**Current**: Hardcoded enum checks
```javascript
const isKid = ['ZERO_TO_10', 'ELEVEN_TO_17'].includes(ageBand);
```

**Needs**: Flexible range matching
- Parse recipient age band (e.g., "5-10", "18-30")
- Parse product age bands (e.g., ["1-7", "4-9"])
- Check if ranges overlap/intersect

**Function to add**: `doAgeRangesOverlap(recipientBand, productBands)`

---

#### 2. `src/components/onboarding/options.jsx`
**Current**: Maps UI ranges to enums
```javascript
export function ageBandFromRange(range) {
  switch (range) {
    case "18-25":
    case "26-35": return "18-30";
    ...
  }
}
```

**Needs**: Return flexible ranges directly
```javascript
export function ageBandFromRange(range) {
  switch (range) {
    case "18-25": return "18-25";
    case "26-35": return "26-35";
    case "36-45": return "36-45";
    ...
  }
}
```

**OR**: Store exact onboarding value (no mapping needed)

---

#### 3. `src/components/admin/CatalogSwapPicker.jsx`
**Current**: Exact enum matching
```javascript
const expectedBand = isUnder18 ? recipient?.ageBand : "18+";
if (!ageBands.includes(expectedBand)) return false;
```

**Needs**: Range overlap check
```javascript
if (!doAgeRangesOverlap(recipient?.ageBand, ageBands)) return false;
```

---

#### 4. `src/components/admin/ProductAddForm.jsx`
**Current**: Hardcoded enum dropdowns
```javascript
const AGE_BANDS = ["Under 5", "5-10", "11-17", "18+"];
```

**Needs**: 
- Option 1: Free-text input (allow any range)
- Option 2: Predefined common ranges + "Add custom"
- Recommended: Multi-select with validation (`/^\d+-\d+$/` or `/^\d+\+$/`)

---

#### 5. `src/lib/format.js` (if exists)
**Check for**: `AGE_BAND_LABEL` mapping object
```javascript
export const AGE_BAND_LABEL = {
  'UNDER_5': 'Under 5',
  'FIVE_TO_10': '5-10',
  ...
};
```

**Needs**: Remove or make passthrough (new format is already human-readable)
```javascript
export const AGE_BAND_LABEL = (band) => band; // or remove entirely
```

---

### 🟡 MEDIUM: Display & UI Components

#### 6. `src/components/admin/ProductsTab.jsx` ✅
**Status**: Already updated to display flexible ranges in CategoryBreadcrumb

---

#### 7. `src/components/admin/ApprovalDetail.jsx`
**Check for**: Age band display formatting
```javascript
<ProfileRow label="Age band" value={AGE_BAND_LABEL[recipient?.ageBand]} />
```

**Needs**: Display raw value (already human-readable)
```javascript
<ProfileRow label="Age band" value={recipient?.ageBand} />
```

---

#### 8. `src/components/admin/ProductEditForm.jsx`
**Current**: Likely has enum-based age band selector

**Needs**: Same as ProductAddForm (free-text or multi-select with validation)

---

### 🟢 LOW: Documentation & Constants

#### 9. Any hardcoded age band constants
Search codebase for:
- `UNDER_5`, `FIVE_TO_10`, `ELEVEN_TO_17` (old enums)
- `AGE_BANDS`, `AGE_BAND_OPTIONS` (constant arrays)

**Action**: Remove or replace with flexible format

---

#### 10. Schema/Prisma
**Current**: `suitableAgeBands String[]` ✅ Already flexible!

**No changes needed** - `String[]` accepts any format

---

## Phase 3: Testing & Validation

### Test Cases

#### Age Range Overlap Logic
```javascript
// Test: doAgeRangesOverlap(recipientBand, productBands)

// Exact match
doAgeRangesOverlap("18-30", ["18-30"]) → true

// Subset
doAgeRangesOverlap("25-35", ["18-40"]) → true

// Overlap
doAgeRangesOverlap("5-10", ["1-7", "8-12"]) → true

// No overlap
doAgeRangesOverlap("18-30", ["1-7", "51+"]) → false

// Open-ended
doAgeRangesOverlap("60", ["51+"]) → true
doAgeRangesOverlap("40", ["18+"]) → true
```

#### UI Tests
1. Add product with custom age bands → saves correctly
2. Edit product → age bands display and save
3. Generate gift list → products match recipient age correctly
4. Admin products table → age bands display under Children category
5. Approval queue → recipient age band displays correctly

---

## Age Range Matching Algorithm

```javascript
/**
 * Check if recipient's age band overlaps with any product age band.
 * 
 * @param {string} recipientBand - e.g., "18-30", "5-10", "51+"
 * @param {string[]} productBands - e.g., ["18-30", "31-50"]
 * @returns {boolean} - true if any overlap exists
 */
function doAgeRangesOverlap(recipientBand, productBands) {
  if (!recipientBand || !Array.isArray(productBands) || productBands.length === 0) {
    return true; // No restrictions - allow product
  }

  const recip = parseAgeBand(recipientBand);
  
  return productBands.some(productBand => {
    const prod = parseAgeBand(productBand);
    return rangesOverlap(recip, prod);
  });
}

/**
 * Parse age band string into min/max numbers.
 * 
 * @param {string} band - e.g., "18-30", "51+", "18+"
 * @returns {{min: number, max: number|null}} - null max = open-ended
 */
function parseAgeBand(band) {
  if (band.endsWith('+')) {
    // e.g., "51+" or "18+"
    const min = parseInt(band.slice(0, -1));
    return { min, max: null };
  }
  
  if (band.includes('-')) {
    // e.g., "18-30"
    const [min, max] = band.split('-').map(n => parseInt(n));
    return { min, max };
  }
  
  // Single number (treat as exact age)
  const age = parseInt(band);
  return { min: age, max: age };
}

/**
 * Check if two age ranges overlap.
 * 
 * @param {{min: number, max: number|null}} range1
 * @param {{min: number, max: number|null}} range2
 * @returns {boolean}
 */
function rangesOverlap(range1, range2) {
  // If either is open-ended, check if other range starts before or within
  if (range1.max === null) {
    return range2.max === null || range2.max >= range1.min;
  }
  if (range2.max === null) {
    return range1.max >= range2.min;
  }
  
  // Both have defined ranges - check overlap
  return range1.min <= range2.max && range2.min <= range1.max;
}

// Examples:
rangesOverlap({min: 18, max: 30}, {min: 25, max: 35}) // true (overlap: 25-30)
rangesOverlap({min: 5, max: 10}, {min: 11, max: 17}) // false (no overlap)
rangesOverlap({min: 51, max: null}, {min: 60, max: 70}) // true (51+ includes 60-70)
rangesOverlap({min: 18, max: 30}, {min: 51, max: null}) // false (no overlap)
```

---

## Migration Checklist

### Pre-Migration
- [x] Create export script
- [x] Create AI prompt
- [x] Create update script
- [x] Document migration plan
- [ ] Run export script
- [ ] Send to AI for reclassification

### Database Migration
- [ ] Receive AI-corrected JSON
- [ ] Validate JSON format
- [ ] Run update script
- [ ] Verify database updates

### Code Updates
- [ ] Implement age range overlap logic
- [ ] Update `product-matcher.js`
- [ ] Update `options.jsx` (ageBandFromRange)
- [ ] Update `CatalogSwapPicker.jsx`
- [ ] Update `ProductAddForm.jsx`
- [ ] Update `ProductEditForm.jsx`
- [ ] Update `ApprovalDetail.jsx`
- [ ] Remove old enum constants
- [ ] Update AGE_BAND_LABEL formatting

### Testing
- [ ] Test gift generation with new age bands
- [ ] Test product filtering by age
- [ ] Test admin UI (add/edit products)
- [ ] Test age band display in UI
- [ ] Test edge cases (open-ended ranges, overlaps)

### Documentation
- [ ] Update API docs (if any)
- [ ] Update admin user guide
- [ ] Create troubleshooting guide

---

## Rollback Plan

If issues arise:

1. **Restore from backup**:
   ```bash
   # Backup is at: age-band-exports/backups/age-band-updates-YYYY-MM-DDTHH-MM-SS.json
   node scripts/restore-age-bands.js <backup-file>
   ```

2. **Revert code changes** (git):
   ```bash
   git checkout HEAD -- src/components/admin/ProductAddForm.jsx
   git checkout HEAD -- server/services/gifts/product-matcher.js
   # etc.
   ```

---

## Estimated Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Export products | 5 min |
| 1 | AI reclassification | 1-2 hours (AI processing) |
| 1 | Update database | 10 min |
| 2 | Implement overlap logic | 1-2 hours |
| 2 | Update product-matcher.js | 30 min |
| 2 | Update options.jsx | 15 min |
| 2 | Update UI components | 2-3 hours |
| 2 | Remove old constants | 30 min |
| 3 | Testing | 2-3 hours |
| 3 | Bug fixes | 1-2 hours |
| **TOTAL** | **8-12 hours** |

---

## Notes

- **Children age bands already done**: 83 children products already have flexible format (`"1-2"`, `"3-4"`, etc.)
- **Gem's Picks excluded**: Only updating catalogue + legacy products
- **No schema change needed**: `String[]` already supports any format
- **Backward compatibility**: Old enums will be replaced, no mixing

---

**Status**: 📋 Plan complete, ready to execute Phase 1  
**Next Step**: Run export script to generate data for AI reclassification
