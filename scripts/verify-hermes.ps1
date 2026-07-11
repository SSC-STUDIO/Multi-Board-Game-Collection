# scripts/verify-hermes.ps1 — Verification gate for the Multi Board Game Collection
# Runs node --test, npm run check, and npm run build, then confirms OthelloApp diff is in scope.
# Exit 0 = all checks pass. Nonzero = failure.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSCommandPath | Split-Path -Parent

function Run-Step($label, $cmd) {
    Write-Host "`n=== $label ===" -ForegroundColor Cyan
    $ErrorActionPreference = "Continue"
    $output = & cmd /c "cd /d $root && $cmd" 2>&1
    $output | Where-Object { $_ -notmatch "^warning:" } | ForEach-Object { Write-Host $_ }
    $exit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($exit -ne 0) {
        Write-Host "`nFAIL: $label exited with code $exit" -ForegroundColor Red
        exit 1
    }
    Write-Host "PASS: $label" -ForegroundColor Green
}

# Step 1: vitest run
Run-Step "node --test (vitest)" "npx vitest run"

# Step 2: lint / module check
Run-Step "npm run check" "npm run check"

# Step 3: build
Run-Step "npm run build" "npm run build"

# Step 4: verify diff is within scope
Write-Host "`n=== Diff check ===" -ForegroundColor Cyan
$ErrorActionPreference = "Continue"
$diffOutput = @()
$diffOutput = cmd /c "cd /d $root && git diff --name-only" 2>$null
$ErrorActionPreference = "Stop"
$diffList = @($diffOutput | Where-Object { $_ -ne "" -and $_ -notmatch "warning:" })
$allowed = @("src/games/othello/OthelloApp.js", "src/games/othello/OthelloApp.test.js", "src/games/chess/ChessApp.js", "src/games/chess/ChessApp.test.js", "src/games/go/GoApp.js", "src/games/go/GoApp.test.js", "src/games/xiangqi/XiangqiApp.js", "src/games/xiangqi/XiangqiApp.test.js", "src/games/shogi/ShogiApp.js")
foreach ($file in $diffList) {
    if ($file -notin $allowed) {
        Write-Host "FAIL: unexpected changed file: $file" -ForegroundColor Red
        exit 1
    }
}
Write-Host "PASS: only expected files changed" -ForegroundColor Green

Write-Host "`n=== ALL CHECKS PASSED ===" -ForegroundColor Green
exit 0
