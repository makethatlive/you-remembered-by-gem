# Install Image Scraper - Quick Guide

## Installation

### Step 1: Install Puppeteer
```bash
npm install
```

This will install `puppeteer` (added to package.json).

### Step 2: Verify Installation
```bash
npm list puppeteer
```

Should show:
```
└── puppeteer@23.0.0
```

---

## Usage

### Run Image Scraper:
```bash
npm run scrape:images
```

### First Run:
- Puppeteer will download Chromium browser (~150MB)
- This happens automatically
- Only needed once

---

## What It Does

1. ✅ Finds CURATED products without images
2. ✅ Opens product URLs in browser
3. ✅ Extracts product image
4. ✅ Updates database

---

## Example Workflow

### After CSV Import:
```bash
# 1. Import products from CSV
npm run import:products

# 2. Scrape missing images
npm run scrape:images

# 3. Check results in admin dashboard
npm run dev:all
```

### Weekly Maintenance:
```bash
# Check for any products missing images
npm run scrape:images
```

---

## Troubleshooting

### Issue: "Cannot find module 'puppeteer'"
```bash
# Solution: Install dependencies
npm install
```

### Issue: "Chromium download failed"
```bash
# Solution: Set environment variable
$env:PUPPETEER_SKIP_DOWNLOAD="false"
npm install puppeteer --force
```

### Issue: "Browser launch failed"
```bash
# Solution: Install Chrome/Chromium manually
# Windows: Download Chrome from google.com/chrome
# Or use system Chrome:
$env:PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

---

## Configuration

### Batch Size (default: 100):
Edit `scripts/scrape-curated-images.js`:
```javascript
take: 50  // Process 50 at a time
```

### Rate Limiting (default: 2 seconds):
```javascript
setTimeout(resolve, 3000)  // Wait 3 seconds between requests
```

---

## Manual Installation (if needed)

If `npm install` doesn't work:

```bash
# Install puppeteer separately
npm install puppeteer@23.0.0

# Or use puppeteer-core (no Chromium download)
npm install puppeteer-core@23.0.0
```

---

## Check Script is Ready:

```bash
# Test script exists
dir scripts\scrape-curated-images.js

# Check package.json has command
npm run | findstr scrape:images
```

Should show:
```
scrape:images
    node scripts/scrape-curated-images.js
```

---

**Ready to use!** 🚀

Run: `npm run scrape:images`
