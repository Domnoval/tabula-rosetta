<#
.SYNOPSIS
  Read-only, byte-for-byte (SHA256) comparison of two folder trees. For proving a backup.

.DESCRIPTION
  Walks folder A and checks every file against the same relative path in folder B:
  missing files, size differences, and content (hash) differences. Then lists files
  that exist only in B. Nothing is written to A or B. The report goes to -Out
  (default: your temp folder), and the script refuses to write it inside A or B.

  Cheap checks first: a file missing from B, or a different size, is reported without
  hashing. Hashing only happens when the sizes match.

.PARAMETER A
  Folder to check (the reference side), e.g. D:\Rescue-DAYWALKER-Michael

.PARAMETER B
  Folder to compare against, e.g. E:\Rescue-DAYWALKER-Michael

.PARAMETER SkipTop
  Top-level folder names (inside A and B) to leave out, comma or semicolon separated.
  Use it for live or known-different folders, e.g. _rescue,Downloads,Pictures

.PARAMETER IncludeRebuildable
  Also compare node_modules, __pycache__, .venv, venv, .gradle, .next (skipped by default).

.PARAMETER Out
  Where to write the report.

.EXAMPLE
  .\Compare-Backups.ps1 -A D:\Rescue-DAYWALKER-Michael -B E:\Rescue-DAYWALKER-Michael -SkipTop "_rescue,Downloads,Pictures,Extra-C_Users_Michael_.claude,Extra-C_Users_Michael_.codex"

.EXAMPLE
  .\Compare-Backups.ps1 -A C:\vault -B E:\Rescue-DAYWALKER-Michael\Extra-C_vault
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$A,
    [Parameter(Mandatory = $true)][string]$B,
    [string[]]$SkipTop = @(),
    [switch]$IncludeRebuildable,
    [string]$Out = (Join-Path ([IO.Path]::GetTempPath()) 'compare-backups-report.txt')
)

