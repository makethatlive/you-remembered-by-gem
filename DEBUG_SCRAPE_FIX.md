# Scrape Button Fix - Debugging Steps

## What Was Fixed

The RetailerScrapeButton was checking for the continuation token BEFORE checking if the scrape was done. This caused it to throw an error when a retailer finished scraping (because backend returns `cursor: null` when `done: true`).

## Changes Made

1. **RetailerScrapeButton.jsx** - Reordered the logic to check `done` before checking cursor
2. Added detailed console logging to see what the backend actually returns

## How to Test

### Step 1: Clear Browser Cache & Reload
The browser might be using the OLD JavaScript bundle. Do ONE of these:

**Option A - Hard Refresh:**
- Windows: `Ctrl + Shift + R` or `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**Option B - Clear Cache Fully:**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Option C - Rebuild & Restart:**
```bash
# Stop the dev server (Ctrl+C)
# Then restart it
npm run dev
```

### Step 2: Open Browser Console
1. Press F12 to open DevTools
2. Go to Console tab
3. Clear any old messages

### Step 3: Test the Scrape
1. Go to Retailers tab
2. Find "adorn-shop.co.uk"
3. Click **Scrape** button
4. Watch the Console for logs like:
   ```
   [RetailerScrape] Batch 1 response: {
     done: true,
     hasCursor: false,
     newProducts: 5,
     ...
   }
   ```

## Expected Behavior

### If it works correctly:
- Console shows `done: true` and `hasCursor: false`
- Success toast appears: "adorn-shop.co.uk scraped in 1 batch(es) — X new (awaiting review), Y updated/verified..."

### If still broken:
- Console will show what `done` and `hasCursor` values are
- Error message will include: `done=X, retailers_remaining=Y`
- Share this information!

## Possible Issues

### Issue 1: Old localStorage cursor
If there's a corrupt cursor saved from previous runs:
```javascript
// In browser console, run:
Object.keys(localStorage).filter(k => k.includes('retailerScrapeCursor')).forEach(k => localStorage.removeItem(k))
```

### Issue 2: Backend returning wrong values
The console logs will tell us if backend is returning:
- `done: false` when it should be `true`
- `cursor: null` without `done: true`

### Issue 3: Browser still cached
- Try in Incognito/Private mode
- Try a different browser
- Check the Network tab to see if RetailerScrapeButton.jsx is being loaded

## Next Steps

After testing, report back with:
1. What you see in the Console logs
2. The exact error message (if any)
3. Whether hard refresh was done
