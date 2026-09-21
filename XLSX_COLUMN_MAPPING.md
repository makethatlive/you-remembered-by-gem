# 📊 XLSX Column Mapping Guide

## ✅ Your XLSX Columns → Database Fields

This document shows how your specific XLSX columns map to the database.

---

## 📋 Your XLSX Structure

```
Item Name
Retailer
Product URL
Category 1
Category 2
Category 3
Gender
Price (£)
Age (if not general adult) ▸ optional
Occasion (if obviously suited) ▸ optional
Personality Tags (optional) ▸ optional
Other notes
Source
```

---

## 🔄 Column Mapping

### **Item Name** → `name`
- **Required:** ✅ Yes
- **Type:** Text
- **Example:** "Macallan 18 Year Whisky"
- **Database field:** `product.name`

---

### **Retailer** → `retailerId`
- **Required:** ✅ Yes
- **Type:** Text
- **Example:** "Whisky Exchange", "Georg Jensen"
- **Process:**
  1. Extract domain from Product URL
  2. Match by domain first (primary)
  3. Match by name second (fallback)
  4. Create new if not found
- **Database field:** `product.retailerId`

**Domain Matching Example:**
```
Retailer: "Georg Jensen"
Product URL: https://georgjensen.com/wine-opener
→ Extract domain: "georgjensen.com"
→ Match existing retailer with same domain
→ No duplicate even if spelling varies!
```

---

### **Product URL** → `productUrl`
- **Required:** ✅ Yes
- **Type:** URL
- **Example:** "https://thewhiskyexchange.com/p/12345"
- **Validation:** Must be valid URL
- **Database field:** `product.productUrl`

---

### **Category 1, Category 2, Category 3** → `category`
- **Required:** 🔶 Optional (but highly recommended)
- **Type:** Text (3 separate columns)
- **Combined with:** " > " separator
- **Database field:** `product.category`

**Examples:**

| Category 1 | Category 2 | Category 3 | Result in Database |
|------------|------------|------------|-------------------|
| Food & Drink | Wine & Drinks | Whisky | `Food & Drink > Wine & Drinks > Whisky` |
| Food & Drink | Coffee & tea | | `Food & Drink > Coffee & tea` |
| Sport & Fitness | | | `Sport & Fitness` |

**Matches onboarding form structure:**
```
Food & Drink              ← Category 1
  ├── Cooking & food      ← Category 2
  ├── Wine & Drinks ▸     ← Category 2
  │   ├── Whisky          ← Category 3
  │   ├── Beer            ← Category 3
  │   └── Wine            ← Category 3
  └── Coffee & tea        ← Category 2
```

---

### **Gender** → `genderAppliesTo`
- **Required:** 🔶 Optional
- **Type:** Text
- **Accepted values:**
  - "Male", "Men", "Man", "Boys" → `MALE`
  - "Female", "Women", "Woman", "Girls" → `FEMALE`
  - "Unisex", empty → `UNISEX`
- **Database field:** `product.genderAppliesTo`

**Example:**
```
Gender: "Women"
→ Stored as: FEMALE

Gender: "Unisex"
→ Stored as: UNISEX

Gender: (empty)
→ Stored as: UNISEX (default)
```

---

### **Price (£)** → `price`
- **Required:** ✅ Yes
- **Type:** Number
- **Format:** With or without £ symbol
- **Range:** 0 < price < £10,000
- **Example:** "189.99", "£189.99", "49"
- **Database field:** `product.price`

**Accepted formats:**
```
✅ 189.99
✅ £189.99
✅ 49
✅ 1,299.99
✅ £1,299.99
```

---

### **Age (if not general adult)** → `suitableAgeBands`
- **Required:** 🔶 Optional
- **Type:** Text (comma-separated)
- **Accepted values:**
  - "Kids", "Children", "Child" → `["Under 5", "5-10", "11-17"]`
  - "Baby", "Toddler" → `["Under 5"]`
  - "Teen", "Teenager" → `["11-17"]`
  - "18+", "Adult", "Adults" → `["18+"]`
  - (empty) → `["18+"]` (default)
- **Database field:** `product.suitableAgeBands` (array)

**Examples:**
```
Age: "Kids"
→ Stored as: ["Under 5", "5-10", "11-17"]

Age: "Teen"
→ Stored as: ["11-17"]

Age: "18+"
→ Stored as: ["18+"]

Age: (empty)
→ Stored as: ["18+"] (default adult)
```

---

### **Occasion (if obviously suited)** → Part of `description`
- **Required:** 🔶 Optional
- **Type:** Text
- **Example:** "Birthday", "Anniversary", "Christmas"
- **Process:** Appended to notes as "Occasion: Birthday"
- **Database field:** Included in `product.description`

**Example:**
```
Other notes: "Premium quality whisky"
Occasion: "Anniversary"
→ Stored in description as:
"Premium quality whisky
Occasion: Anniversary"
```

---

