# CURATED Product Image Scraping - Guide

## Problem
When importing CURATED products from Kate's Google Sheet, **imageUrl is often missing** because manually adding image URLs is:
- Time-consuming
- Error-prone
- Easy to forget

**Result:** Products imported without images, breaking gift display.

---

## Solution ✅

**Automatic Image Scraper** that:
1. Finds CURATED products with `productUrl` but no `imageUrl`
2. Visits each product URL
3. Extracts product image from page
4. Updates database automatically

---

## Usage

### Run Image Scraper:
```bash
npm run scrape:images
```

### What It Does:
1. ✅ Finds CURATED_PRODUCT with missing images
2. ✅ Launches browser (Puppeteer)
3. ✅ Visits each product URL
4. ✅ Scrapes primary product image
5. ✅ Updates database with imageUrl
6. ✅ Shows progress and summary

---

## How It Works

### Image Detection Strategy:

The scraper tries **multiple methods** to find the best product image:

**1. Open Graph Meta Tags** (Priority)
```html
<meta property="og:image" content="https://example.com/product.jpg">
```
✅ Most reliable - set by retailer for social sharing

**2. Twitter Card Meta Tags**
```html
<meta name="twitter:image" content="https://example.com/product.jpg">
```
✅ Fallback for retailers using Twitter cards

**3. Common CSS Selectors**
```css
.product-image img
.product-gallery img
img[class*="product"]
img[id*="product-image"]
```
✅ Matches common e-commerce patterns

**4. Fallback to First Main Image**
```css
main img:first-of-type
article img:first-of-type
```
⚠️ Last resort - may not be product image

---

## Example Output

```
🖼️  CURATED PRODUCTS IMAGE SCRAPER

🔍 Finding CURATED products without images...

📊 Found 47 CURATED products without images

🌐 Launching browser...


[1/47] Personalised Copper Trowel and Fork Set...
   Retailer: Menkind
   URL: https://www.menkind.co.uk/personalised-copper-trowel...
   Scraping: Personalised Copper Trowel and Fork Set...
   ✅ Found image: https://images.menkind.co.uk/products/123...

[2/47] RSPB Silhouette hedgehog home...
   Retailer: RSPB
   URL: https://shopping.rspb.org.uk/hedgehog-home...
   Scraping: RSPB Silhouette hedgehog home...
   ✅ Found image: https://shopping.rspb.org.uk/images/456...

[3/47] Brew Cafetiere...
   Retailer: Tom Dixon
   URL: https://www.tomdixon.net/brew-cafetiere...
   Scraping: Brew Cafetiere...
   ✅ Found image: https://cdn.tomdixon.net/products/789...


💾 Updating 45 products in database...

✅ Database updated!

═══════════════════════════════════════
           SUMMARY REPORT              
═══════════════════════════════════════
📊 Total products processed: 47
✅ Images scraped successfully: 45
❌ Failed to scrape: 2
💾 Database updates: 45
═══════════════════════════════════════

💡 TIP: Failed products may need manual image URLs
   You can add them via admin dashboard or CSV import
```

---

## Configuration

### Batch Size:
Default: **100 products** per run

To change, edit `scripts/scrape-curated-images.js`:
```javascript
take: 100  // Change to 50, 200, etc.
```

### Rate Limiting:
Default: **2 seconds** between requests

To change:
```javascript
await new Promise(resolve => setTimeout(resolve, 2000)); // Change to 3000, 5000, etc.
```

### Browser Headless:
Default: **Headless mode** (no visible browser)

To see browser while scraping (for debugging):
```javascript
browser = await puppeteer.launch({
  headless: false,  // Change to false to see browser
  args: ['--no-sandbox']
});
```

---

## When to Run

### Scenarios:

1. **After CSV Import:**
   ```bash
   npm run import:products
   npm run scrape:images  # Scrape missing images
   ```

2. **Weekly Maintenance:**
   ```bash
   npm run scrape:images  # Check for any missing images
   ```

