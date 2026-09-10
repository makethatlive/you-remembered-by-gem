# Onboarding Alignment with Client Requirements

**Date:** September 9, 2026  
**Status:** Action Required

This document outlines all changes needed to align the current onboarding implementation with the client's revised specification document (August 2026).

---

## Summary of Required Changes

### ✅ Already Correct
- Budget is numeric min/max fields (£) - ✅ Correct
- Under-12 logic exists (using "Under 11" as boundary) - ✅ Mostly correct
- Multiple occasions per person - ✅ Correct
- Relationship-specific occasion defaults - ✅ Correct
- Free-text fields for "Other" occasions and relationships - ✅ Correct

### ❌ Changes Required

---

## 1. Age Range Structure Changes

### Current Implementation
```javascript
AGE_RANGES = [
  "Under 11", "12-17", "18-25", "26-35",
  "36-45", "46-55", "56-65", "66-75", "75+"
]

CHILD_AGE_BRACKETS = ["1-2", "3-4", "5-6", "7-8", "9-11"]
```

### Required by Client
Two-tier selection:
1. **First question:** "Is this person a child, or an adult?"
   - Kids → shows: 1–2 · 3–4 · 5–6 · 7–8 · 9–11 · 12–17
   - All adults → shows: 18–25 · 26–35 · 36–45 · 46–55 · 56–65 · 66–75 · 75+

### Action Required
- **PersonForm.jsx**: Change age selection from single dropdown to two-step:
  1. Radio buttons: "Kids" vs "All adults"
  2. Conditional dropdown based on selection
- **options.jsx**: Update AGE_RANGES structure to match spec
- **Database schema**: Ensure age_range field can store these exact values

---

## 2. Conditional Date Field for Occasions

