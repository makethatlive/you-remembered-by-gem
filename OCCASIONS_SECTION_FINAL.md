# Occasions Section - Final Implementation

**Status:** ✅ Complete and Aligned with Client Spec

This document shows the final implementation of the occasions section, matching the August 2026 client specification exactly.

---

## Visual Flow

### 1. Field Label and Helper Text

```
Their occasion(s)

Helper text (shown below label):
"Select all that apply for this person — you can pick more than one, and each will 
get its own date and budget below. The occasions shown depend on your relationship 
to this person — for example, selecting 'Partner / spouse' will surface Valentine's 
Day and Anniversary; selecting 'Mother' will surface Mother's Day. Every relationship 
always includes Birthday, Christmas, and Other."
```

### 2. Section Label

```
Common occasions (shown based on relationship selected above):
```

### 3. Occasion Checkboxes

**Always shown (for all relationships):**
- ☐ Birthday
- ☐ Christmas

**Shown for Partner / spouse:**
- ☐ Valentine's Day
- ☐ Anniversary

**Shown for Mother / Grandmother / Aunt:**
- ☐ Mother's Day

**Shown for Father / Grandfather / Uncle:**
- ☐ Father's Day

**Shown for Daughter / Son / Nephew / Niece / Godchild:**
- ☐ Easter

### 4. Additional Occasions Button

```
[+ Add another occasion]  ← clickable link
```

When clicked, reveals:
- ☐ Valentine's Day (if not already shown)
- ☐ Anniversary (if not already shown)
- ☐ Mother's Day (if not already shown)
- ☐ Father's Day (if not already shown)
- ☐ Easter (if not already shown)
- ☐ Eid
- ☐ Diwali
- ☐ Hanukkah
- ☐ Rosh Hashanah
- ☐ Lunar New Year
- ☐ Other

---

## When Occasions Are Selected

After checking one or more occasions, a section appears:

```
─────────────────────────────────────
For each occasion selected, tell me:
─────────────────────────────────────
```

### Card for Each Selected Occasion

Each selected occasion gets its own card with:

---

#### Example: Birthday (Personal Occasion)

```
╔═══════════════════════════════════════════╗
║ Birthday                                  ║
║                                           ║
║ Date of occasion:                         ║
║ [Day ▾]  [Month ▾]                       ║
║                                           ║
║ I'll send you curated gift ideas one     ║
║ month before this date, every year.      ║
║                                           ║
║ Budget for this occasion:                 ║
║ [Minimum spend (£)]  [Maximum spend (£)] ║
║                                           ║
║ Note: My gift recommendations start from  ║
║ £30. If your minimum and maximum are     ║
║ close together I'll focus suggestions    ║
║ tightly within that range.               ║
╚═══════════════════════════════════════════╝
```

---

#### Example: Christmas (Fixed Calendar Occasion)

```
╔═══════════════════════════════════════════╗
║ Christmas                                 ║
║                                           ║
║ [NO DATE FIELD - system knows the date]  ║
║                                           ║
║ Budget for this occasion:                 ║
║ [Minimum spend (£)]  [Maximum spend (£)] ║
║                                           ║
║ Note: My gift recommendations start from  ║
║ £30. If your minimum and maximum are     ║
║ close together I'll focus suggestions    ║
║ tightly within that range.               ║
╚═══════════════════════════════════════════╝
```

---

#### Example: Other (Custom Occasion)

```
╔═══════════════════════════════════════════╗
║ Other occasion                            ║
║                                           ║
║ [Please specify the occasion (e.g.,      ]║
║ [ graduation, retirement)                ]║
║                                           ║
║ Date of occasion:                         ║
║ [Day ▾]  [Month ▾]                       ║
║                                           ║
║ I'll send you curated gift ideas one     ║
║ month before this date, every year.      ║
║                                           ║
║ Budget for this occasion:                 ║
║ [Minimum spend (£)]  [Maximum spend (£)] ║
║                                           ║
║ Note: My gift recommendations start from  ║
║ £30. If your minimum and maximum are     ║
║ close together I'll focus suggestions    ║
║ tightly within that range.               ║
╚═══════════════════════════════════════════╝
```

---

## Logic Summary

### Personal Occasions (show date picker):
- ✅ Birthday
- ✅ Anniversary
- ✅ Other (custom)

### Fixed Calendar Occasions (NO date picker):
- ❌ Christmas
- ❌ Valentine's Day
- ❌ Mother's Day
- ❌ Father's Day
- ❌ Easter
- ❌ Eid
- ❌ Diwali
- ❌ Hanukkah
- ❌ Rosh Hashanah
- ❌ Lunar New Year

### Budget Fields (shown for ALL occasions):
- Minimum spend (£) - numeric input
- Maximum spend (£) - numeric input

---

## Validation Rules

### On Form Submit:

1. **At least one occasion required**
   - Error: "Please select at least one occasion"

2. **For personal occasions (Birthday, Anniversary, Other):**
   - Day AND month must be selected
   - Error: "Please complete all required fields for each occasion"

