# 🚀 Railway Deployment Guide - After Base44 Removal

## Current Changes to Deploy

You have made the following critical changes that need to be deployed:

### 1. Base44 Removal (3 files)
- ✅ `src/pages/ResetPassword.jsx` - Fixed auth method
- ✅ `src/pages/ForgotPassword.jsx` - Fixed auth method  
- ✅ `src/pages/CreateAccount.jsx` - Simplified registration

### 2. Gitignore Update
- ✅ `.gitignore` - Added rule to ignore MD files
- ✅ 77 MD files removed from tracking

## Pre-Deployment Checklist

### ✅ 1. Verify Local Changes

```bash
# Check what will be deployed
git status

# Review changes
git diff
```

### ✅ 2. Test Locally First

```bash
# Start backend
npm run server

# Start frontend (different terminal)
npm run dev

# Test these critical flows:
# - Login/Register
# - Password reset
# - Onboarding
# - Gift generation
```

### ✅ 3. Environment Variables on Railway

Make sure these are set in your Railway project:

#### Required Variables:
```env
# Database
DATABASE_URL=postgresql://...your_railway_db_url...

# AI Service (Claude)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Email Service
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=concierge@yourememberedbygem.com
RESEND_FROM_NAME=Gem - You Remembered
ENABLE_EMAILS=true

# App Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-app.railway.app
API_URL=https://your-app.railway.app

# Auth
JWT_SECRET=your_jwt_secret_key_change_in_production_123456789
JWT_EXPIRES_IN=7d
SESSION_SECRET=your_random_session_secret_here

# Internal
INTERNAL_FUNCTION_SECRET=your_internal_secret_here
```

#### Optional (if using Stripe):
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Deployment Steps

### Step 1: Commit Your Changes

```bash
cd "d:\you-remembered-by-gem"

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "fix: remove base44 dependencies and update auth flows

- Fixed ResetPassword.jsx auth method signature
- Fixed ForgotPassword.jsx to use correct method
- Simplified CreateAccount.jsx registration flow
- Added *.md to .gitignore (77 files untracked)
- System now 100% standalone"

# Push to GitHub (if using GitHub)
git push origin main
```

### Step 2: Deploy to Railway

Railway automatically deploys when you push to the connected branch. However, you can also:

#### Option A: Automatic Deployment (Recommended)
```bash
# Just push to your main branch
git push origin main

# Railway will automatically:
# 1. Pull the changes
# 2. Run npm install
# 3. Run prisma generate
# 4. Run npm run build
# 5. Start server with: node server/index.js
```

#### Option B: Manual Deployment via Railway CLI
```bash
# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login
railway login

# Link to your project (first time only)
railway link

# Deploy
railway up
```

#### Option C: Railway Dashboard
1. Go to https://railway.app
2. Open your project
3. Click on your service
4. Go to "Deployments" tab
5. Click "Deploy" or wait for auto-deploy

### Step 3: Run Database Migration (If Schema Changed)

