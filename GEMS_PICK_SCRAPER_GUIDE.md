# Gem's Pick Description Scraper

## Overview

Scripts to scrape product descriptions from product URLs for all 614 Gem's Pick (CURATED_PRODUCT) items. Fetches actual product pages and extracts descriptions to improve product data quality.

---

## 📁 Files Created

1. **`scripts/scrape-gems-picks-descriptions.js`** - Main scraper script
2. **`scripts/update-descriptions-from-scrape.js`** - Database updater script

---

## 🚀 Usage

### Step 1: Run the Scraper

```bash
node scripts/scrape-gems-picks-descriptions.js
```

**What it does:**
- Fetches all products with `sourceType = 'CURATED_PRODUCT'`
- Visits each product URL
- Extracts description from the product page
- Saves results to `scrape-results/gems-picks-descriptions-<timestamp>.json`
- Skips products that already have descriptions (≥50 chars)

**Console output:**
```
🔍 Fetching Gem's Pick products (CURATED_PRODUCT)...
✅ Found 614 Gem's Pick products

📊 Scraping 614 products...
⏱️  Estimated time: 21 minutes
⚙️  Rate limit: 2000ms between requests
📦 Batch size: 10 products

────────────────────────────────────────────────────────────────────────────────

[1/614] Product Name Here
   URL: https://example.com/product
   ✓ Found description in JSON-LD (234 chars)
   ✅ Scraped: This beautiful handcrafted item features...

[2/614] Another Product
   URL: https://another.com/item
   ⏭️  Already has description (156 chars) - skipping

...

💾 Progress saved: scrape-results/gems-picks-descriptions-2026-09-17T12-30-00.json
   Scraped: 10 | Skipped: 0 | Failed: 0 | Errors: 0
```

**Features:**
- ✅ Rate limiting: 2 seconds between requests (respectful scraping)
- ✅ Progress saving: Saves every 10 products (resume-able if interrupted)
- ✅ Timeout handling: 15 second timeout per request
- ✅ Error recovery: Continues on errors, logs failures
- ✅ Skip existing: Doesn't re-scrape products with descriptions

**Estimated Time:**
- 614 products × 2 seconds = ~20-25 minutes

---

### Step 2: Review Results

Check the generated JSON file:

```bash
# Location: scrape-results/gems-picks-descriptions-2026-09-17T12-30-00.json
```

**File structure:**
```json
{
  "timestamp": "2026-09-17T12:30:00.000Z",
  "stats": {
    "total": 614,
    "scraped": 450,
    "skipped": 120,
    "failed": 40,
    "errors": 4
  },
  "results": [
    {
      "success": true,
      "productId": "abc123",
      "status": "scraped",
      "description": "Full product description here...",
      "descriptionLength": 234
    },
    {
      "success": true,
      "productId": "def456",
      "status": "skipped",
      "reason": "already_has_description",
      "description": "Existing description..."
    },
    {
      "success": false,
      "productId": "ghi789",
      "status": "failed",
      "reason": "no_description_found"
    }
  ]
}
```

---

### Step 3: Update Database

```bash
node scripts/update-descriptions-from-scrape.js gems-picks-descriptions-2026-09-17T12-30-00.json
```

**What it does:**
- Reads the scrape results JSON
- Updates products in database with scraped descriptions
- Only updates products with `status: 'scraped'`
- Logs update progress and errors
- Creates update log file

**Console output:**
```
📂 Loading scrape results from: scrape-results/gems-picks-descriptions-2026-09-17T12-30-00.json

📊 Scrape Results Summary:
   Total: 614
   Scraped: 450
   Skipped: 120
   Failed: 40
   Errors: 4

📝 Updating 450 products in database...

────────────────────────────────────────────────────────────────────────────────
   ✓ Updated 10/450 products...
   ✓ Updated 20/450 products...
   ...
────────────────────────────────────────────────────────────────────────────────

✅ DATABASE UPDATE COMPLETE

📊 Results:
   ✅ Updated: 450
   ❌ Failed: 0
   Success rate: 100.0%

📄 Update log saved: scrape-results/gems-picks-descriptions-2026-09-17T12-30-00-update-log.json
```

---

## 🔍 Description Extraction Strategy

The scraper uses a **priority-based extraction** approach:

### Priority 1: JSON-LD Schema (Most Reliable)
```html
<script type="application/ld+json">
{
  "@type": "Product",
  "description": "This is the product description..."
}
</script>
```
✅ Structured data, highly reliable

### Priority 2: Meta Tags
```html
<meta name="description" content="Product description here..." />
<meta property="og:description" content="Product description..." />
```
✅ Always present, good fallback

### Priority 3: HTML Content Selectors
```html
<div class="product-description">Description here</div>
<div itemprop="description">Description here</div>
```
✅ Common e-commerce patterns

**Validation:**
- Description must be between 50-5000 characters
- HTML tags stripped
- Whitespace normalized
- HTML entities decoded

---

## 📊 Result Statistics

### Status Values:

| Status | Meaning | Example Count |
|--------|---------|---------------|
| **scraped** | Successfully scraped description | 450 |
| **skipped** | Already has description | 120 |
| **failed** | No description found on page | 40 |
| **error** | Network/timeout error | 4 |

### Failure Reasons:

