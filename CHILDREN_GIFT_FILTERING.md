# Children Gift Filtering Rules

## Overview
Special filtering rules for children recipients (ages 1-11) to ensure they ONLY receive age-appropriate Gem's Picks from the Children category.

---

## Age Band Classification

### Children (Ages 1-11)
**Age Bands**: `"1-2"`, `"3-4"`, `"5-6"`, `"7-8"`, `"9-11"`

**Product Requirements**:
- ✅ **Source**: MUST be `CURATED_PRODUCT` (Gem's Picks ONLY)
- ✅ **Category**: MUST start with `"Children"` 
- ✅ **Age Band**: Must match recipient's age band
- ❌ **No other sources allowed** (no CURATED_RETAILER, no SHOPIFY_UPLOAD, no LEGACY_UNKNOWN)

### Teens/Adults (Ages 12+)
**Age Bands**: `"12-17"`, `"18-25"`, `"26-35"`, `"36-45"`, `"46-55"`, `"56-65"`, `"66-75"`, `"75+"`

**Product Requirements**:
- ✅ **Source**: ANY source allowed (all tiers)
- ✅ **Category**: No category restrictions
- ✅ **Age Band**: Must match recipient's age band

---

## Category Structure

### For Children Products (Ages 1-11)
**Format**: `Children > {age-band} [> subcategory]`

**Examples**:
```
Children > 1-2
Children > 3-4 > Toys
Children > 5-6 > Books
Children > 7-8 > Games > Board Games
Children > 9-11 > Sports
```

**Why age band in category?**
- Makes it easy to browse products by age in admin UI
- Shows age suitability at a glance
- Aligns with onboarding age selection

### For Teen/Adult Products (Ages 12+)
**Format**: `{Category} > {Subcategory} > {Sub-subcategory}`

**Examples**:
```
Fashion > Accessories
Home & Living > Kitchen > Cookware
Sports & Outdoors > Fitness
Creative & Culture > Reading & books
```

**No age band in category** because:
- Age bands stored in `suitableAgeBands` field
- One product can suit multiple adult age ranges
- Category represents interest/type, not age

---

## Filtering Logic

### Step 1: Base Filters (All Recipients)
```javascript
baseFilters = {
  status: 'ACTIVE',
  price: { gte: budgetMin * 0.95, lte: budgetMax * 1.05 },
  genderAppliesTo: genderFilter,
  qualityScore: { gte: 50 } or null
}
```

### Step 2: Children-Specific Filters (Ages 1-11 ONLY)
```javascript
if (isChild) {
  baseFilters.sourceType = 'CURATED_PRODUCT';  // ONLY Gem's Picks
  baseFilters.category = { startsWith: 'Children' }; // ONLY Children category
}
```

### Step 3: Tier-Based Product Fetching

#### TIER 1: Premium CURATED_PRODUCT + Interest Match
- **Children**: Already restricted to CURATED_PRODUCT + Children category
- **Teens/Adults**: Adds CURATED_PRODUCT restriction
- **Filter**: Interest matching applied
- **Result**: High-quality, interest-matched products

#### TIER 2: All Curated Products + Interest Match
- **Children**: ⏭️ **SKIPPED** (already got all Gem's Picks in Tier 1)
- **Teens/Adults**: Includes CURATED_RETAILER + SHOPIFY_UPLOAD
- **Filter**: Interest matching applied
- **Result**: Broader curated selection

#### TIER 3: Fallback - All Products (No Interest Match)
- **Children**: ⏭️ **SKIPPED** (only Gem's Picks allowed)
- **Teens/Adults**: Includes LEGACY_UNKNOWN + all sources
- **Filter**: No interest requirement
- **Result**: Graceful degradation when interests don't match

### Step 4: Age Band Overlap Filtering
```javascript
// After fetching, filter by age band overlap
products.filter(product => {
  const productAgeBands = product.suitableAgeBands || [];
  return doAgeRangesOverlap(recipientAgeBand, productAgeBands);
});
```

**Example**:
- Recipient: `"5-6"`
- Product age bands: `["5-6", "7-8"]`
- Result: ✅ Match (recipient's 5-6 overlaps with product's 5-6)

### Step 5: Scoring & Diversity Sampling
- Score products based on interest match, quality, budget
- Apply diversity sampling to ensure variety in categories
- Top 20 candidates sent to AI for final selection

---

## Example Scenarios

### Scenario 1: Child Recipient (Age 5-6, Interested in Dinosaurs)
```
Recipient:
  - Age: 5-6
  - Interests: ["Dinosaurs", "Animals", "Books"]
  - Budget: £20-£40

Filtering Result:
  ✅ TIER 1: 15 Gem's Picks from Children category with dinosaur/animal tags
  ⏭️  TIER 2: SKIPPED (children only get Gem's Picks)
  ⏭️  TIER 3: SKIPPED (children only get Gem's Picks)
  
Final Candidates: 15 products (all CURATED_PRODUCT from Children category)
```

### Scenario 2: Teen Recipient (Age 12-17, Interested in Gaming)
```
Recipient:
  - Age: 12-17
  - Interests: ["Video Games", "Technology", "Sports"]
  - Budget: £30-£60

Filtering Result:
  ✅ TIER 1: 8 Gem's Picks with gaming tags
  ✅ TIER 2: 12 curated products (CURATED_RETAILER + SHOPIFY_UPLOAD) with gaming tags
  ✅ TIER 3: Not needed (Tier 1+2 sufficient)
  
Final Candidates: 20 products (mixed sources, all with age band 12-17)
```

### Scenario 3: Adult Recipient (Age 26-35, Interested in Cooking)
```
Recipient:
  - Age: 26-35
  - Interests: ["Cooking", "Home & Living", "Food & Drink"]
  - Budget: £40-£80

Filtering Result:
  ✅ TIER 1: 6 Gem's Picks with cooking tags
  ✅ TIER 2: 14 curated products with cooking tags
  ✅ TIER 3: Not needed (Tier 1+2 sufficient)
  
Final Candidates: 20 products (mixed sources, all with age band 26-35)
```

---

## Why These Rules?

### For Children (1-11):
1. **Safety**: Only manually curated products from Gem
2. **Quality**: Gem personally vets every children's product
3. **Age-Appropriate**: Children category ensures content suitable for kids
4. **Trust**: Parents trust Gem's Picks for their children
5. **Consistency**: All children's gifts maintain high quality standard

### For Teens/Adults (12+):
1. **Variety**: Access to full catalogue (all sources)
2. **Flexibility**: Can find niche interests across all sources
3. **Scalability**: Larger product pool for diverse interests
4. **Graceful Degradation**: Tiers allow fallback if interests don't match

---

## Database Query Examples

### Children Query (Age 5-6)
```sql
SELECT * FROM Product
WHERE status = 'ACTIVE'
  AND price BETWEEN 19 AND 42
  AND sourceType = 'CURATED_PRODUCT'
  AND category LIKE 'Children%'
  AND genderAppliesTo IN ('UNISEX', 'MALE', 'KIDS')
  AND '5-6' = ANY(suitableAgeBands)
ORDER BY qualityScore DESC
LIMIT 200;
```

### Teen Query (Age 12-17, Tier 1)
```sql
SELECT * FROM Product
WHERE status = 'ACTIVE'
  AND price BETWEEN 28.50 AND 63
  AND sourceType = 'CURATED_PRODUCT'
  AND genderAppliesTo IN ('UNISEX', 'MALE')
  AND '12-17' = ANY(suitableAgeBands)
ORDER BY qualityScore DESC
LIMIT 200;
```

---

## Verification Checklist

To verify children filtering is working:

- [ ] Check logs show "CHILD (1-11) - Gem's Picks + Children category ONLY"
- [ ] Verify TIER 2 and TIER 3 are skipped for children
- [ ] Confirm all products have `sourceType = 'CURATED_PRODUCT'`
- [ ] Confirm all products have `category` starting with `"Children"`
- [ ] Verify age band overlap check works correctly
- [ ] Test with actual child recipient and verify gift list quality

---

## Troubleshooting

### Problem: No products found for child recipient
**Check**:
1. Are there Gem's Picks in Children category with matching age band?
2. Does the budget match available children's products?
3. Check `suitableAgeBands` are set correctly on children's products

### Problem: Non-Gem's Pick appearing for child
**Check**:
1. Verify `baseFilters` includes `sourceType: 'CURATED_PRODUCT'`
2. Check TIER 2 and TIER 3 are properly skipped (`!isChild` condition)
3. Review product's `sourceType` in database

### Problem: Adult product appearing for child
**Check**:
1. Verify `baseFilters` includes `category: { startsWith: 'Children' }`
2. Check product's category field in database
3. Verify age band overlap logic working correctly

---

**Implementation Date**: September 21, 2026  
**Status**: ✅ Active  
**Applies To**: Gift generation for all children recipients (ages 1-11)