If you made any schema changes (you didn't in this update):

```bash
# Via Railway CLI
railway run npx prisma migrate deploy

# Or via Railway Dashboard:
# 1. Go to your service
# 2. Click "Variables"
# 3. Add a new variable: RUN_MIGRATIONS=true
# 4. Redeploy
```

### Step 4: Verify Deployment

#### Check Build Logs:
1. Go to Railway Dashboard
2. Click on your service
3. Go to "Deployments"
4. Click on the latest deployment
5. Check "Build Logs" and "Deploy Logs"

Look for:
```
✅ npm install completed
✅ prisma generate completed
✅ npm run build completed
✅ Server started on port 3001
```

#### Test Your Live App:

Visit your Railway URL (e.g., `https://your-app.railway.app`) and test:

1. **Homepage Loads** ✅
2. **Login Page** ✅
   - Test login with existing account
   
3. **Register Page** ✅
   - Create new test account
   
4. **Forgot Password** ✅
   - Request password reset
   - Check if email arrives
   
5. **Reset Password** ✅
   - Click link in email
   - Set new password
   
6. **Onboarding Flow** ✅
   - Add a recipient
   - Complete profile
   
7. **Gift Generation** ✅
   - Generate gifts for a recipient
   - Verify AI works (Claude API)

8. **Admin Dashboard** (if admin) ✅
   - View approval queue
   - Check products/retailers

## Monitoring Deployment

### View Real-time Logs:

```bash
# Via Railway CLI
railway logs

# Or in Dashboard:
# Service → Logs → View live stream
```

### Common Issues and Solutions:

#### Issue 1: Build Fails
```
Error: Cannot find module '@prisma/client'
```
**Solution**: Railway should run `prisma generate` automatically. Check `nixpacks.toml`:
```toml
[phases.build]
cmds = ['npx prisma generate', 'npm run build']
```

#### Issue 2: Server Won't Start
```
Error: listen EADDRINUSE: address already in use
```
**Solution**: Check that Railway's PORT environment variable is set. Server uses `process.env.PORT || 3001`

#### Issue 3: Database Connection Error
```
Error: Can't reach database server
```
**Solution**: 
1. Check `DATABASE_URL` in Railway variables
2. Make sure Railway PostgreSQL service is running
3. Verify connection string format:
   ```
   postgresql://user:password@host:port/database
   ```

#### Issue 4: Claude API Not Working
```
Error: Failed to generate content
```
**Solution**: 
1. Check `ANTHROPIC_API_KEY` is set correctly
2. Verify API key is valid at https://console.anthropic.com/
3. Check API usage limits

#### Issue 5: Email Not Sending
```
Error: Email failed to send
```
**Solution**:
1. Check `RESEND_API_KEY` is set
2. Verify `RESEND_FROM_EMAIL` is authorized domain
3. Check Resend dashboard for errors
4. Verify `ENABLE_EMAILS=true`

#### Issue 6: Frontend Shows 404
```
Cannot GET /
```
**Solution**: Check that `dist` folder was built:
```bash
# Railway should run this in build:
npm run build

# Verify server serves static files in production:
# server/index.js should have:
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}
```

## Post-Deployment Verification Script

Create a simple test to verify all endpoints:

```bash
# Save this as test-production.sh
RAILWAY_URL="https://your-app.railway.app"

echo "Testing Railway Deployment..."

# Test health endpoint
echo "1. Testing health endpoint..."
curl "$RAILWAY_URL/api/health"

# Test if frontend loads
echo "2. Testing frontend..."
curl -I "$RAILWAY_URL"

# Test auth endpoint
echo "3. Testing auth endpoints..."
curl "$RAILWAY_URL/api/auth/me"

echo "✅ Basic tests complete!"
```

## Rollback Plan (If Something Goes Wrong)

### Quick Rollback via Railway Dashboard:

1. Go to Railway Dashboard
2. Click your service
3. Go to "Deployments"
4. Find previous working deployment
5. Click "..." menu
6. Click "Redeploy"

### Rollback via Git:

```bash
# Find the last working commit
git log --oneline

# Revert to that commit
git revert <commit-hash>

# Push
git push origin main

# Railway will auto-deploy the reverted version
```

## Performance Optimization (Post-Deployment)

### 1. Enable Caching
Add to `server/index.js`:
```javascript
app.use(express.static('dist', {
  maxAge: '1d',
  etag: true
}));
```

### 2. Enable Compression
```bash
npm install compression
```

```javascript
import compression from 'compression';
app.use(compression());
```

### 3. Add Health Check
Railway already uses `/api/health`, make sure it returns quickly:
```javascript
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
```

## What Changed vs Previous Deployment

### Files Modified Since Last Push:
1. ✅ `src/pages/ResetPassword.jsx` - Fixed auth method call
2. ✅ `src/pages/ForgotPassword.jsx` - Changed to forgotPassword method
3. ✅ `src/pages/CreateAccount.jsx` - Removed OTP, simplified signup
4. ✅ `.gitignore` - Added *.md ignore rule

### No Schema Changes
- ✅ Database schema unchanged (no migrations needed)
- ✅ API endpoints unchanged
- ✅ Environment variables unchanged

### Backward Compatible
- ✅ All changes are backward compatible
- ✅ Existing users won't be affected
- ✅ No data migration required

## Success Indicators

Your deployment is successful when:

✅ **Build completes without errors**  
✅ **Server starts and shows "API server running"**  
✅ **Frontend loads at your Railway URL**  
✅ **Login/Register works**  
✅ **Password reset sends emails**  
✅ **Gift generation creates lists (Claude API works)**  
✅ **Database connections work**  
✅ **No errors in Railway logs**  

## Quick Command Reference

```bash
# Check what will be deployed
git status
git diff

# Commit and push
git add .
git commit -m "your message"
git push origin main

# Railway CLI commands
railway login
railway link
railway up
railway logs
railway run npx prisma migrate deploy

# Test production
curl https://your-app.railway.app/api/health
```

## Support Checklist

If deployment fails, check:

1. ☑️ Railway build logs for errors
2. ☑️ Railway deploy logs for startup errors
3. ☑️ Environment variables are set correctly
4. ☑️ DATABASE_URL is valid
5. ☑️ ANTHROPIC_API_KEY is valid
6. ☑️ RESEND_API_KEY is valid
7. ☑️ Node version matches (18+)
8. ☑️ All dependencies installed
9. ☑️ Prisma client generated
10. ☑️ Frontend built successfully

---

## 🎯 Quick Deploy Now

```bash
# 1. Commit all changes
git add .
git commit -m "fix: base44 removal complete - auth flows updated"

# 2. Push to trigger deploy
git push origin main

# 3. Monitor deployment
# Go to: https://railway.app → Your Project → Deployments

# 4. Test after deploy
# Visit: https://your-app.railway.app
```

**That's it!** Railway will handle the rest automatically. ✨

---

**Deployment Status**: Ready to Deploy  
**Risk Level**: Low (backward compatible changes)  
**Estimated Deploy Time**: 3-5 minutes  
**Downtime**: None (zero-downtime deployment)