| Reason | Meaning | Solution |
|--------|---------|----------|
| `already_has_description` | Product has description ≥50 chars | Skip (no action needed) |
| `no_description_found` | No description selectors matched | Manual review, may need custom extraction |
| `HTTP 404` | Product page not found | URL may be broken, needs updating |
| `HTTP 403` | Access denied | May need different User-Agent or cookies |
| `Timeout` | Request took >15 seconds | Retry with longer timeout |
| `Network error` | Connection failed | Retry later |

---

## ⚙️ Configuration

**In `scrape-gems-picks-descriptions.js`:**

```javascript
// Rate limiting
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds (adjustable)

// Progress saving frequency
const BATCH_SIZE = 10; // Save every 10 products

// Timeout per request
const timeout = 15000; // 15 seconds
```

**Adjust if needed:**
- Increase `DELAY_BETWEEN_REQUESTS` for slower, more respectful scraping
- Decrease `BATCH_SIZE` for more frequent progress saves
- Increase timeout for slow-loading sites

---

## 🛡️ Safety Features

1. **Rate Limiting**: 2 seconds between requests (respectful to servers)
2. **Timeout Protection**: 15 second timeout prevents hanging
3. **Progress Saving**: Saves every 10 products (resume-able)
4. **Skip Existing**: Doesn't re-scrape products with descriptions
5. **Error Handling**: Continues on errors, logs all failures
6. **User-Agent**: Identifies as legitimate browser to avoid blocks

---

## 📝 Manual Review Needed

After scraping, review failed products:

```javascript
// In the results JSON, find products with status: 'failed'
{
  "success": false,
  "productId": "xyz",
  "status": "failed",
  "reason": "no_description_found"
}
```

**Options:**
1. **Manual entry**: Add descriptions manually via admin panel
2. **Custom extraction**: Write custom selector for specific retailer
3. **Product verification**: Check if URL is still valid

---

## 🔄 Re-running the Scraper

**To re-scrape all products:**
1. The scraper automatically skips products with descriptions
2. To force re-scrape, first clear descriptions in database

**To retry only failed products:**
1. Filter the results JSON for `status: 'failed'`
2. Create new script targeting only those product IDs

---

## 📂 Output Files

### Scrape Results File
**Location:** `scrape-results/gems-picks-descriptions-<timestamp>.json`  
**Purpose:** Complete scrape results with all product data  
**Keep?** Yes, for audit trail

### Update Log File
**Location:** `scrape-results/gems-picks-descriptions-<timestamp>-update-log.json`  
**Purpose:** Database update audit log  
**Keep?** Yes, for troubleshooting

---

## 🎯 Success Metrics

**Good scrape result:**
- ✅ 70%+ scraped successfully
- ✅ 20-30% skipped (already had descriptions)
- ✅ <10% failed (no description found)
- ✅ <5% errors (network issues)

**If many failures:**
1. Check if product URLs are valid (404 errors?)
2. Check if retailer sites block scrapers (403 errors?)
3. Review extraction selectors (may need updates)
4. Check network connectivity

---

## 🚨 Troubleshooting

### Issue: "Timeout errors for many products"
**Solution:** Increase timeout in script:
```javascript
const timeout = 30000; // Increase to 30 seconds
```

### Issue: "HTTP 403 (Forbidden) errors"
**Solution:** Some sites block scrapers. Options:
1. Add site-specific headers
2. Use proxy/VPN
3. Manual extraction for those products

### Issue: "No descriptions found (many failures)"
**Solution:** Check extraction selectors:
1. Visit product pages manually
2. Inspect HTML structure
3. Add new selectors to `extractDescription()` function

### Issue: "Script interrupted"
**Solution:** Resume by running script again:
- Already-scraped products will be skipped
- Progress file shows last completed index
- Script continues from where it left off

---

## 📈 Impact on Gift Generation

**Before scraping:**
- Products with missing descriptions scored lower
- AI had less context for recommendations
- Quality checks might fail

**After scraping:**
- Products have rich, detailed descriptions
- AI makes better gift recommendations
- Quality scores improve
- Better interest matching

---

## 🔍 Example Scraped Description

**Before:**
```
Product.description = null
```

**After:**
```
Product.description = "This beautifully crafted leather wallet features hand-stitched
detailing and RFID protection. Made from premium full-grain leather that develops a
unique patina over time. Perfect for the discerning gentleman who appreciates fine
craftsmanship and timeless style. Includes 6 card slots, 2 note compartments, and a
coin pocket with button closure."
```

**Impact:**
- ✅ AI understands product better
- ✅ Better category classification
- ✅ More accurate interest matching
- ✅ Higher relevance scores
- ✅ Better gift recommendations

---

## ✅ Checklist

Before running:
- [ ] Database backup created
- [ ] Understand rate limiting (2 seconds per request)
- [ ] Estimate time needed (~20-25 minutes for 614 products)

After scraping:
- [ ] Review scrape results JSON
- [ ] Check success rate (should be >70%)
- [ ] Review failed products
- [ ] Run database update script
- [ ] Verify descriptions in admin panel

---

## 📚 Related Documentation

- `DIVERSITY_SAMPLING_IMPLEMENTATION.md` - How products are selected for AI
- `GIFT_QUALITY_CHECKS_EXPLAINED.md` - Quality checks that use descriptions
- `CATEGORY_IMPORT_GUIDE.md` - Category structure for products

---

**Status:** ✅ Ready to use  
**Dependencies:** None (uses native Node.js fetch)  
**Estimated Time:** 20-25 minutes for 614 products  
**Success Rate:** Expected 70-90%