3. **Before Gift Generation:**
   - Ensure all CURATED products have images
   - Run scraper if quality check fails

4. **After Adding New Retailers:**
   - New products may be missing images
   - Run scraper to populate

---

## Troubleshooting

### Issue: "Failed to scrape" for some products

**Possible causes:**
1. Product URL is broken/404
2. Retailer site blocks bots
3. No image on product page
4. Site uses unusual image selectors

**Solution:**
- Check product URL manually
- Add image URL via admin dashboard
- Or update CSV with correct imageUrl

---

### Issue: Script times out

**Cause:** Too many products, slow retailer sites

**Solution:**
- Reduce batch size (take: 50)
- Increase timeout (timeout: 60000)
- Run in multiple batches

---

### Issue: Images are wrong (not product image)

**Cause:** Scraper found wrong image on page

**Solution:**
- Check product manually
- Update imageUrl in admin dashboard
- Report issue so selector can be improved

---

## Manual Image Addition

If scraper fails, you can add images manually:

### Via Admin Dashboard:
1. Go to Products tab
2. Search for product
3. Click Edit
4. Paste image URL
5. Save

### Via CSV Import:
1. Add `image_url` column to CSV
2. Paste image URLs
3. Re-import CSV (will update existing)

### Via Database:
```sql
UPDATE Product 
SET imageUrl = 'https://example.com/image.jpg'
WHERE id = 'product_id';
```

---

## Best Practices

### ✅ Do:
- Run scraper after bulk imports
- Check summary report for failures
- Manually fix failed products
- Run periodically (weekly/monthly)
- Keep rate limiting (2-3 seconds)

### ❌ Don't:
- Run too frequently (rate limits)
- Scrape same products repeatedly
- Remove rate limiting delays
- Ignore failed products
- Scrape non-CURATED products (use their own images)

---

## Technical Details

### Dependencies:
- **Puppeteer:** Headless browser automation
- **Prisma:** Database queries and updates

### Selectors Used:
```javascript
// Meta tags (highest priority)
'meta[property="og:image"]'
'meta[property="og:image:secure_url"]'
'meta[name="twitter:image"]'

// Image elements
'img[class*="product"][class*="image"]'
'img[class*="ProductImage"]'
'.product-image img'
'.product-gallery img'

// Fallbacks
'main img:first-of-type'
'article img:first-of-type'
```

### Browser Settings:
```javascript
// User agent (avoid bot detection)
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'

// Wait strategy
waitUntil: 'networkidle2'  // Wait for network to be idle
timeout: 30000             // 30 second page load timeout
```

---

## Performance

### Speed:
- **~2-3 seconds per product** (including rate limiting)
- **100 products ≈ 5-6 minutes**
- Depends on retailer site speed

### Success Rate:
- **~90-95%** for major retailers
- Higher for sites with proper meta tags
- Lower for unusual/custom sites

---

## Future Enhancements

### Possible Improvements:
1. **AI Image Recognition** - Verify image is actually product
2. **Multiple Images** - Scrape gallery images
3. **Image Optimization** - Resize/compress images
4. **Retry Failed** - Auto-retry failed products
5. **Schedule Scraping** - Run automatically daily

---

## Files

**Script:** `scripts/scrape-curated-images.js`
**Command:** `npm run scrape:images`
**Documentation:** `IMAGE_SCRAPING_GUIDE.md` (this file)

---

## Support

### Common Questions:

**Q: Can I scrape images for all products?**
A: Script targets CURATED_PRODUCT only. Other products should have images from scraping/import.

**Q: What if image URL is invalid?**
A: Database stores whatever URL is found. Check manually if gift display breaks.

**Q: Can I run this on live server?**
A: Yes, but run during low-traffic hours (rate limiting + database updates).

**Q: How often should I run this?**
A: After each CSV import, or weekly to catch any missing images.

---

**Created:** September 16, 2026
**Script:** `scripts/scrape-curated-images.js`
**Command:** `npm run scrape:images`
