# Gift Generation Improvements Plan

## Current Issues & Proposed Solutions

---

## 1. FORM DATA STRUCTURE IMPROVEMENTS

### Current Structure (Incomplete):
```javascript
{
  name: "Ben",
  gender: "MALE",
  ageBand: "THIRTY_ONE_TO_50",
  budget: { min: 50, max: 150 },
  interests: ["Cooking & food", "Watches"],  // Flat array ❌
  personality: ["Practical"],
  giftTypes: ["Experiences"],
  relationship: "Brother",
  avoidItems: "No chocolate"  // ❌ Missing "anythingElse" field
}
```

### Required Structure (Complete):
```javascript
{
  name: "Ben",
  gender: "MALE",
  ageBand: "THIRTY_ONE_TO_50",
  budget: { min: 50, max: 150 },
  
  // ✅ INTERESTS - Structured with categories + "Other" text
  interests: [
    "Cooking & food",
    "Wine & drinks",
    "Travel & adventure",
    "Other"  // This is a checkbox
  ],
  interestsOther: "Vintage car restoration",  // Free text when "Other" is checked
  
  // Alternative structured format (if using nested categories):
  interestsStructured: [
    {
      category: "Food & Drink",
      items: ["Cooking & food", "Wine & drinks", "Coffee & tea"]
    },
    {
      category: "Lifestyle",
      items: ["Travel & adventure", "Fitness & sport"]
    },
    {
      category: "Custom",
      items: ["Vintage car restoration"]  // From "Other" text field
    }
  ],
  
  // ✅ PERSONALITY - With "Other" support
  personality: [
    "Practical and no-nonsense",
    "Adventurous and spontaneous",
    "Other"
  ],
  personalityOther: "Deeply nostalgic",  // Free text when "Other" is checked
  
  // ✅ GIFT TYPES - With "Other" support
  giftTypes: [
    "Experiences",
    "Things to eat or drink",
    "Other"
  ],
  giftTypesOther: "Vintage memorabilia",  // Free text when "Other" is checked
  
  relationship: "Brother",
  
  // ✅ FREE TEXT FIELDS (both needed!)
  anythingElse: "He just moved into a new flat and loves hosting dinner parties",
  thingsToAvoid: "No chocolate (allergic), no cheap gadgets"
}
```

### Form Field Mapping:

**Current Form Has:**
1. `anythingElse` - Free text: "Anything else that would help me find the perfect gift?"
2. `thingsToAvoid` - Free text: "Things to avoid?"
3. `interests` - Checkboxes with "Other" option
4. `personality` - Checkboxes with "Other" option  
5. `giftTypes` - Checkboxes with "Other" option

**Database Schema Needs:**
```prisma
model Recipient {
  // ... existing fields
  
  interests          String[]   // Main checkboxes
  interestsOther     String?    // "Other" text field
  
  personality        String[]   // Main checkboxes
  personalityOther   String?    // "Other" text field
  
  giftTypes          String[]   @map("gift_types")
  giftTypesOther     String?    @map("gift_types_other")
  
  anythingElse       String?    @map("anything_else")
  thingsToAvoid      String?    @map("things_to_avoid")
}
```

---

## 2. INTELLIGENT INTEREST MATCHING

### Current Problem:
```javascript
// ❌ Exact string match only:
productTags.includes("Cooking & food")

// Fails for:
- "Cooking" (without "& food")
- "kooking" (typo)
- "Food and cooking" (different order)
- "Culinary" (synonym)
```

### Solution: Fuzzy + Semantic Matching

#### A. Use Taxonomy Keywords:
```javascript
// From taxonomy.js:
CANONICAL_INTERESTS = [
  { 
    key: "Cooking & food", 
    ui: true,
    keywords: ["cook", "cooking", "chef", "kitchen", "food", "recipe", "bake", "gourmet", "dining", "hamper"],
    aliases: ["food", "cooking", "food and drink"]
  },
  {
    key: "Wine & drinks",
    keywords: ["wine", "champagne", "prosecco", "sommelier"],
    aliases: ["drinks", "wine and drink"]
  }
]

// Matching logic:
function matchesInterest(productTag, recipientInterest) {
  const taxonomy = CANONICAL_INTERESTS.find(t => t.key === recipientInterest);
  
  const productLower = productTag.toLowerCase();
  
  // 1. Exact match (case-insensitive)
  if (productLower === recipientInterest.toLowerCase()) return true;
  
  // 2. Keyword match
  if (taxonomy?.keywords.some(kw => productLower.includes(kw))) return true;
  
  // 3. Alias match
  if (taxonomy?.aliases.some(alias => productLower === alias)) return true;
  
  // 4. Fuzzy similarity (Levenshtein distance)
  if (calculateSimilarity(productLower, recipientInterest.toLowerCase()) > 0.8) return true;
  
  return false;
}

// Examples that NOW match:
matchesInterest("Cooking", "Cooking & food") // ✅ true (keyword: "cook")
matchesInterest("Chef tools", "Cooking & food") // ✅ true (keyword: "chef")
matchesInterest("Culinary", "Cooking & food") // ✅ true (keyword match or AI classification)
matchesInterest("food and drink", "Cooking & food") // ✅ true (alias)
```

