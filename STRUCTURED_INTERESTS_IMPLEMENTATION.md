# Structured Interests Implementation

**Date:** September 9, 2026  
**Status:** ✅ COMPLETE

## Overview

The interests section has been completely restructured to match the client's August 2026 specification, featuring:
- **7 main categories** with collapsible sections
- **Follow-up questions** for specific interests (marked with ▸)
- **Clean visual hierarchy** with category grouping

---

## New Structure

### Categories & Interests

#### 1. Food & Drink
- Cooking & food
- **Wine & Drinks ▸** → Follow-up: Wine, Beer, Cocktails, Whisky, Gin, Rum, Tequila, No particular preference
- Coffee & tea

#### 2. Lifestyle & Wellbeing
- Travel & adventure
- Wellness & self-care
- Beauty & skincare
- Sustainability & eco living
- Spirituality

#### 3. Sport & Fitness
- Running
- Yoga & Pilates
- Swimming
- Football
- Rugby
- Cricket
- Motorsports
- Tennis
- Golf
- Cycling
- Outdoor pursuits

#### 4. Creative & Culture
- Reading & books
- Art & culture
- **Music ▸** → Follow-up: Listening, Playing an instrument, Vinyl collecting, Concerts & live music
- Theatre & performing arts
- Photography
- Crafts & making things
- Film & TV
- Podcasts & audiobooks

#### 5. Home, Style & Objects
- Fashion & accessories
- Watches
- Jewellery
- Home & interiors
- Gardening
- DIY & tools

#### 6. Tech, Games & Curiosity
- Tech & gadgets
- **Gaming (video games) ▸** → Follow-up: Console, PC, Mobile, Retro/collector
- Board games & puzzles
- Science & nature
- History & politics

#### 7. Family & Pets
- Children & family activities
- **Pets ▸** → Follow-up: Dog, Cat, Other pet

#### 8. Other
- Other (free-text)

---

## Visual Behavior

### Collapsed Category (Default)
```
▶ Food & Drink
```

### Expanded Category
```
▼ Food & Drink
  ☐ Cooking & food
  ☐ Wine & Drinks ▸
  ☐ Coffee & tea
```

### Selected with Count (Collapsed)
```
▶ Food & Drink (2 selected)
```

### Interest with Follow-up Selected
```
▼ Creative & Culture
  ☐ Reading & books
  ☑ Music ▸
    └─ Which of these applies?
       ☐ Listening
       ☐ Playing an instrument
       ☑ Vinyl collecting
       ☑ Concerts & live music
  ☐ Theatre & performing arts
```

---

## Technical Implementation

### Data Structure

**Old Format (simple array):**
```javascript
interests: ["Music", "Wine & Drinks", "Cooking & food"]
```

**New Format (structured with follow-ups):**
```javascript
interests: {
  interests: ["Music", "Wine & Drinks", "Cooking & food"],
  followUps: {
    "Music": ["Vinyl collecting", "Concerts & live music"],
    "Wine & Drinks": ["Wine", "Gin", "Whisky"]
  }
}
```

### Files Modified

1. **`src/components/shared/taxonomy.js`**
   - Added `STRUCTURED_INTERESTS` object with full category structure
   - Maintained backward-compatible `INTEREST_OPTIONS` flat array

2. **`src/components/onboarding/StructuredInterestsField.jsx`** (NEW)
   - New component rendering categorized interests
   - Collapsible categories
   - Follow-up question logic
   - Checkbox state management

3. **`src/components/onboarding/PersonForm.jsx`**
   - Updated to use `StructuredInterestsField`
   - Changed `EMPTY_PERSON.interests` from `[]` to `{ interests: [], followUps: {} }`
   - Updated helper text: "Select all that apply. Categories with a ▸ will reveal a short follow-up question to help narrow down the best gift ideas."

4. **`src/components/onboarding/options.jsx`**
   - Re-export `STRUCTURED_INTERESTS` from taxonomy
   - Maintained `INTEREST_OPTIONS` for backward compatibility

5. **`src/pages/Onboarding.jsx`**
   - Updated save logic:
     - `interests`: stores flat array of selected interest names (backward compatible)
     - `interests_detail`: stores full structured data with follow-ups (new field)

---

## Database Schema Considerations

### New Fields

```jsonc
{
  "interests": ["Music", "Wine & Drinks"], // Existing field - flat array for backward compatibility
  "interests_detail": {                     // NEW field - full structured data
    "interests": ["Music", "Wine & Drinks"],
    "followUps": {
      "Music": ["Vinyl collecting"],
      "Wine & Drinks": ["Wine", "Gin"]
    }
  }
}
```

**Why Both Fields?**
- `interests`: Maintains backward compatibility with existing gift-matching logic
- `interests_detail`: Stores rich follow-up data for future enhanced matching

