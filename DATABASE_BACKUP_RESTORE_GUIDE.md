# Database Backup & Restore Guide

## Problem Summary
You have **4 CURATED_PRODUCT pyjamas** incorrectly tagged as "Cooking & food" and "Things to eat or drink" in the database. These wrong tags cause the AI to select 4 pyjamas for recipients interested in cooking/food.

## Solution: Clean Import with 400+ New Products

Follow these steps to backup, clear, and import fresh products:

---

## Step 1: Backup Your Database 💾

**IMPORTANT:** Always backup before deleting data!

```bash
npm run backup:db
```

This will:
- ✅ Export ALL tables (products, retailers, subscribers, recipients, gift lists, users, etc.)
- ✅ Save to `database-backups/backup-YYYY-MM-DD-HH-MM-SS/`
- ✅ Include schema.prisma file
- ✅ Create metadata.json with counts

**Backup Location:**
```
database-backups/
  └── backup-2026-09-15-14-30-00/
      ├── products.json
      ├── retailers.json
      ├── subscribers.json
      ├── recipients.json
      ├── giftLists.json
      ├── giftItems.json
      ├── users.json
      ├── emailLogs.json
      ├── scrapeStates.json
      ├── schema.prisma
      └── metadata.json
```

---

## Step 2: Delete All Products (Optional) 🗑️

If you want to start fresh with ONLY your new 400+ products:

```bash
npm run delete:products
```

