# Deep Analysis of Gemma's Questions - Complete Technical Answers

**Date:** September 18, 2026  
**Analysis by:** Technical Review of Current Implementation  
**Scope:** Express server (NOT base44 - analyzing actual codebase)

---

## Executive Summary

This document provides comprehensive technical answers to all questions from Gemma's message, based on **deep analysis of the current Express-based implementation** (not base44). All answers are grounded in actual code inspection of:

- Express API endpoints (`server/index.js`)
- Database schema (`prisma/schema.prisma`)
- Gift matching logic (`server/services/gifts/product-matcher.js`)
- Frontend forms (`src/components/onboarding/`)
- Taxonomy system (`src/components/shared/taxonomy.js`)

---

## Question 1: Gender Categories - Male/Female/Unisex

### Client Decision
> "Having thought it through, I'd like to keep the gender structure as Male/Female/Unisex rather than moving to Boys/Girls/Kids for children's products."

### Current Implementation Status

**Database Schema (`prisma/schema.prisma`)**
```prisma
// Recipients can be:
enum Gender {
  MALE
  FEMALE
  NON_BINARY
  PREFER_NOT_TO_SAY
}

// Products apply to:
model Product {
  genderAppliesTo String? // Stored as text, not enum
  // Values seen: "MALE", "FEMALE", "UNISEX", "UNISEX_ADULT", "KIDS"
}
```

**Product Matching Logic (`product-matcher.js` line 88-96)**
```javascript
// Gender filter logic (per client spec)
let genderFilter;
if (gender === 'MALE' || gender === 'Male') {
  genderFilter = { in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT', 'KIDS'] };
} else if (gender === 'FEMALE' || gender === 'Female') {
  genderFilter = { in: ['FEMALE', 'Female', 'WOMEN', 'Women', 'UNISEX', 'Unisex', 'UNISEX_ADULT', 'KIDS'] };
} else if (gender === 'NON_BINARY' || gender === 'PREFER_NOT_TO_SAY') {
  genderFilter = { in: ['UNISEX', 'Unisex', 'UNISEX_ADULT', 'KIDS'] };
} else {
  // Default: allow all if gender not specified
  genderFilter = undefined;
}
```

### ✅ Analysis

**No work needed.** The current system already:
- Uses Male/Female/Unisex structure for recipients
- Allows "KIDS" as a gender tag on products (which matches both male and female children)
- Does NOT use Boys/Girls/Kids as recipient gender options

**What this means:**
- ✅ Recipients are tagged as MALE, FEMALE, NON_BINARY, or PREFER_NOT_TO_SAY
- ✅ Products for children are tagged with "KIDS" gender (which matches any child recipient)
- ✅ Male children get: Male products + Unisex products + Kids products
- ✅ Female children get: Female products + Unisex products + Kids products

---

## Question 2: Children's Products - Handling Under-12s

### Client Question
> "I'm considering excluding under-12 recipients from the scraped catalogue, and serving them only from my own curated kids' list. Recipients aged 12–17 would continue to be treated the same as adults."

### Before Answering - What You Need to Know

#### 2a. Is Gem's Picks fully cleaned?

**Current Status:**

**Database Query Result (would need to run):**
```sql
SELECT COUNT(*), sourceType 
FROM products 
WHERE sourceType = 'CURATED_PRODUCT'
GROUP BY sourceType;
```

**What "Gem's Picks" means in the code:**
```javascript
// In product-matcher.js line 124-147
// TIER 1: Premium CURATED_PRODUCT + Interest Match
const tier1Where = {
  ...baseFilters,
  sourceType: 'CURATED_PRODUCT', // ← This is "Gem's Picks"
};
```

**Source Types in Database:**
```prisma
enum SourceType {
  CURATED_PRODUCT      // ← Gem's manually curated Excel list
  CURATED_RETAILER     // ← Scraped from curated retailers
  SHOPIFY_UPLOAD       // ← Uploaded via Shopify integration
  LEGACY_UNKNOWN       // ← Old data from migration
}
```

**To confirm cleanup is complete, you need to:**
1. Run: `GET /api/products?status=ACTIVE&sourceType=CURATED_PRODUCT` (via Postman/frontend)
2. Check if product names/descriptions match ONLY your Excel imports
3. Look for any products with `sourceType: LEGACY_UNKNOWN` that shouldn't be there

**Answer:** **I cannot confirm without database access.** You need to:
1. Export all CURATED_PRODUCT items to Excel
2. Manually verify they match your curated list
3. Check for any leftover scraped products that should have been cleaned

#### 2b. What's involved in restricting under-12 matching to Gem's Picks only?

**Current Age Band Logic:**

```javascript
// Age bands in schema
enum AgeBand {
  UNDER_5          // Age 0-4
  FIVE_TO_10       // Age 5-10
  ELEVEN_TO_17     // Age 11-17
  EIGHTEEN_TO_30   // Age 18-30
  THIRTY_ONE_TO_50 // Age 31-50
  FIFTY_ONE_TO_70  // Age 51-70
  SEVENTY_PLUS     // Age 71+
}
```

**Current Age Filtering (`product-matcher.js` line 98-122):**
```javascript
// TEXT-BASED AGE FILTER (for kids/teens)
// For recipients under 18, search product text for kid-friendly keywords
let ageKeywordFilter;
const isKid = ['ZERO_TO_10', 'ELEVEN_TO_17'].includes(ageBand); // ← Wrong enum names!

if (isKid) {
  // Keywords to search in product name, description, category
  const kidKeywords = ageBand === 'ZERO_TO_10' 
    ? ['kid', 'child', 'baby', 'toddler', 'toy', 'game', 'play']
    : ['teen', 'youth', 'young', 'kid', 'child', 'toy', 'game'];
  
  // Build OR conditions for text search across name/description/category
  ageKeywordFilter = {
    OR: kidKeywords.flatMap(keyword => [
      { name: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
      { category: { contains: keyword, mode: 'insensitive' } }
    ])
  };
}
```

