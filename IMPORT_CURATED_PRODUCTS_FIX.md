# Import Curated Products - Issue & Fix

## The Problem

When trying to import products from Google Sheets or uploaded CSV/XLSX files using the **"Import from Sheet"** feature in the Admin → Products tab, you get:

```
Unexpected response from import — stopped.

Fix the issue and click Start Import again — already-imported rows are detected and will not be duplicated.
```

## Root Cause

The `importCuratedProducts` function is **not implemented** in your standalone architecture. 

### What's Happening:

1. **Frontend** (CuratedImportPanel.jsx) calls:
   ```javascript
   const res = await base44.functions.invoke("importCuratedProducts", { ... });
   ```

2. **base44Client.js** (middleware) was falling through to mock implementation:
   ```javascript
   return { success: true, message: 'Mock function call' };
   ```

3. **Frontend expects** a response with:
   ```javascript
   {
     done: boolean,
     next_row: number,
     processed: number,
     created_active: number,
     // ...other fields
   }
   ```

4. **But gets** a mock response:
   ```javascript
   {
     success: true,
     message: 'Mock function call'
   }
   ```

5. **Frontend validation fails:**
   ```javascript
   if (typeof res?.data?.done !== "boolean" || typeof res?.data?.next_row !== "number") {
     setError("Unexpected response from import — stopped.");
   }
   ```

## What Needs to Be Done

The `importCuratedProducts` function from base44 is **extremely complex** (600+ lines of TypeScript). It:

1. **Parses Excel/CSV files** using SheetJS library
2. **Reads Google Sheets** using Google Sheets API
3. **Validates** product data (name, URL, price, retailer)
4. **Auto-creates missing retailers**
5. **Deduplicates** products by URL
6. **Fill-missing updates** for existing products
7. **Fetches og:image** from product URLs if image missing
8. **Validates product availability** with HEAD requests
9. **Processes in batches** (bounded, client-driven loop)
10. **Returns detailed statistics** and reports

### Complexity Factors:

- **SheetJS (xlsx) library** - Parses .xlsx and .csv files
- **Google Sheets API integration** - Requires OAuth token
- **Multi-mode operation** - File upload OR Google Sheets URL
- **Header normalization** - Accepts various column name spellings
- **Retailer auto-creation** - Creates missing retailers with gender/category detection
- **URL deduplication** - Checks both product_url and affiliate_url
- **Fill-missing upsert logic** - Only updates empty fields, never overwrites
- **Batch processing** - Returns next_row cursor for client-side loop
- **Comprehensive error handling** - Skipped rows with reasons
- **Progress reporting** - Statistics for UI display

## Short-Term Fix (What I Did)

### Step 1: Updated base44Client.js ✅

Added handler for `importCuratedProducts` function:

```javascript
// Import Curated Products function
if (functionName === 'importCuratedProducts') {
  const response = await fetch(`${API_BASE}/products/import-curated`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Admin-Key': localStorage.getItem('admin_key') || '',
    },
    body: JSON.stringify(toSnakeCase(data)),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const error = new Error(errorData.error || 'Import failed');
    error.response = { status: response.status, data: errorData };
    throw error;
  }
  
  const result = await response.json();
  return { data: toCamelCase(result) };
}
```

This routes the function call to `/api/products/import-curated` endpoint.

### Step 2: Backend API Route Needed ⚠️

The API route `POST /api/products/import-curated` does **NOT exist yet**. Creating it requires porting 600+ lines of complex logic from the original base44 function.

## Recommended Solutions

### Option 1: Full Implementation (Best, Most Work)

**Port the entire `importCuratedProducts` function** to standalone Express/Prisma.

**Pros:**
- ✅ 100% feature parity with original
- ✅ Handles all edge cases
- ✅ Full Google Sheets integration
- ✅ Auto-creates retailers
- ✅ Proper deduplication
- ✅ Fill-missing updates

**Cons:**
- ❌ 600+ lines of complex code to port
- ❌ Requires SheetJS library (`xlsx` npm package)
- ❌ Requires Google Sheets API integration
- ❌ 4-6 hours of development time
- ❌ Extensive testing needed