#### B. AI-Enhanced Classification:
```javascript
// For products without clear tags, use AI to classify
// During enrichment, ask Claude:
"Does this product relate to any of these interests?
Product: 'Premium Chef's Knife Set'
Interests: Cooking & food, Wine & drinks, Travel & adventure, ..."

// Claude returns:
{
  matches: ["Cooking & food"],
  confidence: 0.95,
  reasoning: "Chef's knife is clearly a cooking tool"
}

// Store in product:
product.aiClassifications = {
  interests: ["Cooking & food"],
  confidence: 0.95
}
```

---

## 3. TIER SYSTEM IMPROVEMENTS

### Current Problem:
```javascript
// ❌ Bad: If Tier 1 has 14 products, Tier 2 is called and might add 15 more
// Result: 14 GOOD products + 15 MEDIOCRE products = bad mix!

if (tier1.length < 15) {
  // Tier 2 adds products regardless of Tier 1 quality
  tier2Products = getTier2();
}
```

### Solution: ALWAYS Combine Tiers, Sort by Score

```javascript
// ✅ Good: Collect ALL tiers, sort by score, take top 50

async findMatchingProducts(recipient) {
  const allCandidates = [];
  
  // TIER 1: Curated + Interest Match
  const tier1 = await this.getTier1CuratedInterestMatch(recipient);
  tier1.forEach(p => {
    allCandidates.push({
      ...p,
      tier: 'TIER_1_CURATED_INTEREST',
      tierPriority: 1  // Highest priority
    });
  });
  
  console.log(`📦 TIER 1: Found ${tier1.length} curated products with interest match`);
  
  // TIER 2: Scraped + Interest Match (ALWAYS run, don't check tier 1 count)
  const tier2 = await this.getTier2ScrapedInterestMatch(recipient);
  tier2.forEach(p => {
    allCandidates.push({
      ...p,
      tier: 'TIER_2_SCRAPED_INTEREST',
      tierPriority: 2
    });
  });
  
  console.log(`📦 TIER 2: Found ${tier2.length} scraped products with interest match`);
  
  // TIER 3: General Fallback (ALWAYS run)
  const tier3 = await this.getTier3GeneralFallback(recipient);
  tier3.forEach(p => {
    allCandidates.push({
      ...p,
      tier: 'TIER_3_GENERAL_FALLBACK',
      tierPriority: 3  // Lowest priority
    });
  });
  
  console.log(`📦 TIER 3: Found ${tier3.length} general fallback products`);
  
  // Remove duplicates (same product in multiple tiers - keep higher tier)
  const uniqueProducts = this.deduplicateByProductId(allCandidates);
  
  // Score all products
  const scoredProducts = uniqueProducts.map(p => ({
    ...p,
    score: this.scoreProduct(p, recipient)
  }));
  
  // Sort by score (highest first), then by tier priority
  scoredProducts.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.tierPriority - b.tierPriority;  // Lower number = higher priority
  });
  
  console.log(`\n✅ TOTAL CANDIDATES: ${scoredProducts.length}`);
  console.log(`   Tier 1: ${scoredProducts.filter(p => p.tierPriority === 1).length}`);
  console.log(`   Tier 2: ${scoredProducts.filter(p => p.tierPriority === 2).length}`);
  console.log(`   Tier 3: ${scoredProducts.filter(p => p.tierPriority === 3).length}`);
  
  // Take top 50 for AI (will have mix of all tiers based on score)
  return scoredProducts.slice(0, 50);
}

deduplicateByProductId(products) {
  const seen = new Map();
  
  products.forEach(p => {
    const existing = seen.get(p.id);
    
    // Keep the one with higher priority (lower tierPriority number)
    if (!existing || p.tierPriority < existing.tierPriority) {
      seen.set(p.id, p);
    }
  });
  
  return Array.from(seen.values());
}
```

