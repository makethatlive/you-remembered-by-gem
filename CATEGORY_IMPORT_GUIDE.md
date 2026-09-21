# 📊 3-Level Category Import Guide

## 🎯 Overview

The import system now supports **3-level hierarchical categories** matching your onboarding form structure.

---

## 📋 Category Structure

### **Level 1: Main Category** (required)
The top-level category from onboarding

Examples:
- Food & Drink
- Lifestyle & Wellbeing
- Sport & Fitness
- Creative & Culture
- Home, Style & Objects

### **Level 2: Subcategory** (optional)
The second level within main category

Examples under "Food & Drink":
- Cooking & food
- Wine & Drinks
- Coffee & tea

### **Level 3: Specific Type** (optional)
The most specific category (only for some level 2 categories)

Examples under "Wine & Drinks":
- Wine
- Beer
- Cocktails
- Whisky
- Gin
- Rum
- Tequila

---

## 📝 XLSX Column Format

### **Required Columns:**
- `Item Name`
- `Retailer`
- `Product URL`
- `Price (£)`

### **Category Columns** (optional but recommended):
- `Category 1` - Main category
- `Category 2` - Subcategory
- `Category 3` - Specific type (if applicable)

---

## 💡 Example XLSX Rows

### **Example 1: Full 3-Level Category**

| Item Name | Retailer | Product URL | Price (£) | Category 1 | Category 2 | Category 3 |
|-----------|----------|-------------|-----------|------------|------------|------------|
| Macallan 18 Year | Whisky Exchange | https://thewhiskyexchange.com/p/123 | 189.99 | Food & Drink | Wine & Drinks | Whisky |

**Result:** Category stored as: `Food & Drink > Wine & Drinks > Whisky`

---

### **Example 2: 2-Level Category** (No Level 3)

| Item Name | Retailer | Product URL | Price (£) | Category 1 | Category 2 | Category 3 |
|-----------|----------|-------------|-----------|------------|------------|------------|
| Coffee Maker | John Lewis | https://johnlewis.com/coffee-123 | 79.99 | Food & Drink | Coffee & tea | |

**Result:** Category stored as: `Food & Drink > Coffee & tea`

---

### **Example 3: 1-Level Category Only**

| Item Name | Retailer | Product URL | Price (£) | Category 1 | Category 2 | Category 3 |
|-----------|----------|-------------|-----------|------------|------------|------------|
| Running Shoes | Nike | https://nike.com/shoes-456 | 99.99 | Sport & Fitness | | |

**Result:** Category stored as: `Sport & Fitness`

---

## 🔄 Import Logic

The import script builds the category string based on what's provided:

```javascript
if (Category 1 AND Category 2 AND Category 3 exist) {
  category = "Category 1 > Category 2 > Category 3"
}
else if (Category 1 AND Category 2 exist) {
  category = "Category 1 > Category 2"
}
else if (Category 1 exists) {
  category = "Category 1"
}
else if (single "Category" column exists) {
  category = value from "Category" column
}
else {
  category = null
}
```

---

## 📊 Real Examples from Your System

### **Food & Drink Examples:**

| Product | Category Path |
|---------|--------------|
| Whisky Gift Set | `Food & Drink > Wine & Drinks > Whisky` |
| Beer Selection | `Food & Drink > Wine & Drinks > Beer` |
| Cocktail Kit | `Food & Drink > Wine & Drinks > Cocktails` |
| Wine Bottle | `Food & Drink > Wine & Drinks > Wine` |
| Coffee Beans | `Food & Drink > Coffee & tea` |
| Cooking Knife | `Food & Drink > Cooking & food` |

### **Creative & Culture Examples:**

| Product | Category Path |
|---------|--------------|
| Vinyl Record | `Creative & Culture > Music > Vinyl collecting` |
| Concert Tickets | `Creative & Culture > Music > Concerts & live music` |
| Guitar Pick Set | `Creative & Culture > Music > Playing an instrument` |
| Art Print | `Creative & Culture > Art & culture` |
| Photography Book | `Creative & Culture > Photography` |

### **Sport & Fitness Examples:**

| Product | Category Path |
|---------|--------------|
| Golf Clubs | `Sport & Fitness > Golf` |
| Yoga Mat | `Sport & Fitness > Yoga & Pilates` |
| Running Watch | `Sport & Fitness > Running` |
| Cycling Jersey | `Sport & Fitness > Cycling` |

---

## ✅ Backward Compatibility

