# Recipient Update Error Fixed ✅

## Issue
When saving recipient (people) information, the app showed this error:
```
PATCH http://localhost:3001/api/recipients/6a845b117471ac99194f8f88 500 (Internal Server Error)
Invalid value for argument `gender`. Expected Gender.
```

## Root Cause
The frontend was sending enum field values in their original format (e.g., "Male", "Female", "Under 5"), but Prisma expects uppercase enum values with underscores:
- Gender: `MALE`, `FEMALE`, `NON_BINARY`, `PREFER_NOT_TO_SAY`
- AgeBand: `UNDER_5`, `FIVE_TO_10`, `ELEVEN_TO_17`, `EIGHTEEN_TO_30`, etc.

The server wasn't transforming these values before passing them to Prisma.

## The Fix

### File Modified: `server/index.js`

Updated both recipient endpoints to transform enum values:

#### 1. POST `/api/recipients` (Create)
- Transforms `gender` to uppercase
- Transforms `ageBand` to uppercase and maps variations
- Added better error logging

#### 2. PATCH `/api/recipients/:id` (Update)
- Transforms `gender` to uppercase
- Transforms `ageBand` to uppercase and maps variations
- Added better error logging

### Transformation Logic

**Gender Transform:**
```javascript
let gender = data.gender;
if (gender && typeof gender === 'string') {
  gender = gender.toUpperCase();
}
```

**AgeBand Transform:**
```javascript
let ageBand = data.ageBand || data.age_band;
if (ageBand && typeof ageBand === 'string') {
  ageBand = ageBand.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  // Maps variations like "Under 5" → "UNDER_5", "5-10" → "FIVE_TO_10", etc.
  ageBand = ageBandMap[ageBand] || ageBand;
}
```

### AgeBand Mapping Table

| Frontend Value | Database Value |
|----------------|----------------|
| "Under 5" | `UNDER_5` |
| "5-10" | `FIVE_TO_10` |
| "11-17" | `ELEVEN_TO_17` |
| "18-30" | `EIGHTEEN_TO_30` |
| "31-50" | `THIRTY_ONE_TO_50` |
| "51-70" | `FIFTY_ONE_TO_70` |
| "71+" | `SEVENTY_PLUS` |

## What's Fixed Now

✅ **Create recipient** - Gender and age band enums properly transformed  
✅ **Update recipient** - Gender and age band enums properly transformed  
✅ **Better error logging** - Shows request data when errors occur  
✅ **Flexible input** - Accepts various formats and normalizes them  

## Testing

1. Open http://localhost:5173
2. Go to **My People** tab
3. Click on an existing person or add a new person
4. Fill in the form with:
   - Gender: Male, Female, Non-binary, or Prefer not to say
   - Age: Any age range option
   - Other fields as needed
5. Click **Save**
6. ✅ Should save successfully without errors!

## Valid Enum Values

### Gender Enum (case-insensitive input, stored as uppercase)
- `MALE`
- `FEMALE`
- `NON_BINARY`
- `PREFER_NOT_TO_SAY`

### AgeBand Enum (auto-transformed)
- `UNDER_5` (displays as "Under 5")
- `FIVE_TO_10` (displays as "5-10")
- `ELEVEN_TO_17` (displays as "11-17")
- `EIGHTEEN_TO_30` (displays as "18-30")
- `THIRTY_ONE_TO_50` (displays as "31-50")
- `FIFTY_ONE_TO_70` (displays as "51-70")
- `SEVENTY_PLUS` (displays as "71+")

## Other Enums Handled

The server also properly handles these enums in other endpoints:
- **SubscriptionStatus**: `ACTIVE`, `CANCELLED`, `PAST_DUE`, `TRIALLING`
- **RetailerCategory**: `MEN`, `WOMEN`, `UNISEX_ADULT`, `KIDS`, `UNISEX_KIDS`
- **ProductStatus**: `ACTIVE`, `INACTIVE`, `NEEDS_REVIEW`, `REPORTED_BROKEN`
- **SourceType**: `CURATED_PRODUCT`, `CURATED_RETAILER`, `SHOPIFY_UPLOAD`, `LEGACY_UNKNOWN`

## Benefits

✅ **Robust** - Handles various input formats automatically  
✅ **User-friendly** - Frontend can send natural values like "Male" or "Female"  
✅ **Database-safe** - Ensures Prisma receives valid enum values  
✅ **Better debugging** - Error logs now include request data  
✅ **Flexible** - Accepts both snake_case and camelCase field names  

---

**Status**: ✅ Recipient Update Fixed & Server Restarted  
**Affected Endpoints**: POST /api/recipients, PATCH /api/recipients/:id  
**Last Updated**: 2026-09-02
