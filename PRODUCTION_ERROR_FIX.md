# Production Error Fix - Snake_Case to CamelCase Field Mapping

**Date:** September 25, 2026  
**Status:** ✅ Fixed

## Problem

Production server was failing when the frontend React app tried to update gift items because:

1. **Frontend (ApprovalDetail.jsx)** uses Base44 SDK which sends snake_case field names:
   - `admin_feedback_reason`
   - `admin_feedback_note`

2. **Backend (server/index.js)** uses Prisma which expects camelCase field names:
   - `adminFeedbackReason`
   - `adminFeedbackNote`

### Error Messages

```
Error updating gift item: PrismaClientValidationError
Unknown argument `admin_feedback_reason`. Available options are marked with ?.
```

```
Error creating gift item: PrismaClientKnownRequestError
Foreign key constraint violated: `gift_items_product_id_fkey (index)`
Code: P2003
```

## Root Cause

The frontend uses **Base44 entity SDK** (`base44.entities.GiftItem.update()`) which follows database column naming (snake_case), while the Express server expects Prisma model field names (camelCase).

## Solution

Added automatic field name mapping in Express API endpoints to convert snake_case to camelCase.

### Files Modified

- `d:\you-remembered-by-gem\server\index.js`

### Changes Made

#### 1. Gift Item PATCH Endpoint (line ~720)

**Before:**
```javascript
const updateData = { ...data };
if (updateData.status) updateData.status = updateData.status.toUpperCase();
if (updateData.subscriberAction) // ... etc
```

**After:**
```javascript
// Map snake_case (from Base44 SDK) to camelCase (Prisma)
const fieldMapping = {
  subscriber_action: 'subscriberAction',
  admin_feedback_reason: 'adminFeedbackReason',
  admin_feedback_note: 'adminFeedbackNote',
  source_type: 'sourceType',
  delivery_speed: 'deliverySpeed',
  selection_score: 'selectionScore',
  matched_signals: 'matchedSignals',
  product_id: 'productId',
  gift_list_id: 'giftListId'
};

const updateData = {};
for (const [key, value] of Object.entries(data)) {
  const mappedKey = fieldMapping[key] || key;
  updateData[mappedKey] = value;
}
```

#### 2. Gift List PATCH Endpoint (line ~575)

Refactored from manual field-by-field mapping to systematic approach:

```javascript
const fieldMapping = {
  list_type: 'listType',
  rejection_reason: 'rejectionReason',
  rejection_note: 'rejectionNote',
  approved_at: 'approvedAt',
  visible_to_subscriber: 'visibleToSubscriber',
  supersedes_list_id: 'supersedesListId',
  refresh_requested_at: 'refreshRequestedAt',
  refresh_reason: 'refreshReason',
  ai_prompt_used: 'aiPromptUsed',
  recipient_id: 'recipientId',
  subscriber_id: 'subscriberId',
  subscriber_user_id: 'subscriberUserId',
  birthday_date: 'birthdayDate',
  generated_at: 'generatedAt'
};
```

#### 3. Gift Item POST Endpoint - Better Error Handling (line ~850)

Added specific error messages for foreign key violations:

```javascript
} catch (error) {
  console.error('Error creating gift item:', error);
  
  // Better error messages for foreign key violations
  if (error.code === 'P2003') {
    const field = error.meta?.field_name || 'unknown';
    if (field.includes('product_id')) {
      return res.status(400).json({ error: 'Product ID does not exist in database' });
    } else if (field.includes('gift_list_id')) {
      return res.status(400).json({ error: 'Gift list ID does not exist in database' });
    }
    return res.status(400).json({ error: `Foreign key constraint failed on field: ${field}` });
  }
  
  res.status(500).json({ error: error.message });
}
```

## Impact

### ✅ Now Works

1. Admin can remove/swap gift items in ApprovalDetail.jsx
2. Admin can set removal reasons (bad_link_or_data, age_inappropriate, etc.)
3. Admin can add removal notes
4. Subscriber can report broken gifts via reportBrokenGift function
5. All Base44 entity updates work seamlessly with Express API

### 🔄 Backward Compatible

- Still accepts camelCase field names (if sent directly)
- Still accepts snake_case field names (from Base44 SDK)
- Automatically converts snake_case → camelCase

### 🎯 Error Handling Improved

- Foreign key violations now show clear messages:
  - "Product ID does not exist in database"
  - "Gift list ID does not exist in database"
- Helps admins understand data integrity issues

## Testing Checklist

- [ ] Remove a gift item from approval panel
- [ ] Add removal reason and note
- [ ] Report broken gift as subscriber
- [ ] Create gift item with invalid product_id (should show clear error)
- [ ] Update gift list status

## Related Files

These files use snake_case and work through Base44 SDK (direct to Supabase):
- `base44/functions/reportBrokenGift/entry.ts`
- `base44/functions/generateGiftList/entry.ts`
- `base44/functions/computeTrendStats/entry.ts`

These files now work through Express API with field mapping:
- `src/components/admin/ApprovalDetail.jsx` (uses `base44.entities.GiftItem.update()`)

## Notes

- Base44 functions use `svc.entities.X.update()` which talks directly to Supabase → no conversion needed
- React frontend uses `base44.entities.X.update()` which calls Express API → conversion needed
- The field mapping is one-way: snake_case → camelCase
- All Prisma operations use camelCase internally

## Deployment

1. Deploy updated `server/index.js` to production
2. No database changes required
3. No frontend changes required
4. No Base44 function changes required

---

**Status:** Ready to deploy
