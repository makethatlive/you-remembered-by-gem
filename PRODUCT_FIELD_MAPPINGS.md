# Product Field Mappings - Complete Reference

## All Product Fields (Database → JavaScript)

| Database Column (snake_case) | JavaScript Property (camelCase) | Type |
|------------------------------|----------------------------------|------|
| `id` | `id` | String |
| `name` | `name` | String |
| `description` | `description` | String? |
| `retailer_id` | `retailerId` | String |
| `product_url` | `productUrl` | String |
| `affiliate_url` | `affiliateUrl` | String? |
| `image_url` | `imageUrl` | String? |
| `price` | `price` | Decimal |
| `category` | `category` | String? |
| `gender_applies_to` | `genderAppliesTo` | String? |
| `age_restricted` | `ageRestricted` | Boolean |
| `suitable_age_bands` | `suitableAgeBands` | String[] |
| `source_type` | `sourceType` | SourceType |
| `status` | `status` | ProductStatus |
| `reported_broken_at` | `reportedBrokenAt` | DateTime? |
| `last_checked` | `lastChecked` | DateTime? |
| `last_verified` | `lastVerified` | DateTime? |
| `added_date` | `addedDate` | DateTime? |
| `notes` | `notes` | String? |
| `interest_tags` | `interestTags` | String[] |
| `gift_type_tags` | `giftTypeTags` | String[] |
| `search_keywords` | `searchKeywords` | String[] |
| `quality_score` | `qualityScore` | Float? |
| `catalogue_enriched_at` | `catalogueEnrichedAt` | DateTime? |
| `data_quality_flags` | `dataQualityFlags` | String[] |
| `canonical_category` | `canonicalCategory` | String? |
| `ai_classifications` | `aiClassifications` | Json? |
| `created_at` | `createdAt` | DateTime |
| `updated_at` | `updatedAt` | DateTime |

## Helper Function for Safe Access

```javascript
// Use this pattern everywhere:
const getField = (obj, camelCase, snake_case, defaultVal = null) => {
  return obj?.[camelCase] ?? obj?.[snake_case] ?? defaultVal;
};

// Example:
const productUrl = getField(product, 'productUrl', 'product_url', '');
const retailerId = getField(product, 'retailerId', 'retailer_id');
```

## Most Commonly Used Fields in UI

These are the fields that appear most in components and need dual support:

1. ✅ `retailerId` / `retailer_id`
2. ✅ `productUrl` / `product_url`
3. ✅ `imageUrl` / `image_url`
4. ✅ `affiliateUrl` / `affiliate_url`
5. ✅ `genderAppliesTo` / `gender_applies_to`
6. ✅ `ageRestricted` / `age_restricted`
7. ✅ `sourceType` / `source_type`
8. ⚠️ `suitableAgeBands` / `suitable_age_bands`
9. ⚠️ `reportedBrokenAt` / `reported_broken_at`
10. ⚠️ `lastChecked` / `last_checked`
11. ⚠️ `addedDate` / `added_date`
12. ⚠️ `interestTags` / `interest_tags`
13. ⚠️ `giftTypeTags` / `gift_type_tags`
14. ⚠️ `searchKeywords` / `search_keywords`
15. ⚠️ `dataQualityFlags` / `data_quality_flags`
16. ⚠️ `canonicalCategory` / `canonical_category`
17. ⚠️ `aiClassifications` / `ai_classifications`

✅ = Already fixed
⚠️ = Needs fixing
