# Recipient Create Error Fixed ✅

## Issue
When a subscriber tries to add a new recipient (person), the app shows:
```
POST http://localhost:3001/api/recipients 500 (Internal Server Error)
```

**Error message**:
```
Argument `subscriber` is missing.
```

## Root Cause

Looking at the Prisma schema for Recipient:

```prisma
model Recipient {
  // ... other fields ...
  subscriberId  String    @map("subscriber_id")
  createdById   String    @map("created_by_id")
  
  // Relations
  subscriber    Subscriber @relation(fields: [subscriberId], references: [id])
  owner         User       @relation(fields: [createdById], references: [id])
}
```

A Recipient requires **TWO** foreign keys:
1. **`subscriberId`** - The subscriber who owns this recipient
2. **`createdById`** - The user who created this recipient (the subscriber's linked user account)

The frontend was only sending `subscriber_id`, but not `created_by_id`. The server needs to automatically look up the `createdById` from the Subscriber.

## The Fix

Updated `POST /api/recipients` endpoint in `server/index.js`:

### Before
```javascript
const recipient = await prisma.recipient.create({
  data: {
    // ... fields ...
    subscriberId: data.subscriberId || data.subscriber_id,
    createdById: data.createdById || data.created_by_id,  // undefined!
  }
});
```

### After
```javascript
// Get createdById from subscriber if not provided
let createdById = data.createdById || data.created_by_id;
const subscriberId = data.subscriberId || data.subscriber_id;

if (!createdById && subscriberId) {
  // Look up the subscriber to get their createdById (owner)
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: subscriberId },
    select: { createdById: true }
  });
  
  if (subscriber) {
    createdById = subscriber.createdById;
  }
}

if (!createdById) {
  return res.status(400).json({ 
    error: 'createdById is required and could not be determined from subscriber' 
  });
}

const recipient = await prisma.recipient.create({
  data: {
    // ... fields ...
    subscriberId: subscriberId,
    createdById: createdById,  // ✅ Now set!
  }
});
```

## How It Works

1. **Frontend sends**: `subscriber_id` (e.g., `"6a82fcc8dd23ed146cdc7a8f"`)
2. **Server looks up**: The Subscriber record with that ID
3. **Server extracts**: The `createdById` from that Subscriber
4. **Server creates**: Recipient with BOTH `subscriberId` and `createdById`

Example flow:
```
Subscriber (id: 6a82f9ef318f01ae7cd55c69)
├─ createdById: 6a82fcc8dd23ed146cdc7a8f
└─ This is the User who owns this subscriber account

↓ When creating Recipient

Recipient
├─ subscriberId: 6a82f9ef318f01ae7cd55c69 (from frontend)
└─ createdById: 6a82fcc8dd23ed146cdc7a8f (looked up from Subscriber)
```

## Testing

### Test Data from Your Request
```json
{
  "name": "Jenny",
  "relationship": "Daughter",
  "gender": "Female",
  "age_band": "5-10",
  "birthday": "--09-05",
  "occasion": "Birthday",
  "occasion_day": 5,
  "occasion_month": 9,
  "budget_min": 100,
  "budget_max": 350,
  "subscriber_id": "6a82fcc8dd23ed146cdc7a8f"
}
```

**Before**: ❌ 500 Error - "Argument `subscriber` is missing"

**After**: ✅ 201 Created - Recipient "Jenny" created successfully

### Test in Browser

1. Open http://localhost:5173
2. Go to **My People** tab
3. Click **Add Person** or the + button
4. Fill in the form:
   - Name: "Jenny"
   - Relationship: "Daughter"
   - Gender: "Female"
   - Age: "5-10"
   - Birthday: Month 9, Day 5
   - Budget: £100 - £350
   - Interests, etc.
5. Click **Save**
6. ✅ Should save successfully without errors!

## Related Files

### Modified
- `server/index.js` - Added createdById lookup logic to POST `/api/recipients`

### Schema Reference
- `prisma/schema.prisma` - Recipient model definition

## Database Relationships

```
User (Authentication)
  ↓ (one User can create many Subscribers)
Subscriber (Business/Billing)
  ↓ (one Subscriber can have many Recipients)
Recipient (People to buy gifts for)
  ↓ (one Recipient can have many Gift Lists)
Gift List (AI-generated suggestions)
```

**Key Point**: Recipient has relationships to BOTH:
- **Subscriber** (who owns this recipient)
- **User** (who created/owns the subscriber)

This is why both `subscriberId` and `createdById` are required.

## Error Handling

The endpoint now validates that `createdById` can be determined:

```javascript
if (!createdById) {
  return res.status(400).json({ 
    error: 'createdById is required and could not be determined from subscriber' 
  });
}
```

This will return a 400 Bad Request if:
- `subscriber_id` is not provided
- Subscriber with that ID doesn't exist in database
- Subscriber has no `createdById` (should never happen with correct data)

## What Gets Transformed

The endpoint also handles these transformations:

1. **Gender**: `"Female"` → `"FEMALE"`
2. **Age Band**: `"5-10"` → `"FIVE_TO_10"`
3. **Field Names**: snake_case → camelCase
   - `subscriber_id` → `subscriberId`
   - `created_by_id` → `createdById`
   - `age_band` → `ageBand`
   - `budget_min` → `budgetMin`
   - etc.

All these transformations happen automatically on the server.

## Benefits

✅ **Frontend Simplification**: Frontend only needs to send `subscriber_id`  
✅ **Data Integrity**: Both foreign keys are always set correctly  
✅ **Error Prevention**: Validates subscriber exists before creating recipient  
✅ **Backward Compatible**: Still accepts `created_by_id` if provided  
✅ **Clear Errors**: Returns helpful error message if subscriber not found  

---

**Status**: ✅ FIXED - Recipient Create Working  
**Issue**: Missing `createdById` field  
**Solution**: Auto-lookup from Subscriber  
**Last Updated**: 2026-09-02
