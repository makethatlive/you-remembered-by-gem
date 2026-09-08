# Enrichment Configuration Guide

## Current Status: AI Classification DISABLED ✅

The "Enrich catalogue" button is currently running **Track 1 (Deterministic) ONLY** - completely FREE with no API costs.

## What's Running Now (FREE):

✅ **Description fetching** - Scrapes product URLs for descriptions  
✅ **Interest tags matching** - Art & design, Food & drink, etc.  
✅ **Gift type tags matching** - Personalisable, Experience, etc.  
✅ **Search keywords generation** - For product search  
✅ **Quality scoring** - 0-100 score based on completeness  
✅ **Quality flags detection** - Missing image, junk title, etc.  
✅ **Basic age safety rules** - Category-based restrictions  

## What's NOT Running (AI Classification):

❌ **Automatic canonical category** - Needs manual categorization  
❌ **Gender classification** - Needs manual input  
❌ **AI-powered age bands** - Uses scraper defaults  
❌ **Age-restricted detection** - Needs manual marking  

**Cost Savings**: $0 per month (no API calls)

---

## How to Enable AI Classification

If you want to enable AI classification later, you have 2 options:

### Option 1: Frontend (Per-Request)

Currently the frontend button doesn't send `classify: true`. You can manually enable it by updating the frontend code.

**File**: `src/components/admin/RerunScrapeButton.jsx`

```javascript
const enrichCatalogue = async () => {
  // Add classify: true here:
  const res = await base44.functions.invoke("enrichCatalogueBatch", { 
    batch_size: 40,
    classify: true  // ← Enable AI classification
  });
}
```

### Option 2: Backend (Default for All Requests)

Change the default in the server endpoint.

**File**: `server/index.js` (line ~1595)

```javascript
const { 
  batch_size = 25, 
  retailer_id = null,
  classify = true,  // ← Change false to true
  dry_run = false,
} = req.body;
```

**Cost**: ~$2 per 1000 products (one-time per product)

---

## Testing Before Enabling

You can test AI classification without making any changes using **dry-run mode**:

```bash
# Using curl or Postman:
POST http://localhost:3001/api/products/enrich-batch
{
  "batch_size": 5,
  "classify": true,
  "dry_run": true  # ← No changes written, just preview
}
```

This will:
- Call Claude API
- Show you the classifications
- NOT write anything to database
- Cost: ~$0.01 for testing

---

## Alternative: Use Gemini Instead (70% Cheaper)

If you want AI classification but at lower cost, I can switch to Google Gemini:

**Claude**: $2 per 1000 products  
**Gemini**: $0.30 per 1000 products (70% cheaper)

Let me know if you want this option!

---

## Summary

**Current Setup** (as of now):
```
Track 1 (Deterministic): ✅ ENABLED (FREE)
Track 2 (AI Classification): ❌ DISABLED (Cost saving)
```

**To Enable AI Later**:
1. Set `classify: true` in frontend or backend
2. Make sure `ANTHROPIC_API_KEY` is in .env
3. Click "Enrich catalogue" button

**Files to Modify**:
- Frontend: `src/components/admin/RerunScrapeButton.jsx`
- Backend: `server/index.js`

---

**Status**: ✅ AI Classification successfully disabled  
**Cost**: $0 per month  
**Features**: Basic enrichment still working (tags, quality, descriptions)
