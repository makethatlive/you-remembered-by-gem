# Product Enrichment Explanation - "Not enriched" Issue

## What You're Seeing

In the **Products → Review tab**, products associated with "Aadornattire" are labeled **"Not enriched"**, but when you go to **Retailers tab** and click **"Enrich"** for that retailer, it says:

```
"Aadornattire: enriched 0 product(s). 0 still need enrichment."
```

This seems contradictory, but it's actually correct behavior. Let me explain why.

---

## What is "Enrichment"?

**Product Enrichment** is a two-track process that adds metadata to products:

### **Track 1: Deterministic Enrichment (FREE)**
- Fetches product descriptions from URLs
- Matches interest tags (Arts, Books, Sports, etc.)
- Matches gift type tags (Experience, Keepsake, Edible, etc.)
- Generates search keywords
- Calculates quality scores (0-100)
- Identifies quality flags (missing_image, junk_title, etc.)
- **Stamps:** `catalogue_enriched_at` timestamp

### **Track 2: AI Classification (COSTS MONEY - Optional)**
- Uses Claude API to classify:
  - **Category**: Wine & drinks, Arts & crafts, etc.
  - **Gender**: men, women, unisex
  - **Age bands**: Under 5, 5-10, 11-17, 18+
  - **Age restricted**: true/false (alcohol, knives, etc.)
- **Stamps:** `ai_classifications` object with version and timestamp

---

## What "Not enriched" Means

The **"Not enriched"** label specifically refers to **Track 1** (deterministic enrichment). A product is considered "Not enriched" when:

```javascript
!product.catalogue_enriched_at ||
!Array.isArray(product.interest_tags) || 
!Array.isArray(product.gift_type_tags) ||
!Number.isFinite(product.quality_score)
```

**Translation:** The product is missing the basic enrichment timestamp, tags, or quality score.

---

## Why It Says "0 products need enrichment"

When you click **"Enrich"** on a retailer, the enrichment service checks products with:

1. **Retailer ID** matches "Aadornattire"
2. **Status** is either:
   - `ACTIVE` (live in catalogue)
   - `NEEDS_REVIEW` (awaiting admin approval)

### The Key Issue: Status Filter Mismatch

The enrichment process **only processes products** with these statuses:
- ✅ **ACTIVE** - Products that are live
- ✅ **NEEDS_REVIEW** - Products awaiting review

But your "Aadornattire" products showing "Not enriched" might be:
- ❌ **INACTIVE** - Marked as dead/retired
- ❌ **REPORTED_BROKEN** - Reported by users as broken

