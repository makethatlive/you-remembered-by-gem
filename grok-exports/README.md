# Grok AI Product Classification

This folder contains tools to use Grok AI for intelligent product classification.

---

## 📊 Current Status

**Total Products:** 6,042

| Field | Filled | Missing | Percentage |
|-------|--------|---------|------------|
| category | 6,040 | 2 | 100% |
| interestTags | 5,329 | 713 | 88% |
| giftTypeTags | 5,324 | 718 | 88% |
| searchKeywords | 3,720 | 2,322 | 62% |

---

## 🚀 How to Use Grok AI Classification

### **Step 1: Export Products**

```bash
node scripts/export-products-for-grok.js
```

This creates:
- `products-for-grok-TIMESTAMP.json` - All products with current/corrected fields
- `GROK_PROMPT_TIMESTAMP.md` - Instructions for Grok

### **Step 2: Send to Grok AI**

1. Go to https://grok.x.ai/
2. Copy content from `GROK_PROMPT_TIMESTAMP.md`
3. Paste into Grok chat
4. Upload `products-for-grok-TIMESTAMP.json`
5. Wait for Grok to process (~5-10 minutes for 6,000 products)
6. Grok will return corrected JSON - download it

### **Step 3: Import Corrections**

```bash
node scripts/import-grok-corrections.js path/to/grok-corrected-products.json
```

This will:
- Compare corrected vs current values
- Update only changed fields
- Show statistics of changes

---

## 📋 What Grok AI Will Correct

### **1. category**
- Single best canonical category
- Hierarchical format: "Cooking & food > Baking"

### **2. interestTags**
- Array of ALL relevant interest categories
- Example: ["Cooking & food", "Home & interiors"]

### **3. giftTypeTags**
- Array of applicable gift types
- Example: ["Practical but high quality", "Beautiful objects for the home"]

### **4. searchKeywords**
- 5-15 relevant search terms
- Example: ["casserole", "cast iron", "cookware", "le creuset"]

### **5. suitableAgeBands**
- Age ranges appropriate for product
- Example: ["26-35", "36-45", "46-55", "56-65"]

### **6. genderAppliesTo**
- Gender suitability
- Example: ["Unisex"] or ["Female"] or ["Male"]

---

## 🎯 Why Use Grok?

### **Advantages:**
✅ **Intelligent** - Understands context, not just keywords  
✅ **Bulk Processing** - Handles 6,000+ products at once  
✅ **Consistent** - Uses exact taxonomy from onboarding form  
✅ **Fast** - 5-10 minutes vs manual classification  
✅ **Free** - Grok is free to use (vs Claude API costs)  

### **Compared to Current System:**

| Method | Intelligence | Speed | Cost | Accuracy |
|--------|--------------|-------|------|----------|
| Keywords (Track 1) | ⭐ Low | ⚡ Instant | 💰 Free | 60-70% |
| Claude AI (Track 2) | ⭐⭐⭐⭐⭐ High | 🐢 Slow | 💰💰 $0.03/product | 95% |
| **Grok AI (Bulk)** | ⭐⭐⭐⭐⭐ High | ⚡⚡ Fast | 💰 Free | 95%+ |

---

## 📊 Expected Improvements

### **After Grok Classification:**

| Field | Before | After | Improvement |
|-------|--------|-------|-------------|
| interestTags | 88% filled | 98% filled | +10% |
| giftTypeTags | 88% filled | 98% filled | +10% |
| searchKeywords | 62% filled | 95% filled | +33% |
| **Quality** | 60-70% accurate | 95%+ accurate | +30% |

---

## ⚠️ Important Notes

### **Before Running:**
1. Backup your database first!
2. Test with small batch (50 products) before doing all 6,000
3. Review Grok's output before importing

### **After Running:**
1. Check a few products manually to verify quality
2. Run gift generation tests to ensure matching works
3. Monitor quality scores

---

## 🔄 Re-running Classification

You can re-run this process anytime to:
- Fix incorrect classifications
- Add new taxonomy categories
- Update products after adding new fields
- Improve search keywords

Simply export → send to Grok → import corrections.

---

## 📁 Files Generated

### **Export Files:**
- `products-for-grok-TIMESTAMP.json` - Product data for Grok
- `GROK_PROMPT_TIMESTAMP.md` - Instructions for Grok

### **Import Files:**
- Downloaded from Grok after processing
- Same JSON structure with corrected_ fields filled

---

## 💡 Pro Tips

1. **Test First:** Try with 100 products before doing all 6,000
2. **Review Changes:** Check import statistics before confirming
3. **Iterate:** Run multiple times to refine results
4. **Backup:** Always backup database before bulk updates
5. **Spot Check:** Manually verify 10-20 random products after import

---

**Last Updated:** September 23, 2026  
**Version:** 1.0