$ErrorActionPreference = 'Continue'
$sep = [IO.Path]::DirectorySeparatorChar
$SkipTop = @($SkipTop | ForEach-Object { $_ -split '[,;]' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$rxRebuild = '[\\/](node_modules|__pycache__|\.venv|venv|\.gradle|\.next)[\\/]'

foreach ($p in @($A, $B)) {
    if (-not (Test-Path -LiteralPath $p -PathType Container)) { Write-Host "Not a folder: $p" -ForegroundColor Red; exit 2 }
}
$aRoot = (Resolve-Path -LiteralPath $A).ProviderPath.TrimEnd('\', '/')
$bRoot = (Resolve-Path -LiteralPath $B).ProviderPath.TrimEnd('\', '/')
$outFull = [IO.Path]::GetFullPath($Out)
foreach ($r in @($aRoot, $bRoot)) {
    if ($outFull.StartsWith($r + $sep, [StringComparison]::OrdinalIgnoreCase)) {
        Write-Host "Refusing to write the report inside $r. Pick another -Out." -ForegroundColor Red; exit 2
    }
}

$script:checked = 0; $script:hashed = 0; $script:skipped = 0; $script:bytes = [int64]0
$script:nMismatch = 0; $script:nMissing = 0; $script:nSize = 0; $script:nOnlyB = 0; $script:nUnreadable = 0
$script:shown = 0
$started = Get-Date

Set-Content -LiteralPath $outFull -Value @(
    'Compare-Backups report - ' + (Get-Date),
    "A: $aRoot",
    "B: $bRoot",
    ('Skipping top-level: ' + ($SkipTop -join ', ')),
    ('Rebuildable folders (node_modules etc.): ' + $(if ($IncludeRebuildable) { 'compared' } else { 'skipped' })),
    ''
)

function Add-Issue([string]$Text) {
    Add-Content -LiteralPath $outFull -Value $Text
    if ($script:shown -lt 20) { Write-Host "  $Text" -ForegroundColor Yellow; $script:shown++ }
    elseif ($script:shown -eq 20) { Write-Host '  ... more in the report file' -ForegroundColor DarkGray; $script:shown++ }
}

function Test-Skip([string]$Rel) {
    $top = ($Rel -split '[\\/]')[0]
    if ($SkipTop -contains $top) { return $true }
    if (-not $IncludeRebuildable -and (($sep + $Rel) -match $rxRebuild)) { return $true }
    return $false
}

Write-Host ''
Write-Host "Comparing  A: $aRoot" -ForegroundColor Cyan
Write-Host "      vs   B: $bRoot" -ForegroundColor Cyan
Write-Host 'Read-only. Large folders take a while; progress prints every 1000 files.' -ForegroundColor DarkGray

Get-ChildItem -LiteralPath $aRoot -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $f = $_
    $rel = $f.FullName.Substring($aRoot.Length).TrimStart('\', '/')
    if (Test-Skip $rel) { $script:skipped++; return }
    $script:checked++
    if (($script:checked % 1000) -eq 0) {
        Write-Host ('  {0} files checked, {1:N1} GB hashed, {2:N0}s elapsed' -f $script:checked, ($script:bytes / 1GB), ((Get-Date) - $started).TotalSeconds) -ForegroundColor DarkGray
    }
    $other = $bRoot + $sep + $rel
    $fi = New-Object System.IO.FileInfo -ArgumentList $other
    if (-not $fi.Exists) { $script:nMissing++; Add-Issue "MISSING in B: $rel"; return }
    if ($fi.Length -ne $f.Length) { $script:nSize++; Add-Issue ("SIZE differs: {0}  (A {1} bytes, B {2} bytes)" -f $rel, $f.Length, $fi.Length); return }
    try {
        $ha = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256 -ErrorAction Stop).Hash
        $hb = (Get-FileHash -LiteralPath $other -Algorithm SHA256 -ErrorAction Stop).Hash
    } catch {
        $script:nUnreadable++; Add-Issue ("UNREADABLE: {0}  ({1})" -f $rel, $_.Exception.Message); return
    }
    $script:hashed++; $script:bytes += $f.Length
    if ($ha -ne $hb) { $script:nMismatch++; Add-Issue "CONTENT differs (same size, different bytes): $rel" }
}

Write-Host 'Checking for files that exist only in B...' -ForegroundColor DarkGray
Get-ChildItem -LiteralPath $bRoot -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = $_.FullName.Substring($bRoot.Length).TrimStart('\', '/')
    if (Test-Skip $rel) { return }
    if (-not (Test-Path -LiteralPath ($aRoot + $sep + $rel) -PathType Leaf)) { $script:nOnlyB++; Add-Issue "ONLY in B: $rel" }
}

$problems = $script:nMismatch + $script:nMissing + $script:nSize + $script:nUnreadable
$summary = @(
    '',
    ('Files compared: {0}  (hashed {1}, {2:N1} GB; skipped {3})' -f $script:checked, $script:hashed, ($script:bytes / 1GB), $script:skipped),
    ('Content differs: {0}   Size differs: {1}   Missing in B: {2}   Unreadable: {3}   Only in B: {4}' -f $script:nMismatch, $script:nSize, $script:nMissing, $script:nUnreadable, $script:nOnlyB)
)
if ($problems -eq 0) { $summary += 'RESULT: IDENTICAL. Every compared file in A exists in B with matching bytes.' }
else { $summary += "RESULT: DIFFERENCES FOUND ($problems files in A are missing, changed or unreadable in B). See the report." }
Add-Content -LiteralPath $outFull -Value $summary
Write-Host ''
foreach ($l in $summary) { Write-Host $l -ForegroundColor $(if ($l -like 'RESULT: IDENTICAL*') { 'Green' } elseif ($l -like 'RESULT:*') { 'Red' } else { 'Gray' }) }
Write-Host "Report: $outFull" -ForegroundColor Cyan
if ($problems -eq 0) { exit 0 } else { exit 1 }
