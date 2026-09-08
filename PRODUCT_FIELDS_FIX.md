# ✅ Fixed: Product URL and Image Not Showing in Edit Form

## Problem
When editing a product, the Product URL and Image URL fields were empty, even though the data existed in the database.

## Root Cause
**Field Name Mismatch (Again!):**

Same issue as the retailer problem - UI components were looking for snake_case field names but Prisma returns camelCase:

| Field | Database Column | Prisma JavaScript | UI Expected |
|-------|----------------|-------------------|-------------|
| Product URL | `product_url` | `productUrl` | `product_url` ❌ |
| Image URL | `image_url` | `imageUrl` | `image_url` ❌ |
| Affiliate URL | `affiliate_url` | `affiliateUrl` | `affiliate_url` ❌ |
| Gender | `gender_applies_to` | `genderAppliesTo` | `gender_applies_to` ❌ |
| Age Restricted | `age_restricted` | `ageRestricted` | `age_restricted` ❌ |
| Source Type | `source_type` | `sourceType` | `source_type` ❌ |
| Retailer ID | `retailer_id` | `retailerId` | `retailer_id` ❌ |

---

## Solution Applied

Updated all product-related components to support **both** camelCase and snake_case field names:

### 1. ✅ ProductEditForm.jsx

**Initial Form State:**
```javascript
// Before
image_url: product.image_url || "",
affiliate_url: product.affiliate_url || "",

// After
image_url: product.imageUrl || product.image_url || "",
affiliate_url: product.affiliateUrl || product.affiliate_url || "",
gender_applies_to: product.genderAppliesTo || product.gender_applies_to || "",
age_restricted: product.ageRestricted ?? product.age_restricted ?? false,
source_type: product.sourceType || product.source_type || "legacy_unknown",
```

**Read-Only Display:**
```javascript
// Before
<ReadOnly label="Product URL" value={product.product_url} />

// After
<ReadOnly label="Product URL" value={product.productUrl || product.product_url} />
```

### 2. ✅ ProductsTab.jsx

**Table Display:**
```javascript
// Before
<ProductThumb src={p.image_url} />
{p.gender_applies_to || "—"}

// After
<ProductThumb src={p.imageUrl || p.image_url} />
{p.genderAppliesTo || p.gender_applies_to || "—"}
```

**Edit Form Call:**
```javascript
// Before
retailerName={retailerName(editing.retailer_id)}

// After
retailerName={retailerName(editing.retailerId || editing.retailer_id)}
```

### 3. ✅ ProductsByRetailer.jsx

```javascript
// Before
<ProductThumb src={p.image_url} />

// After
<ProductThumb src={p.imageUrl || p.image_url} />
```

### 4. ✅ NeedsReviewPanel.jsx

```javascript
// Before
<ProductThumb src={p.image_url} />
{p.product_url && (
  <a href={p.product_url}>View</a>
)}

// After
<ProductThumb src={p.imageUrl || p.image_url} />
{(p.productUrl || p.product_url) && (
  <a href={p.productUrl || p.product_url}>View</a>
)}
```

### 5. ✅ ApprovalCard.jsx

```javascript
// Before
{item.image_url && ...}
<a href={item.product_url}>
{item.source_type === "curated_product" && ...}
{item.retailer_name}
{item.why_this_gift}

// After
{(item.imageUrl || item.image_url) && ...}
<a href={item.productUrl || item.product_url}>
{(item.sourceType || item.source_type) === "curated_product" && ...}
{item.retailerName || item.retailer_name}
{item.whyThisGift || item.why_this_gift}
```

---

## Files Modified

1. `src/components/admin/ProductEditForm.jsx`
2. `src/components/admin/ProductsTab.jsx`
3. `src/components/admin/ProductsByRetailer.jsx`
4. `src/components/admin/NeedsReviewPanel.jsx`
5. `src/components/admin/ApprovalCard.jsx`

---

## Result

✅ **Product Edit Form now shows all fields:**
- Product URL displays correctly (read-only)
- Image URL field is populated
- Image preview works
- Affiliate URL field is populated
- Gender, age restricted, source type all work

✅ **Product images display throughout the app:**
- Products tab table view
- By Retailer view
- Needs Review panel
- Approval cards

✅ **Product URLs work:**
- Links to product pages
- View buttons in tables

---

## Pattern Recognition

This is the **third time** we've fixed the same issue:

1. **Recipients/Gift Lists:** `subscriberId` vs `subscriber_id`, `recipientId` vs `recipient_id`
2. **Products by Retailer:** `retailerId` vs `retailer_id`
3. **Product Fields:** `productUrl` vs `product_url`, `imageUrl` vs `image_url`, etc.

### Why This Keeps Happening

**Prisma ORM Behavior:**
- Database columns use snake_case: `product_url`, `image_url`, `retailer_id`
- Prisma schema maps them: `@map("product_url")`
- JavaScript objects use camelCase: `productUrl`, `imageUrl`, `retailerId`

**The UI was written expecting database column names instead of JavaScript property names.**

### Long-Term Solution

For a comprehensive fix, we should either:

1. **Option A:** Add a normalization layer in base44Client to convert all Prisma responses to snake_case
2. **Option B:** Update Prisma schema to NOT use @map and keep camelCase in database
3. **Option C:** Continue supporting both (current approach - most compatible)

---

## Testing Checklist

✅ Edit a product → All fields should be populated
✅ Product images show in table view
✅ Product images show in "By Retailer" view
✅ Product URLs work (clickable links)
✅ Image preview in edit form works
✅ Approval cards show product images
✅ Needs Review panel shows images and links