**Result:**
- If Tier 1 has 2 excellent products (score 45, 42)
- Tier 2 has 5 good products (score 38, 36, 34, 32, 30)
- Tier 3 has 100 mediocre products (score 15-25)

**Top 10 will be:**
1. Tier 1 product (score 45) ⭐⭐⭐
2. Tier 1 product (score 42) ⭐⭐⭐
3. Tier 2 product (score 38) ⭐⭐
4. Tier 2 product (score 36) ⭐⭐
5. Tier 2 product (score 34) ⭐⭐
6. Tier 2 product (score 32) ⭐⭐
7. Tier 2 product (score 30) ⭐⭐
8. Tier 3 product (score 25) ⭐
9. Tier 3 product (score 24) ⭐
10. Tier 3 product (score 23) ⭐

---

## 4. INTELLIGENT SCORING IMPROVEMENTS

### Current Scoring Problems:
```javascript
// ❌ Exact tag match only:
if (productInterestTags.includes(recipientInterest)) {
  score += 15;
}

// Misses:
- "eating" vs "food"
- "culinary" vs "cooking"
- "beverages" vs "drinks"
```

### Solution: Semantic + Fuzzy Scoring

```javascript
class IntelligentProductScorer {
  
  // 1. INTEREST MATCH SCORE (0-30 points)
  scoreInterestMatch(product, recipient) {
    let score = 0;
    const productTags = product.interestTags || [];
    const recipientInterests = recipient.interests || [];
    
    recipientInterests.forEach(recipientInterest => {
      productTags.forEach(productTag => {
        const matchQuality = this.getMatchQuality(productTag, recipientInterest);
        
        if (matchQuality === 'EXACT') score += 20;        // Perfect match
        else if (matchQuality === 'KEYWORD') score += 15; // Keyword match
        else if (matchQuality === 'ALIAS') score += 12;   // Alias match
        else if (matchQuality === 'FUZZY') score += 8;    // Similar spelling
        else if (matchQuality === 'SEMANTIC') score += 10; // AI detected similarity
      });
    });
    
    return Math.min(score, 30); // Cap at 30
  }
  
  getMatchQuality(productTag, recipientInterest) {
    const taxonomy = this.getTaxonomyFor(recipientInterest);
    const productLower = productTag.toLowerCase();
    const recipientLower = recipientInterest.toLowerCase();
    
    // 1. Exact match
    if (productLower === recipientLower) return 'EXACT';
    
    // 2. Keyword match from taxonomy
    if (taxonomy?.keywords.some(kw => productLower.includes(kw) || kw.includes(productLower))) {
      return 'KEYWORD';
    }
    
    // 3. Alias match
    if (taxonomy?.aliases.some(alias => productLower === alias || alias === recipientLower)) {
      return 'ALIAS';
    }
    
    // 4. Fuzzy string similarity (Levenshtein)
    const similarity = this.calculateSimilarity(productLower, recipientLower);
    if (similarity > 0.8) return 'FUZZY';
    
    // 5. Semantic similarity (word embeddings or AI classification)
    if (this.areSemanticallySimilar(productTag, recipientInterest)) {
      return 'SEMANTIC';
    }
    
    return 'NO_MATCH';
  }
  
  // Semantic similarity examples:
  areSemanticallySimilar(tag1, tag2) {
    const semanticPairs = {
      'eating': ['food', 'dining', 'cooking'],
      'beverages': ['drinks', 'wine', 'coffee'],
      'culinary': ['cooking', 'food', 'chef'],
      'wellness': ['self-care', 'spa', 'relaxation'],
      'fitness': ['sport', 'exercise', 'gym'],
      'literature': ['books', 'reading'],
      'travelling': ['travel', 'adventure', 'trip']
    };
    
    const tag1Lower = tag1.toLowerCase();
    const tag2Lower = tag2.toLowerCase();
    
    // Check if words are in the same semantic group
    for (const [key, synonyms] of Object.entries(semanticPairs)) {
      if ((key === tag1Lower || synonyms.includes(tag1Lower)) &&
          (key === tag2Lower || synonyms.includes(tag2Lower))) {
        return true;
      }
    }
    
    return false;
  }
  
  // Levenshtein distance for fuzzy matching
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}
```

### Scoring Example:

**Product:** "Premium Chef's Cooking Set"  
**Product Tags:** `['Culinary', 'Kitchen essentials']`

**Recipient:** Ben  
**Interests:** `['Cooking & food', 'Wine & drinks']`

