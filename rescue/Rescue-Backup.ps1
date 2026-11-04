<#
.SYNOPSIS
  Crash-tolerant, resumable backup for a Windows laptop that keeps dying.

.DESCRIPTION
  Copies what matters, most irreplaceable first, to an external drive using
  robocopy (built into Windows - nothing to install).

  Why it survives crashes:
    - Every folder is its own robocopy run. Running the script again skips what
      is already copied (same size + timestamp), so a crash costs at most the
      file that was mid-copy.
    - Progress is kept on the external drive in <dest>\Rescue-...\_rescue\state.txt
    - -AutoResume relaunches the script at your next logon until it finishes.
    - Low thread count by default: less heat, fewer reasons to fall over.

  It only READS from C: and only WRITES to the destination drive (plus one
  optional HKCU Run entry if you pass -AutoResume, removed when the job ends).

.PARAMETER Dest
  Destination drive or folder, e.g. E:\   (you are asked to pick if omitted)

.PARAMETER ExtraPaths
  Extra folders to copy, separated by semicolons, e.g. "D:\Art;C:\Games\Saves"

.PARAMETER Threads
  robocopy threads per run (default 2). Raise only if the machine is stable.

.PARAMETER MaxTier
  Stop after this tier. 1 = Desktop+Documents, 2 = projects, 3 = configs/keys,
  4 = Pictures + small profile folders, 5 = Downloads/Music/Videos (default 5).

.PARAMETER AutoResume
  After a crash, relaunch this script at each logon until the job is complete.

.PARAMETER VerifyOnly
  Do not copy anything; just compare source against destination.

.EXAMPLE
  .\Rescue-Backup.ps1 -Dest E:\ -AutoResume