**🚨 BUG FOUND:** The code uses wrong enum values:
- Code checks: `'ZERO_TO_10'` and `'ELEVEN_TO_17'`
- Schema has: `'UNDER_5'`, `'FIVE_TO_10'`, `'ELEVEN_TO_17'`

**To restrict under-12s to Gem's Picks only:**

```javascript
// In product-matcher.js, around line 120

// Check if recipient is under 12
const isUnder12 = ['UNDER_5', 'FIVE_TO_10'].includes(ageBand);

// Modify baseFilters to add sourceType restriction
const baseFilters = {
  status: 'ACTIVE',
  price: {
    gte: budgetMinWithMargin,
    lte: budgetMaxWithMargin,
  },
  OR: [
    { qualityScore: { gte: this.MIN_QUALITY_SCORE } },
    { qualityScore: null }
  ],
  
  // ✅ ADD THIS:
  ...(isUnder12 ? { sourceType: 'CURATED_PRODUCT' } : {})
};
```

**Effort Estimate:**
- **Time:** 15 minutes to add the filter
- **Testing:** 1 hour to verify with real child recipient data
- **Total:** **1.25 hours** (straightforward filter addition)

**Does it touch tiering structure?**
- **No.** It's a simple WHERE clause addition.
- All three tiers will only see CURATED_PRODUCT items for under-12s.
- The tiering logic (interest match > category match > fallback) remains unchanged.

**Fallback Behavior:**
- If your curated list has <10 products for a specific child profile, the AI will see fewer candidates.
- The system already handles this gracefully (validated in `gift-list-generator.js` line 44-54):

```javascript
// Per client spec: "It's better to offer five thoughtfully-priced, age/gender-appropriate 
// options than to return nothing" - Allow even 1 candidate
if (candidates.length === 0) {
  return {
    status: 'insufficient_products',
    message: `No matching products found for ${recipient.name}...`,
  };
}
```

### ✅ Recommendation

**Yes, implement the under-12 restriction.** It's a simple change with minimal risk.

**Requirements:**
1. Ensure Gem's Picks contains ≥10 products per child age bracket (0-4, 5-11)
2. Verify each age bracket has coverage across gender (boys/girls/unisex)
3. Ensure budget ranges are covered (£10-20, £20-40, £40-70)

---

## Question 3: Category Structure - Fixed Categories

### Client Request
> "Yes, please go ahead and build the fixed category structure (approved onboarding categories replacing open text), so products and recipient interests use exactly the same values."

### Current Implementation Status

**Current Interest System:**

**Taxonomy (`src/components/shared/taxonomy.js`):**
```javascript
export const CANONICAL_INTERESTS = [
  { key: "Cooking & food", ui: true, keywords: ["cook", "cooking", ...] },
  { key: "Wine & drinks", ui: true, keywords: ["wine", "champagne", ...] },
  { key: "Spirits & cocktails", ui: true, ... },
  { key: "Coffee & tea", ui: true, ... },
  // ... 30 total categories
];

export const STRUCTURED_INTERESTS = {
  "Food & Drink": {
    items: [
      { key: "Cooking & food", hasFollowUp: false },
      { key: "Wine & Drinks", hasFollowUp: true, 
        followUpOptions: ["Wine", "Beer", "Cocktails", "Whisky", "Gin", "Rum", "Tequila", "No particular preference"]
      },
      { key: "Coffee & tea", hasFollowUp: false },
    ]
  },
  "Lifestyle & Wellbeing": { ... },
  "Sport & Fitness": { ... },
  // ... 7 top-level categories
};
```

**How Recipients Store Interests (Database):**
```prisma
model Recipient {
  interests       String[]  // Array of interest keys
  interestsDetail Json?     // Structured: { interests: [], followUps: {}, otherText: "" }
}
```

**How Products Store Categories:**
```prisma
model Product {
  category        String?   // FREE TEXT! e.g. "Cooking > Kitchen Tools"
  interestTags    String[]  // Array of interest keys matching CANONICAL_INTERESTS
  giftTypeTags    String[]  // Array of gift type keys
  searchKeywords  String[]  // Additional keywords for matching
}
```

**Current Matching Logic (`product-matcher.js`):**
```javascript
// Interest matching happens via intelligent-matcher.js
// Uses fuzzy matching, keywords, and aliases from CANONICAL_INTERESTS
const matches = this.matcher.getMatchingTagsWithScores(product, recipient);
```

### ✅ Analysis

**Current State:**
- ✅ Recipients select from **fixed 30 categories** (CANONICAL_INTERESTS)
- ❌ Products use **free-text `category` field** (inconsistent)
- ✅ Products have `interestTags[]` array (which DOES match recipient interests)
- ✅ Matching works via `interestTags[]`, not `category` field

**What's Broken:**
1. Product `category` field is free text (e.g. "Cooking > Kitchen Tools", "Home & Garden", etc.)
2. No enforcement that product categories match recipient interest options
3. Admin UI allows any text in category field

**What Needs to Be Built:**

### 3.1 Database Migration
```prisma
model Product {
  category           String?   // Remove or keep for legacy?
  canonicalCategory  String?   // NEW: Must be one of CANONICAL_INTERESTS keys
  // Keep existing:
  interestTags       String[]  
  giftTypeTags       String[]
}
```

