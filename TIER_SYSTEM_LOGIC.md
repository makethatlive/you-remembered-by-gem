# Smart Tier System Logic - CORRECTED

## Overview

**Goal:** Get 30 candidates efficiently without unnecessary database queries.

**Strategy:** Progressive tier loading with early stopping.

---

## Flow Chart

```
START
  ↓
[Tier 1: Curated + Interest]
  ↓
Count >= 30? ─── YES ──→ STOP (Skip Tier 2 & 3)
  ↓ NO
[Tier 2: Scraped + Interest]
  ↓
Count >= 30? ─── YES ──→ STOP (Skip Tier 3)
  ↓ NO
[Tier 3: General Fallback]
  ↓
Combine ALL fetched tiers
  ↓
Sort by SCORE (then tier priority)
  ↓
Return top 50
```

---

## Detailed Logic

### Step 1: Tier 1 - Curated + Interest Match

```javascript
const TARGET_CANDIDATES = 30;

// Fetch curated products
const tier1Products = await prisma.product.findMany({
  where: {
    status: 'ACTIVE',
    sourceType: 'CURATED_PRODUCT',
    price: { gte: budgetMin, lte: budgetMax },
    genderAppliesTo: { in: ['MALE', 'UNISEX', ...] },
    OR: [
      { qualityScore: { gte: 50 } },
      { qualityScore: null }
    ]
  },
  take: 200
});

// Filter by interest (intelligent matching)
const tier1Filtered = tier1Products.filter(p => 
  intelligentMatcher.hasInterestMatch(p, recipient)
);

// Score and validate
const tier1Scored = tier1Filtered
  .filter(isValidProduct)
  .map(p => ({ ...p, score, tier: 'CURATED_INTEREST', tierPriority: 1 }));

console.log(`Tier 1: Found ${tier1Scored.length} products`);
```

**Decision Point:**
```javascript
if (tier1Scored.length >= 30) {
  console.log('✅ TIER 2: Skipped (Tier 1 sufficient)');
  console.log('✅ TIER 3: Skipped (Tier 1 sufficient)');
  // Skip Tier 2 and 3 entirely!
  return tier1Scored.slice(0, 50);
}
```

---

### Step 2: Tier 2 - Scraped + Interest Match

**Only runs if:** `tier1Scored.length < 30`

```javascript
if (tier1Scored.length < 30) {
  console.log(`📦 TIER 2: Need ${30 - tier1Scored.length} more`);
  
  // Fetch scraped products
  const tier2Products = await prisma.product.findMany({
    where: {
      // Same filters as Tier 1
      sourceType: { in: ['CURATED_RETAILER', 'SHOPIFY_UPLOAD'] }
    },
    take: 300
  });
  
  // Filter by interest (intelligent matching)
  const tier2Filtered = tier2Products.filter(p =>
    intelligentMatcher.hasInterestMatch(p, recipient)
  );
  
  // Score and validate
  const tier2Scored = tier2Filtered
    .filter(isValidProduct)
    .map(p => ({ ...p, score, tier: 'SCRAPED_INTEREST', tierPriority: 2 }));
  
  console.log(`Tier 2: Found ${tier2Scored.length} products`);
}
```

**Decision Point:**
```javascript
const totalSoFar = tier1Scored.length + tier2Scored.length;

if (totalSoFar >= 30) {
  console.log('✅ TIER 3: Skipped (Tier 1+2 sufficient)');
  // Skip Tier 3!
  return [...tier1Scored, ...tier2Scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}
```

---

### Step 3: Tier 3 - General Fallback

**Only runs if:** `tier1Scored.length + tier2Scored.length < 30`

```javascript
const totalSoFar = tier1Scored.length + tier2Scored.length;

if (totalSoFar < 30) {
  console.log(`📦 TIER 3: Need ${30 - totalSoFar} more (fallback)`);
  
  // Fetch ANY products (no interest filter)
  const tier3Products = await prisma.product.findMany({
    where: {
      // Same filters, BUT no interest requirement
      status: 'ACTIVE',
      price: { gte: budgetMin, lte: budgetMax },
      genderAppliesTo: { in: [...] }
    },
    take: 200
  });
  
  // Exclude already found products
  const existingIds = [...tier1Scored, ...tier2Scored].map(p => p.id);
  const tier3Unique = tier3Products.filter(p => !existingIds.includes(p.id));
  
  // Score with penalty
  const tier3Scored = tier3Unique
    .filter(isValidProduct)
    .map(p => ({ 
      ...p, 
      score: score * 0.85,  // 15% penalty for no interest match
      tier: 'GENERAL_FALLBACK', 
      tierPriority: 3 
    }));
  
  console.log(`Tier 3: Found ${tier3Scored.length} products`);
} else {
  console.log('✅ TIER 3: Skipped (Tier 1+2 sufficient)');
}
```

---

## Final Assembly

```javascript
// Combine all fetched tiers
const allCandidates = [...tier1Scored, ...tier2Scored, ...tier3Scored];

// Deduplicate (shouldn't be needed, but safety check)
const unique = deduplicateByProductId(allCandidates);

// Filter by minimum threshold
const filtered = unique.filter(p => {
  if (p.tier === 'GENERAL_FALLBACK') return p.score >= 3;
  return p.score >= 15;
});

// Sort: SCORE first, then tier priority
const sorted = filtered.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;  // Higher score wins
  return a.tierPriority - b.tierPriority;  // Lower priority number wins
});

// Return top 50 for AI
return sorted.slice(0, 50);
```

