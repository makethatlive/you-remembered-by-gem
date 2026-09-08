# Availability Check Implementation (Re-run Scrape Button)

## Summary

Successfully implemented the **"Re-run Scrape"** functionality in the standalone version to match the original base44 implementation exactly.

## What Was Implemented

### 1. **New Service: `availability-checker.js`**
**Location**: `server/services/products/availability-checker.js`

This service replicates the logic from `base44/functions/checkAvailabilityBatch/entry.ts`:

- **`checkAvailabilityBatch(prisma, { cursor, batchSize })`**
  - Fetches all `ACTIVE` and `NEEDS_REVIEW` products
  - Processes them in batches (default 25, max 50)
  - Uses cursor-based pagination for resume capability
  - Returns `{ processed, next_cursor, done }`

- **`checkAvailability(url)`**
  - Sends HEAD request to product URL (8-second timeout)
  - Falls back to GET with Range header if HEAD fails (405/403)
  - Returns: `"available"`, `"gone"` (404/410), or `"unknown"`

- **`catalogueCorrection(product)`**
  - Detects invalid product names ("Choose", "Shop Now", etc.)
  - Filters non-product URLs (blog, journal, guide, article, search)
  - Identifies listicle/editorial content ("Top 10 tips...")
  - Corrects age bands based on product text patterns

### 2. **New API Endpoint**
**Location**: `server/index.js`

```
POST /api/products/check-availability-batch
```

**Request Body**:
```json
{
  "cursor": 0,
  "batch_size": 25
}
```

**Response**:
```json
{
  "processed": 25,
  "next_cursor": 25,
  "done": false
}
```

**Authentication**: Requires admin (uses `requireAdmin` middleware)

### 3. **Client Integration**
**Location**: `src/api/base44Client.js`

Added handler for `base44.functions.invoke('checkAvailabilityBatch', { cursor, batch_size })`:

```javascript
if (functionName === 'checkAvailabilityBatch') {
  const response = await fetch(`${API_BASE}/products/check-availability-batch`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Admin-Key': localStorage.getItem('admin_key') || '',
    },
    body: JSON.stringify(toSnakeCase(data)),
  });
  
  const result = await response.json();
  return { data: toCamelCase(result) };
}
```

### 4. **ScrapeState Support**
**Location**: `server/index.js` + `src/api/base44Client.js`

Added endpoints and client support for ScrapeState queries:

```
GET /api/scrape-state
GET /api/scrape-state/:id
```

Added to base44Client entities:
```javascript
ScrapeState: {
  list: async () => { ... },
  get: async (id) => { ... }
}
```

**Note**: The availability check does NOT require or use the ScrapeState lock (by design). The RerunScrapeButton queries ScrapeState only to keep the cache warm, not to gate execution.

## How It Works

### Frontend Flow (RerunScrapeButton.jsx)

1. User clicks **"Re-run Scrape"** button
2. Component loads saved cursor from `localStorage` (key: `"availabilityCheckCursor"`)
3. Loops up to 100 times:
   - Calls `base44.functions.invoke("checkAvailabilityBatch", { cursor, batch_size: 25 })`
   - Accumulates `totalProcessed`
   - Updates cursor: `next_cursor` from response
   - Saves cursor to localStorage after each batch
   - Stops if `done === true` or `processed === 0`
4. Shows toast notification:
   - **Complete**: "Availability check complete — X product(s) checked."
   - **Partial**: "Checked X product(s) — press Re-run Scrape again to continue."
5. Clears saved cursor only when `done === true`
6. Invalidates React Query caches: `["products"]`, `["scrape-state"]`

### Backend Flow (availability-checker.js)

1. Validates and constrains `cursor` and `batchSize`
2. Fetches all ACTIVE + NEEDS_REVIEW products (up to 5000 each)
3. Merges lists and slices by cursor: `products.slice(cursor, cursor + batchSize)`
4. For each product in batch:
   - **Duplicate URL check**: Mark inactive if URL already seen in batch
   - **Catalogue corrections**: Mark inactive if invalid name/URL patterns detected
   - **Availability check**: Send HTTP HEAD/GET request
     - **Available (200)**: Update `lastChecked` + `lastVerified`
     - **Gone (404/410)**: Mark `status = INACTIVE`, update `lastChecked`
     - **Unknown (timeout/403/rate-limit)**: Skip, don't update `lastChecked`
5. Tracks `retired` count (products marked inactive)
6. Returns:
   ```javascript
   {
     processed: slice.length,
     next_cursor: cursor + slice.length - retired,  // Cursor stability
     done: slice.length < batchSize
   }
   ```

