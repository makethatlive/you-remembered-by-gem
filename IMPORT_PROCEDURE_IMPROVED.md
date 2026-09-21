# 📦 Improved CSV Import Procedure - Domain-Based Retailer Matching

## 🎯 Overview

The import system has been improved to use **domain-based retailer matching** instead of name-based matching. This prevents duplicate retailers caused by spelling variations, typos, or name differences.

---

## ✅ Why Domain-Based Matching?

### ❌ Problems with Name Matching:

| CSV Entry | Database Entry | Result with Name Matching |
|-----------|---------------|---------------------------|
| "Georg Jensen" | "Georg Jenson" (typo) | ❌ Creates duplicate |
| "Jo Malone" | "Jo Malone London" | ❌ Creates duplicate |
| "Fortnum & Mason" | "Fortnum and Mason" | ❌ Creates duplicate |
| "LEGO" | "Lego" | ✅ Works (case insensitive) |

### ✅ Benefits of Domain Matching:

| CSV Product URL | Database websiteUrl | Result |
|-----------------|---------------------|---------|
| https://georgjensen.com/wine-opener | georgjensen.com | ✅ MATCH |
| https://www.georgjensen.com/product | georgjensen.com | ✅ MATCH |
| https://georgjensen.com/en-gb/item | georgjensen.com | ✅ MATCH |

**Key Benefit:** Domain is a reliable, unique identifier that doesn't change with spelling variations!

---

## 🔄 Import Process (Step-by-Step)

### **Script:** `server/services/products/import-curated.js`

### **Required CSV Columns:**
- ✅ Item Name (required)
- ✅ Retailer (required)
- ✅ Product URL (required)
- ✅ Price (£) (required)
- Image URL (optional)
- Description (optional)
- Interest Category (optional)
- Gender, Age, Tags (optional)

---

## 📋 Detailed Workflow

### **For Each CSV Row:**

#### **Step 1: Validate Basic Fields**
```javascript
✅ Check name (min 4 characters)
✅ Check URL (valid format)
✅ Check price (0 < price < £10,000)
```

#### **Step 2: Extract Product Domain**
```javascript
Product URL: "https://www.georgjensen.com/en-gb/wine-opener"
           ↓ Extract domain
Domain: "georgjensen.com" (removes www., protocol, path)
```

#### **Step 3: Find Retailer (3-Tier Matching)**

##### **Tier 1: Domain Matching (PRIMARY)** 🎯
```javascript
// Most reliable - checks websiteUrl in database
const productDomain = "georgjensen.com";

const retailer = await prisma.retailer.findFirst({
  where: {
    websiteUrl: { contains: productDomain }
  }
});

if (retailer) {
  ✅ MATCH FOUND!
  console.log(`Matched by domain: ${retailer.name}`);
}
```

**Examples:**
```
Product URL: https://georgjensen.com/wine-opener
DB websiteUrl: https://georgjensen.com
Domain extracted: georgjensen.com
Result: ✅ MATCH

Product URL: https://www.babymori.com/baby-toys
DB websiteUrl: https://babymori.com
Domain extracted: babymori.com
Result: ✅ MATCH

Product URL: https://fortnumandmason.com/hamper
DB websiteUrl: https://www.fortnumandmason.com
Domain extracted: fortnumandmason.com
Result: ✅ MATCH
```

##### **Tier 2: Name Matching (FALLBACK)** 🔄
```javascript
// Only if domain matching fails
// Case-insensitive name comparison

if (!retailer) {
  const retailerKey = retailerName.toLowerCase().trim();
  retailer = retailerByName.get(retailerKey);
  
  if (retailer) {
    ✅ MATCH FOUND!
    console.log(`Matched by name: ${retailer.name}`);
  }
}
```

**When This Helps:**
```
CSV: Retailer = "Amazon"
DB: name = "amazon" (case different)
Result: ✅ MATCH (case insensitive)

CSV: Retailer = "LEGO"
DB: name = "Lego"
Result: ✅ MATCH
```

##### **Tier 3: Auto-Create (LAST RESORT)** ✨
```javascript
// Only if both domain and name matching fail

if (!retailer) {
  const origin = new URL(productUrl).origin; // "https://georgjensen.com"
  
  retailer = await prisma.retailer.create({
    data: {
      name: retailerName,        // From CSV
      websiteUrl: origin,        // From product URL
      category: 'UNISEX_ADULT',  // Default
      active: true,
      curatedOnly: true
    }
  });
  
  ✅ NEW RETAILER CREATED!
  console.log(`Created retailer: ${retailer.name}`);
}
```

#### **Step 4: Check if Product Exists**
```javascript
const existing = await prisma.product.findUnique({
  where: { productUrl: normalizedUrl }
});

if (existing) {
  // UPDATE only BLANK fields
  // Never overwrite existing data
} else {
  // CREATE new product
}
```

#### **Step 5: Create or Update Product**
```javascript
if (existing) {
  // SMART UPDATE - only fill blank fields
  const patch = {};
  
  if (!existing.description && csvDescription) {
    patch.description = csvDescription;
  }
  if (!existing.imageUrl && csvImageUrl) {
    patch.imageUrl = csvImageUrl;
  }
  // ... etc
  
  if (Object.keys(patch).length > 0) {
    await prisma.product.update({
      where: { id: existing.id },
      data: patch
    });
    ✅ UPDATED (filled in blank fields only)
  } else {
    ✅ SKIPPED (already complete)
  }
} else {
  // CREATE new product
  await prisma.product.create({
    data: {
      name: csvName,
      productUrl: normalizedUrl,
      price: csvPrice,
      retailerId: retailer.id,  // ✅ Linked to correct retailer
      description: csvDescription,
      imageUrl: csvImageUrl,
      category: csvCategory,
      sourceType: 'CURATED_PRODUCT',
      status: 'NEEDS_REVIEW',
      // ... other fields
    }
  });
  ✅ CREATED
}
```

