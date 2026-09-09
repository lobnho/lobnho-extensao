<#
.SYNOPSIS
    Runs all automated test suites for Lobnho Extension.
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host "  🐺 LOBNHO EXTENSION — AUTOMATED TEST RUNNER              " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host ""

node (Join-Path $ScriptDir "test-syntax.js")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
node (Join-Path $ScriptDir "test-manifest.js")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
node (Join-Path $ScriptDir "test-generators.js")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  ✅ ALL AUTOMATED TESTS PASSED (100% GREEN)               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
