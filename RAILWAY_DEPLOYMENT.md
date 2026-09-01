# 🚂 Railway Deployment Guide

## Overview
This guide will help you deploy your app to Railway for free. Railway will host both your PostgreSQL database and Node.js application.

---

## 📋 Prerequisites

1. ✅ Local app working (confirmed)
2. ✅ PostgreSQL database with data imported
3. ✅ Git repository initialized
4. ⏳ Railway account (we'll create this)
5. ⏳ GitHub account (to connect Railway)

---

## Step 1: Prepare Your Code

### 1.1 Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit - Ready for Railway deployment"
```

### 1.2 Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `you-remembered-app`)
3. **Don't** initialize with README (you already have code)
4. Copy the repository URL

### 1.3 Push to GitHub

```bash
git remote add origin YOUR_GITHUB_REPO_URL
git branch -M main
git push -u origin main
```

---

## Step 2: Create Railway Account

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Sign up with GitHub (easiest option)
4. Authorize Railway to access your repositories

---

## Step 3: Deploy PostgreSQL Database

### 3.1 Create Database Service

1. Click **"New Project"**
2. Click **"Deploy PostgreSQL"**
3. Wait for deployment (1-2 minutes)
4. Database will be created automatically!

### 3.2 Get Database Connection String

1. Click on the PostgreSQL service
2. Go to **"Variables"** tab
3. Copy the `DATABASE_URL` value (starts with `postgresql://`)
4. Keep this safe - you'll need it!

---

## Step 4: Deploy Your Application

### 4.1 Add Your App to Railway

1. In the same project, click **"New"** 
2. Select **"GitHub Repo"**
3. Choose your `you-remembered-app` repository
4. Railway will detect it's a Node.js app automatically

### 4.2 Configure Environment Variables

1. Click on your app service
2. Go to **"Variables"** tab
3. Click **"New Variable"**
4. Add these variables:

```
DATABASE_URL = (paste the URL from Step 3.2)
NODE_ENV = production
PORT = 3001
```

### 4.3 Link Database to App

1. In **"Variables"** tab
2. Click **"Reference Variables"**
3. Select **PostgreSQL**
4. Select `DATABASE_URL`
5. This ensures your app uses Railway's database

---

## Step 5: Run Database Migration

### 5.1 Connect to Railway Database Locally

Update your local `.env` file temporarily:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/railway"
```

(Use the DATABASE_URL from Railway)

### 5.2 Push Schema to Railway Database

```bash
npm run db:push
```

This creates all tables in Railway's PostgreSQL.

### 5.3 Import Your Data to Railway

```bash
npm run import:csv
```

This imports all your CSV data to the Railway database.

---

## Step 6: Deploy and Test

### 6.1 Trigger Deployment

Railway auto-deploys on git push, but you can manually trigger:

1. Go to your app service in Railway
2. Click **"Deployments"** tab
3. Click **"Deploy"** (if needed)

### 6.2 Get Your App URL

1. Go to **"Settings"** tab
2. Click **"Generate Domain"**
3. Railway will give you a URL like: `your-app.up.railway.app`
4. Copy this URL!

### 6.3 Test Your App

1. Open the Railway URL in browser
2. Should see your app loading
3. Should auto-login
4. Should show all your data!

---

## Step 7: Configure Custom Domain (Optional)

If you have a custom domain:

1. In **"Settings"** → **"Domains"**
2. Click **"Custom Domain"**
3. Enter your domain
4. Add CNAME record to your DNS:
   - Name: `www` (or `app`)
   - Value: Your Railway domain

---

## 🎯 Quick Deploy Checklist

- [ ] Code pushed to GitHub
- [ ] Railway account created
- [ ] PostgreSQL service deployed on Railway
- [ ] App service deployed on Railway
- [ ] Environment variables configured
- [ ] Database schema pushed (`npm run db:push`)
- [ ] Data imported (`npm run import:csv`)
- [ ] Custom domain generated
- [ ] App tested and working!

---

## 🐛 Troubleshooting

### "Database connection failed"
**Solution**: Check DATABASE_URL in Railway variables matches PostgreSQL service

### "500 Internal Server Error"
**Solution**: Check Railway logs:
1. Click on app service
2. Go to **"Deployments"**
3. Click latest deployment
4. Check logs for errors

### "App not loading"
**Solution**: 
1. Check if deployment succeeded
2. Generate domain if not done
3. Wait 2-3 minutes for DNS propagation

### "No data showing"
**Solution**:
1. Verify data was imported: Check Railway PostgreSQL in browser or connect with Prisma Studio
2. Check API endpoints work: Visit `your-app.up.railway.app/api/subscribers`

---

## 💰 Railway Free Tier Limits

Railway's free tier includes:
- ✅ $5 free credit per month
- ✅ PostgreSQL database (512 MB)
- ✅ Full app deployment
- ✅ Custom domains
- ✅ Automatic HTTPS

Your app should easily fit within free tier for development/testing!

---

## 🔐 Security Notes

1. **Never commit .env** - Already in .gitignore
2. **Use Railway's database** - More secure than local
3. **Enable 2FA** on Railway account
4. **Rotate database credentials** if exposed

---

## 📞 Need Help?

If deployment fails:
1. Check Railway logs (Deployments tab)
2. Verify all environment variables are set
3. Check database connection string format
4. Contact Railway support: https://railway.app/help

---

## ✨ Post-Deployment

Once deployed, your app will:
- ✅ Be accessible worldwide
- ✅ Auto-deploy on git push
- ✅ Have free HTTPS
- ✅ Scale automatically
- ✅ Backup database daily

**Your app is now live!** 🎉

---

## Next Steps After Deployment

1. **Monitor usage**: Check Railway dashboard for resource usage
2. **Add team members**: Invite collaborators in Project Settings
3. **Setup monitoring**: Use Railway's built-in metrics
4. **Configure alerts**: Get notified of deployment issues
5. **Plan for scaling**: Upgrade if you exceed free tier

---

**Deployment Complete!**  
Your app: `https://your-app.up.railway.app`  
Database: Managed by Railway  
Status: Live and running! 🚀