---

## Example Scenarios

### Scenario 1: Abundant Tier 1 (Best Case)

```
Tier 1: 45 products ✅
  → Skip Tier 2 ✅
  → Skip Tier 3 ✅
  
Result: 45 high-quality, interest-matched products
Queries: 1 (only Tier 1)
Time: ~2 seconds
```

### Scenario 2: Tier 1 + Tier 2 Sufficient

```
Tier 1: 8 products (need 22 more)
  → Run Tier 2
Tier 2: 25 products ✅
  → Skip Tier 3 ✅

Total: 33 products (8 + 25)
Result: Good mix of curated + scraped, all interest-matched
Queries: 2 (Tier 1 + 2)
Time: ~5 seconds
```

### Scenario 3: Need All Tiers

```
Tier 1: 2 products (need 28 more)
  → Run Tier 2
Tier 2: 5 products (need 23 more)
  → Run Tier 3
Tier 3: 30 products

Total: 37 products (2 + 5 + 30)
Result: Mix of all tiers, sorted by score
Queries: 3 (all tiers)
Time: ~8 seconds
```

### Scenario 4: Edge Case - Ben (Before Fix)

**BEFORE (Old System):**
```
Tier 1: 0 products (exact match only)
  → Run Tier 2
Tier 2: 0 products (exact match only)
  → Run Tier 3
Tier 3: 10 products (pyjamas, jewelry - unrelated)

Result: ❌ 0% interest match
```

**AFTER (Intelligent Matching):**
```
Tier 1: 23 products (intelligent matching finds "culinary", "chef", "kitchen")
  → Skip Tier 2 ✅ (not needed)
  → Skip Tier 3 ✅ (not needed)

Result: ✅ 100% interest match, 1 query only!
```

---

## Performance Optimization

### Query Reduction:

**Old System:**
- Always ran 2-3 queries (Tier 1, 2, sometimes 3)
- Average: 2.5 queries per generation

**New System:**
- 1 query if Tier 1 sufficient (most common after intelligent matching)
- 2 queries if Tier 1 + 2 sufficient
- 3 queries only when really needed

**Estimated Savings:**
- 40% reduction in database queries
- 30% faster generation time on average

---

## Console Output Examples

### Sufficient Tier 1:
```
📦 TIER 1: Curated products with interest match
   Found 45 curated products with interest match

✅ TIER 2: Skipped (Tier 1 has 45 products - sufficient)
✅ TIER 3: Skipped (Tier 1 has 45 products - sufficient)

✅ FINAL CANDIDATE POOL:
   Tier 1 (Curated+Interest): 45
   Tier 2 (Scraped+Interest): 0
   Tier 3 (General Fallback): 0
   Total: 45
```

### Need Tier 2:
```
📦 TIER 1: Curated products with interest match
   Found 8 curated products with interest match

📦 TIER 2: Scraped products with interest match (need 22 more)
   Found 25 scraped products with interest match

✅ TIER 3: Skipped (Tier 1+2 have 33 products - sufficient)

✅ FINAL CANDIDATE POOL:
   Tier 1 (Curated+Interest): 8
   Tier 2 (Scraped+Interest): 25
   Tier 3 (General Fallback): 0
   Total: 33
```

### Need All Tiers:
```
📦 TIER 1: Curated products with interest match
   Found 2 curated products with interest match

📦 TIER 2: Scraped products with interest match (need 28 more)
   Found 5 scraped products with interest match

📦 TIER 3: General fallback (need 23 more)
   ⚠️  Relaxing interest requirements - graceful degradation
   Found 30 general products

✅ FINAL CANDIDATE POOL:
   Tier 1 (Curated+Interest): 2
   Tier 2 (Scraped+Interest): 5
   Tier 3 (General Fallback): 30
   Total: 37
```

---

## Why This Approach is Better

### ✅ **Efficiency**
- Stop early when you have enough
- Don't fetch Tier 3 if Tier 1+2 are good
- Saves database queries and processing time

### ✅ **Quality Priority**
- Try best quality first (Tier 1)
- Only degrade to Tier 2 if needed
- Only use fallback (Tier 3) as last resort

### ✅ **Smart Sorting**
- Sort by SCORE across all tiers
- If Tier 2 product has higher score than Tier 1, it appears first
- But we prioritize FETCHING Tier 1 first (efficiency)

### ✅ **Example:**
```
Tier 1 products:
  - Score 45 (excellent match)
  - Score 42 (great match)
  
Tier 2 products (only fetched if Tier 1 < 30):
  - Score 48 (amazing match!) ← This beats Tier 1!
  - Score 38 (good match)
  
Sorting result:
1. Tier 2 - Score 48  ← Best score wins!
2. Tier 1 - Score 45
3. Tier 1 - Score 42
4. Tier 2 - Score 38
```

---

## Summary

1. **Always try Tier 1 first** (best quality)
2. **Stop if you have 30+** (no unnecessary queries)
3. **Try Tier 2 only if needed** (good quality backup)
4. **Stop again if Tier 1+2 = 30+**
5. **Try Tier 3 only as last resort** (fallback)
6. **Sort ALL by score** (best products rise to top regardless of tier)

**Result:** Fast, efficient, high-quality candidate selection! ⚡
