Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\..\LOBINHOLOGO.png"
if (-not (Test-Path $srcPath)) {
    $srcPath = Join-Path $PSScriptRoot "..\..\public_html\LOBINHOLOGO.png"
}

$destDir = Join-Path $PSScriptRoot "..\extension\assets\icons"
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

if (Test-Path $srcPath) {
    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    @(16, 32, 48, 128) | ForEach-Object {
        $size = $_
        $bmp = New-Object System.Drawing.Bitmap($size, $size)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($srcImg, 0, 0, $size, $size)
        $g.Dispose()
        $destFile = Join-Path $destDir "icon$size.png"
        $bmp.Save($destFile, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Host "Generated icon: icon$size.png"
    }
    $srcImg.Dispose()
} else {
    Write-Warning "Source logo not found at $srcPath"
}