**Current System:**
```javascript
// ❌ Score = 0 (no exact match)
'Culinary' !== 'Cooking & food'
'Kitchen essentials' !== 'Cooking & food'
```

**New Intelligent System:**
```javascript
// ✅ Score calculation:

1. "Culinary" vs "Cooking & food":
   - Check keywords: ['cook', 'cooking', 'chef', 'kitchen', 'food']
   - "Culinary" → semantic match with "cooking" → SEMANTIC match
   - Score: +10 points

2. "Kitchen essentials" vs "Cooking & food":
   - Check keywords: ['cook', 'cooking', 'chef', 'kitchen', 'food']
   - "Kitchen" found in keywords → KEYWORD match
   - Score: +15 points

Total Interest Score: 25 points (out of 30) ✅
```

---

## 5. IMPLEMENTATION FILES TO MODIFY

### A. Database Schema (`prisma/schema.prisma`):
```prisma
model Recipient {
  // Add new fields:
  interestsOther     String?    @map("interests_other")
  personalityOther   String?    @map("personality_other")
  giftTypesOther     String?    @map("gift_types_other")
}
```

### B. Form Component (`src/components/onboarding/PersonForm.jsx`):
```javascript
// Already has "Other" support in CheckboxGroup component
// Just need to store the "Other" text fields separately

const [interestsOther, setInterestsOther] = useState("");
const [personalityOther, setPersonalityOther] = useState("");
const [giftTypesOther, setGiftTypesOther] = useState("");

// When saving:
await createRecipient({
  ...formData,
  interestsOther,
  personalityOther,
  giftTypesOther
});
```

### C. Product Matcher (`server/services/gifts/product-matcher.js`):
```javascript
// Replace simple interest matching with intelligent matching:
import { IntelligentMatcher } from './intelligent-matcher.js';

const matcher = new IntelligentMatcher();

// In tier filtering:
const tier1WithInterest = tier1All.filter(product => 
  matcher.hasInterestMatch(product, recipient)
);
```

### D. Create New File (`server/services/gifts/intelligent-matcher.js`):
```javascript
// All the intelligent matching logic
export class IntelligentMatcher {
  hasInterestMatch(product, recipient) { ... }
  getMatchQuality(productTag, recipientInterest) { ... }
  calculateSimilarity(str1, str2) { ... }
  areSemanticallySimilar(tag1, tag2) { ... }
}
```

### E. Product Scorer (`server/services/gifts/product-scorer.js`):
```javascript
// Replace exact matching with intelligent scoring
import { IntelligentScorer } from './intelligent-scorer.js';

const scorer = new IntelligentScorer();

scoreProduct(product, recipient) {
  return scorer.scoreProduct(product, recipient);
}
```

---

## SUMMARY OF CHANGES NEEDED

### ✅ **Priority 1: Form Data Structure**
1. Add `interestsOther`, `personalityOther`, `giftTypesOther` fields to schema
2. Update form to capture and save "Other" text inputs
3. Ensure `anythingElse` is properly saved (already in schema)

### ✅ **Priority 2: Tier System**
1. Always run all 3 tiers (don't check counts)
2. Combine all candidates
3. Sort by score (not by tier)
4. Deduplicate by product ID (keep higher tier)

### ✅ **Priority 3: Intelligent Matching**
1. Create taxonomy-based keyword matching
2. Add fuzzy string matching (Levenshtein)
3. Add semantic similarity (word relationships)
4. Use in tier filtering

### ✅ **Priority 4: Intelligent Scoring**
1. Weight matches by quality (exact > keyword > fuzzy > semantic)
2. Add points for partial matches
3. Consider "Other" text fields in matching

---

## EXPECTED IMPROVEMENTS

**Before:**
- Ben interests: `['Cooking & food']`
- Products with tag `'Culinary'`: 0 matches ❌
- Products with tag `'Kitchen'`: 0 matches ❌
- Result: 0 Tier 1 products

**After:**
- Ben interests: `['Cooking & food', 'Vintage cars' (from Other)]`
- Products with tag `'Culinary'`: ✅ SEMANTIC match (+10 points)
- Products with tag `'Kitchen'`: ✅ KEYWORD match (+15 points)
- Products with tag `'Chef'`: ✅ KEYWORD match (+15 points)
- Products with keyword `'vintage'` or `'car'`: ✅ CUSTOM match (+8 points)
- Result: 50+ Tier 1 products with varying scores

**Quality:**
- Top 10 gifts: Mix of highest-scoring products from all tiers
- Better relevance through intelligent matching
- Captures user's custom interests from "Other" fields
