# Database Schema Update Required

**Date:** September 9, 2026  
**Status:** ⚠️ ACTION REQUIRED

## Issue

The new onboarding features are saving data that the database schema doesn't recognize:
1. **Structured interests** with follow-up questions (`interests_detail`)
2. **"Other" text fields** for personality (`personality_other`) and gift types (`gift_types_other`)
3. **New age ranges** (1-2, 3-4, 5-6, 7-8, 9-11 instead of just "Under 11")

Currently, when users:
- Select interests with follow-ups (e.g., Music → Vinyl collecting)
- Select "Other" and type custom text
- Select new age brackets

The data is being sent but may not be stored properly because the schema wasn't updated.

## Schema Changes Made

I've updated `base44/entities/Recipient.jsonc` with:

### 1. New Fields Added

```jsonc
"interests_detail": {
  "type": "object",
  "description": "Structured interests with categories, follow-ups, and other text",
  "properties": {
    "interests": {
      "type": "array",
      "items": { "type": "string" }
    },
    "followUps": {
      "type": "object"
    },
    "otherText": {
      "type": "string"
    }
  }
},
"personality_other": {
  "type": "string",
  "description": "Free text when 'Other' personality is selected"
},
"gift_types_other": {
  "type": "string",
  "description": "Free text when 'Other' gift type is selected"
}
```

### 2. Age Range Enum Extended

Added new values to `age_range` enum:
- "1-2"
- "3-4"
- "5-6"
- "7-8"
- "9-11"

(Kept "Under 11" for backward compatibility)

## Required Actions

### 1. Restart Base44 Server

The schema changes need to be picked up:

```bash
cd d:\you-remembered-by-gem
# Stop the current base44 process
# Then restart it
npm run base44
```

### 2. Test Data Saving

After restart, test that:

1. **Structured Interests:**
   - Go to onboarding
   - Select "Music" → check "Vinyl collecting"
   - Submit
   - Edit the person → verify "Music" is checked AND "Vinyl collecting" is selected

2. **Other Text Fields:**
   - Select "Other" in Personality
   - Type "Meticulous planner"
   - Submit
   - Edit → verify "Other" is checked AND text is shown

3. **Age Ranges:**
   - Select "Kids" → "5-6"
   - Submit
   - Edit → verify "Kids" is selected and "5-6" shows in dropdown

### 3. Check Existing Data

Existing recipients may have:
- `interests` as flat array (old format)
- No `interests_detail` field

The code handles this gracefully by:
```javascript
const storedInterests = recipient?.interests_detail || { 
  interests: recipient?.interests || [], 
  followUps: {},
  otherText: ""
};
```

## Data Format Examples

### Before (Old Format)
```json
{
  "interests": ["Music", "Wine & Drinks"],
  "personality": ["Creative and expressive"],
  "gift_types": ["Experiences"]
}
```

### After (New Format)
```json
{
  "interests": ["Music", "Wine & Drinks"],
  "interests_detail": {
    "interests": ["Music", "Wine & Drinks"],
    "followUps": {
      "Music": ["Vinyl collecting", "Concerts & live music"],
      "Wine & Drinks": ["Wine", "Gin"]
    },
    "otherText": ""
  },
  "personality": ["Creative and expressive", "Other"],
  "personality_other": "Meticulous planner",
  "gift_types": ["Experiences", "Other"],
  "gift_types_other": "Vintage collectibles"
}
```

## Files Modified

1. ✅ `base44/entities/Recipient.jsonc` - Schema updated
2. ✅ `src/components/onboarding/PersonForm.jsx` - Saves new format
3. ✅ `src/pages/Onboarding.jsx` - Saves new format
4. ✅ `src/components/subscriber/RecipientForm.jsx` - Loads and saves new format

## Verification Queries

After restart, you can verify the schema is loaded by checking base44's logs or by testing a create/update operation.

---

**Status: Schema Updated, Server Restart Required** ⚠️