**Estimated Time:** 4-6 hours

---

### Option 2: Simplified CSV Import (Faster)

**Create a simplified import** that only handles uploaded CSV files (no Google Sheets).

**Pros:**
- ✅ Simpler implementation (200-300 lines)
- ✅ Covers most common use case
- ✅ Can use existing CSV parsing
- ✅ 1-2 hours development time

**Cons:**
- ❌ No Google Sheets support
- ❌ Limited retailer auto-creation
- ❌ Basic validation only
- ❌ May miss edge cases

**Estimated Time:** 1-2 hours

---

### Option 3: Use Existing CSV Import Script (Quickest)

**Leverage your existing** `scripts/import-csv-products.js` script.

Looking at your codebase, you already have:
```
scripts/import-csv-products.js
```

**Pros:**
- ✅ Already exists
- ✅ Quick to adapt
- ✅ CSV file support
- ✅ 30 minutes to wire up

**Cons:**
- ❌ No Google Sheets support
- ❌ May need UI adjustments
- ❌ May not have all features

**Estimated Time:** 30 minutes

---

### Option 4: Workaround - Manual CSV Processing (Immediate)

**For right now**, use manual workaround:

1. **Download template** from Import panel
2. **Fill in products** in Excel/Google Sheets
3. **Export as CSV**
4. **Use existing import script:**
   ```bash
   node scripts/import-csv-products.js path/to/your-file.csv
   ```

**Pros:**
- ✅ Works immediately
- ✅ No code changes needed
- ✅ Uses proven script

**Cons:**
- ❌ No UI integration
- ❌ Manual command-line process
- ❌ No real-time progress

---

## My Recommendation

Given the complexity and your need for a working solution:

### **Phased Approach:**

#### **Phase 1 (Now - 1 hour):** 
Enhance the existing `scripts/import-csv-products.js` and create a minimal API wrapper:

1. Review/fix existing CSV import script
2. Create simple API endpoint that calls the script
3. Return proper response format (done, next_row, processed, etc.)
4. Handle file uploads

#### **Phase 2 (Later - 4-6 hours):**
Port full `importCuratedProducts` functionality when time allows:

1. Add SheetJS library
2. Implement Google Sheets API integration
3. Add all validation logic
4. Implement retailer auto-creation
5. Add fill-missing upsert logic
6. Comprehensive testing

## What I Need From You

To proceed with Phase 1 (quick fix), please confirm:

1. ✅ Can I check your existing `scripts/import-csv-products.js`?
2. ✅ Should I create a simple API wrapper for it?
3. ✅ Is CSV-only import acceptable for now (Google Sheets later)?

OR

If you want Phase 2 (full implementation) right away:
- ⏰ Confirm you have 4-6 hours for this work
- 📋 I'll need to port all 600+ lines carefully

## Temporary Workaround

Until the API is implemented, you can:

### Option A: Use Command-Line Script

```bash
# Navigate to project root
cd d:\you-remembered-by-gem

# Run import script
node scripts/import-csv-products.js "C:\path\to\your-products.csv"
```

### Option B: Direct Database Import

If the CSV is properly formatted:

1. Export CSV from Google Sheets
2. Use database tool (pgAdmin, DBeaver) to import directly to Product table
3. Set `source_type = 'curated_product'` for imported rows
4. Run enrichment afterward

---

## Summary

The "Unexpected response" error is because `importCuratedProducts` has no backend implementation. I've:

✅ **Fixed** the base44Client.js routing
⚠️ **Still needed:** Backend API implementation

**Choose your path:**
- 🚀 **Quick (1 hr):** Simple CSV import via existing script
- ⭐ **Complete (4-6 hrs):** Full feature parity with base44

Let me know which direction you want to go!

---

**Status:** Frontend routing fixed, backend implementation needed  
**Blocker:** `/api/products/import-curated` endpoint doesn't exist  
**Next Step:** Choose implementation approach (simple vs complete)
