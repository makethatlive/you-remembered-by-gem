# Sync Database from Live to Local
# Simple approach using pg_dump and psql

Write-Host "🔄 Starting database sync from live to local..." -ForegroundColor Cyan
Write-Host ""

# Database URLs
$LIVE_DB = "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
$LOCAL_DB = "postgresql://postgres:password@localhost:5432/youremembered"

# Check if local database exists, if not create it
Write-Host "📊 Checking local database..." -ForegroundColor Yellow
$dbExists = psql $LOCAL_DB -c "\l" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   💡 Local database doesn't exist or wrong credentials" -ForegroundColor Yellow
    Write-Host "   📝 Please update LOCAL_DB in this script with your local database URL" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Example: postgresql://postgres:YOUR_PASSWORD@localhost:5432/YOUR_DATABASE" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Create backup directory
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupDir = "database-backups\live-sync-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Host "📤 Exporting live database..." -ForegroundColor Yellow
$dumpFile = "$backupDir\live-dump.sql"

# Export from live
pg_dump --no-owner --no-acl --clean --if-exists -f $dumpFile $LIVE_DB

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Live database exported" -ForegroundColor Green
    Write-Host "   💾 Backup saved to: $dumpFile" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "   ❌ Export failed!" -ForegroundColor Red
    exit 1
}

# Import to local
Write-Host "📥 Importing to local database..." -ForegroundColor Yellow
Write-Host "   ⚠️  This will REPLACE your local database!" -ForegroundColor Red
Write-Host ""
$confirm = Read-Host "Continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "   ❌ Cancelled" -ForegroundColor Yellow
    exit 0
}

psql $LOCAL_DB -f $dumpFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "   ✅ Database imported to local" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Sync complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Summary:" -ForegroundColor Cyan
    Write-Host "   ✅ Live database backed up to: $backupDir" -ForegroundColor Gray
    Write-Host "   ✅ Local database now matches live" -ForegroundColor Gray
    Write-Host "   ✅ You can now test your changes locally" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "   ❌ Import failed!" -ForegroundColor Red
    exit 1
}