### Current Implementation
**ALL** occasions (including Christmas, Valentine's Day, etc.) show date picker fields.

### Required by Client
**BUILD NOTE for Shoaib:** Only personal occasions (Birthday, Anniversary, Other) should show a date field. Publicly fixed occasions (Christmas, Valentine's Day, Mother's Day, Father's Day, Easter, Eid, Diwali, Hanukkah, Rosh Hashanah, Lunar New Year) should NOT show date fields.

### Action Required
- **OccasionsField.jsx**: Add conditional logic:
```javascript
const PERSONAL_OCCASIONS = ["Birthday", "Anniversary", "Other"];
const isPersonalOccasion = (type) => PERSONAL_OCCASIONS.includes(type);

// In render:
{isPersonalOccasion(occ.type) && (
  <div className="grid grid-cols-2 gap-3">
    {/* Date picker fields */}
  </div>
)}
```

---

## 3. Interests Section: Age-Gating (12+ Only)

### Current Implementation
Shows structured interests for "adults" (not "Under 11"), but the client spec says **12+**.

### Required by Client
**BUILD NOTE for Shoaib:** The structured interests section (8 categories, 28 options) should **only be shown when the recipient's age is 12 or older**. For recipients under 12 (1–2, 3–4, 5–6, 7–8, 9–11), show only a free-text box: "Tell me anything about what they love."

### Current Issue
The boundary is "Under 11" which includes ages 9-11, but should be under 12.

### Action Required
- **PersonForm.jsx**: Change condition from `isChild = form.age_range === "Under 11"` to check if age < 12:
```javascript
const AGE_UNDER_12 = ["1-2", "3-4", "5-6", "7-8", "9-11"];
const isUnder12 = AGE_UNDER_12.includes(form.child_age_bracket) || 
                  (form.age_category === "Kids" && form.age_range !== "12-17");
```

---

## 4. Cars & Motoring Removed from Interests

### Required by Client
"(3) **Cars & Motoring removed from interests entirely** — not a sensible gift category, and Motorsports already covers the spectating angle"

### Action Required
- **src/components/shared/taxonomy.js**: Remove "Cars & Motoring" from INTEREST_OPTIONS
- Verify it's not in the current options.jsx (need to check taxonomy.js)

---

## 5. Milestones Field Merged into "Anything Else"

### Current Implementation
PersonForm.jsx has a separate field:
```javascript
<Field label="Any upcoming significant milestones?" optional>
  <Textarea value={form.milestones} onChange={(e) => set("milestones", e.target.value)} 
    rows={2} placeholder="A big birthday, a new home, a wedding..." />
</Field>
```

### Required by Client
"(4) the milestones question has been merged into the main 'anything else' box"

The "Anything Else?" section should include prompt text mentioning milestones.

### New Combined Field Label & Helper
**Label:** "Anything Else?"  
**Helper text:**
> Tell me anything else that would help
> 
> This is your chance to give me real colour — a recent life change, something they've mentioned wanting, a hobby they've just taken up, their personality and taste level, what's worked brilliantly in the past or fallen completely flat. Small details go a long way — **a favourite colour, a football team they support, the style of jewellery they wear**. Also let me know if there's **a significant milestone coming up — a big birthday, retirement, having a baby, buying a house** — anything that might call for something extra special. The more you share, the more personal my suggestions will be.

### Action Required
- **PersonForm.jsx**: 
  - Remove separate "Any upcoming significant milestones?" field
  - Update the "Tell me anything else" field with the combined helper text above
  - **Database note:** Keep `milestones` field in schema for backward compatibility, but don't collect it separately in UI

---

## 6. Relationship Options Update

### Current Implementation
```javascript
RELATIONSHIP_OPTIONS = [
  "Partner", "Mother", "Father", "Sister", "Brother", 
  "Daughter", "Son", "Friend", "Grandmother", "Grandfather",
  "Aunt/Uncle", "Nephew/Niece", "Godchild", "Colleague", "Other"
]
```

### Required by Client
```
Partner / spouse
Mother
Father
Sister
Brother
Daughter
Son
Friend
Grandmother
Grandfather
Aunt
Uncle
Godchild
Colleague
Other
```

### Issues
- "Aunt/Uncle" should be separate: "Aunt" and "Uncle"
- "Nephew/Niece" should be separate: "Nephew" and "Niece"  
- Missing: "Niece"
- "Partner" should show as "Partner / spouse" in UI

### Action Required
- **options.jsx**: Update RELATIONSHIP_OPTIONS array
- **RELATIONSHIP_OCCASION_DEFAULTS**: Ensure Father's Day shows for "Grandfather", "Uncle", "Stepfather", "Father-in-law"
- **RELATIONSHIP_OCCASION_DEFAULTS**: Ensure Mother's Day shows for "Grandmother", "Aunt", "Stepmother", "Mother-in-law"

---

## 7. Additional Occasions List

### Current Implementation (options.jsx)
```javascript
ADDITIONAL_OCCASION_OPTIONS = [
  "Valentine's Day", "Anniversary", "Mother's Day", "Father's Day",
  "Easter", "Eid", "Diwali", "Hanukkah", "Rosh Hashanah", 
  "Lunar New Year", "Other"
]
```

### Required by Client
Under "+ Add another occasion" should show the FULL list including:
- Eid
- Diwali
- Hanukkah
- Rosh Hashanah
- Lunar New Year
- Easter
- Other: ___ (free text)

But EXCLUDING occasions already shown based on relationship (Birthday, Christmas, Valentine's Day, Anniversary, Mother's Day, Father's Day).

### Status
✅ Already correct — the component filters out `primary` occasions from the additional list.

---

## 8. Form Field Updates

### Current PersonForm Fields
```
- Their first name ✅
- Their relationship to you ✅
- Occasions to remember ✅
- Approximate age range ⚠️ (needs two-step)
- Their gender ✅
- [Age-dependent sections]
```

### For Under 12:
- Detailed age bracket ✅
- What are they into? ✅ (but label should be more aligned)
- Gifts or categories to avoid ✅

### For 12+:
- Their interests ✅
- Their personality ✅
- What kind of gifts do they love? ✅
- Gifts or categories to avoid ✅
- **Who they are** - optional ✅
- **Hobbies and interests** - optional ✅
- **Tell me anything else that would help** ⚠️ (merge milestones here)
- ~~Any upcoming significant milestones?~~ ❌ (remove, merge above)

### Action Required
- Merge "milestones" into "anything else" field
- Update helper text to match client spec exactly
- Update child interests helper text to match: "Tell me anything about what they love — e.g. dinosaurs, princesses, a particular cartoon, building things, animals. Anything at all helps."

---

## 9. Budget Validation

### Current Implementation
Budget is free-text numeric (min/max) - ✅ Correct

### Required Validation (from client note)
> "Please validate that minimum ≤ maximum and both are positive numbers"

### Action Required
- **PersonForm.jsx**: Add validation in `submit` function:
```javascript
if (form.occasions.some((o) => {
  const min = Number(o.budget_min);
  const max = Number(o.budget_max);
  return min < 0 || max < 0 || min > max;
})) {
  er.occasions = "Budget minimum must be ≤ maximum, and both must be positive";
}
```

### Client Note Display
> "My gift recommendations start from £30. If your minimum and maximum are close together I'll focus suggestions tightly within that range."

Consider adding this as helper text on the budget fields.

---

## 10. Copy & Messaging Updates

### AboutYouStep.jsx
**Current heading:** "First, a little about you"  
**Required:** No change specified in doc, but could align better with client tone.

**Current subheading:** "Just so Gem knows who she's curating for."  
**Required:** ✅ Matches tone

### PersonForm.jsx
**Current heading:** 
- First person: "Now, someone special"
- Additional: "Add another person"

**Required (from spec):**
```
About the Person You'd Like Me to Remember

Complete one section per person. You can add up to 10 people. Don't worry about completing 
everything now — fill in what you can and I'll check in six weeks before their occasion with 
another opportunity to add more detail.
```

### Action Required
- Update heading to: "About the Person You'd Like Me to Remember" (first person only)
- Update subheading to match spec exactly
- Keep "Person X of up to 10" indicator

---

## 11. Final Confirmation Screen

### Current "Done" Screen
```
You're all set!
Gem now has {count} {word} to look after. You'll hear from her ahead of each 
occasion with thoughtful gift ideas.
```

### Required by Client
```
Thank you — I'll be in touch shortly to confirm your profile is set up. Your first 
curated gift ideas will arrive one month before your earliest upcoming occasion. 
In the meantime, if you have any questions or want to add anything you've forgotten, 
just reply to your welcome email or get in touch at [EMAIL]. — Gem x
```

### Action Required
- **Onboarding.jsx**: Update `Done` component copy to match spec

---

## Implementation Priority

### High Priority (Functional Correctness)
1. ✅ Conditional date field for occasions (#2)
2. ✅ Age range two-step selection (#1)
3. ✅ Interests age-gating to 12+ (#3)
4. ✅ Budget validation (#9)
5. ✅ Relationship options split (#6)

### Medium Priority (UX & Copy)
6. ✅ Merge milestones field (#5)
7. ✅ Update helper texts (#8)
8. ✅ Update final screen copy (#11)
9. ✅ Verify Cars & Motoring removed (#4)

### Low Priority (Polish)
10. Review all copy against client spec
11. Ensure all placeholder text matches spec

---

## Testing Checklist

After implementation, verify:

- [ ] Under-12 recipients see only free-text "what they love" field
- [ ] 12-17 and adult recipients see structured interests
- [ ] Birthday/Anniversary/Other show date picker
- [ ] Christmas/Valentine's Day/etc. do NOT show date picker
- [ ] Budget validation works (min ≤ max, both positive)
- [ ] Two-step age selection works (Kids vs Adults)
- [ ] Relationship-specific occasions appear correctly
- [ ] "Aunt" and "Uncle" are separate options
- [ ] Milestones are NOT a separate field
- [ ] Final confirmation copy matches spec
- [ ] Form data saves correctly to Recipient entity

---

## Database Schema Considerations

Ensure these fields exist in `Recipient` entity:

```jsonc
{
  "name": "string",
  "relationship": "string",
  "occasions": "array", // [{ type, custom_label?, day, month, budget_min, budget_max }]
  "age_range": "string", // Now stores the exact client spec values
  "child_age_bracket": "string?", // Optional, for under-12 only
  "age_band": "enum", // Computed from age_range for gift matching
  "gender": "enum",
  "interests": "array",
  "personality": "array",
  "gift_types": "array",
  "avoid_notes": "text?",
  "hobbies_and_interests": "text?",
  "things_you_know": "text?",
  "milestones": "text?", // Keep for backward compatibility
  "who_they_are": "text?",
  "notes": "text?"
}
```

---

## Files to Modify

1. **src/components/onboarding/options.jsx**
   - Update AGE_RANGES structure
   - Split Aunt/Uncle, add Nephew/Niece separately
   - Update CHILD_INTERESTS_HELPER text
   - Add PERSONAL_OCCASIONS constant

2. **src/components/onboarding/PersonForm.jsx**
   - Change age selection to two-step
   - Fix age-gating condition (12+ for interests)
   - Remove separate milestones field
   - Update "anything else" helper text
   - Add budget validation

3. **src/components/onboarding/OccasionsField.jsx**
   - Add conditional date field logic (personal occasions only)
   - Add budget helper text note about £30 minimum

4. **src/pages/Onboarding.jsx**
   - Update Done component copy
   - Verify data mapping handles new age structure

5. **src/components/shared/taxonomy.js** (if it exists)
   - Remove "Cars & Motoring" from interests

---

## Questions for Client

1. Should "Partner / spouse" be stored as "Partner" in the database, or as the full string?
2. Confirm the email address to display in final confirmation: `[EMAIL]` → what should this be?
3. For the two-step age selection, should we save "Kids" or "All adults" as a separate field, or derive it from the selected age range?

---

**END OF DOCUMENT**
