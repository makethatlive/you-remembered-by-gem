# Category Hierarchy in Gift Matching - Analysis

## Summary

✅ **Good News**: Your 3-level category hierarchy (`Category 1 > Category 2 > Category 3`) IS being used in gift generation!

⚠️ **Important**: Categories are used for **diversity** and **text matching**, but NOT for primary interest matching (which uses `interestTags`).

---

## How Categories Are Used

### 1. ✅ **Diversity Sampling** (CONFIRMED)
**File:** `server/services/gifts/product-matcher.js` → `applyDiversitySampling()`

**How it works:**
```javascript
const getTopCategory = (product) => {
  if (!product.category) return 'Uncategorized';
  const parts = product.category.split('>').map(p => p.trim());
  return parts[0] || 'Uncategorized';  // Returns "Food & Drink" from "Food & Drink > Wine & Drinks > Whisky"
};
```

**What it does:**
- Extracts top-level category (Category 1)
- Ensures max 3-6 products per top-level category
- Prevents AI from receiving all "Gardening & outdoor" products
- Forces variety across different category 1 levels

**Example:**
```
User interests: [Gardening, Cooking, Fashion]

❌ WITHOUT diversity (old):
- Gardening & outdoor: 15 products
- Food & Drink: 3 products
- Fashion & accessories: 2 products

✅ WITH diversity (new):
- Gardening & outdoor: 5 products max
- Food & Drink: 5 products max
- Fashion & accessories: 5 products max
- Other categories: 5 products max
```

---

### 2. ✅ **Product Text Matching** (CONFIRMED)
**File:** `server/services/gifts/intelligent-matcher.js` → `hasInterestMatch()`

**How it works:**
```javascript
const productText = [
  product.name,
  product.description,
  product.category,  // ✅ Category IS included in text search
].filter(Boolean).join(' ').toLowerCase();

// Then searches for taxonomy keywords in productText
if (productText.includes(keyword.toLowerCase())) {
  return true; // Found match!
}
```