### **Old Single "Category" Column Still Works!**

If your XLSX has just one `Category` column (not Category 1, 2, 3), it will still work:

| Item Name | Category | Price |
|-----------|----------|-------|
| Wine Gift | Wine & Drinks | 49.99 |

**Result:** Category stored as: `Wine & Drinks`

---

## 🎯 Onboarding Form Mapping

The 3-level structure matches your onboarding form exactly:

### **Onboarding UI:**
```
Food & Drink                    ← Category 1
├── Cooking & food              ← Category 2
├── Wine & Drinks ▸             ← Category 2 (has follow-up)
│   ├── Wine                    ← Category 3
│   ├── Beer                    ← Category 3
│   ├── Cocktails               ← Category 3
│   ├── Whisky                  ← Category 3
│   ├── Gin                     ← Category 3
│   ├── Rum                     ← Category 3
│   └── Tequila                 ← Category 3
└── Coffee & tea                ← Category 2
```

### **Product Import:**
```
Category 1: "Food & Drink"
Category 2: "Wine & Drinks"
Category 3: "Whisky"
Result: "Food & Drink > Wine & Drinks > Whisky"
```

---

## 📝 Template XLSX Structure

Download this structure for your import file:

| Column Name | Required | Example |
|-------------|----------|---------|
| Item Name | ✅ Yes | Macallan 18 Year Whisky |
| Retailer | ✅ Yes | Whisky Exchange |
| Product URL | ✅ Yes | https://thewhiskyexchange.com/p/123 |
| Price (£) | ✅ Yes | 189.99 |
| Category 1 | 🔶 Optional | Food & Drink |
| Category 2 | 🔶 Optional | Wine & Drinks |
| Category 3 | 🔶 Optional | Whisky |
| Image URL | 🔶 Optional | https://... |
| Description | 🔶 Optional | Smooth highland whisky... |
| Gender | 🔶 Optional | Unisex |
| Age | 🔶 Optional | 18+ |
| Interest Tags | 🔶 Optional | Wine, Spirits |
| Gift Type Tags | 🔶 Optional | Things to eat or drink |

---

## 🔍 How Products Are Matched

When generating gifts, the system matches products to recipients based on:

1. **Interest matching** - Does the product category match recipient interests?
2. **Level of detail** - More specific categories (3-level) get better matches
3. **Keywords** - Category keywords are indexed for searching

### **Example Matching:**

**Recipient Profile:**
```json
{
  "interests": ["Wine & Drinks"],
  "winePreference": "Whisky"
}
```

**Product Match Quality:**
```
Product A: "Food & Drink > Wine & Drinks > Whisky"
→ 🎯 BEST MATCH (exact 3-level match)

Product B: "Food & Drink > Wine & Drinks"
→ ✅ GOOD MATCH (2-level match)

Product C: "Food & Drink"
→ ⚠️ WEAK MATCH (1-level only)

Product D: No category
→ ❌ NO CATEGORY MATCH
```

---

## 💡 Best Practices

### **1. Be as Specific as Possible**
✅ Good: `Food & Drink > Wine & Drinks > Whisky`
⚠️ OK: `Food & Drink > Wine & Drinks`
❌ Less useful: `Food & Drink`

### **2. Match Onboarding Categories Exactly**
Use the exact spelling from the onboarding form:
- ✅ "Wine & Drinks" (with &)
- ❌ "Wine and Drinks" (wrong)

### **3. Use Follow-Up Categories When Available**
If a category has follow-up questions in onboarding, use Category 3:
- Wine & Drinks → Whisky, Beer, Wine, etc.
- Music → Vinyl collecting, Concerts, etc.

### **4. Leave Empty if Not Applicable**
Not all products need 3 levels:
- "Cooking & food" products usually don't have Category 3
- That's OK - just leave it empty

---

## 🚀 Import Process

1. **Prepare your XLSX** with Category 1, 2, 3 columns
2. **Upload via Admin Dashboard**
3. **System combines** categories with " > " separator
4. **Products indexed** by full category path
5. **Matching improved** with detailed categories

---

## ✅ Summary

**Old Way (Single Category):**
- ❌ Flat structure
- ❌ Less precise matching
- ❌ Harder to organize

**New Way (3-Level Categories):**
- ✅ Hierarchical structure
- ✅ Precise matching
- ✅ Matches onboarding exactly
- ✅ Better gift suggestions

---

**Your XLSX is now ready for 3-level category imports!** 🎉
