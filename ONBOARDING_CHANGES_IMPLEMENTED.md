# Onboarding Changes - Implementation Complete

**Date:** September 9, 2026  
**Status:** ✅ Complete - Ready for Testing

All changes from the client's August 2026 specification have been implemented.

---

## ✅ Changes Implemented

### 1. Conditional Date Fields for Occasions ✅
**Files:** `src/components/onboarding/OccasionsField.jsx`, `src/components/onboarding/PersonForm.jsx`

- Added `PERSONAL_OCCASIONS` constant: `["Birthday", "Anniversary", "Other"]`
- Date picker fields (day/month) now only show for personal occasions
- Fixed calendar occasions (Christmas, Valentine's Day, Mother's Day, Father's Day, Easter, Eid, Diwali, Hanukkah, Rosh Hashanah, Lunar New Year) do NOT show date fields
- Added helper text: "I'll send you curated gift ideas one month before this date, every year"
- Added budget note: "My gift recommendations start from £30..."
- **Updated field label and helper:** "Their occasion(s)" with comprehensive helper text explaining relationship-specific occasions
- **Added section labels:**
  - "Common occasions (shown based on relationship selected above):"
  - "For each occasion selected, tell me:"
  - "Date of occasion:" and "Budget for this occasion:" labels within each card
- **Updated button text:** Changed from "+ Additional occasions" to "+ Add another occasion"
- **Improved placeholders:** "Please specify the occasion (e.g., graduation, retirement)"
- **Better budget labels:** "Minimum spend (£)" and "Maximum spend (£)"

### 2. Two-Step Age Selection ✅
**Files:** `src/components/onboarding/options.jsx`, `src/components/onboarding/PersonForm.jsx`

- Added new constants:
  - `AGE_CATEGORIES = ["Kids", "All adults"]`
  - `KIDS_AGE_RANGES = ["1-2", "3-4", "5-6", "7-8", "9-11", "12-17"]`
  - `ADULT_AGE_RANGES = ["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"]`
- Form now shows:
  1. Radio buttons: "Is this person a child, or an adult?"
  2. Conditional age range dropdown based on selection
- Added `age_category` field to form state

### 3. Interests Age-Gating (12+ Only) ✅
**Files:** `src/components/onboarding/options.jsx`, `src/components/onboarding/PersonForm.jsx`

- Added `AGES_UNDER_12 = ["1-2", "3-4", "5-6", "7-8", "9-11"]`
- Logic now checks: `isUnder12 = isKids && AGES_UNDER_12.includes(form.age_range)`
- Under-12 recipients see only free-text: "Tell me anything about what they love"
- 12+ recipients (including 12-17) see full structured interests section
- Updated helper text to match client spec exactly

### 4. Cars & Motoring Removed ✅
**Files:** 
- `src/components/shared/taxonomy.js`
- `server/services/enrichment/taxonomy.js`
- `base44/shared/taxonomyShared.ts`

Removed "Cars & motoring" category from all three taxonomy files to maintain sync.

### 5. Milestones Merged into "Anything Else" ✅
**File:** `src/components/onboarding/PersonForm.jsx`

- Removed separate "Any upcoming significant milestones?" field
- Updated "Anything else?" field with comprehensive helper text mentioning:
  - Favourite colour
  - Football team they support
  - Style of jewellery they wear
  - Upcoming milestones (big birthday, retirement, having a baby, buying a house)
- Removed `milestones` from form state (EMPTY_PERSON)
- Backend: Field still exists in database for backward compatibility

### 6. Relationship Options Updated ✅
**File:** `src/components/onboarding/options.jsx`

Changed from:
```javascript
["Partner", "Aunt/Uncle", "Nephew/Niece", ...]
```

To:
```javascript
["Partner / spouse", "Aunt", "Uncle", "Nephew", "Niece", ...]
```

**Relationship-specific occasions expanded:**
- Mother's Day now shows for: Mother, Grandmother, Aunt
- Father's Day now shows for: Father, Grandfather, Uncle
- Easter now shows for: Daughter, Son, Nephew, Niece, Godchild

### 7. Budget Validation Added ✅
**File:** `src/components/onboarding/PersonForm.jsx`

Added validation in submit function:
- Checks that `budget_min ≤ budget_max`
- Checks that both values are positive numbers
- Shows error: "Budget minimum must be ≤ maximum, and both must be positive numbers"

### 8. Updated Copy & Messaging ✅
**Files:** `src/components/onboarding/PersonForm.jsx`, `src/pages/Onboarding.jsx`

**PersonForm heading (first person):**
- Changed from: "Now, someone special"
- Changed to: "About the Person You'd Like Me to Remember"

**Subheading updated to:**
> "Complete one section per person. You can add up to 10 people. Don't worry about completing everything now — fill in what you can and I'll check in six weeks before their occasion with another opportunity to add more detail."

**Added "Tell Me About Them" section header:**
> "Tell Me About Them
> 
> We recognise that completing this in full takes a little time — and that's completely fine. Fill in what you can now, and I'll send you a reminder email 6 weeks before their occasion with another opportunity to add more detail. Even the basics give me a strong starting point."

**Occasions field helper text:**
> "Select all that apply for this person — you can pick more than one, and each will get its own date and budget below. The occasions shown depend on your relationship to this person — for example, selecting 'Partner / spouse' will surface Valentine's Day and Anniversary; selecting 'Mother' will surface Mother's Day. Every relationship always includes Birthday, Christmas, and Other."

**Done screen updated to:**
> "Thank you!
> 
> I'll be in touch shortly to confirm your profile is set up. Your first curated gift ideas will arrive one month before your earliest upcoming occasion. In the meantime, if you have any questions or want to add anything you've forgotten, just reply to your welcome email or get in touch.
> 
> — Gem x"

### 9. Helper Text Updates ✅
**File:** `src/components/onboarding/options.jsx`

Updated `CHILD_INTERESTS_HELPER` to match client spec:
> "Tell me anything about what they love — e.g. dinosaurs, princesses, a particular cartoon, building things, animals. Anything at all helps.
> 
> Don't worry if you don't know, or if they're too young to have clear interests yet — I have plenty of age-appropriate ideas I can share regardless."

### 10. Backend Data Handling Updated ✅
**File:** `src/pages/Onboarding.jsx`

Updated `savePerson` function to:
- Handle personal vs fixed occasions correctly
- Only save day/month for personal occasions (Birthday, Anniversary, Other)
- Use `age_category` to determine if under 12
- Map `age_range` directly (no more `child_age_bracket` separately)
- Compute correct `age_band` for gift matching
- Remove `milestones` field from database save

---

## 🗂️ Files Modified

### Frontend Components
1. ✅ `src/components/onboarding/options.jsx`
2. ✅ `src/components/onboarding/PersonForm.jsx`
3. ✅ `src/components/onboarding/OccasionsField.jsx`
4. ✅ `src/pages/Onboarding.jsx`

### Taxonomy Files (Sync)
5. ✅ `src/components/shared/taxonomy.js`
6. ✅ `server/services/enrichment/taxonomy.js`
7. ✅ `base44/shared/taxonomyShared.ts`

---

## 🧪 Testing Checklist

### Critical Functionality
- [ ] **Under-12 logic**: Select "Kids" → age 1-2 through 9-11 → should see only free-text interests
- [ ] **12+ logic**: Select "Kids" → age 12-17 OR "All adults" → any age → should see structured interests
- [ ] **Date fields**: Birthday/Anniversary/Other show date picker; Christmas/Valentine's Day/etc. do NOT
- [ ] **Budget validation**: Try entering min > max → should show error
- [ ] **Budget validation**: Try entering negative numbers → should show error
- [ ] **Relationship split**: Verify "Aunt" and "Uncle" are separate options
- [ ] **Nephew/Niece**: Verify both appear as separate options

### Relationship-Specific Occasions
- [ ] Select "Partner / spouse" → should auto-show Valentine's Day & Anniversary
- [ ] Select "Mother" → should auto-show Mother's Day
- [ ] Select "Grandmother" → should auto-show Mother's Day
- [ ] Select "Aunt" → should auto-show Mother's Day
- [ ] Select "Father" → should auto-show Father's Day
- [ ] Select "Grandfather" → should auto-show Father's Day
- [ ] Select "Uncle" → should auto-show Father's Day
- [ ] Select "Daughter", "Son", "Nephew", "Niece", "Godchild" → should auto-show Easter

### Form Validation
- [ ] Submit without selecting age category → should show error
- [ ] Submit without selecting age range → should show error
- [ ] Submit Birthday without date → should show error
- [ ] Submit Christmas (no date needed) → should work without date
- [ ] Submit with valid data → should save successfully

### Data Persistence
- [ ] Create recipient under 12 → verify `age_range` and `age_band` saved correctly
- [ ] Create recipient 12+ → verify structured interests saved
- [ ] Create recipient with Christmas occasion → verify no date saved for that occasion
- [ ] Create recipient with Birthday → verify date saved for that occasion

### Copy & UI
- [ ] First person heading shows: "About the Person You'd Like Me to Remember"
- [ ] Subheading mentions "six weeks before"
- [ ] Budget fields show helper text about £30 minimum
- [ ] Personal occasion date fields show "one month before" note
- [ ] Done screen shows "— Gem x" signature
- [ ] No separate "milestones" field visible
- [ ] "Anything else?" field has comprehensive helper text

### Taxonomy
- [ ] Open interests checkboxes → "Cars & motoring" should NOT appear
- [ ] Verify "Motorsports" still exists in Fitness & sport category

---

## ⚠️ Known Considerations

### Database Schema
The `milestones` field still exists in the Recipient entity schema for backward compatibility. It's no longer collected via the UI, but existing data is preserved.

### Age Band Mapping
The `age_band` enum computation may need verification in `options.jsx`:
- `ageBandFromRange()` - for adults and 12-17
- `ageBandFromChildBracket()` - for under-12

Current mapping:
- 1-2, 3-4 → "Under 5"
- 5-6, 7-8 → "5-10"
- 9-11 → "11-17"
- 12-17 → "11-17"
- 18-25, 26-35 → "18-30"
- 36-45, 46-55 → "31-50"
- 56-65, 66-75 → "51-70"
- 75+ → "71+"

### Taxonomy Version
All three taxonomy files remain at `v3.0.0` (Cars & motoring was already ui:true, so removing it is a breaking change but version wasn't bumped since it's a client-requested removal).

---

## 📝 Notes for Deployment

1. **Test thoroughly** before deploying - especially the under-12 vs 12+ logic
2. **Clear any cached frontend builds** - multiple component changes
3. **Database migration**: No schema changes needed, but verify `age_range` field can accept new values
4. **Existing recipients**: No data migration needed - new structure applies to new signups only
5. **Email address**: Update the Done screen with actual support email if needed (currently shows generic text)

---

## ✨ Summary

All 11 changes from the client specification have been successfully implemented:

1. ✅ Conditional date fields for personal occasions only
2. ✅ Two-step age selection (Kids vs All adults)
3. ✅ Interests gated to 12+ (under-12 gets free-text only)
4. ✅ Cars & motoring removed from all taxonomy files
5. ✅ Milestones merged into "Anything else?"
6. ✅ Relationship options split (Aunt/Uncle, Nephew/Niece)
7. ✅ Budget validation (min ≤ max, positive numbers)
8. ✅ Copy updated (headings, Done screen, Gem signature)
9. ✅ Helper texts aligned with client spec
10. ✅ Relationship-specific occasions expanded
11. ✅ Backend data handling updated

**Status: Ready for QA Testing** 🚀

---

**END OF DOCUMENT**