**What it does:**
- If a product has NO `interestTags` (or they don't match)
- Falls back to searching the full category hierarchy text
- Example: "Food & Drink > Wine & Drinks > Whisky" can match user interest "Wine"

**Example:**
```javascript
Product: {
  name: "Dom Perignon 2013",
  category: "Food & Drink > Wine & Drinks > Whisky",
  interestTags: []  // Empty!
}

User interests: ["Wine"]

Match process:
1. Check interestTags: [] (no match)
2. Fallback to text search:
   - productText = "dom perignon 2013 food & drink > wine & drinks > whisky"
   - Search for "wine" keyword
   - ✅ FOUND in category hierarchy!
```

---

### 3. ❌ **PRIMARY Interest Matching** (NOT USED)

**Current behavior:**
- Primary matching uses ONLY `interestTags` field
- Categories are NOT directly mapped to interests
- This is by design: `interestTags` are more precise than broad categories

**Why:**
```javascript
// Taxonomy defines interests like:
const INTERESTS = [
  {
    key: 'wine',
    keywords: ['wine', 'vineyard', 'sommelier', 'vintage'],
    productCategory: 'Food & Drink > Wine & Drinks'  // ⚠️ This is NOT used for matching
  }
];

// Matching ONLY checks:
product.interestTags.includes('wine')  // ✅ Used
product.category.includes('Wine')      // ❌ Not used (fallback only)
```

---

## Gift Generation Flow with Categories

```
1. USER CREATES RECIPIENT
   Interests: [Gardening, Cooking, Wine]
   Budget: £30-£50

2. PRODUCT MATCHING (product-matcher.js)
   ↓
   a) Hard filters:
      - Budget: £28.50 - £52.50 (±5%)
      - Gender: Match or Unisex
      - Age: Appropriate for age band
   ↓
   b) Interest matching (intelligent-matcher.js):
      - Primary: Check interestTags array
      - Fallback: Search in name + description + category ✅
   ↓
   c) Result: 143 candidates

3. DIVERSITY SAMPLING
   ↓
   - Extract top-level category from each product:
     * "Food & Drink" from "Food & Drink > Wine & Drinks > Whisky"
     * "Gardening & outdoor" from "Gardening & outdoor > Tools > Spades"
   ↓
   - Apply limits:
     * MAX 5 products per top-level category
     * MAX 4 products per retailer
   ↓
   - Result: 20 diverse products sent to AI

4. AI SELECTION (ai-gift-selector.js)
   ↓
   - AI sees product with:
     * name
     * description  
     * category: "Food & Drink > Wine & Drinks > Whisky" ✅
     * price
     * retailer
   ↓
   - AI uses category to understand context
   - Selects 10 best gifts

5. QUALITY CHECKS
   ↓
   - Checks category diversity (using top-level category)
   - Ensures not all gifts from same category
```

---

## Example: How Your Categories Work

### Product in Database:
```javascript
{
  id: "abc123",
  name: "Dom Perignon 2013",
  category: "Food & Drink > Wine & Drinks > Whisky",  // ✅ Your 3-level hierarchy
  interestTags: ["Wine", "Luxury items"],
  price: 45.00,
  description: "A prestigious champagne..."
}
```

### User Profile:
```javascript
{
  name: "John",
  interests: ["Wine", "Cooking"],
  budget: [30, 50]
}
```

### Matching Process:

**Step 1: Interest Match**
```javascript
// Check interestTags
product.interestTags = ["Wine", "Luxury items"]
recipient.interests = ["Wine", "Cooking"]
// ✅ MATCH: "Wine" appears in both
```

**Step 2: Diversity Sampling**
```javascript
// Extract top category
getTopCategory(product)
// Returns: "Food & Drink"

// Count products in "Food & Drink"
foodDrinkProducts = 12
MAX_PER_CATEGORY = 5

// This product gets included if it's in top 5 scoring "Food & Drink" products
```

**Step 3: AI Sees**
```javascript
{
  name: "Dom Perignon 2013",
  category: "Food & Drink > Wine & Drinks > Whisky",  // ✅ AI sees full hierarchy!
  description: "A prestigious champagne...",
  price: "£45.00"
}

// AI understands:
// - Top level: Food & Drink (not a tech gadget)
// - Mid level: Wine & Drinks (not cooking ingredients)
// - Specific: Whisky (actually it's champagne, but category says whisky)
```

---

## Verification Checklist

To confirm categories are working correctly in gift generation:

### ✅ 1. Category Diversity
**Test:** Generate gift for user with ONE interest (e.g., "Gardening")

**Expected:** 
- AI should receive products from MULTIPLE categories
- Not all 20 products should be "Gardening & outdoor"
- Should see mix of related categories

**How to verify:**
```bash
# Check console logs during gift generation
🎨 Applying diversity sampling to 143 products...
   ✓ Gardening & outdoor: 5 products
   ✓ Home & lifestyle: 4 products
   ✓ Books & stationery: 3 products
   ...
```

### ✅ 2. Category in AI Context
**Test:** Check what AI sees in prompt

**Expected:**
- Product JSON includes `category` field
- Full hierarchy visible: "Cat1 > Cat2 > Cat3"

**How to verify:**
Look at AI prompt in `ai-gift-selector.js` → `buildUserPrompt()`

### ✅ 3. Fallback Text Matching
**Test:** Product with empty `interestTags` but relevant category

**Expected:**
- Should still match if category contains interest keyword
- Example: Category "Food & Drink > Wine" matches interest "Wine"

**How to verify:**
```javascript
// Test product:
{
  name: "Mystery Wine",
  category: "Food & Drink > Wine & Drinks > Wine",
  interestTags: []  // Empty!
}

// Should STILL match recipient with interest "Wine"
// Because fallback searches category text
```

---

## Recommendations

### ✅ KEEP: Current System Working Well
Your 3-level hierarchy is working correctly for:
1. Diversity sampling (prevents category domination)
2. AI context (AI sees full category path)
3. Fallback matching (searches category text)

### 🔧 OPTIONAL IMPROVEMENTS

#### Option 1: Map Categories to Interest Tags (Recommended)
**Problem:** Products might have relevant categories but empty `interestTags`

**Solution:** Auto-populate `interestTags` from categories

```javascript
// Example mapping:
const CATEGORY_TO_TAGS = {
  'Food & Drink > Wine & Drinks': ['Wine', 'Beverages'],
  'Fashion & accessories > Jewelry': ['Fashion', 'Jewelry'],
  'Gardening & outdoor > Plants': ['Gardening', 'Plants'],
  'Home & lifestyle > Kitchen': ['Cooking', 'Kitchen'],
};

// When importing products:
if (product.category && !product.interestTags.length) {
  product.interestTags = getCategoryTags(product.category);
}
```

#### Option 2: Category-Based Scoring Boost
**Problem:** Categories aren't directly scored, only used for diversity

**Solution:** Add category-match bonus to scoring

```javascript
// In scoreProduct():
if (recipientInterests.includes('Wine')) {
  if (product.category.toLowerCase().includes('wine')) {
    score += 5; // Bonus for category match
    signals.push('Category: Wine ✓');
  }
}
```

#### Option 3: Use All 3 Levels for Diversity
**Current:** Uses only Category 1 for diversity
**Proposed:** Consider Category 2 for more granular diversity

```javascript
// Current:
"Food & Drink" → max 5 products

// Proposed:
"Food & Drink > Wine & Drinks" → max 3 products
"Food & Drink > Cooking & food" → max 3 products
// Ensures variety within main category
```

---

## Testing Your Categories

### Test Script:
```javascript
// Test if categories work in gift generation
const recipient = {
  name: "Test User",
  interests: ["Wine"],
  budgetMin: 30,
  budgetMax: 50,
  gender: "MALE",
  ageBand: "EIGHTEEN_TO_35"
};

// Generate gift list
// Check console output for:
// 1. Diversity sampling stats
// 2. Categories of selected products
// 3. Whether category matches interest
```

### Expected Console Output:
```
🎨 Applying diversity sampling to 85 products...
   📊 Found 6 top-level categories
   🎯 Diversity limits: 5 per category, 4 per retailer
   ✓ Food & Drink: 5 products
   ✓ Home & lifestyle: 4 products
   ✓ Fashion & accessories: 3 products
   ...
   ✅ Final diversity: 6 categories, 8 retailers
```

---

## Conclusion

### ✅ YES - Your Categories ARE Used!

**Usage Confirmed:**
1. ✅ **Diversity Sampling**: Top-level category prevents domination
2. ✅ **AI Context**: Full 3-level hierarchy visible to AI
3. ✅ **Text Fallback**: Category text searched for interest keywords

**Current Limitation:**
- Categories are NOT directly mapped to `interestTags` for primary matching
- This is OK if your products have good `interestTags`
- Fallback ensures categories still work when tags are missing

### 🎯 Action Items:

1. **Verify** your products have good `interestTags`:
   ```sql
   SELECT COUNT(*) FROM Product WHERE interestTags IS NULL OR interestTags = '[]';
   ```

2. **Test** gift generation with various interests to see diversity in action

3. **Consider** implementing Category → InterestTags mapping if many products lack tags

4. **Monitor** quality reports to see if category diversity is working

---

**Your 3-level category hierarchy is working correctly! The gift generation system uses it for diversity sampling and provides it to AI for better context. 🎉**
