# Import Your Real Data from Base44

You already have real data exported from Base44 in the `database-csv` folder. This guide will help you import it into your new PostgreSQL database.

## Your Current Data

Based on your CSV exports, you have:

- ✅ **~50 Retailers** - Including mysteriesintime.com, lovecrafts.com, notonthehighstreet.com, etc.
- ✅ **4 Subscribers** - Your real users including pph2shoaib, Gemma, Megan, Katie
- ✅ **1+ Recipients** - Including Sarah Test with full profile data
- ✅ **1000+ Products** - Full product catalog with descriptions, images, pricing
- ✅ **Gift Lists** - Generated lists with status tracking
- ✅ **Gift Items** - Individual gift suggestions
- ✅ **Email Logs** - Email history
- ✅ **Scrape Data** - Historical scraping logs and stats

## Quick Import (3 Commands)

```bash
# 1. Setup database schema
npm run db:push

# 2. Import all your real data
npm run import:csv

# 3. Verify the import
npm run db:studio
```

That's it! Your data is now in PostgreSQL.

## What the Import Does

The `import:csv` script:

1. **Reads CSV files** from `database-csv/` folder
2. **Transforms field names** from snake_case to camelCase
3. **Converts enum values** to Prisma format (e.g., "active" → "ACTIVE")
4. **Handles relationships** ensuring foreign keys are valid
5. **Creates missing users** for subscribers and recipients
6. **Imports in correct order** to satisfy dependencies

### Import Order

1. Retailers (no dependencies)
2. Subscribers (creates users as needed)
3. Recipients (depends on subscribers)
4. Products (depends on retailers)
5. Gift Lists (depends on recipients)
6. Gift Items (depends on gift lists and products)
7. Email Logs
8. Other data (scrape logs, stats, etc.)

## Field Transformations

### Field Name Changes

| Base44 (CSV) | Prisma (Database) |
|--------------|-------------------|
| `subscriber_id` | `subscriberId` |
| `gift_list_id` | `giftListId` |
| `created_date` | `createdAt` |
| `product_url` | `productUrl` |
| `age_band` | `ageBand` |

### Enum Value Changes

| Base44 | Prisma |
|--------|--------|
| `"active"` | `"ACTIVE"` |
| `"Women"` | `"WOMEN"` |
| `"curated"` | `"CURATED"` |
| `"shopify_upload"` | `"SHOPIFY_UPLOAD"` |

### Data Type Changes

- **Booleans**: `"true"` → `true`, `"false"` → `false`
- **Dates**: `"2026-08-01"` → `Date object`
- **JSON**: String JSON → Parsed objects
- **Arrays**: String arrays → Proper arrays
- **Numbers**: String numbers → Numeric values

## Verification

After import, check your data:

```bash
# Open database browser
npm run db:studio
```

Or query from Node:

```javascript
import prisma from './src/lib/db.js';

// Check counts
const retailers = await prisma.retailer.count();
const products = await prisma.product.count();
const subscribers = await prisma.subscriber.count();

console.log({ retailers, products, subscribers });
```

## Expected Results

After successful import, you should see:

```
📊 Final Database Counts:
   retailers: 50+
   subscribers: 4+
   recipients: 1+
   products: 1000+
   giftLists: X
   giftItems: X
   emailLogs: X
   users: 4+
```

## Handling Import Errors

### Products Skipped

Some products may be skipped if their retailer doesn't exist:

```
✅ Imported 950/1000 products (50 skipped)
```

This is normal if there are orphaned products in the CSV.

### Missing Foreign Keys

If you see errors like:
```
Foreign key constraint failed
```

The script handles this by:
- Creating missing users automatically
- Skipping records with invalid foreign keys
- Logging which records were skipped

### Data Type Errors

If you see type conversion errors:
```
Expected number, got string
```

Check the CSV data and update the transformation logic in `scripts/import-csv-data.js`.

## Re-importing Data

If you need to re-import:

```bash
# Reset database (WARNING: Deletes all data)
npm run db:reset

# Re-import
npm run import:csv
```

Or keep existing data and update:

```bash
# Just re-run import (uses upsert)
npm run import:csv
```

The import script uses `upsert` which means:
- Existing records are **updated**
- New records are **created**
- No duplicates

## Custom Import

If you need to customize the import:

1. Edit `scripts/import-csv-data.js`
2. Modify field mappings in `FIELD_MAPPINGS`
3. Add enum mappings in `ENUM_MAPPINGS`
4. Adjust transformation logic in `transformValue()`

Example:
```javascript
// Add custom field mapping
const FIELD_MAPPINGS = {
  ...existing,
  'my_custom_field': 'myCustomField'
};

// Add custom enum mapping
const ENUM_MAPPINGS = {
  ...existing,
  'my_status': 'MY_STATUS'
};
```

## Incremental Updates

To import only specific entities:

```javascript
// Edit scripts/import-csv-data.js main() function
async function main() {
  // Comment out what you don't need
  // await importRetailers();
  await importProducts();  // Only import products
  // await importSubscribers();
}
```

## Data Validation

After import, validate your data:

```javascript
import prisma from './src/lib/db.js';

// Check for orphaned records
const orphanedProducts = await prisma.product.findMany({
  where: {
    retailer: null
  }
});

// Check data integrity
const recipientsWithoutSubscribers = await prisma.recipient.findMany({
  where: {
    subscriber: null
  }
});

console.log({
  orphanedProducts: orphanedProducts.length,
  orphanedRecipients: recipientsWithoutSubscribers.length
});
```

## Next Steps After Import

1. ✅ **Verify data** in Prisma Studio
2. ✅ **Test queries** to ensure relationships work
3. ✅ **Update function code** to use Prisma instead of Base44
4. ✅ **Test your application** with real data
5. ✅ **Backup your database** before going live

## Backup Your Data

Once imported, create a backup:

```bash
# PostgreSQL backup
pg_dump -U username -d youremembered > backup.sql

# Restore from backup
psql -U username -d youremembered < backup.sql
```

Or use your cloud provider's backup:
- **Supabase**: Automatic daily backups
- **Railway**: Database backups in dashboard
- **Neon**: Point-in-time restore

## Troubleshooting

### "Module not found: csv-parse"

```bash
npm install csv-parse
```

### "Cannot find module 'url'"

Your Node version is too old. Upgrade to Node 18+:

```bash
node --version  # Should be 18.0.0 or higher
```

### "Connection refused"

Check your DATABASE_URL in `.env`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/youremembered"
```

Test connection:
```bash
npx prisma db execute --stdin <<< "SELECT 1"
```

### "CSV file not found"

Ensure files are in the correct location:
```
database-csv/
  ├── Retailer_export.csv
  ├── Subscriber_export.csv
  ├── Recipient_export.csv
  ├── Product_export.csv
  └── ...
```

## Support

If you encounter issues:

1. Check the import logs for specific errors
2. Review the CSV data format
3. Verify field mappings in the script
4. Check Prisma schema matches your data

---

**Your data is valuable - this import preserves everything from Base44! 🎉**
