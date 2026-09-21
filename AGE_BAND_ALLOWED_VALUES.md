# Age Band Allowed Values - Official Reference

## Purpose
This document defines the ONLY allowed age band values for products in the database. These values exactly match the onboarding form age ranges to ensure consistency across the entire system.

---

## Allowed Age Bands (Complete List)

### Children/Youth (Ages 1-17)
```
"1-2"    → Babies and toddlers (1-2 years old)
"3-4"    → Preschoolers (3-4 years old)
"5-6"    → Early school age (5-6 years old)
"7-8"    → School age children (7-8 years old)
"9-11"   → Pre-teens (9-11 years old)
"12-17"  → Teenagers (12-17 years old)
```

### Adults (Ages 18+)
```
"18-25"  → Young adults (university age, early career)
"26-35"  → Young professionals (career building, relationships)
"36-45"  → Mid-career adults (established career, family)
"46-55"  → Mature professionals (peak career, raising teens)
"56-65"  → Pre-retirement adults (grandparents, planning retirement)
"66-75"  → Active retirees (retirement hobbies, travel)
"75+"    → Senior adults (comfort, nostalgia, accessibility)
```

---

## Rules

### ✅ DO:
- Use ONLY the 13 exact values listed above
- Assign multiple age bands to products when appropriate
- Example: A cookbook might be `["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"]`
- Example: A children's toy might be `["5-6", "7-8", "9-11"]`

### ❌ DON'T:
- Create custom ranges (e.g., `"18-30"`, `"5-10"`, `"1-4"`)
- Use `"18+"` or `"all adults"` (use all 7 adult ranges instead)
- Use old enum values (e.g., `"UNDER_5"`, `"EIGHTEEN_TO_30"`)
- Mix children and adult ranges incorrectly

---

## Examples

### Children's Products

**Board Book (Ages 1-4)**
```json
{
  "suitableAgeBands": ["1-2", "3-4"]
}
```

**LEGO Set (Ages 7-17)**
```json
{
  "suitableAgeBands": ["7-8", "9-11", "12-17"]
}
```

**Simple Board Game (Ages 3-8)**
```json
{
  "suitableAgeBands": ["3-4", "5-6", "7-8"]
}
```

### Adult Products

**Universal Kitchen Tool**
```json
{
  "suitableAgeBands": ["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"]
}
```

**Anti-Aging Skincare (Ages 36+)**
```json
{
  "suitableAgeBands": ["36-45", "46-55", "56-65", "66-75", "75+"]
}
```

**Trendy Fashion Item (Ages 18-35)**
```json
{
  "suitableAgeBands": ["18-25", "26-35"]
}
```

**Retirement Planning Book (Ages 46+)**
```json
{
  "suitableAgeBands": ["46-55", "56-65", "66-75", "75+"]
}
```

---

## Old Enum → New Range Mapping

When migrating from old enum format, use these mappings:

| Old Enum | New Age Bands |
|----------|---------------|
| `UNDER_5` | `["1-2", "3-4"]` (or subset based on product) |
| `FIVE_TO_10` | `["5-6", "7-8", "9-11"]` (or subset) |
| `ELEVEN_TO_17` | `["9-11", "12-17"]` or `["12-17"]` |
| `EIGHTEEN_TO_30` | `["18-25", "26-35"]` |
| `THIRTY_ONE_TO_50` | `["36-45", "46-55"]` |
| `FIFTY_ONE_PLUS` | `["56-65", "66-75", "75+"]` (or subset) |

---

## Validation

The update script validates that all age bands:
1. Are strings
2. Match exactly one of the 13 allowed values
3. Are in an array (even if only one value)

**Invalid examples that will fail validation:**
- ❌ `["18-30"]` - not in allowed list
- ❌ `["5-10"]` - not in allowed list
- ❌ `["18+"]` - not in allowed list
- ❌ `["UNDER_5"]` - old enum format
- ❌ `["1-4"]` - custom range not in allowed list

---

## Source of Truth

These values come from `src/components/onboarding/options.jsx`:
- `KIDS_AGE_RANGES` = `["1-2", "3-4", "5-6", "7-8", "9-11", "12-17"]`
- `ADULT_AGE_RANGES` = `["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"]`

---

## Impact on Codebase

### Files Using Age Bands:
1. **Database**: `Product.suitableAgeBands` field (String array)
2. **Onboarding**: `src/components/onboarding/options.jsx`
3. **Gift Matching**: `server/services/gifts/product-matcher.js`
4. **Admin UI**: `src/components/admin/ProductAddForm.jsx`, `ProductEditForm.jsx`
5. **Display**: `src/components/admin/ProductsTab.jsx`, `ApprovalDetail.jsx`

### Age Range Overlap Logic:
When matching products to recipients, the system checks if the recipient's age band overlaps with any of the product's age bands:
- Recipient: `"26-35"`, Product: `["18-25", "26-35", "36-45"]` → ✅ Match (exact overlap)
- Recipient: `"7-8"`, Product: `["5-6", "7-8", "9-11"]` → ✅ Match (exact overlap)
- Recipient: `"18-25"`, Product: `["56-65", "66-75", "75+"]` → ❌ No match (no overlap)

---

## Maintenance

**When adding new age ranges** (rare):
1. Update `src/components/onboarding/options.jsx` (KIDS_AGE_RANGES or ADULT_AGE_RANGES)
2. Update this document (AGE_BAND_ALLOWED_VALUES.md)
3. Update validation in `scripts/update-age-bands-flexible.js` (ALLOWED_AGE_BANDS constant)
4. Update AI prompt: `age-band-exports/AI_PROMPT_AGE_RECLASSIFICATION.md`
5. Test thoroughly - impacts gift matching logic

---

**Status**: Active | Effective Date: September 21, 2026  
**Last Updated**: September 21, 2026