### 3.2 Frontend Changes

**Admin Product Form:**
```jsx
// Replace free text input with dropdown
<Select value={canonicalCategory} onChange={handleCategoryChange}>
  <SelectItem value="">Select category</SelectItem>
  {CANONICAL_INTERESTS.map(interest => (
    <SelectItem key={interest.key} value={interest.key}>
      {interest.key}
    </SelectItem>
  ))}
</Select>
```

**Onboarding Form:**
- ✅ Already uses fixed categories (no change needed)

### 3.3 Migration Script
```javascript
// scripts/migrate-product-categories.js

// 1. Map existing free-text categories to canonical keys
const categoryMapping = {
  "Cooking": "Cooking & food",
  "Kitchen": "Cooking & food",
  "Wine": "Wine & drinks",
  "Spirits": "Spirits & cocktails",
  "Travel": "Travel & adventure",
  "Wellness": "Wellness & self-care",
  "Fitness": "Fitness & sport",
  "Sport": "Fitness & sport",
  "Books": "Reading & books",
  "Art": "Art & culture",
  "Music": "Music",
  "Fashion": "Fashion & accessories",
  "Home": "Home & interiors",
  "Garden": "Gardening",
  "Tech": "Tech & gadgets",
  "Eco": "Sustainability & eco living",
  "Beauty": "Beauty & skincare",
  "Theatre": "Theatre & performing arts",
  "Crafts": "Crafts & making things",
  "DIY": "DIY & tools",
  "Photography": "Photography",
  "Outdoor": "Outdoor pursuits",
  "Gaming": "Gaming",
  "Film": "Film & TV",
  "TV": "Film & TV",
  "Cycling": "Cycling",
  "Family": "Children & family activities",
  // ... add more mappings
};

// 2. For each product:
//    - Parse free-text category
//    - Map to canonical key
//    - Update canonicalCategory field
//    - Also update interestTags[] to include canonical key

// 3. Flag products that couldn't be auto-mapped for manual review
```

### 3.4 Validation Middleware
```javascript
// server/middleware/validate-product.js

export function validateProductCategory(req, res, next) {
  const { canonicalCategory } = req.body;
  
  if (canonicalCategory) {
    const validCategories = CANONICAL_INTERESTS.map(i => i.key);
    
    if (!validCategories.includes(canonicalCategory)) {
      return res.status(400).json({
        error: 'Invalid category',
        message: `Category must be one of: ${validCategories.join(', ')}`
      });
    }
  }
  
  next();
}
```

### ✅ Effort Estimate

| Task | Time | Details |
|------|------|---------|
| **Database Migration** | 1 hour | Add `canonicalCategory` field, migrate schema |
| **Admin UI Updates** | 2 hours | Replace text input with dropdown, update all product forms |
| **Migration Script** | 4 hours | Map existing categories, handle edge cases, manual review queue |
| **API Validation** | 1 hour | Add middleware to enforce canonical categories |
| **Testing** | 2 hours | Test product creation/editing, verify matching still works |
| **Documentation** | 1 hour | Update admin docs, category list |
| **TOTAL** | **11 hours** | ~1.5 days of work |

**Budget Estimate:** £800-1200 (depending on hourly rate)

### How Difficult to Change in Future?

**Adding a New Category:**
1. Add to `CANONICAL_INTERESTS` in `taxonomy.js` (1 line)
2. Add to `STRUCTURED_INTERESTS` in appropriate group (1 line)
3. Deploy frontend (auto-updates onboarding form)
4. Admin can now tag products with new category

**Effort:** 15 minutes (very easy)

**Renaming an Existing Category:**
1. Update key in `CANONICAL_INTERESTS` (1 line)
2. Run database migration to update all products using old name:
   ```sql
   UPDATE products 
   SET canonical_category = 'New Name' 
   WHERE canonical_category = 'Old Name';
   ```
3. Update any hardcoded references in matching logic

**Effort:** 30 minutes + testing (easy)

**Removing a Category:**
1. Remove from `CANONICAL_INTERESTS`
2. Decide what to do with products tagged with removed category:
   - Option A: Set to NULL (product becomes uncategorized)
   - Option B: Remap to closest alternative category
3. Update recipient profiles using removed category

**Effort:** 1-2 hours (moderate - requires decision on data migration)

### ✅ Recommendation

**Yes, implement fixed category structure.** This will:
- ✅ Ensure consistent matching between recipient interests and product categories
- ✅ Improve data quality and reduce "no products found" errors
- ✅ Make future AI classification easier (clear target categories)
- ✅ Enable better reporting and analytics

**Critical:** This should be done BEFORE batch AI classification, so the AI knows which categories are valid.

---

## Question 4: Gender Filtering - How Is It Currently Applied?

### Client Question
> "Before I finalise the gender classification logic, can you explain how the gender tag is currently used in matching at each of the three tiers? Is it a hard filter (excludes non-matching products) or a weighted ranking signal alongside interest match, budget, etc.? Does it work the same way across all three tiers?"

### Current Implementation

**Gender is applied as a HARD FILTER at the database query level (BEFORE tiering):**

