# One-time: copies Bubble Wrap build + optimized promo images into static/
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$g = "C:\Users\Gamer\Desktop\Bubble Wrap\BubbleWrap-Game"
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root "static\assets\our"
$play = Join-Path $root "static\play\bubble-wrap"
New-Item -ItemType Directory -Force $out, $play | Out-Null
Copy-Item "$g\web\BubbleWrap.html" "$play\index.html" -Force

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
function Save-Jpg($srcPath, $dstPath, $w, $h, $q = 82) {
  $src = [System.Drawing.Image]::FromFile($srcPath)
  # center crop to target aspect
  $ta = $w / $h; $sa = $src.Width / $src.Height
  if ($sa -gt $ta) { $ch = $src.Height; $cw = [int]($ch * $ta); $cx = [int](($src.Width - $cw) / 2); $cy = 0 }
  else { $cw = $src.Width; $ch = [int]($cw / $ta); $cx = 0; $cy = [int](($src.Height - $ch) / 2) }
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $gr = [System.Drawing.Graphics]::FromImage($bmp)
  $gr.InterpolationMode = 'HighQualityBicubic'; $gr.SmoothingMode = 'HighQuality'; $gr.PixelOffsetMode = 'HighQuality'
  if ($script:fit) {
    # letterbox: whole image, background filled with the source's corner color
    $gr.Clear(([System.Drawing.Bitmap]$src).GetPixel(2, 2))
    $s = [Math]::Min($w / $src.Width, $h / $src.Height); $dw = [int]($src.Width * $s); $dh = [int]($src.Height * $s)
    $gr.DrawImage($src, [int](($w - $dw) / 2), [int](($h - $dh) / 2), $dw, $dh)
  } else {
    $gr.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch), 'Pixel')
  }
  $p = New-Object System.Drawing.Imaging.EncoderParameters 1
  $p.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]$q)
  $bmp.Save($dstPath, $enc, $p)
  $gr.Dispose(); $bmp.Dispose(); $src.Dispose()
}
Save-Jpg "$g\crazygames\cg-cover-1920x1080.png" "$out\bubble-wrap-cover.jpg" 1280 720
$script:fit = $true
Save-Jpg "$g\crazygames\cg-cover-800x800.png" "$out\bubble-wrap-thumb.jpg" 512 384 88
$script:fit = $false
Save-Jpg "$g\promo\web-1-pop.png" "$out\bubble-wrap-1.jpg" 960 540
Save-Jpg "$g\promo\web-2-weapons.png" "$out\bubble-wrap-2.jpg" 960 540
Save-Jpg "$g\promo\web-3-rage.png" "$out\bubble-wrap-3.jpg" 960 540
Get-ChildItem $out, $play | ForEach-Object { "{0} {1:N0} KB" -f $_.Name, ($_.Length / 1KB) }
