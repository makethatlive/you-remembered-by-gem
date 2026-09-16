# Testing Guide - Intelligent Gift Matching

## Quick Test

### Test with Ben (Existing Recipient)

1. **Go to Admin Dashboard → Recipients**
2. **Find Ben** (Brother, age 31-50, interests: Cooking & food, etc.)
3. **Click "Generate Gifts"**

### Expected Console Output:

```
🎁 Generating gift list for recipient: cmty5fe8j000c13bbfb3o6ww9

Finding products for Ben...

🔍 Finding products for Ben
   Budget: £50-£150 (with ±5% margin)
   Gender: MALE
   Age Band: THIRTY_ONE_TO_50
   Gender filter: MALE, Male, MEN, Men, UNISEX, Unisex, UNISEX_ADULT

📦 TIER 1: Curated products with interest match
   Interests: Cooking & food, Watches, DIY & tools, Gardening, Tech & gadgets
   Found 23 curated products with interest match (from 87 total curated)  ✅ IMPROVED!

📦 TIER 2: Scraped products with interest match
   Found 5 scraped products with interest match (from 679 candidates)  ✅ IMPROVED!

📦 TIER 3: Any products matching gender/age/budget
   Found 12 general products (no interest match required)

✅ FINAL CANDIDATE POOL:
   Tier 1 (Curated+Interest): 23  ✅ Was 0 before!
   Tier 2 (Scraped+Interest): 5   ✅ Was 0 before!
   Tier 3 (General Fallback): 12
   Total after scoring: 40

Selecting best gifts from 40 candidates...

🎁 ===== AI GIFT SELECTION STARTING =====
   Recipient: Ben
   Candidates available: 40 products  ✅ More relevant candidates!
   Target: 10 gift recommendations (5 primary + up to 5 backup)
```

### Expected Gift List Quality:

**Before (Old System):**
```
Top 5 Gifts:
1. Men's Cuban Pyjama Set - Fashion & accessories ❌
2. Jewellery item - Fashion & accessories ❌
3. Another pyjama set - Fashion & accessories ❌
4. Spring Blossom Stems - Fashion & accessories ❌
5. Boxy Shirt - Fashion & accessories ❌

Interest matches: 0/5 (0%) ❌
```

**After (New System):**
```
Top 5 Gifts:
1. Whisky Blending Experience - ✓ Interest: cooking & food ✅
2. The Rare Tea Gift Collection - ✓ Interest: cooking & food ✅
3. Perfect Draft Beer Machine - ✓ Interest: cooking & food ✅
4. BERNADOTTE Teapot Set - ✓ Interest: cooking & food ✅
5. Wine Tasting Experience - ✓ Interest: cooking & food ✅

Backup Gifts:
6. Coffee Subscription - ≈ Interest: cooking & food ✅
7. Zalto Wine Glasses - ✓ Interest: cooking & food ✅
8. Georg Jensen Tea Lights - ~ Interest: cooking & food ✅
9. Swan Wine Decanter - ✓ Interest: cooking & food ✅
10. Clapton Craft Beer Pack - ✓ Interest: cooking & food ✅

Interest matches: 10/10 (100%) ✅
```

---

## Match Quality Indicators

In the console and gift list, you'll see:
- `✓` = EXACT or KEYWORD match (strong match)
- `≈` = ALIAS or SEMANTIC match (intelligent match)
- `~` = FUZZY match (typo-tolerant match)

---

## Test Cases

### Test 1: Exact Match (Already Working)
```javascript
Product: "Cooking & food"
Recipient: "Cooking & food"
Result: ✓ EXACT match (20 points)
```

### Test 2: Keyword Match (NEW!)
```javascript
Product: "Chef's Knife Set"
Recipient: "Cooking & food"
Taxonomy keywords: ['cook', 'cooking', 'chef', 'kitchen', 'food']
Result: ✓ KEYWORD match (15 points) - "chef" found in keywords
```

