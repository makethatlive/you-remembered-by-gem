# 📊 Sync Database from Live to Local

## 🎯 Current Setup

Looking at your `.env`, you're using **Railway PostgreSQL** for both live and local:
```
DATABASE_URL="postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
```

This means you're **already connected to the live database** when running locally! 

---

## ✅ Option 1: Use Live Database (Recommended for Quick Testing)

**Current situation:** Your local code is already pointing to Railway (live database).

**What this means:**
- ✅ Any changes you make locally will reflect immediately
- ✅ No need to sync - you're already using live data
- ⚠️ Be careful - changes affect live data!

**To test the import changes:**
1. Just run your local server:
   ```bash
   npm run dev
   ```

2. Navigate to Admin Dashboard
3. Upload a CSV with spelling variations
4. Check if domain-based matching works

**Recommendation:** Since your code is already using live DB, you can test directly!

---

## 🔧 Option 2: Set Up Local PostgreSQL (For Safe Testing)

If you want a **separate local database** for testing without affecting live:

### **Step 1: Install PostgreSQL Locally**

**Windows:**
1. Download: https://www.postgresql.org/download/windows/
2. Install PostgreSQL 15 or 16
3. Remember the password you set for `postgres` user

**Or use Docker:**
```bash
docker run --name postgres-local -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
```

---

### **Step 2: Create Local Database**

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE youremembered;

# Exit
\q
```

---

### **Step 3: Update .env for Local**

Create a `.env.local` file:
```env
# Local PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/youremembered"

# Copy all other vars from .env
ANTHROPIC_API_KEY="your-anthropic-key-here"
RESEND_API_KEY="your-resend-key-here"
# ... etc
```

---

### **Step 4: Run Migrations**

```bash
npx prisma migrate dev
```

---

### **Step 5: Sync Data from Live**

I've created 3 methods for you:

#### **Method A: Using pg_dump (Fastest)**

```powershell
# 1. Export from Railway
$LIVE_DB = "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
$LOCAL_DB = "postgresql://postgres:password@localhost:5432/youremembered"

# 2. Dump live database
pg_dump --no-owner --no-acl --clean --if-exists -f live-dump.sql $LIVE_DB

# 3. Import to local
psql $LOCAL_DB -f live-dump.sql
```

#### **Method B: Using PowerShell Script**

```powershell
# Run the sync script
.\scripts\sync-db-simple.ps1
```

#### **Method C: Using Node.js Script**

```bash
# Update LOCAL_DATABASE_URL in scripts/sync-db-from-live.js first
node scripts/sync-db-from-live.js
```

---

## 🚀 Quick Start (Recommended)

Since you're **already using Railway database locally**, here's the quickest path:

### **1. Just test with current setup:**
```bash
# Your local code is already connected to Railway
npm run dev
```

### **2. Test the import:**
- Go to http://localhost:5173/admin
- Click "Import from Sheet"
- Upload CSV with spelling variations
- Check logs for "Matched by domain"

### **3. Monitor live database:**
- Check Railway dashboard
- Or use Prisma Studio: `npx prisma studio`

---

## ⚠️ Important Notes

### **Current Setup (Railway for Both):**
- ✅ No sync needed
- ✅ Instant testing
- ⚠️ Changes affect live data
- ⚠️ Other users might be affected

### **Recommended Setup (Local PostgreSQL):**
- ✅ Safe testing environment
- ✅ No impact on live users
- ⚠️ Requires initial setup
- ⚠️ Need to sync data periodically

---

## 💡 My Recommendation

**For quick testing of the import changes:**
1. Use your current setup (Railway)
2. Test with a small CSV file (5-10 products)
3. Check if domain matching works
4. If it works, we can push to production

**For extensive testing:**
1. Set up local PostgreSQL
2. Sync data once
3. Test thoroughly without affecting live
4. Push when confident

---

## 🎯 What Do You Prefer?

**Option A:** Test directly with Railway (quick, affects live)
**Option B:** Set up local PostgreSQL first (safe, takes time)

Let me know which route you want to take! 👍
