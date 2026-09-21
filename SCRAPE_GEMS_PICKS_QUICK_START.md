# Scrape Gem's Picks - Quick Start

## 🎯 Goal
Scrape product descriptions from URLs for all 614 Gem's Pick products to improve data quality and AI recommendations.

---

## ⚡ Quick Commands

### 1. Run Scraper (20-25 minutes)
```bash
node scripts/scrape-gems-picks-descriptions.js
```

### 2. Update Database
```bash
node scripts/update-descriptions-from-scrape.js gems-picks-descriptions-2026-09-17T12-30-00.json
```

---

## 📊 What to Expect

### During Scraping:
```
[1/614] Product Name
   URL: https://example.com/product
   ✓ Found description in JSON-LD (234 chars)
   ✅ Scraped: This beautiful handcrafted item...

💾 Progress saved every 10 products
```

**Time:** ~2 seconds per product = 20-25 minutes total

### After Scraping:
```
✅ Found 614 products
📊 Scraped: 450 | Skipped: 120 | Failed: 40 | Errors: 4
📁 Results saved to: scrape-results/gems-picks-descriptions-<timestamp>.json
```

### After Database Update:
```
✅ Updated: 450 products
❌ Failed: 0 products
Success rate: 100%
```

---

## 🔍 How It Works

1. **Fetch** all products with `sourceType = 'CURATED_PRODUCT'`
2. **Visit** each product URL
3. **Extract** description using:
   - JSON-LD Product schema (priority)
   - Meta tags (fallback)
   - HTML content (last resort)
4. **Validate** description (50-5000 characters)
5. **Save** results to JSON file
6. **Update** database with scraped descriptions

---

## ✅ Success Criteria

| Metric | Good Result |
|--------|-------------|
| Scraped | 70%+ |
| Skipped | 20-30% (already had descriptions) |
| Failed | <10% (no description found) |
| Errors | <5% (network issues) |

---

## ⚙️ Features

- ✅ **Rate limiting**: 2 seconds between requests
- ✅ **Progress saving**: Every 10 products
- ✅ **Skip existing**: Don't re-scrape products with descriptions
- ✅ **Error recovery**: Continue on failures
- ✅ **Timeout protection**: 15 seconds per request

---

## 📂 Output Files

### Scrape Results
`scrape-results/gems-picks-descriptions-<timestamp>.json`

Contains:
- All scraped descriptions
- Success/failure status
- Error messages
- Statistics

### Update Log
`scrape-results/gems-picks-descriptions-<timestamp>-update-log.json`

Contains:
- Products updated
- Database errors
- Success rate

---

## 🚨 Common Issues

### "Many timeout errors"
**Fix:** Increase timeout in script:
```javascript
const timeout = 30000; // 30 seconds
```

### "HTTP 403 errors"
**Cause:** Site blocks scrapers  
**Fix:** May need manual entry for those products

### "Script interrupted"
**Fix:** Just run again - it will resume from where it left off

### "No descriptions found"
**Cause:** Extraction selectors don't match site structure  
**Fix:** May need custom selectors for specific retailers

---

## 📈 Impact

**Before:**
```
Product.description = null
→ Lower quality scores
→ Poor AI recommendations
```

**After:**
```
Product.description = "Beautiful handcrafted leather wallet..."
→ Higher quality scores
→ Better AI recommendations
→ Improved gift matching
```

---

## 🔄 Resume After Interruption

If script stops halfway:
1. Just run the scraper again
2. It will skip already-scraped products
3. Continue from where it left off

---

## ✅ Checklist

### Before Running:
- [ ] Backup database (recommended)
- [ ] Understand it takes ~20-25 minutes
- [ ] Ensure stable internet connection

### After Scraping:
- [ ] Check success rate (aim for 70%+)
- [ ] Review failed products
- [ ] Run database update script
- [ ] Verify in admin panel

---

## 📞 Need Help?

**Full documentation:** See `GEMS_PICK_SCRAPER_GUIDE.md`

**Script locations:**
- `scripts/scrape-gems-picks-descriptions.js` - Scraper
- `scripts/update-descriptions-from-scrape.js` - Database updater

---

**Ready to run!** Just execute:
```bash
node scripts/scrape-gems-picks-descriptions.js
```

And wait ~20-25 minutes for completion. ☕
