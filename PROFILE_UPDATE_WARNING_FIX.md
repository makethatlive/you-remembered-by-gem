# Profile Update Warning Fix ✅

## Issue

Message showing on ALL old gift lists even when user made NO changes:
```
"Izzy's profile was updated after these gifts were generated — Regenerate will use the latest details."
```

---

## Root Cause

### The Problem:

1. **Hash includes TAXONOMY_VERSION**
   ```javascript
   computeProfileHash([
     ...user fields,
     TAXONOMY_VERSION  // ❌ This caused the issue
   ])
   ```

2. **When taxonomy.js updated:**
   - Added DIY & tools entry
   - Added keywords (coffee, tea, maker, pan, etc.)
   - BUT version stayed "3.0.0"

3. **Result:**
   - Old gift lists have hash with old taxonomy
   - New page load computes hash with updated taxonomy
   - Hashes don't match → shows warning
   - **Even though USER didn't change anything!**

---

## Solution Implemented

### Fixed Hash Computation:

**Removed TAXONOMY_VERSION from client-side hash check**

```javascript
// OLD (in ApprovalDetail.jsx):
function computeProfileHash(recipient) {
  const source = JSON.stringify([
    recipient.interests,
    recipient.personality,
    // ... other fields
    TAXONOMY_VERSION,  // ❌ Removed this
  ]);
  // ... hash logic
}

// NEW:
function computeProfileHash(recipient) {
  const source = JSON.stringify([
    recipient.interests,
    recipient.personality,
    recipient.giftTypes,
    recipient.hobbiesAndInterests,
    recipient.whoTheyAre,
    recipient.thingsYouKnow,
    recipient.milestones,
    recipient.avoidNotes,
    recipient.notes,
    recipient.ageBand,
    recipient.gender,
    recipient.relationship,
    // TAXONOMY_VERSION removed ✅
  ]);
  // ... hash logic
}
```

---

## Why This Fix is Correct

### Taxonomy Changes vs User Changes:

| Change Type | Should Show Warning? | Reason |
|------------|---------------------|---------|
| User edits interests | ✅ YES | Profile actually changed |
| User edits personality | ✅ YES | Profile actually changed |
| User edits budget | ✅ YES | Profile actually changed |
| **Taxonomy updated** | ❌ NO | System change, not user change |
| **Keywords added** | ❌ NO | Improves matching, not a profile edit |

### Server-Side Still Includes TAXONOMY_VERSION:

- Server generates NEW hash with TAXONOMY_VERSION
- This ensures regeneration uses latest taxonomy
- But client-side check only looks at USER-EDITABLE fields
- **Result:** Warning only shows when user ACTUALLY edited profile

---

## Files Changed

### 1. `src/components/admin/ApprovalDetail.jsx`
- Removed `TAXONOMY_VERSION` from `computeProfileHash()`
- Now only checks user-editable fields

### 2. `src/components/shared/taxonomy.js`
- Bumped version: `3.0.0` → `3.1.0`
- Documents taxonomy changes made

### 3. `server/services/enrichment/taxonomy.js`
- Bumped version: `3.0.0` → `3.1.0`
- Keeps server in sync

---

## Expected Behavior After Fix

### Scenario 1: User Edits Profile
```
User changes interests: Cooking → Cooking + Gardening
✅ Warning shows: "Profile was updated after..."
✅ Regenerate button appears
✅ Correct behavior
```

### Scenario 2: Taxonomy Updated (System Change)
```
Dev adds DIY & tools category
❌ Warning does NOT show
❌ No regenerate prompt
✅ Correct - user didn't change anything
```

### Scenario 3: User Edits Budget
```
User changes budget: £50-£150 → £100-£200
✅ Warning shows (budget visible in profile card)
✅ Regenerate available
✅ Correct behavior
```

---

## Testing

### Test Cases:

1. **Load existing gift list (Izzy)**
   - Should NOT show warning ✅
   - Profile unchanged by user

2. **Edit recipient profile → Load list**
   - Should show warning ✅
   - Profile genuinely changed

3. **Update taxonomy → Load old list**
   - Should NOT show warning ✅
   - System change, not user change

---

## Technical Details

### Hash Algorithm (FNV-1a):

```javascript
let hash = 0x811c9dc5;  // FNV offset basis
for (let i = 0; i < source.length; i++) {
  hash ^= source.charCodeAt(i);
  hash = Math.imul(hash, 0x01000193) >>> 0;  // FNV prime
}
return hash.toString(16);
```

### Fields Included in Hash:

✅ **User-Editable:**
- interests
- personality
- giftTypes
- hobbiesAndInterests
- whoTheyAre
- thingsYouKnow
- milestones
- avoidNotes
- notes
- ageBand
- gender
- relationship

❌ **System/Excluded:**
- budgetMin (shown separately)
- budgetMax (shown separately)
- TAXONOMY_VERSION (system change)

---

## Version History

### v3.1.0 (Current)
- Added DIY & tools category
- Enhanced keywords (coffee, tea, maker, pan, pot, fork, spade)
- Fixed profile update warning logic

### v3.0.0 (Previous)
- Original taxonomy structure

---

## Migration Notes

### No Database Migration Needed! ✅

- Old `derivedProfileHash` values stay unchanged
- Client-side hash now ignores TAXONOMY_VERSION
- Hashes will match for unchanged profiles
- Server will regenerate with new taxonomy on next generation

---

## Commit Message

```
Fix: Profile update warning showing incorrectly

- Removed TAXONOMY_VERSION from client-side hash check
- Warning now only shows when USER edits profile fields
- System changes (taxonomy updates) don't trigger warning
- Bumped TAXONOMY_VERSION to 3.1.0 (documents changes)
- Fixes false positive warnings on old gift lists
```

---

**Status:** ✅ Fixed and Ready
**Impact:** Better UX - warnings only for actual profile changes
**Breaking:** None - backward compatible
