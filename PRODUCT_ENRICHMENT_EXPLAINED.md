# Product Enrichment - How Tags & Categories Are Filled

This document explains how the Product table columns are populated with metadata for gift matching.

---

## 📊 Product Table Columns That Get Enriched

| Column | Type | Description |
|--------|------|-------------|
| **interestTags** | String[] | E.g. ["Cooking & food", "Tech & gadgets"] |
| **giftTypeTags** | String[] | E.g. ["Beautiful objects for the home", "Practical but high quality"] |
| **category** | String | E.g. "Cooking & food > Baking" or "Children > Toys" |
| **searchKeywords** | String[] | Auto-extracted keywords for search |
| **suitableAgeBands** | String[] | E.g. ["18-25", "26-35", "36-45"] |
| **suitableGenders** | String[] | E.g. ["Female", "Male", "Unisex"] |
| **qualityScore** | Int | 0-100 score based on completeness |
| **dataQualityFlags** | String[] | Issues like ["missing_description"] |
| **description** | String | Fetched from meta tags or provided |

---

## 🔧 Three Ways Products Get Enriched

### **Method 1: Manual Upload (CURATED_PRODUCT)** ✅ RECOMMENDED
**Source:** Gem's Picks - manually curated by Kate via CSV import

**Process:**
1. Admin uploads CSV with pre-filled columns:
   ```csv
   name,price,category,gender,age_bands,product_url,image_url
   "Gin Lovers Gift Set",45,"Wine & drinks > Gin",Unisex,"18-25,26-35,36-45",https://...
   ```

2. Import script: `scripts/import-csv-products.js`
   ```javascript
   sourceType: 'CURATED_PRODUCT'
   category: "Wine & drinks > Gin"  // From CSV
   suitableAgeBands: ["18-25", "26-35", "36-45"]  // From CSV
   suitableGenders: ["Unisex"]  // From CSV
   ```

3. Enrichment runs automatically:
   - **interestTags**: Matched from category using keyword rules
   - **giftTypeTags**: Matched from name + description using keyword rules
   - **searchKeywords**: Auto-extracted from name + description
   - **qualityScore**: Calculated (typically 90-100 for curated)

**Files:**
- `scripts/import-csv-products.js` - CSV import
- `server/services/enrichment/enrichment-service.js` - Auto-enrichment

---

### **Method 2: Automatic Scraping (CURATED_RETAILER)** 🤖
**Source:** Automated web scraping from approved retailers

**Process:**
1. Scraper runs monthly: `server/services/scraper/scraper-service.js`
   ```javascript
   // Scrapes product page
   name: "Le Creuset Cast Iron Casserole"
   price: 180
   productUrl: "https://..."
   imageUrl: "https://..."
   description: "" // Empty initially
   ```

2. **Track 1 Enrichment** (runs automatically after scrape):
   ```javascript
   // Fetch meta description from URL
   description = fetchDescription(productUrl)
   
   // Match keywords from name + description
   interestTags = matchingTags(text, INTEREST_KEYWORDS)
   giftTypeTags = matchingTags(text, GIFT_TYPE_KEYWORDS)
   
   // Calculate quality
   qualityScore = qualityScore(product)
   ```

3. **Track 2 AI Classification** (optional, manual trigger):
   ```javascript
   // Uses Claude AI to classify
   category = "Cooking & food > Cookware"
   suitableGenders = ["Unisex"]
   suitableAgeBands = ["26-35", "36-45", "46-55"]
   ```

**API Endpoint:**
```
POST /api/admin/enrichment/enrich-batch
{
  "batchSize": 25,
  "classify": true  // Enable AI classification
}
```

**Files:**
- `server/services/scraper/scraper-service.js` - Web scraping
- `server/services/enrichment/enrichment-service.js` - Track 1 + Track 2
- `server/services/enrichment/ai-classifier.js` - Claude AI classification

---

### **Method 3: Admin Manual Edit** ✏️
**Source:** Admin UI - ProductEditForm