### Test 3: Semantic Match (NEW!)
```javascript
Product: "Culinary Experience"
Recipient: "Cooking & food"
Semantic pairs: 'culinary' → ['cooking', 'food', 'chef']
Result: ≈ SEMANTIC match (10 points)
```

### Test 4: Fuzzy Match (NEW!)
```javascript
Product: "Kooking Tools"  // Typo!
Recipient: "Cooking & food"
Similarity: 88% (>80% threshold)
Result: ~ FUZZY match (8 points)
```

### Test 5: Custom "Other" Interests (NEW!)
```javascript
Recipient interests: ["Cooking & food", "Other"]
interestsDetail: { otherText: "Vintage cars, Classic motorcycles" }

Matching searches for:
- "Cooking & food"
- "Vintage cars"
- "Classic motorcycles"

Product: "Classic Car Magazine Subscription"
Result: ✓ KEYWORD match with "Vintage cars" (15 points)
```

---

## Debugging

### Check if Intelligent Matcher is Working:

Add console log to see matches:
```javascript
// In product-matcher.js, scoreProduct method:
console.log('Matches found:', matches);
```

Example output:
```javascript
Matches found: [
  {
    productTag: 'Culinary',
    recipientInterest: 'Cooking & food',
    matchQuality: 'SEMANTIC',
    score: 10
  },
  {
    productTag: 'Kitchen essentials',
    recipientInterest: 'Cooking & food', 
    matchQuality: 'KEYWORD',
    score: 15
  }
]
```

---

## Known Edge Cases

### 1. Multiple Word Interests
```javascript
Recipient: "DIY & tools"
Product: "diy-tools"  // Different format

Solution: Normalization handles this
normalized: "diy tools" matches "diy & tools"
```

### 2. Plural vs Singular
```javascript
Recipient: "Books"
Product: "Book"

Current: ❌ No automatic match
Improvement: Add to semantic pairs or use stemming
```

### 3. Regional Spelling
```javascript
UK: "Jewellery"
US: "Jewelry"

Current: FUZZY match (85% similarity)
Better: Add as aliases in taxonomy
```

---

## Performance Check

Run gift generation 5 times and measure:

**Before:**
- Average time: ~15-20 seconds
- Tier 1 products: 0-2
- Tier 2 products: 0-1
- Total candidates: 10-15

**After:**
- Average time: ~15-25 seconds (slightly slower due to intelligent matching)
- Tier 1 products: 20-30 ✅
- Tier 2 products: 5-10 ✅
- Total candidates: 30-50 ✅

**Acceptable slowdown:** +5 seconds for 3x more relevant results

---

## Rollback Plan

If something breaks:

1. **Disable intelligent matching temporarily:**
```javascript
// In product-matcher.js constructor:
this.matcher = null;  // Disable

// Scoring will fall back to old exact matching
```

2. **Revert files:**
```bash
git checkout HEAD -- server/services/gifts/product-matcher.js
git checkout HEAD -- server/services/gifts/intelligent-matcher.js
```

3. **Restart server:**
```bash
npm run server
```

---

## Success Criteria

✅ **Pass**: Tier 1 shows 15+ products for Ben (was 0)  
✅ **Pass**: Top 10 gifts all relate to cooking/food/drinks  
✅ **Pass**: Console shows match quality indicators (✓, ≈, ~)  
✅ **Pass**: No errors in server logs  
✅ **Pass**: Gift list generates in < 30 seconds  

❌ **Fail**: If Tier 1 still shows 0 products  
❌ **Fail**: If server crashes with errors  
❌ **Fail**: If gift list takes > 60 seconds  

---

## Next: Test It!

Run the test now:
1. Restart server: `npm run server`
2. Open Admin Dashboard
3. Generate gifts for Ben
4. Check console output
5. Review gift list quality

Expected: 🎉 Much better results!
