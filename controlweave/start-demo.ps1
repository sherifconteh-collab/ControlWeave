# ControlWeave Demo Startup Script
# Run once from PowerShell: .\start-demo.ps1

$ErrorActionPreference = "Stop"
$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "=== ControlWeave Demo Setup ===" -ForegroundColor Cyan

# ── 1. Install dependencies ──────────────────────────────────────────────────
Write-Host "`n[1/4] Installing backend dependencies..." -ForegroundColor Yellow
Push-Location $Backend
npm install --prefer-offline --no-audit 2>&1 | Select-Object -Last 3
Pop-Location

Write-Host "[1/4] Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location $Frontend
npm install --prefer-offline --no-audit 2>&1 | Select-Object -Last 3
Pop-Location

# ── 2. Run migrations ────────────────────────────────────────────────────────
Write-Host "`n[2/4] Running database migrations..." -ForegroundColor Yellow
Push-Location $Backend
npm run migrate
Pop-Location

# ── 3. Seed demo data ────────────────────────────────────────────────────────
Write-Host "`n[3/4] Seeding demo data..." -ForegroundColor Yellow
Push-Location $Backend
npm run seed:demo-full
Pop-Location

# ── 4. Open two terminals: backend + frontend ────────────────────────────────
Write-Host "`n[4/4] Starting backend and frontend in separate windows..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$Backend'
  Write-Host 'Backend starting on http://localhost:3001' -ForegroundColor Green
  npm run dev
"

Start-Sleep -Seconds 3   # give backend a head start

Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  Set-Location '$Frontend'
  Write-Host 'Frontend starting on http://localhost:3000' -ForegroundColor Green
  npm run dev
"

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend : http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Demo logins (password: ControlWeave!2026):" -ForegroundColor Cyan
Write-Host "    Community    : admin@community.com" -ForegroundColor White
Write-Host "    Pro          : admin@pro.com" -ForegroundColor White
Write-Host "    Enterprise   : admin@enterprise.com" -ForegroundColor White
Write-Host "    GovCloud     : admin@govcloud.com" -ForegroundColor White
Write-Host ""
Write-Host "  Two new PowerShell windows have opened (backend + frontend)." -ForegroundColor DarkGray
Write-Host "  Wait ~15 seconds for Next.js to compile, then open the URL above." -ForegroundColor DarkGray
Write-Host ""
