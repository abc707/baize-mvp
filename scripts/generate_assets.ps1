$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$audioDir = Join-Path $root "assets\audio"
$iconDir = Join-Path $root "assets\icons"
New-Item -ItemType Directory -Force -Path $audioDir, $iconDir | Out-Null

function Write-ToneWav {
  param(
    [string]$Path,
    [double]$Freq,
    [double]$Duration = 2.6,
    [int]$Rate = 22050
  )
  $n = [int]($Duration * $Rate)
  $data = New-Object byte[] ($n * 2)
  for ($i = 0; $i -lt $n; $i++) {
    $t = $i / $Rate
    $fadeIn = [Math]::Min(1.0, $t / 0.08)
    $fadeOut = [Math]::Min(1.0, ($Duration - $t) / 0.25)
    $env = $fadeIn * $fadeOut
    $sample = 0.32 * [Math]::Sin(2 * [Math]::PI * $Freq * $t)
    $sample += 0.12 * [Math]::Sin(2 * [Math]::PI * $Freq * 2 * $t)
    $value = [int]([Math]::Max(-1.0, [Math]::Min(1.0, $sample * $env)) * 32767)
    $bytes = [BitConverter]::GetBytes([int16]$value)
    $data[2 * $i] = $bytes[0]
    $data[2 * $i + 1] = $bytes[1]
  }
  $byteRate = $Rate * 2
  $header = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter $header
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
  $bw.Write([int](36 + $data.Length))
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
  $bw.Write([int]16)
  $bw.Write([int16]1)
  $bw.Write([int16]1)
  $bw.Write([int]$Rate)
  $bw.Write([int]$byteRate)
  $bw.Write([int16]2)
  $bw.Write([int16]16)
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
  $bw.Write([int]$data.Length)
  $bw.Flush()
  $out = New-Object System.IO.FileStream($Path, [System.IO.FileMode]::Create)
  $header.Position = 0
  $header.CopyTo($out)
  $out.Write($data, 0, $data.Length)
  $out.Close()
  $bw.Close()
  $header.Close()
}

$tones = @{
  "shanmen.wav" = 220.0
  "hubian.wav"  = 246.94
  "miaoyu.wav"  = 196.0
  "gucheng.wav" = 174.61
  "shanlu.wav"  = 261.63
}

foreach ($name in $tones.Keys) {
  Write-ToneWav -Path (Join-Path $audioDir $name) -Freq $tones[$name]
}

function Write-IconPng {
  param(
    [string]$Path,
    [int]$Size,
    [bool]$Maskable
  )
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $ink = [System.Drawing.Color]::FromArgb(18, 16, 12)
  $gold = [System.Drawing.Color]::FromArgb(201, 164, 92)
  $goldBright = [System.Drawing.Color]::FromArgb(232, 201, 122)
  $g.Clear($ink)
  $cx = $Size / 2
  $cy = $Size / 2
  $outer = if ($Maskable) { $Size * 0.36 } else { $Size * 0.42 }
  $pen = New-Object System.Drawing.Pen $goldBright, ([Math]::Max(2, $Size / 48.0))
  $discBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 24, 18))
  $goldBrush = New-Object System.Drawing.SolidBrush $gold
  $brightBrush = New-Object System.Drawing.SolidBrush $goldBright
  $rect = New-Object System.Drawing.RectangleF ($cx - $outer), ($cy - $outer), (2 * $outer), (2 * $outer)
  $g.FillEllipse($discBrush, $rect)
  $g.DrawEllipse($pen, $rect)
  $inner = $outer * 0.28
  $innerRect = New-Object System.Drawing.RectangleF ($cx - $inner), ($cy - $inner), (2 * $inner), (2 * $inner)
  $g.FillEllipse($goldBrush, $innerRect)
  $barW = [Math]::Max(3, $Size * 0.035)
  $g.FillRectangle($brightBrush, ($cx - $barW / 2), ($cy - $outer * 0.55), $barW, ($outer * 1.05))
  $g.FillRectangle($goldBrush, ($cx - $outer * 0.42), ($cy - $outer * 0.11), ($outer * 0.84), [Math]::Max(3, $Size * 0.03))
  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $pen.Dispose()
  $discBrush.Dispose()
  $goldBrush.Dispose()
  $brightBrush.Dispose()
}

Write-IconPng -Path (Join-Path $iconDir "icon-192.png") -Size 192 -Maskable $false
Write-IconPng -Path (Join-Path $iconDir "icon-512.png") -Size 512 -Maskable $false
Write-IconPng -Path (Join-Path $iconDir "icon-192-maskable.png") -Size 192 -Maskable $true
Write-IconPng -Path (Join-Path $iconDir "icon-512-maskable.png") -Size 512 -Maskable $true
Write-IconPng -Path (Join-Path $iconDir "apple-touch-icon.png") -Size 180 -Maskable $false
Write-Output "assets written"