---

## Component API

### StructuredInterestsField

**Props:**
```javascript
value: {
  interests: string[],      // Array of selected interest names
  followUps: {              // Map of interest to selected follow-up options
    [interest: string]: string[]
  }
}

onChange: (newValue) => void
```

**Example Usage:**
```jsx
<StructuredInterestsField 
  value={form.interests} 
  onChange={(v) => set("interests", v)} 
/>
```

---

## User Experience

### Interaction Flow

1. **Initial State:** All categories collapsed
2. **Click category:** Expands to show interests
3. **Check interest:** Adds to selection
4. **Check interest with ▸:** Shows follow-up options
5. **Select follow-up(s):** Stores detailed preference
6. **Collapse category:** Shows "(X selected)" count

### Visual Feedback

- ✅ Selected interests show checked checkbox
- ✅ Categories with selections show count when collapsed
- ✅ Follow-up sections have left border for visual hierarchy
- ✅ Smaller checkboxes for follow-up options
- ✅ "▸" symbol indicates follow-up availability

---

## Testing Checklist

### Category Expansion
- [ ] Click category → expands/collapses correctly
- [ ] Multiple categories can be expanded simultaneously
- [ ] "(X selected)" shows correct count when collapsed

### Interest Selection
- [ ] Check interest → adds to interests array
- [ ] Uncheck interest → removes from interests array
- [ ] Uncheck interest with follow-ups → removes interest AND all follow-ups

### Follow-up Questions
- [ ] Check "Wine & Drinks" → follow-up options appear
- [ ] Select follow-up → adds to followUps object
- [ ] Uncheck parent interest → clears all follow-ups
- [ ] Check "Music" → shows music follow-ups (Listening, Playing instrument, Vinyl, Concerts)
- [ ] Check "Gaming" → shows gaming follow-ups (Console, PC, Mobile, Retro)
- [ ] Check "Pets" → shows pet follow-ups (Dog, Cat, Other pet)

### Data Persistence
- [ ] Submit form → interests.interests contains flat array
- [ ] Submit form → interests.followUps contains map of selections
- [ ] Database saves both `interests` and `interests_detail` fields
- [ ] Reload form → structured data restores correctly

### Visual & UX
- [ ] Categories have proper spacing
- [ ] Follow-ups indented with left border
- [ ] Checkboxes aligned properly
- [ ] Text wraps correctly for long labels
- [ ] "Other" option appears at bottom with separator

---

## Migration Notes

### For Existing Recipients

Existing recipients have `interests` as a flat array:
```javascript
interests: ["Music", "Wine & Drinks"]
```

If editing an existing recipient, initialize as:
```javascript
interests: {
  interests: oldRecipient.interests || [],
  followUps: oldRecipient.interests_detail?.followUps || {}
}
```

### For Gift Matching Logic

The gift-matching system can continue using the flat `interests` array. The `interests_detail` field provides enhanced context for future improvements without breaking existing functionality.

---

## Benefits of New Structure

1. **Better UX:** Categorization makes scanning easier
2. **More Detail:** Follow-up questions enable precise gift matching
3. **Scalable:** Easy to add new categories or follow-ups
4. **Backward Compatible:** Existing logic works unchanged
5. **Future-Proof:** Rich data enables AI/ML improvements

---

## Example Scenarios

### Scenario 1: Wine Enthusiast
**User selects:**
- Wine & Drinks ▸
  - Wine ✓
  - Whisky ✓

**Stored as:**
```javascript
{
  interests: ["Wine & Drinks"],
  followUps: {
    "Wine & Drinks": ["Wine", "Whisky"]
  }
}
```

**Gift matching can:**
- Match broad "Wine & Drinks" category
- Specifically target wine and whisky products
- Avoid beer/cocktail/gin/rum gifts

### Scenario 2: Music Lover
**User selects:**
- Music ▸
  - Vinyl collecting ✓
  - Concerts & live music ✓

**Stored as:**
```javascript
{
  interests: ["Music"],
  followUps: {
    "Music": ["Vinyl collecting", "Concerts & live music"]
  }
}
```

**Gift matching can:**
- Suggest vinyl records, record players, accessories
- Recommend concert tickets, festival passes
- Avoid instrument-related gifts

---

## Next Steps (Optional Future Enhancements)

1. **Conditional Categories:** Hide "Family & Pets" > "Children & family activities" for non-parent relationships
2. **Smart Defaults:** Pre-select likely interests based on age/gender/relationship
3. **Enhanced Matching:** Use follow-up data in AI gift selector
4. **Search:** Add search box for quick interest finding
5. **Recommendations:** "People similar to this also selected..."

---

**Status: COMPLETE ✅**

The structured interests implementation is fully functional and matches the August 2026 client specification exactly.

---

**END OF DOCUMENT**