### **Personality Tags (optional)** → `searchKeywords`
- **Required:** 🔶 Optional
- **Type:** Text (comma-separated)
- **Example:** "Practical, Thoughtful, Sentimental"
- **Process:** Combined with search keywords
- **Database field:** `product.searchKeywords` (array)

**Example:**
```
Personality Tags: "Practical, Thoughtful"
→ Stored as: ["Practical", "Thoughtful"]
```

---

### **Other notes** → `description`
- **Required:** 🔶 Optional
- **Type:** Text (long)
- **Example:** "Premium highland single malt, aged 18 years"
- **Database field:** `product.description`

---

### **Source** → Part of `description`
- **Required:** 🔶 Optional
- **Type:** Text
- **Example:** "Kate's curated list", "Client recommendation"
- **Process:** Appended to notes as "Source: ..."
- **Database field:** Included in `product.description`

**Example:**
```
Other notes: "Premium quality whisky"
Occasion: "Anniversary"
Source: "Kate's curated list"

→ Stored in description as:
"Premium quality whisky
Occasion: Anniversary
Source: Kate's curated list"
```

---

## 📊 Complete Example Row

### **XLSX Input:**
```
Item Name: Macallan 18 Year Highland Single Malt Whisky
Retailer: The Whisky Exchange
Product URL: https://thewhiskyexchange.com/p/12345
Category 1: Food & Drink
Category 2: Wine & Drinks
Category 3: Whisky
Gender: Unisex
Price (£): 189.99
Age: 18+
Occasion: Anniversary, Birthday
Personality Tags: Thoughtful, Sophisticated
Other notes: Premium highland single malt, aged 18 years in oak casks
Source: Kate's curated list
```

### **Database Output:**
```javascript
{
  name: "Macallan 18 Year Highland Single Malt Whisky",
  productUrl: "https://thewhiskyexchange.com/p/12345",
  price: 189.99,
  retailerId: "abc123", // Matched by domain "thewhiskyexchange.com"
  category: "Food & Drink > Wine & Drinks > Whisky",
  genderAppliesTo: "UNISEX",
  suitableAgeBands: ["18+"],
  searchKeywords: ["Thoughtful", "Sophisticated"],
  description: "Premium highland single malt, aged 18 years in oak casks\nOccasion: Anniversary, Birthday\nSource: Kate's curated list",
  sourceType: "CURATED_PRODUCT",
  status: "NEEDS_REVIEW",
  addedDate: "2026-09-17T..."
}
```

---

## 🎯 Import Process Summary

### **Step 1: Read XLSX**
- Parse all columns
- Normalize header names (case-insensitive, flexible spelling)

### **Step 2: Validate Required Fields**
- Item Name (min 4 characters)
- Product URL (valid URL)
- Price (0 < price < £10,000)
- Retailer (not empty)

### **Step 3: Match/Create Retailer**
1. Extract domain from Product URL
2. Match by domain (primary)
3. Match by name (fallback)
4. Create new if not found

### **Step 4: Build Category**
```javascript
if (Cat1 && Cat2 && Cat3) → "Cat1 > Cat2 > Cat3"
else if (Cat1 && Cat2)    → "Cat1 > Cat2"
else if (Cat1)            → "Cat1"
else                      → null
```

### **Step 5: Combine Notes**
```javascript
notes = other_notes
if (occasion) notes += "\nOccasion: " + occasion
if (source)   notes += "\nSource: " + source
```

### **Step 6: Create/Update Product**
- Check if product exists by URL
- If exists: Update blank fields only
- If new: Create with all fields

---

## ✅ Column Checklist

Before uploading, verify your XLSX has:

**Required:**
- ✅ Item Name
- ✅ Retailer
- ✅ Product URL
- ✅ Price (£)

**Highly Recommended:**
- ✅ Category 1
- ✅ Category 2
- ✅ Category 3 (if applicable)
- ✅ Gender

**Optional but Useful:**
- 🔶 Age (if not general adult)
- 🔶 Occasion (if obviously suited)
- 🔶 Personality Tags
- 🔶 Other notes
- 🔶 Source

---

## 💡 Best Practices

### **1. Category Structure**
✅ Be as specific as possible
✅ Use exact spelling from onboarding form
✅ Fill Category 1, 2, 3 when available

### **2. Retailer Names**
✅ Don't worry about spelling variations!
✅ Domain matching handles it automatically
✅ "Georg Jensen" vs "Georg Jenson" → Same retailer

### **3. Age Field**
✅ Leave empty for general adult products
✅ Use "Kids" for children's products
✅ Use "Teen" for teenagers

### **4. Personality Tags**
✅ Match personality options from onboarding:
- Practical and no-nonsense
- Creative and expressive
- Thoughtful and introverted
- etc.

### **5. Other Notes**
✅ Include product details, quality info
✅ Mention brand heritage if relevant
✅ Note special features

---

## 🚀 Ready to Import!

Your XLSX columns are now fully supported! Upload and the system will:
- ✅ Parse all columns correctly
- ✅ Match retailers by domain
- ✅ Build 3-level categories
- ✅ Combine notes from multiple fields
- ✅ Store everything properly

**Happy importing!** 🎉