---

## 📊 Real-World Examples

### **Example 1: Spelling Variation**

**CSV Row 1:**
```csv
Product Name: "Wine Opener"
Retailer: "Georg Jensen"
Product URL: "https://georgjensen.com/wine-opener"
```

**CSV Row 2 (same retailer, different spelling):**
```csv
Product Name: "Champagne Flutes"
Retailer: "Georg Jenson"  ← TYPO!
Product URL: "https://georgjensen.com/champagne-flutes"
```

**Process:**
```
Row 1:
1. Extract domain: "georgjensen.com"
2. No match in DB
3. Create retailer: "Georg Jensen" with websiteUrl "https://georgjensen.com"
4. Create product with retailerId = X

Row 2:
1. Extract domain: "georgjensen.com"
2. ✅ DOMAIN MATCH FOUND! (ignores spelling difference in name)
3. Use SAME retailer (id = X)
4. Create product with retailerId = X

Result: ✅ Both products linked to SAME retailer, NO DUPLICATE!
```

---

### **Example 2: Name Variation**

**CSV Row 1:**
```csv
Product Name: "Hamper"
Retailer: "Fortnum & Mason"
Product URL: "https://fortnumandmason.com/hamper"
```

**CSV Row 2:**
```csv
Product Name: "Tea Selection"
Retailer: "Fortnum and Mason"  ← Different spelling (&/and)
Product URL: "https://fortnumandmason.com/tea"
```

**Process:**
```
Row 1:
1. Domain: "fortnumandmason.com"
2. Create retailer
3. Create product

Row 2:
1. Domain: "fortnumandmason.com"
2. ✅ DOMAIN MATCH! (ignores &/and difference)
3. Use SAME retailer
4. Create product

Result: ✅ NO DUPLICATE!
```

---

### **Example 3: Subdomain/Path Differences**

**CSV Row 1:**
```csv
Product URL: "https://georgjensen.com/uk/wine-opener"
```

**CSV Row 2:**
```csv
Product URL: "https://www.georgjensen.com/us/product/123"
```

**CSV Row 3:**
```csv
Product URL: "https://georgjensen.com/en-gb/item"
```

**Process:**
```
All extract to domain: "georgjensen.com"
Result: ✅ All match SAME retailer!
```

---

## 🎯 Key Benefits

### **1. Prevents Duplicates**
- ✅ Typos in retailer name don't create duplicates
- ✅ Different spellings don't create duplicates
- ✅ Extra words in name don't create duplicates

### **2. Reliable Matching**
- ✅ Domain is unique and consistent
- ✅ Works across different URL paths
- ✅ Handles www. variations automatically

### **3. Smart Fallback**
- ✅ Domain matching first (most reliable)
- ✅ Name matching second (handles edge cases)
- ✅ Auto-create third (for genuinely new retailers)

### **4. Safe Updates**
- ✅ Existing products only get blank fields filled
- ✅ Never overwrites existing data
- ✅ No data loss

---

## 📝 Import Results

After import, you'll see logs like:
```
📦 Import batch: start_row=2, batch_size=40

   🔗 Matched retailer by domain: Georg Jensen (georgjensen.com)
   ✅ Created: Wine Opener
   
   🔗 Matched retailer by domain: Georg Jensen (georgjensen.com)
   ✅ Created: Champagne Flutes
   
   ✨ Created retailer: Baby Mori (babymori.com)
   ✅ Created: Baby Toy Set
   
   📝 Updated existing: LEGO Set (filled 2 fields)
   
   📊 Batch complete: 40 processed, 35 created, 3 updated, 2 skipped
```

---

## 🚀 Usage

### **Admin UI:**
1. Navigate to Admin Dashboard
2. Click "Import from Sheet"
3. Upload CSV/XLSX file
4. Click "Start Import"
5. System automatically matches retailers by domain
6. Review results

### **Programmatic:**
```javascript
import { importCuratedBatch } from './server/services/products/import-curated.js';

const result = await importCuratedBatch(prisma, {
  fileUrl: '/path/to/uploaded-file.csv',
  startRow: 2,
  batchSize: 40,
  expectedTotal: 0
});

console.log(`Created: ${result.created_needs_review}`);
console.log(`Updated: ${result.updated_existing}`);
console.log(`Skipped: ${result.skipped.length}`);
console.log(`New retailers: ${result.created_retailers.length}`);
```

---

## ✅ Summary

**Old System (Name-Based):**
- ❌ "Georg Jensen" ≠ "Georg Jenson" → Duplicate
- ❌ "Jo Malone" ≠ "Jo Malone London" → Duplicate
- ❌ "Fortnum & Mason" ≠ "Fortnum and Mason" → Duplicate

**New System (Domain-Based with Name Fallback):**
- ✅ georgjensen.com = georgjensen.com → MATCH!
- ✅ Works with any spelling variation
- ✅ Works with www. or without
- ✅ Works with different URL paths
- ✅ Fallback to name if domain fails
- ✅ Auto-create if genuinely new

**Result:** Reliable, duplicate-free retailer matching! 🎉
