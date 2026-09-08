# Restart Server Script
# This script stops the current server and provides instructions to start it again

Write-Host "`n🔄 Stopping existing Node.js servers on port 3001..." -ForegroundColor Yellow

# Find and stop processes on port 3001
$connections = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        try {
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Stopping process $pid ($($process.ProcessName))..." -ForegroundColor Cyan
                Stop-Process -Id $pid -Force
                Write-Host "  ✅ Stopped" -ForegroundColor Green
            }
        } catch {
            Write-Host "  ⚠️  Could not stop process $pid" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  No processes found on port 3001" -ForegroundColor Gray
}

Write-Host "`n✅ Server stopped successfully!" -ForegroundColor Green
Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: npm run dev" -ForegroundColor White
Write-Host "  2. Wait for the server to start" -ForegroundColor White
Write-Host "  3. Refresh your browser" -ForegroundColor White
Write-Host "  4. Go to Admin Dashboard, Products, By Retailer, then find Aadornattire" -ForegroundColor White
Write-Host ""
