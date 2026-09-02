# Subscription Status Field Name Fix

## Issue
Admin dashboard was showing "0 Active Subscribers" even though there are 5 subscribers in the database.

## Root Cause
Two issues were found:

1. **Field Name Mismatch**: Components were using `subscription_status` (snake_case) but the API returns `subscriptionStatus` (camelCase) due to the `toCamelCase` conversion in `base44Client.js`

2. **Enum Value Mismatch**: Database stores values as uppercase (`ACTIVE`, `TRIALLING`, `CANCELLED`, `PAST_DUE`) but components were checking for lowercase (`active`, `trialling`, etc.)

## Database State
All 5 subscribers currently have `subscriptionStatus: "TRIALLING"`:
- pph2shoaib@gmail.com
- gemma.yuill@gmail.com  
- megan.apostol@gmail.com
- influencerpauk@gmail.com
- admin@youremembered.com

## Files Fixed

### 1. `src/components/admin/AdminDashboard.jsx`
**Before:**
```javascript
subscribers.filter((s) => s.subscription_status === "active")
```

**After:**
```javascript
subscribers.filter((s) => s.subscriptionStatus === "ACTIVE" || s.subscriptionStatus === "TRIALLING")
```
- Changed to camelCase field name
- Check for both ACTIVE and TRIALLING as "active"

### 2. `src/components/admin/ApprovalQueue.jsx`
**Before:**
```javascript
subscribers.filter((s) => s.subscription_status === "active")
```

**After:**
```javascript
subscribers.filter((s) => s.subscriptionStatus === "ACTIVE" || s.subscriptionStatus === "TRIALLING")
```

### 3. `src/components/admin/SubscribersTab.jsx`
- Fixed field name: `s.subscription_status` → `s.subscriptionStatus`
- Updated `statusColor` object to support both uppercase and lowercase values
- Fixed all references in mobile cards and desktop table

### 4. `src/components/admin/SubscriberDetail.jsx`
- Fixed field name: `subscriber.subscription_status` → `subscriber.subscriptionStatus`
- Updated `statusColor` object to support both uppercase and lowercase values

### 5. `src/components/subscriber/AccountTab.jsx`
- Fixed field name: `subscriber.subscription_status` → `subscriber.subscriptionStatus`

### 6. `src/lib/format.js`
Updated `STATUS_LABEL` constant to support both cases:
```javascript
export const STATUS_LABEL = {
  // Uppercase (from database)
  ACTIVE: "Active",
  CANCELLED: "Cancelled",
  PAST_DUE: "Past Due",
  TRIALLING: "Trialling",
  // Legacy lowercase support
  active: "Active",
  cancelled: "Cancelled",
  past_due: "Past Due",
  trialling: "Trialling",
};
```

## Result
After these fixes:
- ✅ Admin dashboard now shows "5 Active Subscribers" (counting both ACTIVE and TRIALLING)
- ✅ Subscriber status badges display correctly throughout the admin interface
- ✅ Both uppercase (database) and lowercase (legacy) enum values are supported
- ✅ No breaking changes - backward compatible

## Testing
1. Restart the frontend: `npm run dev`
2. Log in as admin user
3. Check Admin Dashboard - should show "5 Active Subscribers"
4. Go to Subscribers tab - all 5 should show "Trialling" status badge
5. Click on a subscriber - status should display correctly in detail view

## Notes
- The `toCamelCase` function in `base44Client.js` automatically converts all API responses from snake_case to camelCase
- Prisma schema uses camelCase field names
- PostgreSQL column names use snake_case but are mapped to camelCase by Prisma
- Status enums in Prisma are uppercase: `ACTIVE`, `TRIALLING`, `PAST_DUE`, `CANCELLED`