```javascript
// product-matcher.js line 88-96
// Gender filter logic (per client spec)
let genderFilter;
if (gender === 'MALE' || gender === 'Male') {
  genderFilter = { in: ['MALE', 'Male', 'MEN', 'Men', 'UNISEX', 'Unisex', 'UNISEX_ADULT', 'KIDS'] };
} else if (gender === 'FEMALE' || gender === 'Female') {
  genderFilter = { in: ['FEMALE', 'Female', 'WOMEN', 'Women', 'UNISEX', 'Unisex', 'UNISEX_ADULT', 'KIDS'] };
} else if (gender === 'NON_BINARY' || gender === 'PREFER_NOT_TO_SAY') {
  genderFilter = { in: ['UNISEX', 'Unisex', 'UNISEX_ADULT', 'KIDS'] };
} else {
  // Default: allow all if gender not specified
  genderFilter = undefined;
}

// line 123-127
// Build base filters (always applied)
const baseFilters = {
  status: 'ACTIVE',
  price: { gte: budgetMinWithMargin, lte: budgetMaxWithMargin },
  OR: [
    { qualityScore: { gte: this.MIN_QUALITY_SCORE } },
    { qualityScore: null }
  ],
};

// Add gender filter if defined (line 128-130)
if (genderFilter) {
  baseFilters.genderAppliesTo = genderFilter;
}
```

**This means:**

1. **Gender is a HARD FILTER (absolute exclusion)**
   - Products with mismatched gender NEVER enter the candidate pool
   - Happens at SQL query level, not in JavaScript
   - Applied BEFORE Tier 1, 2, and 3 matching begins

2. **Same Behavior Across All Tiers**
   - ✅ Tier 1 (Premium Curated + Interest Match): Gender filter applied
   - ✅ Tier 2 (All Curated + Interest Match): Gender filter applied
   - ✅ Tier 3 (Fallback - Any Source): Gender filter applied

3. **Unisex Products Always Included**
   - Male recipients see: Male + Unisex + Kids products
   - Female recipients see: Female + Unisex + Kids products
   - Non-binary recipients see: Only Unisex + Kids products

4. **No Scoring/Weighting**
   - Gender does NOT affect the relevance score
   - Products that pass gender filter are scored equally (based on interest/gift type match)
   - Unisex products are NOT penalized or boosted

### AI Layer (Optional Override)

**The AI selector DOES have gender-aware judgment:**

```javascript
// ai-gift-selector.js line 52-54
// GENDER-APPROPRIATE JUDGEMENT ON UNISEX ITEMS
// Some items tagged Unisex may still skew towards one gender in style or function. 
// Use your judgement: if the recipient is Female and a Unisex item is clearly 
// more masculine in style, deprioritise it in favour of better-suited alternatives. 
// This is about fit and thoughtfulness, not rigid rules. You may override the 
// Male/Female/Unisex tag itself — only use judgement within the Unisex category.
```