#>
[CmdletBinding()]
param(
    [string]$Dest,
    [string]$ExtraPaths = '',
    [ValidateRange(1, 16)][int]$Threads = 2,
    [ValidateRange(1, 5)][int]$MaxTier = 5,
    [switch]$AutoResume,
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Continue'
$ScriptPath = $MyInvocation.MyCommand.Path
$UserHome   = $env:USERPROFILE
$RunKey     = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName    = 'TabulaRescueBackup'

function Say([string]$Text, [string]$Color = 'Gray') { Write-Host $Text -ForegroundColor $Color }

function Format-Root([string]$p) {
    $p = $p.Trim().Trim('"')
    if ($p -match '^[A-Za-z]:\\?$') { return ($p.Substring(0, 1).ToUpper() + ':\') }
    return $p.TrimEnd('\')
}

function Get-SafeName([string]$p) { return (($p -replace '[:\\/ ]+', '_').Trim('_')) }

# Keep the machine awake while we run (does not change any power settings).
try {
    Add-Type -Namespace RescueWin32 -Name Power -ErrorAction Stop -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
    [void][RescueWin32.Power]::SetThreadExecutionState([uint32]2147483649)   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
} catch { }

function Select-Destination {
    $sys = $env:SystemDrive.Substring(0, 1)
    $vols = @(Get-Volume -ErrorAction SilentlyContinue | Where-Object {
        $_.DriveLetter -and ("$($_.DriveLetter)" -ne $sys) -and $_.Size -gt 0 -and
        ($_.DriveType -eq 'Fixed' -or $_.DriveType -eq 'Removable')
    })
    if ($vols.Count -eq 0) { throw 'No second drive found. Plug in the external drive, or pass -Dest E:\' }
    Say 'Drives other than the system drive:' 'Cyan'
    foreach ($v in $vols) {
        Say ('  {0}:  {1,-20} free {2,8:N1} GB of {3,8:N1} GB  [{4}]' -f $v.DriveLetter, $v.FileSystemLabel, ($v.SizeRemaining / 1GB), ($v.Size / 1GB), $v.FileSystem)
    }
    $pick = (Read-Host 'Type the letter of the drive to back up TO').Trim().TrimEnd(':', '\')
    if ($pick.Length -ne 1 -or -not ($vols | Where-Object { "$($_.DriveLetter)" -eq $pick })) {
        throw "'$pick' is not one of the listed drives."
    }
    return ($pick.ToUpper() + ':\')
}

function Get-FreeGB {
    try {
        $d = New-Object System.IO.DriveInfo -ArgumentList $Dest.Substring(0, 1)
        return [math]::Round($d.AvailableFreeSpace / 1GB, 1)
    } catch { return 0 }
}

# ---------------------------------------------------------------- the plan ---
$script:Items = @()
$script:Seq = 0

function Add-BackupItem {
    param(
        [int]$Tier,
        [string]$Name,
        [string]$Path,
        [string]$Files = '*',
        [bool]$Recurse = $true,
        [string[]]$ExcludeDirs = @()
    )
    if (-not $Path) { return }
    $Path = Format-Root $Path
    if (-not (Test-Path -LiteralPath $Path)) { return }
    if ($script:Items | Where-Object { $_.Name -eq $Name }) { return }
    $script:Seq++
    $script:Items += [pscustomobject]@{
        Seq = $script:Seq; Tier = $Tier; Name = $Name; Path = $Path
        Files = $Files; Recurse = $Recurse; ExcludeDirs = $ExcludeDirs
    }
}

function Build-Plan {
    $docs = [Environment]::GetFolderPath('MyDocuments')

    # Tier 1 - the stuff you cannot recreate
    Add-BackupItem -Tier 1 -Name 'Desktop'   -Path ([Environment]::GetFolderPath('DesktopDirectory'))
    Add-BackupItem -Tier 1 -Name 'Documents' -Path $docs

    # Tier 2 - project folders in the usual places, plus anything you name
    $rebuildable = @('node_modules', '__pycache__', '.venv', 'venv', '.gradle')
    $devNames = 'source', 'repos', 'projects', 'dev', 'code', 'github', 'git', 'workspace', 'work',
                'art', 'blender', 'touchdesigner', 'unity', 'unreal projects'
    foreach ($d in $devNames) {
        $n = Get-SafeName $d
        Add-BackupItem -Tier 2 -Name "Dev-$n"     -Path (Join-Path $UserHome $d)                  -ExcludeDirs $rebuildable
        Add-BackupItem -Tier 2 -Name "DevRoot-$n" -Path ($env:SystemDrive + '\' + $d)             -ExcludeDirs $rebuildable
    }
    foreach ($p in $script:ExtraList) {
        if (Test-Path -LiteralPath (Format-Root $p)) {
            Add-BackupItem -Tier 2 -Name ('Extra-' + (Get-SafeName $p)) -Path $p
        } else {
            Say "Skipping extra path that does not exist: $p" 'Yellow'
        }
    }

    # Tier 3 - small, high-value: keys, settings, bookmarks
    Add-BackupItem -Tier 3 -Name 'Config-ssh'       -Path (Join-Path $UserHome '.ssh')
    Add-BackupItem -Tier 3 -Name 'Config-gnupg'     -Path (Join-Path $UserHome '.gnupg')
    Add-BackupItem -Tier 3 -Name 'Config-gitconfig' -Path $UserHome -Files '.gitconfig' -Recurse $false
    Add-BackupItem -Tier 3 -Name 'Config-VSCode'    -Path (Join-Path $env:APPDATA 'Code\User')
    Add-BackupItem -Tier 3 -Name 'Config-Blender'   -Path (Join-Path $env:APPDATA 'Blender Foundation')
    Add-BackupItem -Tier 3 -Name 'Config-Firefox'   -Path (Join-Path $env:APPDATA 'Mozilla\Firefox')
    Add-BackupItem -Tier 3 -Name 'Config-ChromeBookmarks' -Path (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default')    -Files 'Bookmarks' -Recurse $false
    Add-BackupItem -Tier 3 -Name 'Config-EdgeBookmarks'   -Path (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data\Default')   -Files 'Bookmarks' -Recurse $false

    # Tier 4 - Pictures and small profile folders
    Add-BackupItem -Tier 4 -Name 'Pictures' -Path ([Environment]::GetFolderPath('MyPictures'))
    foreach ($n in 'Saved Games', 'Contacts', 'Favorites', '3D Objects') {
        Add-BackupItem -Tier 4 -Name ('Profile-' + (Get-SafeName $n)) -Path (Join-Path $UserHome $n)
    }

    # Tier 5 - bulk
    Add-BackupItem -Tier 5 -Name 'Downloads' -Path (Join-Path $UserHome 'Downloads')
    Add-BackupItem -Tier 5 -Name 'Music'     -Path ([Environment]::GetFolderPath('MyMusic'))
    Add-BackupItem -Tier 5 -Name 'Videos'    -Path ([Environment]::GetFolderPath('MyVideos'))
}

# ---------------------------------------------------------------- robocopy ---
function Get-RoboArgs($it, [string[]]$more) {
    $ra = @($it.Path, (Join-Path $Root $it.Name))
    if ($it.Files -ne '*') { $ra += $it.Files }
    if ($it.Recurse) { $ra += '/E' }
    $ra += @('/COPY:DAT', '/DCOPY:DAT', '/FFT', '/XJ',
             '/XF', 'Thumbs.db', 'desktop.ini', '*.sock',
             '/XD', '$RECYCLE.BIN', 'System Volume Information')
    if ($it.ExcludeDirs) { $ra += $it.ExcludeDirs }
    return ($ra + $more)
}

function Invoke-Backup($it) {
    $log = Join-Path $Meta ("robocopy-{0}.log" -f $it.Name)
    $ra = Get-RoboArgs $it @('/R:1', '/W:1', "/MT:$Threads", '/NP', '/NDL', '/TEE', "/LOG+:$log")
    & robocopy @ra | Out-Host
    return [int]$LASTEXITCODE
}

function Test-Backup($it) {
    # /L = list only, nothing is copied. Exit code 0 means source and destination match.
    $ra = Get-RoboArgs $it @('/L', '/XX', '/R:0', '/W:0', '/NJH', '/NJS', '/NDL', '/NFL', '/NP')
    & robocopy @ra | Out-Null
    return [int]$LASTEXITCODE
}

# ------------------------------------------------------------ auto-resume ---
function Enable-AutoResume {
    if (-not $ScriptPath) { Say 'AutoResume needs the script saved as a .ps1 file - skipping.' 'Yellow'; return }
    $cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{0}" -Dest "{1}" -Threads {2} -MaxTier {3} -AutoResume' -f `
        $ScriptPath, $Dest.TrimEnd('\'), $Threads, $MaxTier
    if ($script:ExtraList.Count -gt 0) { $cmd += (' -ExtraPaths "{0}"' -f ($script:ExtraList -join ';')) }
    try {
        Set-ItemProperty -Path $RunKey -Name $RunName -Value $cmd -ErrorAction Stop
        Say 'AutoResume ON: after a crash, this relaunches when you log back in.' 'Green'
    } catch { Say "Could not set AutoResume: $_" 'Yellow' }
}

function Disable-AutoResume {
    Remove-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue
}

# --------------------------------------------------------------- evidence ---
function Save-Evidence {
    # Small, fast, read-only: a reinstall list plus the story of the crashes.
    try {
        $keys = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
                'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
                'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
        Get-ItemProperty $keys -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName } |
            Select-Object DisplayName, DisplayVersion, Publisher |
            Sort-Object DisplayName |
            Export-Csv -NoTypeInformation -Path (Join-Path $Meta 'installed-apps.csv')
    } catch { }

    $since = (Get-Date).AddDays(-21)
    $ev = @()
    try {
        # Blue screens are logged by Microsoft-Windows-WER-SystemErrorReporting (shown as "BugCheck" in Event Viewer).
        $ev = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1, 2, 3; StartTime = $since } -ErrorAction Stop |
            Where-Object { $_.ProviderName -match 'Kernel-Power|WHEA|Display|nvlddmkm|amdkmdag|amdwddmg|igfx|BugCheck|WER-SystemErrorReporting|volmgr|disk|Ntfs|storahci|stornvme|EventLog' })
    } catch { }
    $wer = @()
    try {
        # Graphics driver timeouts (TDRs, the "driver timeout" popup) land in the Application log as
        # Windows Error Reporting "LiveKernelEvent" reports, often with nothing in the System log.
        $wer = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Windows Error Reporting'; StartTime = $since } -ErrorAction Stop |
            Where-Object { "$($_.Message)" -match 'LiveKernelEvent|BlueScreen' })
    } catch { }
    $all = @($ev) + @($wer)
    if ($all.Count -eq 0) { Say 'No crash events readable (or none logged). Skipping crash-evidence.' 'DarkGray'; return }

    try {
        $all | Select-Object TimeCreated, Id, ProviderName, LevelDisplayName,
                @{ n = 'Message'; e = { ("$($_.Message)" -split "\r?\n")[0] } } |
            Export-Csv -NoTypeInformation -Path (Join-Path $Meta 'crash-evidence.csv')

        $kp   = @($ev | Where-Object { $_.ProviderName -match 'Kernel-Power' -and $_.Id -eq 41 }).Count
        $bsod = @($ev | Where-Object { $_.ProviderName -match 'WER-SystemErrorReporting|BugCheck' }).Count
        $tdr  = @($wer | Where-Object { "$($_.Message)" -match 'LiveKernelEvent' }).Count
        $gpu  = @($ev | Where-Object { $_.ProviderName -match 'Display|nvlddmkm|amdkmdag|amdwddmg|igfx' }).Count
        $whea = @($ev | Where-Object { $_.ProviderName -match 'WHEA' }).Count
        $dsk  = @($ev | Where-Object { $_.ProviderName -match 'disk|Ntfs|volmgr|storahci|stornvme' }).Count
        Say ("Last 21 days: {0} unexpected shutdowns, {1} blue screens, {2} driver timeouts (LiveKernelEvent, usually the GPU), {3} GPU/display events, {4} hardware-error (WHEA) events, {5} disk events." -f $kp, $bsod, $tdr, $gpu, $whea, $dsk) 'Yellow'
        if ($dsk -gt 0) { Say 'Disk events present: the SSD itself may be unhealthy. That is why the important stuff goes first.' 'Yellow' }
    } catch {
        Say "Could not save crash-evidence: $_" 'DarkGray'
    }
}

# ======================================================================= main
Say ''
Say '=== Tabula Rescue Backup ===' 'Magenta'
Say 'Resumable. Crash-tolerant. Run it again every time the machine dies.' 'DarkGray'
Say ''

$script:ExtraList = @($ExtraPaths -split ';' | ForEach-Object { Format-Root $_ } | Where-Object { $_ })

if (-not $Dest) {
    try { $Dest = Select-Destination } catch { Say "$_" 'Red'; exit 1 }
}
$Dest = Format-Root $Dest

if ($AutoResume) {
    # After a reboot the external drive can take a moment to show up.
    for ($w = 0; $w -lt 24 -and -not (Test-Path -LiteralPath $Dest); $w++) { Start-Sleep -Seconds 5 }
}
if (-not (Test-Path -LiteralPath $Dest)) { Say "Destination not found: $Dest" 'Red'; exit 2 }
if ($Dest.Substring(0, 1).ToUpper() -eq $env:SystemDrive.Substring(0, 1).ToUpper()) {
    Say 'Destination is on the system drive. That defeats the point - use the external drive.' 'Red'
    exit 2
}

$Root  = Join-Path $Dest ("Rescue-{0}-{1}" -f $env:COMPUTERNAME, $env:USERNAME)
$Meta  = Join-Path $Root '_rescue'
$null  = New-Item -ItemType Directory -Force -Path $Meta
$StateFile = Join-Path $Meta 'state.txt'
$RunLog    = Join-Path $Meta 'runs.log'

Add-Content -LiteralPath $RunLog -Value ("{0}  run started{1}" -f (Get-Date -Format 's'), $(if ($AutoResume) { ' (auto-resume)' } else { '' }))
$attempt = @(Get-Content -LiteralPath $RunLog).Count

if ($AutoResume -and $attempt -gt 8) {
    Disable-AutoResume
    Say 'Auto-resume has restarted 8 times without finishing. Giving up on auto-resume; run the script by hand and read the logs.' 'Yellow'
    exit 3
}

Say ("Destination : {0}   ({1} GB free)" -f $Root, (Get-FreeGB)) 'White'
try {
    $cv = Get-Volume -DriveLetter ($env:SystemDrive.Substring(0, 1)) -ErrorAction Stop
    Say ("System drive: {0:N1} GB in use (Windows and apps are not copied, so expect far less)" -f (($cv.Size - $cv.SizeRemaining) / 1GB)) 'White'
} catch { }
Say ("This is run #{0} on this backup set." -f $attempt) 'DarkGray'
Say ''
Say 'BEFORE YOU WIPE ANYTHING: do you have your BitLocker recovery key?' 'Yellow'
Say '  https://account.microsoft.com/devices/recoverykey   (needed if the drive moves to another machine)' 'Yellow'
Say ''

Build-Plan
$queue = @($script:Items | Where-Object { $_.Tier -le $MaxTier } | Sort-Object Tier, Seq)
if ($queue.Count -eq 0) { Say 'Nothing to back up was found. Pass -ExtraPaths to point me at your folders.' 'Red'; exit 4 }

Say 'Plan (most important first):' 'Cyan'
foreach ($it in $queue) {
    $warn = ''
    if ($it.Path -match 'OneDrive') { $warn = '   <-- OneDrive: cloud-only files will be downloaded to copy them' }
    Say ('  tier {0}  {1,-28} {2}{3}' -f $it.Tier, $it.Name, $it.Path, $warn) 'Gray'
}
Say ''

Save-Evidence
if ($AutoResume) { Enable-AutoResume }
if (-not $AutoResume -and -not $VerifyOnly) {
    [void](Read-Host 'Press Enter to start (Ctrl+C to abort)')
}

$done    = @()
if (Test-Path -LiteralPath $StateFile) { $done = @(Get-Content -LiteralPath $StateFile) }
$errored = @()
$fatal   = $false

if (-not $VerifyOnly) {
    $i = 0
    foreach ($it in $queue) {
        $i++
        $label = '[{0}/{1}] tier {2}: {3}' -f $i, $queue.Count, $it.Tier, $it.Name
        if ($done -contains $it.Name) { Say "$label - already done, skipping" 'DarkGray'; continue }
        if (-not (Test-Path -LiteralPath $Dest)) { Say 'The destination drive disappeared. Reconnect it and run again.' 'Red'; $fatal = $true; break }
        if ((Get-FreeGB) -lt 1) { Say 'Destination drive is full. Free some space or use a bigger drive, then run again.' 'Red'; $fatal = $true; break }

        Say $label 'Cyan'
        $rc = Invoke-Backup $it
        if ($rc -ge 16) {
            Say "robocopy hit a fatal error (code $rc) on $($it.Name). Check the drive connection, then run again." 'Red'
            $fatal = $true; break
        } elseif ($rc -ge 8) {
            Say "$($it.Name): finished with some files that could not be copied (code $rc). See its log in _rescue." 'Yellow'
            $errored += $it.Name
            Add-Content -LiteralPath $StateFile -Value $it.Name
        } else {
            Add-Content -LiteralPath $StateFile -Value $it.Name
        }
    }
}

$bad = @()
if (-not $fatal) {
    Say ''
    Say 'Verifying (size + timestamp compare, no heavy hashing)...' 'Cyan'
    $badNames = @()
    foreach ($it in $queue) {
        $rc = Test-Backup $it
        if ($rc -ne 0) {
            $bad += ('{0}  (compare code {1})' -f $it.Name, $rc)
            $badNames += $it.Name
        }
    }
    if ($badNames.Count -gt 0 -and (Test-Path -LiteralPath $StateFile)) {
        # Make "re-run to fix" true: forget folders that failed verify so the next run copies them again.
        $keep = @(Get-Content -LiteralPath $StateFile | Where-Object { $badNames -notcontains $_ })
        Set-Content -LiteralPath $StateFile -Value $keep
    }
}

# ---------------------------------------------------------------- report ----
$lines = @()
$lines += 'Rescue backup report - {0}' -f (Get-Date)
$lines += 'Destination: {0}' -f $Root
$lines += 'Runs: {0}' -f $attempt
$lines += 'Items planned: {0}' -f $queue.Count
$lines += ''
if ($fatal)           { $lines += 'STATUS: STOPPED EARLY. Reconnect/clear space and run again; it will resume.' }
elseif ($bad.Count -eq 0 -and $errored.Count -eq 0) { $lines += 'STATUS: COMPLETE. Every planned folder matches the destination.' }
else                  { $lines += 'STATUS: FINISHED WITH ISSUES (below).' }
if ($errored.Count -gt 0) {
    $lines += ''
    $lines += 'Copied with errors (locked/unreadable files; see robocopy-<name>.log):'
    foreach ($e in $errored) { $lines += "  $e" }
}
if ($bad.Count -gt 0) {
    $lines += ''
    $lines += 'Differences found on verify (re-run the script and these folders are copied again; or check logs):'
    foreach ($b in $bad) { $lines += "  $b" }
    $lines += 'Folders an app is writing to right now (for example .claude, .codex) can differ again straight away: close the app first.'
}
$lines += ''
$lines += 'Not covered: installed programs (see installed-apps.csv), saved browser passwords,'
$lines += 'authenticator apps, software licenses, and any folder outside your user profile'
$lines += 'unless you passed -ExtraPaths.'
Set-Content -LiteralPath (Join-Path $Meta 'REPORT.txt') -Value $lines

Say ''
$lines | ForEach-Object { Say $_ $(if ($_ -like 'STATUS: COMPLETE*') { 'Green' } elseif ($_ -like 'STATUS*') { 'Yellow' } else { 'Gray' }) }

if (-not $fatal) {
    Disable-AutoResume
    Say ''
    if ($MaxTier -lt 5) { Say "Tiers 1-$MaxTier done. Run again without -MaxTier to get the bulk folders (Downloads, Music, Videos)." 'Cyan' }
    if ($bad.Count -eq 0 -and $errored.Count -eq 0) {
        Say 'Next: copy this backup to a second place (Google Drive, or any other disk) BEFORE you wipe the laptop.' 'Cyan'
    }
}
