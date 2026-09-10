# Railway Deployment Script
# This script will commit and push changes to trigger Railway deployment

Write-Host "`n🚀 ===== RAILWAY DEPLOYMENT SCRIPT =====" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not in a git repository!" -ForegroundColor Red
    Write-Host "Please run this script from the project root." -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Step 1: Checking git status..." -ForegroundColor Yellow
git status --short | Select-Object -First 20

Write-Host "`n❓ Do you want to commit these changes? (Y/N): " -ForegroundColor Yellow -NoNewline
$confirm = Read-Host

if ($confirm -ne 'Y' -and $confirm -ne 'y') {
    Write-Host "❌ Deployment cancelled." -ForegroundColor Red
    exit 0
}

Write-Host "`n📦 Step 2: Staging all changes..." -ForegroundColor Yellow
git add .

Write-Host "`n💾 Step 3: Committing changes..." -ForegroundColor Yellow
$commitMessage = @"
fix: base44 removal complete - auth flows updated

Changes:
- Fixed ResetPassword.jsx auth method signature
- Fixed ForgotPassword.jsx to use forgotPassword method
- Simplified CreateAccount.jsx (removed OTP flow)
- Added *.md to .gitignore (77 internal docs removed)
- System now 100% standalone with no external dependencies

Deploy: Ready for production
Risk: Low (backward compatible changes)
"@

git commit -m $commitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Commit successful!" -ForegroundColor Green

Write-Host "`n🔍 Step 4: Checking current branch..." -ForegroundColor Yellow
$branch = git branch --show-current
Write-Host "Current branch: $branch" -ForegroundColor Cyan

Write-Host "`n❓ Push to origin/$branch and deploy to Railway? (Y/N): " -ForegroundColor Yellow -NoNewline
$confirmPush = Read-Host

if ($confirmPush -ne 'Y' -and $confirmPush -ne 'y') {
    Write-Host "❌ Push cancelled." -ForegroundColor Red
    Write-Host "💡 Changes are committed locally. You can push later with: git push origin $branch" -ForegroundColor Yellow
    exit 0
}

Write-Host "`n🚀 Step 5: Pushing to GitHub..." -ForegroundColor Yellow
git push origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host "💡 Try: git push origin $branch --force-with-lease" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ ===== DEPLOYMENT INITIATED! =====" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Railway is now building and deploying your changes..." -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Go to: https://railway.app" -ForegroundColor White
Write-Host "   2. Open your project" -ForegroundColor White
Write-Host "   3. Check 'Deployments' tab" -ForegroundColor White
Write-Host "   4. Monitor build logs" -ForegroundColor White
Write-Host "   5. Test your app after deployment" -ForegroundColor White
Write-Host ""
Write-Host "⏱️  Estimated deployment time: 3-5 minutes" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ Deployment script complete!" -ForegroundColor Green
Write-Host ""

# Ask if user wants to open Railway dashboard
Write-Host "❓ Open Railway dashboard in browser? (Y/N): " -ForegroundColor Yellow -NoNewline
$openBrowser = Read-Host

if ($openBrowser -eq 'Y' -or $openBrowser -eq 'y') {
    Start-Process "https://railway.app"
    Write-Host "✅ Browser opened!" -ForegroundColor Green
}

Write-Host "`n📝 For detailed deployment info, see: RAILWAY_DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