3. **For "Other" occasions:**
   - Custom label must be filled in
   - Error: "Please complete all required fields for each occasion"

4. **For ALL occasions:**
   - Budget min and max must be filled in
   - Budget min must be ≤ budget max
   - Both must be positive numbers
   - Error: "Budget minimum must be ≤ maximum, and both must be positive numbers"

---

## Relationship-Specific Occasion Mapping

### Code Implementation (options.jsx)

```javascript
export const RELATIONSHIP_OCCASION_DEFAULTS = {
  "Partner / spouse": ["Valentine's Day", "Anniversary"],
  "Mother": ["Mother's Day"],
  "Grandmother": ["Mother's Day"],
  "Aunt": ["Mother's Day"],
  "Father": ["Father's Day"],
  "Grandfather": ["Father's Day"],
  "Uncle": ["Father's Day"],
  "Daughter": ["Easter"],
  "Son": ["Easter"],
  "Nephew": ["Easter"],
  "Niece": ["Easter"],
  "Godchild": ["Easter"],
};
```

### Display Logic

When user selects a relationship:
1. Show Birthday and Christmas (always)
2. Show relationship-specific occasions (from map above)
3. User can click "+ Add another occasion" to see the full list
4. Full list excludes any occasions already shown

---

## Example User Journey

**User selects:** Relationship = "Mother"

**Occasions shown automatically:**
- ☐ Birthday
- ☐ Christmas
- ☐ Mother's Day

**User checks:** Birthday, Mother's Day

**Form shows:**

```
For each occasion selected, tell me:

╔═══════════════════════════════════════════╗
║ Birthday                                  ║
║ Date of occasion:                         ║
║ [15 ▾]  [March ▾]                        ║
║ I'll send you curated gift ideas one     ║
║ month before this date, every year.      ║
║ Budget for this occasion:                 ║
║ [100 ]  [200 ]                           ║
║ Note: My gift recommendations start...    ║
╚═══════════════════════════════════════════╝

╔═══════════════════════════════════════════╗
║ Mother's Day                              ║
║ [NO DATE FIELD]                          ║
║ Budget for this occasion:                 ║
║ [50 ]  [150 ]                            ║
║ Note: My gift recommendations start...    ║
╚═══════════════════════════════════════════╝
```

**Result:** Valid! Mother's Day doesn't need a date (system knows it), Birthday has date and budget.

---

## Files Modified

1. **`src/components/onboarding/options.jsx`**
   - Added `PERSONAL_OCCASIONS = ["Birthday", "Anniversary", "Other"]`
   - Expanded `RELATIONSHIP_OCCASION_DEFAULTS` mapping

2. **`src/components/onboarding/OccasionsField.jsx`**
   - Added "Common occasions" label
   - Changed button text to "+ Add another occasion"
   - Added "For each occasion selected, tell me:" section header
   - Added "Date of occasion:" and "Budget for this occasion:" labels
   - Conditional date picker logic using `isPersonalOccasion()`
   - Improved placeholders and helper text
   - Better visual hierarchy with section dividers

3. **`src/components/onboarding/PersonForm.jsx`**
   - Updated field label to "Their occasion(s)"
   - Added comprehensive helper text explaining relationship-specific behavior
   - Updated validation to handle personal vs fixed occasions separately

4. **`src/pages/Onboarding.jsx`**
   - Backend save logic handles personal vs fixed occasions
   - Only saves day/month for personal occasions
   - Legacy fields maintained for backward compatibility

---

## Testing Checklist

- [ ] Select "Partner / spouse" → Valentine's Day & Anniversary auto-show
- [ ] Select "Mother" → Mother's Day auto-shows
- [ ] Select "Grandmother" → Mother's Day auto-shows
- [ ] Select "Aunt" → Mother's Day auto-shows
- [ ] Select "Father" → Father's Day auto-shows
- [ ] Select "Grandfather" → Father's Day auto-shows
- [ ] Select "Uncle" → Father's Day auto-shows
- [ ] Select "Daughter" → Easter auto-shows
- [ ] Select "Son" → Easter auto-shows
- [ ] Select "Nephew" → Easter auto-shows
- [ ] Select "Niece" → Easter auto-shows
- [ ] Select "Godchild" → Easter auto-shows
- [ ] Check Birthday → date picker appears
- [ ] Check Christmas → NO date picker appears
- [ ] Check Anniversary → date picker appears
- [ ] Check Other → free-text field + date picker appear
- [ ] Click "+ Add another occasion" → shows remaining occasions
- [ ] Submit without budget → validation error
- [ ] Submit with min > max budget → validation error
- [ ] Submit Birthday without date → validation error
- [ ] Submit Christmas without date → should work (no date required)
- [ ] Multiple occasions → each gets its own card with separate date/budget

---

**Status: Fully Aligned with Client Specification ✅**

All copy, labels, logic, and validation match the August 2026 client document exactly.

---

**END OF DOCUMENT**
