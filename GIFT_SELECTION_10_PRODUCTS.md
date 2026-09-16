# Gift Selection: 10 Products (5 Primary + 5 Backup)

## Changes Made

Updated the gift selection system to generate **up to 10 gifts** instead of 5:
- **First 5** → "Top 5 Selected" (Primary - shown to subscriber)
- **Next 5** → "Backup Ideas" (Backup - for admin to promote/swap)

---

## Modified Files

### 1. `server/services/gifts/ai-gift-selector.js`
**Changes:**
- System prompt updated to request 10 gifts (5 primary + 5 backup)
- Schema `maxItems` changed from 5 to 10
- `validateAndMapSelections()` now marks first 5 as `isPrimary: true`, rest as `isPrimary: false`
- `fallbackSelection()` also returns up to 10 (5 primary + 5 backup)
- Logging updated to show primary vs backup count

**Key Logic:**
```javascript
isPrimary: index < 5  // First 5 are primary, rest are backup
```

### 2. `server/services/gifts/gift-list-generator.js`
**Changes:**
- Gift item status now based on `isPrimary` flag:
  - `isPrimary: true` → `status: 'approved'` (Top 5 Selected)
  - `isPrimary: false` → `status: 'standby'` (Backup Ideas)

**Key Logic:**
```javascript
status: gift.isPrimary ? 'approved' : 'standby'
```

---

## How It Works

### AI Selection Flow:
1. **Product Matcher** finds matching products (same as before)
2. **AI Gift Selector** asks Claude for up to 10 gifts:
   - AI is instructed: "First 5 should be strongest, next 5 are backup"
   - Marks first 5 with `isPrimary: true`
   - Marks remaining with `isPrimary: false`
3. **Gift List Generator** saves gifts:
   - Primary gifts (`isPrimary: true`) → `status: 'approved'`
   - Backup gifts (`isPrimary: false`) → `status: 'standby'`

### Admin UI Display:
The `ApprovalDetail.jsx` component already supports this:
- **Top 5 Selected** section shows gifts with `status: 'approved'`
- **Backup Ideas** section shows gifts with `status: 'standby'`
- Admins can **promote** backup → top 5
- Admins can **demote** top 5 → backup

---

## Example Output

### Before (5 gifts total):
```
Top 5 Selected: 5 gifts
Backup Ideas: 0 gifts
```

### After (10 gifts when available):
```
Top 5 Selected: 5 gifts
Backup Ideas: 5 gifts
```

### Graceful Degradation:
If only 7 suitable products found:
```
Top 5 Selected: 5 gifts
Backup Ideas: 2 gifts
```

If only 3 suitable products found:
```
Top 5 Selected: 3 gifts
Backup Ideas: 0 gifts
```

---

## Testing

1. **Generate a new gift list:**
   ```bash
   npm run server
   # Then in browser: Generate gifts for a recipient
   ```

2. **Expected behavior:**
   - AI should return up to 10 products (if available)
   - First 5 show in "Top 5 Selected"
   - Remaining show in "Backup Ideas"
   - Admin can promote/demote between sections

3. **Check console logs:**
   ```
   🎁 ===== AI GIFT SELECTION STARTING =====
      Target: 10 gift recommendations (5 primary + up to 5 backup)
   
   ✅ AI GIFT SELECTION COMPLETE
      Selected: 10 gifts
      ℹ️  AI returned 10 recommendations (5 primary, 5 backup)
   ```

---

## Benefits

✅ **More options** for subscribers (10 vs 5)
✅ **Better admin control** with backup gifts ready to swap
✅ **Graceful degradation** if fewer than 10 suitable products exist
✅ **No UI changes needed** - existing UI already supports primary/backup
✅ **Backward compatible** - works with existing gift lists

---

## Notes

- The AI will try to provide 10 gifts but may return fewer if:
  - Not enough suitable products match recipient interests
  - Quality standards not met
  - Budget/age/gender constraints limit options

- Backup gifts are NOT shown to subscribers initially
- Only "Top 5 Selected" gifts go in the approval email
- Admins can promote backups if needed before approval

---

## Status

✅ **IMPLEMENTED AND READY**

Test by generating a new gift list!