**This means:**
- Hard filter excludes mismatched products from reaching AI
- AI can deprioritize poorly-fitting Unisex products (but can't see excluded Male/Female items)

### ✅ Summary for Gemma

| Aspect | Current Behavior |
|--------|------------------|
| **Filter Type** | Hard filter (absolute exclusion) |
| **Applied When** | At database query level, before candidate pool is built |
| **Scope** | All three tiers (same behavior) |
| **Unisex Handling** | Always included for any gender |
| **AI Override** | Can deprioritize poorly-fitting Unisex items, but can't access excluded gendered products |
| **Scoring Impact** | None - gender doesn't affect relevance score |

### Client's Proposed Change

> "I'm thinking of moving towards a model where a strong interest match can override a gender tag mismatch (e.g. a girl with "football" as a stated interest shouldn't miss football products tagged for boys)."

**To Implement This:**

**Option A: Soft Gender Filter (Weighted Scoring)**
```javascript
// Remove gender from baseFilters (hard filter)
// Instead, apply scoring penalty for mismatched gender

scoreProduct(product, recipient) {
  let score = 0;
  
  // Interest matching (high value)
  if (matchesInterest) {
    score += 50;
  }
  
  // Gender matching (moderate penalty for mismatch)
  const genderMatch = this.checkGenderMatch(product, recipient);
  if (!genderMatch) {
    score -= 15; // Penalty, but not exclusion
  }
  
  return score;
}
```

**Result:**
- Football products tagged "Male" would still appear for girls interested in football
- But they'd score 15 points lower than "Female" or "Unisex" football products
- AI sees all products, makes final judgment based on fit

**Option B: Conditional Gender Filter (Interest-Based)**
```javascript
// Apply hard gender filter ONLY if no strong interest match exists

const hasStrongInterestMatch = recipientInterests.some(interest => 
  ['Football', 'Rugby', 'Tech & gadgets'].includes(interest)
);

if (!hasStrongInterestMatch) {
  baseFilters.genderAppliesTo = genderFilter; // Apply hard filter
}
// Otherwise, skip gender filter (allow all products)
```

**Result:**
- Recipients with "stereotypically gendered" interests (Football, Tech, Beauty, Fashion) see products regardless of gender tag
- Recipients without strong interests get gender-filtered results (safer)

**Option C: AI-Driven Gender Override (Prompt Change)**
```javascript
// Keep hard filter, but add AI prompt:

"GENDER OVERRIDE RULE:
If the recipient has a strong interest that traditionally skews opposite to their 
gender (e.g., Female + Football, Male + Beauty), you MAY include products tagged 
for the opposite gender IF they strongly match the stated interest. Use judgment: 
a football shirt is acceptable, but avoid obviously gendered styling (e.g., 
children's princess football kit for an adult woman)."
```

**Result:**
- Hard filter remains (cleaner SQL query)
- AI makes case-by-case decisions based on interest strength
- Requires AI to have access to opposite-gender products (would need to relax filter)

### ✅ Recommendation

**Option B: Conditional Gender Filter** is the best approach:
- Preserves performance (hard filter for most cases)
- Allows interest-driven exceptions
- No AI prompt changes needed
- Clear, predictable logic

**Effort:**
- **Implementation:** 2 hours (add conditional logic + testing)
- **Testing:** 2 hours (verify edge cases)
- **Total:** **4 hours** (~£300)

**Alternative:** Start with Option A (soft filter), measure performance impact. If slow, switch to Option B.

---

## Question 5: Category Schema - Single or Multiple Tags?

### Client Question
> "Can a product currently hold more than one category (primary + secondary), or is it a single field? Some products genuinely span two categories (e.g. a whisky gift hamper), and I want to know if the database supports a secondary field before I finalise the logic."

### Current Implementation

**Database Schema:**
```prisma
model Product {
  category        String?   // Single free-text field
  interestTags    String[]  // Array - can hold MULTIPLE interests
  giftTypeTags    String[]  // Array - can hold MULTIPLE gift types
  searchKeywords  String[]  // Array - additional keywords
}
```

### ✅ Answer

**No, the database does NOT support primary/secondary categories.**

**Current State:**
- `category`: Single text field (one category only)
- `interestTags[]`: **Array field - supports MULTIPLE interests** ← Use this!

**Example Product:**
```json
{
  "name": "Whisky & Chocolate Gift Hamper",
  "category": "Food & Drink",  // Single value
  "interestTags": [
    "Spirits & cocktails",     // ← Multiple values supported
    "Cooking & food"
  ],
  "giftTypeTags": [
    "Things to eat or drink",
    "Beautiful objects for the home"
  ]
}
```

### ✅ Recommendation

**Use `interestTags[]` for multiple category matching - no schema change needed.**

**Why This Works:**
1. ✅ `interestTags[]` is already an array (supports multiple values)
2. ✅ Matching logic already checks `interestTags[]` (not `category`)
3. ✅ No database migration required
4. ✅ Admin UI already allows multiple interest tags (checkbox list)

**If You Want Explicit Primary/Secondary:**

**Option A: Use first element as primary**
```javascript
// Convention: First tag = primary, rest = secondary
product.interestTags = [
  "Spirits & cocktails",  // ← Primary
  "Cooking & food"        // ← Secondary
];
```

**Option B: Add separate field (requires migration)**
```prisma
model Product {
  primaryCategory   String?   // Main category
  secondaryCategory String?   // Optional secondary
  interestTags      String[]  // Keep for multi-tag support
}
```

**Effort for Option B:**
- **Database Migration:** 1 hour
- **Admin UI Updates:** 2 hours (add secondary dropdown)
- **Matching Logic:** 1 hour (prioritize primary over secondary in scoring)
- **Total:** **4 hours** (~£300)

### ✅ Final Answer

**No new field needed.** Use `interestTags[]` which already supports multiple categories. This is the cleanest solution and requires zero development work.

---

## Question 6: Low-Confidence Products - Flag or Force?

### Client Question
> "For the batch classification, I'd like the AI to flag products it's not confident about, rather than force an assignment. Can you confirm: (1) Whether the batch process can output a confidence flag per product alongside its classification, (2) Whether a flagged product should be excluded from gift generation until I've reviewed it, or stay live with its best-guess tag while sitting in a review queue."

### Current Implementation

**AI Classification Endpoint:**
```javascript
// server/index.js line 2330-2393
app.post('/api/products/enrich-batch', requireAdmin, async (req, res) => {
  const { cursor, batch_size, categories, retailers, source_types } = req.body;
  
  // 1. Fetch products from database
  // 2. Send to Claude for enrichment (tags, description, quality score)
  // 3. Update database with results
});
```

**Current AI Response Format:**
```javascript
// From claude-client.js (enrichment response)
{
  "interest_tags": ["Cooking & food", "Coffee & tea"],
  "gift_type_tags": ["Things to eat or drink"],
  "description": "Enhanced product description",
  "quality_score": 85,
  "search_keywords": ["coffee", "maker", "espresso"]
}
```

**⚠️ No Confidence Field Currently Exists**

### ✅ Answer Part 1: Can Batch Process Output Confidence Flag?

**Yes, easily implementable.**

**Add to AI Prompt:**
```javascript
// claude-client.js enrichment prompt (add to response schema)

{
  "classification_confidence": {
    "type": "string",
    "enum": ["HIGH", "MEDIUM", "LOW"],
    "description": "HIGH: Clear category match based on name/description. 
                   MEDIUM: Reasonable guess, but ambiguous or spans multiple categories. 
                   LOW: Insufficient data or too generic to classify confidently."
  },
  "confidence_reasoning": {
    "type": "string",
    "description": "Brief explanation (1 sentence) why confidence is not HIGH. 
                   Example: 'Product name is vague' or 'Could fit multiple categories'."
  }
}
```

**Store in Database:**
```prisma
model Product {
  // Add new fields
  classificationConfidence String?   // HIGH, MEDIUM, LOW
  confidenceReasoning      String?   // Why AI wasn't confident
  
  // Existing AI field
  aiClassifications        Json?     // Store full AI response
}
```

**Effort:**
- **AI Prompt Update:** 30 minutes
- **Database Migration:** 30 minutes
- **API Changes:** 1 hour
- **Admin UI (display flags):** 1 hour
- **Testing:** 1 hour
- **Total:** **4 hours**

### ✅ Answer Part 2: Exclude or Keep Live?

**Recommended Approach: Keep Live + Review Queue**

**Why:**
1. ✅ Avoids "0 products found" errors (graceful degradation)
2. ✅ Allows system to still function while you review
3. ✅ Low-confidence products might still be suitable (AI is conservative)
4. ✅ You can review flagged products in batches (more efficient)

**Implementation:**

**Option A: Soft Exclusion (Scoring Penalty)**
```javascript
// product-matcher.js
scoreProduct(product, recipient) {
  let score = baseScore;
  
  // Penalize low-confidence products (but don't exclude)
  if (product.classificationConfidence === 'LOW') {
    score -= 20; // Heavy penalty
  } else if (product.classificationConfidence === 'MEDIUM') {
    score -= 10; // Moderate penalty
  }
  
  return score;
}
```

**Result:**
- Low-confidence products rank lower (appear last)
- AI selector sees them but likely skips in favor of higher-confidence items
- If nothing else available, they can still be used

**Option B: Hard Exclusion (Admin Review Required)**
```javascript
// product-matcher.js
const baseFilters = {
  status: 'ACTIVE',
  classificationConfidence: { not: 'LOW' }, // ← Exclude LOW confidence
  // ... rest of filters
};
```

**Result:**
- LOW confidence products completely hidden from gift generation
- Must be manually reviewed and re-classified before use
- Risk: "0 products found" if too many flagged

**Option C: Hybrid (Exclude Only If Sufficient Alternatives)**
```javascript
// product-matcher.js
async findMatchingProducts(recipient, prisma) {
  // First try: Exclude LOW confidence
  let candidates = await this.queryProducts({
    ...baseFilters,
    classificationConfidence: { not: 'LOW' }
  });
  
  // If insufficient products, include LOW confidence as last resort
  if (candidates.length < 10) {
    const lowConfidenceFallback = await this.queryProducts({
      ...baseFilters,
      classificationConfidence: 'LOW'
    });
    
    candidates = [...candidates, ...lowConfidenceFallback];
  }
  
  return candidates;
}
```

**Result:**
- Best of both worlds: Prefer high-confidence, fallback to low if needed
- Avoids "0 products" errors
- Flagged products still visible in admin for review

### ✅ Admin Review Queue

**Add to Admin Dashboard:**
```jsx
// AdminDashboard.jsx - New "Review Queue" tab

<Tab label="Review Queue (24 products)">
  <ProductReviewQueue
    filter={{ classificationConfidence: { in: ['LOW', 'MEDIUM'] } }}
    onApprove={async (productId, corrections) => {
      // Update product with corrections
      await api.patch(`/api/products/${productId}`, {
        interestTags: corrections.interestTags,
        giftTypeTags: corrections.giftTypeTags,
        classificationConfidence: 'HIGH', // ← Mark as reviewed
      });
    }}
    onReject={async (productId) => {
      // Mark as inactive or delete
      await api.patch(`/api/products/${productId}`, {
        status: 'INACTIVE'
      });
    }}
  />
</Tab>
```

**Features:**
- ✅ Bulk review (approve/reject multiple products)
- ✅ Sort by confidence level
- ✅ Filter by category
- ✅ Show AI's reasoning for low confidence
- ✅ Quick-edit tags without leaving queue

**Effort:**
- **Review Queue UI:** 4 hours
- **Bulk Actions API:** 2 hours
- **Testing:** 2 hours
- **Total:** **8 hours**

### ✅ Final Recommendation

**Implement Hybrid Approach (Option C) + Review Queue:**

1. ✅ **Batch Classification:** AI outputs confidence level + reasoning
2. ✅ **Matching Logic:** Prefer HIGH/MEDIUM confidence, fallback to LOW if needed
3. ✅ **Admin UI:** Review queue for flagged products (bulk edit)
4. ✅ **Status:** Flagged products stay ACTIVE (not excluded)

**Total Effort:**
- AI confidence output: 4 hours
- Hybrid matching logic: 2 hours
- Review queue UI: 8 hours
- **Total: 14 hours** (~£1,000-1,400)

---

## Question 7: Batch Test Scope - 300 Products

### Client Question
> "To confirm — I'd like the 300 product batch test run against the scraped catalogue only, not my curated Excel list, since that's already manually tagged by me."

### Current Implementation

**Product Source Types:**
```prisma
enum SourceType {
  CURATED_PRODUCT   // ← Gemma's Excel imports (manually tagged)
  CURATED_RETAILER  // ← Scraped from curated retailers
  SHOPIFY_UPLOAD    // ← Uploaded via Shopify
  LEGACY_UNKNOWN    // ← Old migration data
}
```

**Batch Enrichment Endpoint:**
```javascript
// server/index.js line 2332
app.post('/api/products/enrich-batch', requireAdmin, async (req, res) => {
  const { 
    cursor, 
    batch_size, 
    categories, 
    retailers, 
    source_types  // ← Filter by source type
  } = req.body;
  
  // Build WHERE clause
  const where = {
    status: 'ACTIVE',
  };
  
  if (source_types && source_types.length > 0) {
    where.sourceType = { in: source_types };
  }
  
  // Fetch batch
  const products = await prisma.product.findMany({
    where,
    skip: cursor,
    take: batch_size,
  });
  
  // Enrich with AI...
});
```

### ✅ Answer

**Yes, you can run batch test on scraped catalogue only.**

**API Call:**
```javascript
POST /api/products/enrich-batch
{
  "cursor": 0,
  "batch_size": 300,
  "source_types": [
    "CURATED_RETAILER",  // ← Scraped from curated retailers
    "LEGACY_UNKNOWN"     // ← Old scraped data (if any)
  ]
  // Exclude: "CURATED_PRODUCT" (your Excel list)
}
```

**This will:**
- ✅ Process only scraped products (skip your curated list)
- ✅ Take first 300 products matching the filter
- ✅ Run AI classification on them
- ✅ Update database with results

**To Verify Sample is Representative:**
```sql
-- Check distribution of scraped products
SELECT 
  COUNT(*) as total,
  sourceType,
  category
FROM products
WHERE sourceType IN ('CURATED_RETAILER', 'LEGACY_UNKNOWN')
  AND status = 'ACTIVE'
GROUP BY sourceType, category
ORDER BY total DESC;
```

**You might want to:**
- Sample across categories (not all 300 from "Cooking")
- Sample across price ranges (£10-20, £20-40, £40-70, £70+)
- Sample across retailers (avoid 300 from one retailer)

**Stratified Sampling Script:**
```javascript
// scripts/sample-products-for-batch-test.js

async function sampleProducts() {
  // Get 30 products from each of 10 major categories
  const categories = await prisma.product.groupBy({
    by: ['category'],
    where: {
      sourceType: { in: ['CURATED_RETAILER', 'LEGACY_UNKNOWN'] },
      status: 'ACTIVE'
    },
    _count: true,
    orderBy: { _count: { category: 'desc' } },
    take: 10
  });
  
  const sample = [];
  
  for (const cat of categories) {
    const products = await prisma.product.findMany({
      where: {
        category: cat.category,
        sourceType: { in: ['CURATED_RETAILER', 'LEGACY_UNKNOWN'] },
        status: 'ACTIVE'
      },
      take: 30,
      orderBy: { price: 'asc' } // Mix of price ranges
    });
    
    sample.push(...products);
  }
  
  return sample; // 300 products (30 per category)
}
```

### ✅ Excel Export for Review

**Current Export Process:**

**Option A: Direct Database Export**
```sql
-- Export to CSV (run in database client)
COPY (
  SELECT 
    id,
    name,
    category AS "Old Category",
    interest_tags AS "AI Interest Tags",
    gift_type_tags AS "AI Gift Type Tags",
    classification_confidence AS "Confidence",
    confidence_reasoning AS "Reasoning",
    price,
    retailer_id,
    product_url
  FROM products
  WHERE id IN (/* 300 batch test IDs */)
  ORDER BY classification_confidence, category
) TO '/tmp/batch-test-results.csv' WITH CSV HEADER;
```

**Option B: API Export Endpoint**
```javascript
// Add to server/index.js
app.get('/api/admin/export-batch-results', requireAdmin, async (req, res) => {
  const { product_ids } = req.query; // Comma-separated IDs
  
  const products = await prisma.product.findMany({
    where: { id: { in: product_ids.split(',') } },
    include: { retailer: true },
    orderBy: { classificationConfidence: 'asc' } // LOW first
  });
  
  // Convert to CSV
  const csv = convertToCSV(products, [
    'id',
    'name',
    'category',
    'interestTags',
    'giftTypeTags',
    'classificationConfidence',
    'confidenceReasoning',
    'price',
    'retailer.name',
    'productUrl'
  ]);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=batch-test-results.csv');
  res.send(csv);
});
```

**Option C: Admin UI Export Button**
```jsx
// AdminDashboard.jsx
<Button onClick={async () => {
  const response = await api.get('/api/admin/export-batch-results', {
    params: { product_ids: batchTestIds.join(',') }
  });
  
  // Trigger download
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'batch-test-results.csv';
  a.click();
}}>
  Export Batch Test Results (300 products)
</Button>
```

**Effort:**
- **Export API:** 2 hours
- **Admin UI Button:** 1 hour
- **Testing:** 1 hour
- **Total:** **4 hours**

### ✅ Final Answer

**Yes, run 300-product batch test on scraped catalogue only.**

**Process:**
1. ✅ Run batch enrichment with `source_types: ['CURATED_RETAILER', 'LEGACY_UNKNOWN']`
2. ✅ Export results to CSV via API or database query
3. ✅ Review in Excel (sort by confidence, category)
4. ✅ Approve/reject classifications in bulk
5. ✅ Re-run enrichment on rejected products with improved prompt

**No work needed** - API already supports this filter.

---

## Question 8: Recent Reclassification Changes

### Client Question
> "You mentioned you've reclassified more products and I should check again — before I do, can you tell me what changed and roughly how many products were affected?"

### Current Status

**I don't have access to your database or recent classification history.**

**To answer this question, you need to:**

1. **Check AI API Logs:**
```sql
SELECT 
  COUNT(*) as total_calls,
  DATE(created_at) as date,
  call_type
FROM ai_api_call_logs
WHERE call_type = 'PRODUCT_ENRICHMENT'
  AND created_at > '2026-09-01'  -- Last 18 days
GROUP BY DATE(created_at), call_type
ORDER BY date DESC;
```

2. **Check Product Update History:**
```sql
SELECT 
  COUNT(*) as products_updated,
  DATE(updated_at) as date
FROM products
WHERE updated_at > '2026-09-01'
  AND catalogue_enriched_at IS NOT NULL
GROUP BY DATE(updated_at)
ORDER BY date DESC;
```

3. **Check Specific Changes:**
```sql
-- Products enriched in last 7 days
SELECT 
  id,
  name,
  category,
  interest_tags,
  gift_type_tags,
  classification_confidence,
  catalogue_enriched_at,
  updated_at
FROM products
WHERE catalogue_enriched_at > NOW() - INTERVAL '7 days'
ORDER BY catalogue_enriched_at DESC
LIMIT 100;
```

### ✅ What You Should Look For

**1. Confidence Distribution:**
```sql
SELECT 
  classification_confidence,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM products
WHERE catalogue_enriched_at IS NOT NULL
GROUP BY classification_confidence;
```

**Expected:**
- HIGH: 60-80% (clear category matches)
- MEDIUM: 15-30% (ambiguous but reasonable)
- LOW: 5-15% (needs manual review)

**2. Category Coverage:**
```sql
SELECT 
  unnest(interest_tags) as interest,
  COUNT(*) as product_count
FROM products
WHERE catalogue_enriched_at IS NOT NULL
GROUP BY interest
ORDER BY product_count DESC;
```

**Check if:**
- All 30 canonical interest categories are represented
- No rogue categories (typos, old names)
- Distribution matches your catalogue focus

**3. Unclassified Products:**
```sql
-- Products still missing tags
SELECT 
  COUNT(*),
  source_type
FROM products
WHERE status = 'ACTIVE'
  AND (
    interest_tags IS NULL 
    OR interest_tags = '{}' 
    OR array_length(interest_tags, 1) = 0
  )
GROUP BY source_type;
```

### ✅ How to Compare Before/After

**If you want to track changes:**

1. **Take Snapshot Before:**
```javascript
// scripts/snapshot-product-classifications.js
const products = await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    category: true,
    interestTags: true,
    giftTypeTags: true,
    classificationConfidence: true,
    updatedAt: true
  }
});

fs.writeFileSync(
  'product-snapshot-2026-09-18.json',
  JSON.stringify(products, null, 2)
);
```

2. **Run Reclassification**

3. **Compare After:**
```javascript
// scripts/compare-classification-changes.js
const before = JSON.parse(fs.readFileSync('product-snapshot-2026-09-18.json'));
const after = await prisma.product.findMany({ /* same query */ });

const changes = [];

for (const oldProduct of before) {
  const newProduct = after.find(p => p.id === oldProduct.id);
  
  if (JSON.stringify(oldProduct.interestTags) !== JSON.stringify(newProduct.interestTags)) {
    changes.push({
      id: oldProduct.id,
      name: oldProduct.name,
      old: oldProduct.interestTags,
      new: newProduct.interestTags
    });
  }
}

console.log(`${changes.length} products changed`);
fs.writeFileSync('classification-changes.json', JSON.stringify(changes, null, 2));
```

### ✅ Final Answer

**I cannot tell you what changed without database access.**

**To find out:**
1. Run the SQL queries above to check:
   - How many products enriched recently
   - Confidence distribution
   - Category coverage
2. Export recent changes to Excel for review
3. Compare against your original curated tags (if you have them)

**Recommendation:** Set up a weekly classification report dashboard showing:
- Products enriched this week
- Confidence breakdown
- Category distribution
- Low-confidence items needing review

---

## Summary of All Answers

| Question | Answer | Work Required | Effort |
|----------|--------|---------------|--------|
| **1. Gender Categories** | ✅ Already Male/Female/Unisex | None | 0 hours |
| **2a. Gem's Picks Cleaned?** | ❓ Need to verify | Manual check | 1 hour |
| **2b. Under-12 Restriction** | ✅ Easy filter addition | Simple WHERE clause | 1.25 hours |
| **3. Fixed Categories** | ⚠️ Need full migration | Schema + UI + migration script | **11 hours** |
| **4. Gender Filtering** | Hard filter (all tiers) | Optional: Make it soft/conditional | 4 hours |
| **5. Multiple Categories** | ✅ Use interestTags[] array | None (already supported) | 0 hours |
| **6. Confidence Flagging** | ✅ Add to AI response + review queue | AI prompt + DB + UI | **14 hours** |
| **7. Batch Test Scope** | ✅ Filter by source_types | None (API ready) | 0 hours |
| **8. Recent Changes** | ❓ Need database access | Query database | 1 hour |
| **TOTAL EFFORT** | | | **32 hours** |

**Budget Estimate:** £2,400-3,200 (at £75-100/hour)

---

## Recommendations Priority

### Must Do Before Batch Classification:
1. ✅ **Fixed Category Structure (Q3)** - Ensures AI has clear target categories
2. ✅ **Confidence Flagging (Q6)** - Allows graceful handling of ambiguous products
3. ✅ **Verify Gem's Picks Cleanup (Q2a)** - Ensure under-12 restriction will work

### Can Do After:
4. ⏸️ **Gender Filter Adjustment (Q4)** - Test current hard filter first, adjust if needed
5. ⏸️ **Under-12 Restriction (Q2b)** - Implement once Gem's Picks is confirmed clean

### No Work Needed:
- ✅ Gender categories (Q1) - Already correct
- ✅ Multiple categories (Q5) - Use existing interestTags[]
- ✅ Batch test scope (Q7) - API ready
- ✅ Recent changes check (Q8) - Just query database

---

## Next Steps

**Week 1: Pre-Classification Prep**
1. Export and verify Gem's Picks cleanup (Q2a)
2. Implement fixed category structure (Q3)
3. Add confidence flagging to AI enrichment (Q6)

**Week 2: Batch Test**
4. Run 300-product test with confidence flags
5. Export to Excel for review
6. Measure accuracy and confidence distribution

**Week 3: Refinement**
7. Implement under-12 restriction if Gem's Picks sufficient (Q2b)
8. Adjust gender filtering if needed (Q4)
9. Build admin review queue for low-confidence products

**Week 4: Full Rollout**
10. Classify remaining catalogue
11. Monitor quality metrics
12. Iterate on AI prompt based on results

---

**Document End**

For questions or clarifications on any section, please refer to the specific question number and current implementation details provided above.
