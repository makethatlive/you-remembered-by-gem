# 📦 Gem's Picks Backup & Restore Guide

## 🎯 Purpose

Before uploading new Gem's Pick products, backup and remove existing ones (with their orphaned retailers) so you can safely test and revert if needed.

---

## 📋 What This Does

### **Backup & Remove Script:**
1. ✅ Backs up all `CURATED_PRODUCT` products (Gem's Picks)
2. ✅ Backs up their associated retailers
3. ✅ Removes all Gem's Pick products
4. ✅ Removes retailers that have **NO other products** (orphaned)
5. ✅ Keeps retailers that have other scraped products

### **Restore Script:**
1. ✅ Restores retailers from backup
2. ✅ Restores products from backup
3. ✅ Verifies data integrity

---

## 🚀 Step-by-Step Process

### **Step 1: Backup and Remove Existing Gem's Picks**

```bash
# Dry run (creates backup, no deletion)
node scripts/backup-and-remove-gems-picks.js

# Actual deletion (after reviewing backup)
node scripts/backup-and-remove-gems-picks.js --confirm
```

**Output:**
```
🔄 Starting Gem's Pick backup and removal...

📊 Fetching Gem's Pick products...
   ✅ Found 150 Gem's Pick products

   📊 Found 45 unique retailers

💾 Creating backup in: database-backups/gems-picks-backup-2026-09-17_10-30-00

💾 Backing up products...
   ✅ Saved 150 products to curated-products.json

💾 Backing up retailers...
   ✅ Saved 45 retailers to retailers.json

📝 Creating restore script...
   ✅ Created RESTORE.md with instructions

⚠️  Add --confirm flag to proceed with deletion
   Example: node scripts/backup-and-remove-gems-picks.js --confirm

   ✅ Backup completed - no deletion performed
```

---

### **Step 2: Review Backup**

Check the backup folder:
```
database-backups/gems-picks-backup-2026-09-17_10-30-00/
├── curated-products.json    (All Gem's Pick products)
├── retailers.json            (Associated retailers)
└── RESTORE.md                (Restore instructions)
```

Open `RESTORE.md` to see:
- Number of products backed up
- Number of retailers backed up
- Products breakdown by retailer
- Total value
- Restore command

---

### **Step 3: Confirm Deletion**

```bash
# After reviewing backup, proceed with deletion
node scripts/backup-and-remove-gems-picks.js --confirm
```

**Output:**
```
🗑️  Proceeding with deletion...

🗑️  Deleting Gem's Pick products...
   ✅ Deleted 150 products

🔍 Finding orphaned retailers...
   📊 Found 12 retailers with no products

🗑️  Deleting orphaned retailers...
   🗑️  Deleting: Small Boutique Shop
   🗑️  Deleting: Artisan Gifts Ltd
   ...
   ✅ Deleted 12 orphaned retailers

✅ Operation Complete!

📊 Summary:
   ✅ Backup location: database-backups/gems-picks-backup-2026-09-17_10-30-00
   ✅ Products deleted: 150
   ✅ Retailers deleted: 12
   ✅ Remaining retailers: 33

💡 To restore, run:
   node scripts/restore-gems-picks.js "database-backups/gems-picks-backup-2026-09-17_10-30-00"

🔍 Verifying database state...
   📊 CURATED_PRODUCT remaining: 0
   📊 Total products: 5850
   📊 Total retailers: 286
```

---

### **Step 4: Upload New Gem's Picks**

Now you can upload your new CSV:

1. Go to Admin Dashboard
2. Click "Import from Sheet"
3. Upload your new Gem's Picks CSV
4. Domain-based matching will work! ✅

---

### **Step 5: Test the New Products**

Test gift generation with the new products:
- Check if products appear in suggestions
- Verify quality and categorization
- Test with different recipients

---

### **Step 6A: If Everything Works** ✅

**Keep the new products:**
```bash
# You're done! New products are now live
# Backup is saved for historical reference
```

---

### **Step 6B: If There's an Issue** ⚠️

**Restore the backup:**
```bash
# Restore previous Gem's Picks
node scripts/restore-gems-picks.js "database-backups/gems-picks-backup-2026-09-17_10-30-00"
```

**Output:**
```
🔄 Starting restore from backup...

📂 Backup location: database-backups/gems-picks-backup-2026-09-17_10-30-00

📥 Loading retailers...
   ✅ Loaded 45 retailers

📥 Loading products...
   ✅ Loaded 150 products

📦 Restoring retailers...
   ✅ Restored 45 retailers

📦 Restoring products...
   ✅ Restored 150 products

🔍 Verifying restore...
   📊 CURATED_PRODUCT in database: 150
   📊 Expected: 150
   ✅ Verification successful!

✅ Restore Complete!

📊 Summary:
   ✅ Retailers restored: 45
   ✅ Products restored: 150
   ✅ Database verified
```

---

## 📊 Understanding Orphaned Retailers

### **What is an Orphaned Retailer?**

A retailer is "orphaned" when:
- It only had Gem's Pick products
- All its products were deleted
- No other scraped products exist for it

### **Example:**

```
Retailer: "Small Boutique"
Products before deletion:
- 3 CURATED_PRODUCT (Gem's Picks)
- 0 CURATED_RETAILER (scraped)

After deletion:
- 0 products total
- Retailer is orphaned ❌
- Safe to delete ✅
```

### **Retailer with Other Products:**

```
Retailer: "Georg Jensen"
Products before deletion:
- 5 CURATED_PRODUCT (Gem's Picks)
- 120 CURATED_RETAILER (scraped)

After deletion:
- 120 products remaining
- Retailer is NOT orphaned ✅
- Kept in database ✅
```

---

## ⚠️ Important Notes

### **Safety:**
- ✅ Backup created BEFORE deletion
- ✅ Orphaned retailers only removed (safe)
- ✅ Retailers with scraped products kept
- ✅ Full restore available if needed

### **Testing:**
- ✅ Run without `--confirm` first to see what will be deleted
- ✅ Review backup files before confirming
- ✅ Test on small CSV first before full upload

### **Restore:**
- ✅ Can restore anytime using backup folder path
- ✅ Restore includes all products and retailers
- ✅ Verification checks data integrity

---

## 🎯 Complete Workflow

```bash
# 1. Backup and remove (dry run)
node scripts/backup-and-remove-gems-picks.js

# 2. Review backup in database-backups/gems-picks-backup-XXXX/

# 3. Confirm deletion
node scripts/backup-and-remove-gems-picks.js --confirm

# 4. Upload new CSV via Admin Dashboard

# 5. Test new products

# 6. If issues, restore:
node scripts/restore-gems-picks.js "database-backups/gems-picks-backup-XXXX"
```

---

## 💡 Tips

### **Before Uploading:**
1. Review your CSV for spelling errors in retailer names
2. Check that URLs are valid
3. Verify prices are in correct format

### **After Uploading:**
1. Check import logs for "Matched by domain" messages
2. Verify no duplicate retailers created
3. Test gift generation with new products

### **If Something Goes Wrong:**
1. Don't panic - backup exists ✅
2. Run restore script with backup path
3. Everything returns to previous state
4. Fix CSV and try again

---

## 📞 Quick Reference

| Action | Command |
|--------|---------|
| Backup only (safe) | `node scripts/backup-and-remove-gems-picks.js` |
| Backup + Delete | `node scripts/backup-and-remove-gems-picks.js --confirm` |
| Restore | `node scripts/restore-gems-picks.js "backup-path"` |

---

## ✅ Ready to Go!

You're now ready to safely backup, remove, upload, and restore Gem's Picks! 🚀