**What it does:**
- ⚠️ Asks for confirmation: `"DELETE ALL PRODUCTS"`
- 🗑️ Deletes all gift items first (they reference products)
- 🗑️ Deletes all products
- ✅ Keeps retailers, subscribers, recipients (but they'll have no products)

**Note:** You can skip this step and just import new products to ADD to existing ones.

---

## Step 3: Prepare Your Excel/CSV File 📊

Your CSV should have these columns (match the template):

```csv
name,retailer_name,price,product_url,image_url,description,interest_tags,gift_type_tags,gender_applies_to,suitable_age_bands,category,source_type
```

### Required Fields:
- ✅ `name` - Product name
- ✅ `retailer_name` - Retailer name (will create if doesn't exist)
- ✅ `price` - Price in GBP (number)
- ✅ `product_url` - Product page URL
- ✅ `source_type` - Use **`CURATED_PRODUCT`** for manually curated items

### Important Fields for Correct Tagging:
- ✅ `interest_tags` - Array format: `["Fashion & accessories","Clothing"]`
- ✅ `gift_type_tags` - Array format: `["Practical but high quality"]`
- ✅ `category` - e.g., "Clothing & Accessories", "Fashion"
- ✅ `gender_applies_to` - MALE, FEMALE, UNISEX

### Example Row for Pyjamas:
```csv
"Men's Cuban Pyjama Set","Desmond & Dempsey",91,"https://desmondanddempsey.com/products/mens-cuban-pyjama-set","https://cdn.shopify.com/...","Luxury pyjama set with boxy Cuban shirt...","[""Fashion & accessories"",""Clothing""]","[""Practical but high quality""]","UNISEX","[""18+""]","Clothing & Accessories","CURATED_PRODUCT"
```

**NOT:**
```csv
❌ "Men's Cuban Pyjama Set",...,"[""Cooking & food""]","[""Things to eat or drink""]",...,"Food & Drink",...
```

---

## Step 4: Import Your New Products 📥

```bash
npm run import:products path/to/your-products.csv
```

Or use the full path:
```bash
node scripts/import-csv-products.js "C:\Users\amird\Downloads\my-products.csv"
```

**What it does:**
- ✅ Reads CSV file
- ✅ Creates retailers if they don't exist
- ✅ Validates data (skips invalid rows)
- ✅ Imports products with correct tags
- ✅ Shows progress and summary

**Expected output:**
```
📊 Importing products from: your-products.csv
   Found 420 rows in CSV

✅ Import complete!
   Imported: 410 products
   Skipped: 10 (invalid data)
   Retailers created: 15
```

---

## Step 5: Verify Import ✅

Check the products were imported correctly:

```bash
# Start the server
npm run server

# Then check in your browser:
# Admin Dashboard → Products Review
```

Or query the database directly:
```bash
npx prisma studio
```

### Quick Check Query:
```javascript
// Run this in your browser console or Node:
const products = await prisma.product.findMany({
  where: { name: { contains: 'Pyjama' } },
  select: { name: true, interestTags: true, giftTypeTags: true, category: true }
});
console.table(products);
```

---

## Step 6: Restore Backup (If Needed) 🔄

If something goes wrong, you can restore your backup:

```bash
npm run restore:db
```

**What it does:**
- 📦 Lists all available backups with dates and counts
- ⚠️ Asks which backup to restore
- ⚠️ Asks for confirmation: `"YES"`
- 🗑️ Deletes current data (except users)
- 📥 Restores all data from backup

**Example:**
```
📦 Available backups:

1. backup-2026-09-15-14-30-00
   Date: 15/09/2026, 14:30:00
   Products: 350
   Recipients: 12

Enter backup number to restore (or "cancel"): 1

⚠️  WARNING: This will DELETE all existing data and restore from backup!
Type "YES" to confirm: YES

✅ DATABASE RESTORE COMPLETE!
```

---

## Complete Workflow Example

### Scenario: Replace all products with 400 new curated items

```bash
# 1. Backup current database
npm run backup:db
# ✅ Backup saved to database-backups/backup-2026-09-15-14-30-00/

# 2. Delete all existing products
npm run delete:products
# Type: DELETE ALL PRODUCTS
# ✅ 350 products deleted

# 3. Import new products
npm run import:products "C:\Users\amird\Downloads\curated-products-400.csv"
# ✅ 400 products imported

# 4. Test gift generation
# Go to frontend → Create recipient → Generate gifts
# ✅ Check gifts are appropriate (no pyjamas for cooking interest!)

# 5. If problems, restore backup
npm run restore:db
# Select backup #1
# Type: YES
# ✅ Original data restored
```

---

## Troubleshooting

### Import fails with "Retailer not found"
**Solution:** The CSV should have `retailer_name` column. The script will create missing retailers automatically.

### Products imported but have no tags
**Solution:** Check CSV has correct array format:
```
✅ "[""Fashion & accessories"",""Clothing""]"
❌ "Fashion & accessories, Clothing"
```

### Restore fails with foreign key errors
**Solution:** Restore deletes data in correct order. If it fails:
1. Check backup files exist
2. Try deleting all data first:
   ```bash
   npm run delete:products
   npm run restore:db
   ```

### Wrong products still appearing in gift selection
**Solution:** 
1. Check product `status` is `ACTIVE` (not `NEEDS_REVIEW`)
2. Check `sourceType` is `CURATED_PRODUCT` (not `LEGACY_UNKNOWN`)
3. Verify interest tags are correct in database

---

## CSV Template for Your 400 Products

I've created a template at: `scripts/curated-import-template.csv`

Copy this and fill in your 400 products. Make sure:
- ✅ Interest tags match actual product categories
- ✅ Gift type tags are appropriate
- ✅ Gender is correct
- ✅ Age bands are appropriate
- ✅ All pyjamas have "Fashion & accessories" NOT "Cooking & food"!

---

## Important Notes

### Data Safety:
- ✅ **Users are NEVER deleted** (even during restore) for safety
- ✅ Backups include EVERYTHING (all tables)
- ✅ Each backup is timestamped (no overwriting)
- ✅ Restore asks for confirmation twice

### Foreign Keys:
- Gift Items depend on Products (deleted first)
- Products depend on Retailers (restored first)
- Recipients depend on Subscribers

### Source Types Matter:
- **CURATED_PRODUCT** = Manually curated, high quality, tags preserved during enrichment
- **SHOPIFY_UPLOAD** = Scraped from Shopify, machine-tagged, tags may be replaced
- **LEGACY_UNKNOWN** = Old imports, tags preserved (can be wrong!)

---

## Next Steps After Clean Import

1. ✅ **Run enrichment** to add quality scores:
   ```bash
   # TODO: Add enrichment script if needed
   ```

2. ✅ **Test gift generation** with various recipient profiles:
   - Create test recipient with "Cooking & food" interest
   - Generate gifts
   - Verify NO pyjamas appear!

3. ✅ **Monitor quality** in Admin Dashboard:
   - Check Products Review tab
   - Review any "needs_review" items

---

## Files Created

- ✅ `scripts/backup-database.js` - Full database backup
- ✅ `scripts/restore-database.js` - Restore from backup
- ✅ `scripts/delete-all-products.js` - Delete all products only
- ✅ `scripts/import-csv-products.js` - Import products from CSV (already exists)
- ✅ `package.json` - Added npm scripts

## Questions?

- Check backup location: `database-backups/`
- Check import logs in terminal
- Check Prisma Studio: `npm run db:studio`
