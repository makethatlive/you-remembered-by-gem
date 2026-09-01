# 🔧 Fix Railway Deployment

## Issue
Railway couldn't find Node.js (`node: command not found`)

## Solution
Updated configuration files to properly specify Node.js version.

## Steps to Fix

### 1. Pull the latest changes (if working from different machine)
```bash
git pull
```

### 2. Commit the configuration fixes
```bash
git add .
git commit -m "Fix: Add Node.js configuration for Railway"
git push
```

### 3. Railway will auto-deploy
Go to Railway dashboard → Your app → Deployments

You should see a new deployment starting automatically.

### 4. Check the logs
- Click on the deployment
- Watch the "Build Logs" 
- Should see:
  - ✅ Installing Node.js 20
  - ✅ Running npm ci
  - ✅ Generating Prisma client
  - ✅ Building frontend
  - ✅ Starting server

---

## What We Fixed

### Files Updated:
1. **`nixpacks.toml`** - Specified Node.js 20
2. **`railway.toml`** - Added Railway-specific config
3. **`package.json`** - Added engines specification
4. **`Procfile`** - Already had correct start command

### Why it failed before:
Railway's auto-detection didn't properly configure Node.js environment.

### Why it works now:
We explicitly tell Railway to use Node.js 20 in multiple config files.

---

## After Successful Deployment

Once deployment succeeds:

### 1. Generate Domain (if not done)
Railway → Your app → Settings → Generate Domain

### 2. Set Environment Variables (if not done)
Railway → Your app → Variables → Add:
```
NODE_ENV = production
```

And reference PostgreSQL's DATABASE_URL

### 3. Import Data
```bash
# In local terminal, update .env with Railway DATABASE_URL
npm run db:push
npm run import:csv
```

### 4. Test!
Visit: `https://your-app.up.railway.app`

---

## Still Having Issues?

### Check Build Logs
Railway dashboard → Deployments → Click deployment → Build Logs

Look for errors in:
1. npm install phase
2. Prisma generate phase  
3. Build phase
4. Start phase

### Common Issues:

**"Module not found"**
- Solution: Ensure all dependencies in package.json
- Run locally: `npm install`
- Push updated package-lock.json

**"Prisma Client not found"**
- Solution: Build command must include `npx prisma generate`
- Already fixed in railway.toml

**"Port already in use"**
- Solution: Use `process.env.PORT || 3001`
- Already fixed in server/index.js

---

## Quick Test Commands

### Test locally before pushing:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Generate Prisma
npx prisma generate

# Build
npm run build

# Start (simulating production)
NODE_ENV=production node server/index.js
```

Should work locally? Then it will work on Railway!

---

**Push the fixes now and Railway will auto-deploy!** 🚀