### Cursor Stability Logic

**Problem**: If we mark products as INACTIVE, they drop out of the next query. Simply advancing the cursor by `slice.length` would overshoot and skip rows.

**Solution**: Subtract `retired` count from the cursor advance:
```javascript
next_cursor = cursor + slice.length - retired
```

This keeps the cursor pointing at the same logical position, accounting for removed rows.

## Key Features

### ✅ Batch Processing with Resume
- Processes 25 products per batch (configurable 1-50)
- Saves progress to `localStorage` after each batch
- Can be interrupted and resumed — "press again to continue"
- Loops up to 100 batches per button click (max 2,500 products)

### ✅ Timeout Protection
- 8-second timeout per product check
- Prevents one slow/hanging website from stalling the entire batch
- Falls back to GET if HEAD fails (some servers reject HEAD)

### ✅ Duplicate Detection
- Tracks URLs within each batch using `urlKey()` normalization
- Marks duplicates as INACTIVE immediately
- Prevents duplicate products from polluting the catalogue

### ✅ Catalogue Corrections
- Filters out non-product pages (blog, guide, article, etc.)
- Removes invalid product names ("Choose", "Shop Now", "View Product")
- Identifies listicle/editorial content ("Top 10 tips...")
- Applies age band corrections based on text patterns

### ✅ No Lock Required
- Availability check does NOT use ScrapeState lock
- Can run concurrently with other operations
- Prevents stuck lock from disabling the sweep

## Testing

To test the implementation:

1. **Start the server**: `npm run server` (in project root)
2. **Start the frontend**: `npm run dev` (in project root)
3. **Login as admin** and navigate to **Admin → Products** tab
4. **Click "Re-run Scrape"** button
5. **Monitor console logs**:
   - Frontend: Check React Query cache updates
   - Backend: Check batch processing logs (`🔍 Starting availability check batch...`)
6. **Verify database updates**:
   - Check `Product` table for updated `lastChecked`, `lastVerified`, `status` fields
   - Look for products marked `INACTIVE` (404/410 responses)

## Comparison with Original Base44

| Feature | Base44 Original | Standalone Implementation |
|---------|----------------|---------------------------|
| **Function** | `checkAvailabilityBatch/entry.ts` (Deno) | `availability-checker.js` (Node.js) |
| **Endpoint** | Base44 SDK function call | `POST /api/products/check-availability-batch` |
| **Batch Size** | 25 (default), 1-50 range | 25 (default), 1-50 range ✅ |
| **Timeout** | 8 seconds | 8 seconds ✅ |
| **Cursor Logic** | Stable (subtract retired) | Stable (subtract retired) ✅ |
| **Catalogue Corrections** | Yes | Yes ✅ |
| **Duplicate Detection** | Yes | Yes ✅ |
| **Age Band Corrections** | Yes | Yes ✅ |
| **ScrapeState Lock** | No lock used | No lock used ✅ |
| **Resume Capability** | localStorage cursor | localStorage cursor ✅ |

## Files Modified

1. ✅ **Created**: `server/services/products/availability-checker.js` (170 lines)
2. ✅ **Modified**: `server/index.js` (added endpoint + ScrapeState routes)
3. ✅ **Modified**: `src/api/base44Client.js` (added function handler + ScrapeState entity)

## What the Button Does (User Perspective)

Despite its name **"Re-run Scrape"**, this button is actually a **LINK CHECKER**:

- ✅ Validates all ACTIVE and NEEDS_REVIEW products are still available
- ✅ Marks dead links (404/410) as INACTIVE
- ✅ Removes duplicate URLs from catalogue
- ✅ Filters out non-product pages (blog posts, guides, listicles)
- ✅ Processes large catalogues in installments (resume-friendly)
- ❌ Does NOT scrape new products from retailer sites
- ❌ Does NOT require or use the scrape lock

**Recommended Usage**: Run monthly or after users report broken links.

## Next Steps

The implementation is now **complete and matches the original base44 behavior**. The "Re-run Scrape" button should work identically in both versions.

To use it:
1. Navigate to **Admin → Products** tab
2. Click **"Re-run Scrape"** button
3. Wait for the batch to complete
4. If it shows "press again to continue", click the button again
5. Repeat until it shows "Availability check complete"

---

**Status**: ✅ Complete  
**Date**: 2026-09-08  
**Implementation Time**: ~30 minutes  
**Files Changed**: 3 files (1 new, 2 modified)
