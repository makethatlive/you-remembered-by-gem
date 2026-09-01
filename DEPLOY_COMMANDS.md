# 🚀 Quick Deploy Commands

## Step-by-Step Deployment to Railway

### 1. Push to GitHub
```bash
# Initialize git (if not done)
git init

# Add all files
git add .

# Commit
git commit -m "Ready for Railway deployment"

# Add GitHub remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/you-remembered-app.git

# Push
git branch -M main
git push -u origin main
```

### 2. Create Railway Project
- Go to: https://railway.app
- Click "New Project"
- Deploy PostgreSQL first
- Then deploy from GitHub repo

### 3. Configure Environment Variables in Railway
```
DATABASE_URL = (copy from Railway PostgreSQL service)
NODE_ENV = production
PORT = 3001
```

### 4. Import Data to Railway Database
```bash
# Update local .env with Railway DATABASE_URL temporarily
# Then run:
npm run db:push
npm run import:csv
```

### 5. Deploy!
Railway auto-deploys on push. Or manually click "Deploy" in Railway dashboard.

---

## Testing Locally Before Deploy

```bash
# Start API server
npm run server

# Start frontend (in another terminal)
npm run dev

# Visit http://localhost:5173
```

---

## Useful Railway Commands

### View Logs
```bash
# Install Railway CLI (optional)
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs
```

### Database Management
```bash
# Connect to Railway DB
railway run prisma studio

# Push schema changes
railway run npm run db:push
```

---

## Post-Deployment Updates

When you make changes:

```bash
# Make your changes to code

# Commit and push
git add .
git commit -m "Your changes"
git push

# Railway auto-deploys!
```

---

## Quick Links

- Railway Dashboard: https://railway.app/dashboard
- Your App (after deploy): https://YOUR-APP.up.railway.app
- Railway Docs: https://docs.railway.app

---

**That's it! Your app will be live in ~5 minutes!** 🎉