**Result:** The enrichment service sees **0 products** that need enrichment (because they're not in ACTIVE or NEEDS_REVIEW status), even though products exist with missing enrichment data.

---

## From Original base44 Code

Here's the exact logic from your original base44 implementation:

```typescript
const retailerId = typeof body.retailer_id === "string" && body.retailer_id.trim() 
  ? body.retailer_id.trim() 
  : null;

const products = retailerId
  ? [
      // Per-retailer mode: fetch ACTIVE + NEEDS_REVIEW
      ...(await svc.entities.Product.filter(
        { retailer_id: retailerId, status: "active" }, 
        "created_date", 
        5000
      )),
      ...(await svc.entities.Product.filter(
        { retailer_id: retailerId, status: "needs_review" }, 
        "created_date", 
        5000
      )),
    ]
  : // Global mode: fetch ACTIVE only
    await svc.entities.Product.filter(
      { status: "active" }, 
      "created_date", 
      5000
    );

// Then filter for products that need enrichment
const needsWork = products.filter((product) =>
  !product.catalogue_enriched_at ||
  !Array.isArray(product.interest_tags) || 
  !Array.isArray(product.gift_type_tags) ||
  !Number.isFinite(Number(product.quality_score))
);
```

**Key Point:** Enrichment **deliberately excludes INACTIVE and REPORTED_BROKEN products** because:
1. Inactive products won't be shown to users
2. Enriching dead products wastes resources (API calls, processing time)
3. You should fix/recover products FIRST, then enrich them

---

## How to Fix This

### Option 1: Check Product Status (Most Likely)

1. **Go to Products tab** and filter by "Aadornattire"
2. **Check the status** of products showing "Not enriched"
3. **If they're INACTIVE:**
   - Use **"Recover old catalogue"** button to move plausible ones to NEEDS_REVIEW
   - Or manually activate them if you know they're good
4. **Then run Enrich** on the retailer again

### Option 2: Products are Already in NEEDS_REVIEW

If the products ARE in NEEDS_REVIEW but still showing "Not enriched":

**Check the database directly:**

```sql
SELECT 
  id, 
  name, 
  status, 
  catalogue_enriched_at,
  array_length(interest_tags, 1) as interest_tag_count,
  array_length(gift_type_tags, 1) as gift_type_tag_count,
  quality_score
FROM "Product"
WHERE retailer_id = '<aadornattire-id>'
  AND status = 'NEEDS_REVIEW'
ORDER BY created_at DESC
LIMIT 20;
```

This will show you:
- Actual status of each product
- Whether `catalogue_enriched_at` exists
- Whether tags arrays exist and are populated
- Quality score values

### Option 3: Re-Enrich Specific Products

If products ARE in NEEDS_REVIEW and HAVE `catalogue_enriched_at` but tags are still empty:

**Possible causes:**
1. **Enrichment ran but found no matches** - The product description doesn't match any interest/gift type keywords
2. **Description is missing** - Enrichment can't fetch description from product URL
3. **Product URL is broken** - Can't fetch description for tag matching

**Solution:**
- Check individual product URLs manually
- Update product descriptions manually if URLs are broken
- Or accept that some products legitimately have no matching tags

---

## Complete Diagnostic Flow

Here's how to diagnose the exact issue:

### Step 1: Identify the Products

```sql
-- Get Aadornattire retailer ID
SELECT id, name FROM "Retailer" WHERE name ILIKE '%aadorn%';

-- Check products showing "Not enriched"
SELECT 
  p.id,
  p.name,
  p.status,
  p.catalogue_enriched_at,
  p.interest_tags,
  p.gift_type_tags,
  p.quality_score,
  r.name as retailer_name
FROM "Product" p
LEFT JOIN "Retailer" r ON p.retailer_id = r.id
WHERE r.name ILIKE '%aadorn%'
  AND (
    p.catalogue_enriched_at IS NULL
    OR p.interest_tags IS NULL
    OR p.gift_type_tags IS NULL
    OR p.quality_score IS NULL
  )
ORDER BY p.created_at DESC;
```

### Step 2: Check Status Distribution

```sql
-- Count products by status for Aadornattire
SELECT 
  status, 
  COUNT(*) as count
FROM "Product" p
LEFT JOIN "Retailer" r ON p.retailer_id = r.id
WHERE r.name ILIKE '%aadorn%'
GROUP BY status
ORDER BY count DESC;
```

### Step 3: Understand What Enrichment Will See

```sql
-- These are the products enrichment WILL process
SELECT COUNT(*) as enrichable_count
FROM "Product" p
LEFT JOIN "Retailer" r ON p.retailer_id = r.id
WHERE r.name ILIKE '%aadorn%'
  AND p.status IN ('ACTIVE', 'NEEDS_REVIEW')
  AND (
    p.catalogue_enriched_at IS NULL
    OR p.interest_tags IS NULL
    OR p.gift_type_tags IS NULL
    OR p.quality_score IS NULL
  );
```

### Step 4: Find the Gap

If **Step 3 returns 0** but **Step 1 returns products**:
- ✅ **Diagnosis:** Products are INACTIVE or REPORTED_BROKEN
- 🔧 **Solution:** Use "Recover old catalogue" or manually change status

If **Step 3 returns > 0**:
- ❌ **Diagnosis:** Enrichment should have processed them but didn't
- 🔧 **Solution:** Check server logs for errors, verify enrichment service is running

---

## The Bottom Line

**"Not enriched" in UI** vs **"0 need enrichment" from button**

These are NOT contradictory because they're checking different things:

| What | Where Shown | Condition |
|------|-------------|-----------|
| **"Not enriched" label** | Products → Review tab | Product has `catalogue_enriched_at = NULL` |
| **"0 need enrichment" message** | After clicking Enrich button | Products with status = ACTIVE or NEEDS_REVIEW that also have `catalogue_enriched_at = NULL` |

**If products are INACTIVE**, they satisfy the first condition (show "Not enriched") but NOT the second (aren't counted by Enrich button).

---

## Action Items

1. **Run this query** to see what's happening:

```sql
SELECT 
  status,
  COUNT(*) as total,
  SUM(CASE WHEN catalogue_enriched_at IS NULL THEN 1 ELSE 0 END) as not_enriched
FROM "Product" p
LEFT JOIN "Retailer" r ON p.retailer_id = r.id
WHERE r.name ILIKE '%aadorn%'
GROUP BY status;
```

2. **Based on results:**
   - **If INACTIVE products exist:** Use "Recover old catalogue" first
   - **If NEEDS_REVIEW products exist:** Enrich should work - check for errors
   - **If ACTIVE but not enriching:** Check server logs for enrichment errors

3. **Share the query results** with me and I can give you exact next steps!

---

**Key Takeaway:** The enrichment system is working correctly - it's designed to skip INACTIVE products. You likely need to recover/activate products before enriching them.