**Process:**
1. Admin opens product in admin panel
2. Manually edits fields:
   - Category (dropdown + free text)
   - Interest tags (checkboxes)
   - Gift type tags (checkboxes)
   - Age bands (checkboxes)
   - Gender (checkboxes)

3. Saves → Database updated directly

**Files:**
- `src/components/admin/ProductEditForm.jsx`
- `src/components/admin/ProductsTab.jsx`

---

## 🎯 How Each Field Gets Filled

### **1. interestTags** (Interest Tags)

**Track 1: Keyword Matching**
```javascript
// taxonomy.js - Keyword dictionary
INTEREST_KEYWORDS = {
  "Cooking & food": ["cook", "cooking", "chef", "kitchen", "food", "recipe", "bake"],
  "Tech & gadgets": ["tech", "gadget", "smart", "wireless", "electronic", "charger"],
  "Wine & drinks": ["wine", "champagne", "prosecco", "beer", "brew", "cider"],
  ...
}

// Matching algorithm
const text = `${product.name} ${product.description}`.toLowerCase()
const matched = Object.entries(INTEREST_KEYWORDS)
  .filter(([tag, keywords]) => keywords.some(kw => text.includes(kw)))
  .map(([tag]) => tag)
```

**Example:**
- Product: "Le Creuset Cast Iron Casserole"
- Description: "Perfect for slow cooking and baking"
- Match: "cook" → **"Cooking & food"** ✅

---

### **2. giftTypeTags** (Gift Type Tags)

**Track 1: Keyword Matching**
```javascript
GIFT_TYPE_KEYWORDS = {
  "Beautiful objects for the home": ["home", "interior", "decor", "vase", "candle", "blanket"],
  "Practical but high quality": ["practical", "everyday", "premium", "quality", "leather"],
  "Experiences": ["experience", "day out", "afternoon tea", "class", "tour"],
  ...
}
```

**Example:**
- Product: "Handcrafted Ceramic Vase"
- Description: "Beautiful minimalist design for modern homes"
- Match: "vase", "home" → **"Beautiful objects for the home"** ✅

---

### **3. category** (Canonical Category)

**Method A: Manual (CSV import)**
```csv
category: "Cooking & food > Baking"
```

**Method B: AI Classification (Track 2)**
```javascript
// Claude AI classifies based on:
- Product name
- Description
- Retailer category
- Price range

// Returns hierarchical category
category: "Home & interiors > Decorative objects"
```

**Method C: Manual Admin Edit**
- Admin selects from dropdown or types custom category

---

### **4. searchKeywords** (Search Keywords)

**Auto-extracted from name + description:**
```javascript
function extractKeywords(product) {
  const text = `${product.name} ${product.description}`
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !STOPWORDS.includes(word))
  
  return [...new Set(words)].slice(0, 20)
}
```

**Example:**
- Name: "Luxury Gin Tasting Set"
- Description: "Includes premium craft gin bottles from artisan distilleries"
- Keywords: `["luxury", "tasting", "premium", "craft", "bottles", "artisan", "distilleries"]`

---

### **5. suitableAgeBands** (Age Bands)

**Method A: Manual (CSV import)**
```csv
age_bands: "18-25,26-35,36-45,46-55,56-65,66-75,75+"
```

**Method B: AI Classification (Track 2)**
```javascript
// Claude AI determines appropriate age ranges
// Based on:
- Product sophistication
- Price point
- Category
- Cultural signals

// Returns array
suitableAgeBands: ["26-35", "36-45", "46-55"]
```

**Safety Rules Applied Automatically:**
```javascript
// Adult-only categories
if (category === "Wine & drinks" || category === "Spirits & cocktails") {
  // Remove all child age bands (1-2, 3-4, 5-6, 7-8, 9-11, 12-17)
}

// Adult content detection
if (hasAdultContent(product)) {
  // Remove child bands
}

// Children categories
if (category.startsWith("Children")) {
  // Remove 18+ bands
}
```

---

### **6. suitableGenders** (Gender Tags)

**Method A: Manual (CSV import)**
```csv
gender: "Female,Male,Unisex"
```

