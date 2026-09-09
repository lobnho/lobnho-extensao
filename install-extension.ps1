<#
.SYNOPSIS
    Automated cross-browser installer and launcher for Lobnho Extension.
.DESCRIPTION
    Detects the default browser in Windows Registry (Thorium, Brave, Chrome, Edge, Opera, Firefox),
    configures extension loading, creates a Desktop shortcut, and launches the browser ready for testing.
#>

param (
    [switch]$Dev,
    [string]$CustomBrowserPath = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ExtensionDir = Join-Path $ScriptDir "extension"
$TestPage = Join-Path $ScriptDir "test-page.html"

Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host "  LOBNHO EXTENSION AUTOMATED BROWSER INSTALLER" -ForegroundColor Yellow
Write-Host "  Orkut Nostalgia Theme and Precision Design Inspector" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host ""

# 1. Verify Extension Directory
if (-not (Test-Path $ExtensionDir)) {
    Write-Error "Extension directory not found at: $ExtensionDir"
    exit 1
}

# 2. Synchronize Vendor dependencies if needed
$VendorDir = Join-Path $ExtensionDir "src\shared\vendor"
if (-not (Test-Path (Join-Path $VendorDir "gsap.min.js"))) {
    Write-Host "[*] Setting up local vendor dependencies..." -ForegroundColor Gray
    node (Join-Path $ScriptDir "scripts\setup-vendor.js")
}

# 3. Detect Default Browser from Windows Registry
Write-Host "[*] Detecting default browser from Windows Registry..." -ForegroundColor Cyan

$DefaultProgId = ""
try {
    $UserChoice = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice" -ErrorAction SilentlyContinue
    if ($UserChoice -and $UserChoice.ProgId) {
        $DefaultProgId = $UserChoice.ProgId
        Write-Host "    Default UserChoice ProgId: $DefaultProgId" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "    Could not read UserChoice ProgId." -ForegroundColor DarkGray
}

# Candidate browser definitions
$BrowserCandidates = @(
    @{
        Name = "Thorium"
        Path = "$env:LOCALAPPDATA\Thorium\Application\thorium.exe"
        ProgMatch = "Thorium"
        Type = "chromium"
    },
    @{
        Name = "Brave"
        Path = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
        ProgMatch = "Brave"
        Type = "chromium"
    },
    @{
        Name = "Google Chrome"
        Path = "C:\Program Files\Google\Chrome\Application\chrome.exe"
        ProgMatch = "Chrome"
        Type = "chromium"
    },
    @{
        Name = "Google Chrome (User)"
        Path = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        ProgMatch = "Chrome"
        Type = "chromium"
    },
    @{
        Name = "Microsoft Edge"
        Path = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        ProgMatch = "MSEdge"
        Type = "chromium"
    },
    @{
        Name = "Opera"
        Path = "$env:LOCALAPPDATA\Programs\Opera\launcher.exe"
        ProgMatch = "Opera"
        Type = "chromium"
    },
    @{
        Name = "Firefox"
        Path = "C:\Program Files\Mozilla Firefox\firefox.exe"
        ProgMatch = "Firefox"
        Type = "firefox"
    }
)

$SelectedBrowser = $null

# First: match against custom path if provided
if ($CustomBrowserPath -and (Test-Path $CustomBrowserPath)) {
    $SelectedBrowser = @{
        Name = "Custom Browser"
        Path = $CustomBrowserPath
        Type = "chromium"
    }
}

# Second: match against DefaultProgId if found
if (-not $SelectedBrowser -and $DefaultProgId) {
    foreach ($cand in $BrowserCandidates) {
        if ($DefaultProgId -like "*$($cand.ProgMatch)*" -and (Test-Path $cand.Path)) {
            $SelectedBrowser = $cand
            break
        }
    }
}

# Third: fallback to first installed candidate
if (-not $SelectedBrowser) {
    foreach ($cand in $BrowserCandidates) {
        if (Test-Path $cand.Path) {
            $SelectedBrowser = $cand
            break
        }
    }
}

if (-not $SelectedBrowser) {
    Write-Host "[!] No supported browser detected automatically." -ForegroundColor Red
    Write-Host "    Please load unpacked extension manually from: $ExtensionDir" -ForegroundColor Yellow
    exit 1
}

Write-Host "[+] Target Browser Selected: $($SelectedBrowser.Name)" -ForegroundColor Green
Write-Host "    Executable: $($SelectedBrowser.Path)" -ForegroundColor DarkGray
Write-Host "    Extension Path: $ExtensionDir" -ForegroundColor DarkGray
Write-Host ""

# 4. Create Desktop Shortcut for convenient 1-click launch
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
    $ShortcutPath = Join-Path $DesktopPath "Launch Lobnho Extension.lnk"
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $SelectedBrowser.Path
    if ($SelectedBrowser.Type -eq "chromium") {
        $UserDataDirShortcut = Join-Path $env:TEMP "lobnho-browser-profile"
        $Shortcut.Arguments = "--user-data-dir=`"$UserDataDirShortcut`" --load-extension=`"$ExtensionDir`" `"$TestPage`""
    } else {
        $Shortcut.Arguments = "`"$TestPage`""
    }
    $Shortcut.Description = "Launch $($SelectedBrowser.Name) with Lobnho Extension loaded"
    $Shortcut.Save()
    Write-Host "[+] Desktop Shortcut created: $ShortcutPath" -ForegroundColor Green
} catch {
    Write-Host "[-] Could not create Desktop shortcut (non-fatal): $_" -ForegroundColor DarkGray
}

# 5. Launch Target Browser with Extension
Write-Host "[*] Launching $($SelectedBrowser.Name) with Lobnho Extension..." -ForegroundColor Cyan

if ($SelectedBrowser.Type -eq "chromium") {
    $UserDataDir = Join-Path $env:TEMP "lobnho-browser-profile"
    $ArgsList = @(
        "--user-data-dir=`"$UserDataDir`"",
        "--load-extension=`"$ExtensionDir`"",
        "--disable-extensions-except=`"$ExtensionDir`"",
        "--no-first-run",
        "--no-default-browser-check",
        "`"$TestPage`""
    )
    Start-Process -FilePath $SelectedBrowser.Path -ArgumentList $ArgsList
} else {
    Write-Host "[*] For Firefox, opening test page. Open about:debugging to load temporary extension." -ForegroundColor Yellow
    Start-Process -FilePath $SelectedBrowser.Path -ArgumentList "`"$TestPage`""
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  [OK] LOBNHO EXTENSION SUCCESSFULLY LAUNCHED!            " -ForegroundColor Green
Write-Host "  1. Test Page is now open in your browser.               " -ForegroundColor White
Write-Host "  2. Click the Lobnho icon in the toolbar or press:       " -ForegroundColor White
Write-Host "     Alt + Shift + L to toggle the Target Cursor!         " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