**Method B: AI Classification (Track 2)**
```javascript
// Claude AI determines gender suitability
// Based on:
- Product name signals ("men's", "women's", "unisex")
- Description language
- Category (e.g., "Jewellery" might be Female-leaning)
- Cultural norms

// Returns array
suitableGenders: ["Female", "Male", "Unisex"]
```

**Method C: Manual Admin Edit**

---

## 🔄 Enrichment Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     PRODUCT CREATION                         │
└───────────────┬─────────────────────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
   CSV Import      Web Scraper
        │                │
        └───────┬────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│              TRACK 1: KEYWORD ENRICHMENT                     │
│  • Fetch meta description                                    │
│  • Match interestTags from keywords                          │
│  • Match giftTypeTags from keywords                          │
│  • Extract searchKeywords                                    │
│  • Calculate qualityScore                                    │
│  • Detect dataQualityFlags                                   │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│        TRACK 2: AI CLASSIFICATION (Optional)                 │
│  • Claude AI analyzes product                                │
│  • Sets: category, suitableGenders, suitableAgeBands        │
│  • Flags low confidence classifications                      │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                   SAFETY RULES                               │
│  • Adult content detection                                   │
│  • Age-inappropriate filtering                               │
│  • Quality flags                                             │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                 READY FOR MATCHING                           │
│  • Used by product-matcher.js                                │
│  • Used by intelligent-matcher.js                            │
│  • Used by ai-gift-selector.js                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Key Files Reference

### Enrichment System:
- `server/services/enrichment/enrichment-service.js` - Main enrichment logic
- `server/services/enrichment/taxonomy.js` - Keyword dictionaries
- `server/services/enrichment/ai-classifier.js` - Claude AI classification

### Matching System:
- `server/services/gifts/product-matcher.js` - Main product matching
- `server/services/gifts/intelligent-matcher.js` - Advanced keyword matching
- `src/components/shared/taxonomy.js` - Frontend taxonomy (synced)

### Import/Scraping:
- `scripts/import-csv-products.js` - CSV import
- `server/services/scraper/scraper-service.js` - Web scraping

### Admin UI:
- `src/components/admin/ProductEditForm.jsx` - Manual editing
- `src/components/admin/ProductsTab.jsx` - Product management

---

## 🎯 Best Practices

### For CURATED_PRODUCT (Gem's Picks):
✅ Pre-fill category, gender, age_bands in CSV  
✅ Use hierarchical categories: "Cooking & food > Baking"  
✅ Be specific with age bands  
✅ Include good descriptions  

### For CURATED_RETAILER (Scraped):
✅ Run Track 1 enrichment immediately after scraping  
✅ Run Track 2 AI classification in batches (saves cost)  
✅ Review AI classifications with low confidence  
✅ Manually fix misclassifications  

### For All Products:
✅ Good product names help keyword matching  
✅ Rich descriptions improve matching accuracy  
✅ Review quality scores - aim for 70+  
✅ Fix dataQualityFlags before going live  

---

## 💡 Summary

| Field | Filled By | Method |
|-------|-----------|--------|
| **interestTags** | Track 1 Enrichment | Keyword matching |
| **giftTypeTags** | Track 1 Enrichment | Keyword matching |
| **category** | CSV / AI / Manual | Pre-filled or Claude AI |
| **searchKeywords** | Track 1 Enrichment | Auto-extraction |
| **suitableAgeBands** | CSV / AI / Manual | Pre-filled or Claude AI |
| **suitableGenders** | CSV / AI / Manual | Pre-filled or Claude AI |
| **description** | Track 1 / CSV | Meta tag fetch or provided |
| **qualityScore** | Track 1 Enrichment | Algorithm (0-100) |
| **dataQualityFlags** | Track 1 Enrichment | Quality detection |

**Key Insight:** 
- **Curated products** = Manual control, high quality, immediate use
- **Scraped products** = Automated discovery, needs enrichment + review
- **All products** benefit from Track 1 enrichment for tags and quality

---

**Last Updated:** September 2026  
**Version:** 1.0
