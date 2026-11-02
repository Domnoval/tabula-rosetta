# Rescue backup (Windows, crash-tolerant)

For a laptop that dies at random. Copies what matters to an external drive, most irreplaceable first, and picks up where it left off every time the machine falls over. Uses only robocopy and PowerShell, both already on Windows.

## Stabilize first (5 minutes, worth it)

The crashes look like the GPU dropping out and the board resetting. The backup itself barely touches the GPU, so starve the GPU of work:

1. Plug in power, put the laptop on a hard flat surface, close everything.
2. Disable the discrete GPU: Device Manager, Display adapters, right-click the NVIDIA/AMD entry, Disable device. The integrated GPU keeps the screen alive.
3. If it still dies within minutes: boot Safe Mode (Settings, Recovery, Advanced startup, Startup Settings, 4). Safe Mode loads no GPU driver. If the machine is stable there, the driver or dGPU is the culprit. Note: `-AutoResume` does not fire in Safe Mode, so re-run by hand after each crash.
4. Save your BitLocker recovery key: https://account.microsoft.com/devices/recoverykey

## Run it

Double-click `Rescue-Backup.cmd`, or from PowerShell in this folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\Rescue-Backup.ps1 -Dest E:\ -AutoResume
```

Replace `E:\` with the external drive. Leave `-Dest` off and it asks which drive.

| Option | Meaning |
|---|---|
| `-AutoResume` | After a crash, relaunch at next logon until finished (gives up after 8 restarts) |
| `-ExtraPaths "D:\Art;C:\Games\Saves"` | More folders, semicolon-separated |
| `-MaxTier 3` | Stop after tier 3. Do the vital stuff first, bulk later |
| `-Threads 1` | Gentler. Default is 2 |
| `-VerifyOnly` | Compare source and destination, copy nothing |

## Order

1. Desktop, Documents
2. Project folders (source, repos, projects, dev, code, art, blender, touchdesigner, unity...) plus `-ExtraPaths`. `node_modules`, `venv` and `__pycache__` are skipped; `.git` is kept
3. SSH/GPG keys, `.gitconfig`, VS Code settings, Blender prefs, Firefox profile, Chrome/Edge bookmarks
4. Pictures and small profile folders
5. Downloads, Music, Videos

## How it survives crashes

Each folder is its own robocopy run. Re-running skips anything already copied (same size and timestamp), so a crash costs at most the file in flight. Progress lives on the external drive in `Rescue-<PC>-<user>\_rescue\`:

- `state.txt` finished folders
- `runs.log` one line per start (your crash counter)
- `robocopy-<name>.log` full per-folder logs
- `REPORT.txt` final status
- `installed-apps.csv` list of installed programs, for reinstalling after a reset
- `crash-evidence.csv` last 21 days of shutdown, GPU, WHEA and disk events

At the end it verifies source against destination (size and timestamp) and says COMPLETE or lists what differs.

## Not covered

- Saved browser passwords and your authenticator app: export or sync them yourself
- Software licenses: deauthorize (Adobe etc.) before wiping
- Anything outside your user profile, unless passed via `-ExtraPaths`
- OneDrive: cloud-only files are downloaded in order to be copied

## After the backup

1. Make a second copy before you wipe. Plug the external drive into any stable computer and upload the `Rescue-...` folder to drive.google.com.
2. Do not run Windows "Reset this PC" on a machine that still crashes. A crash mid-reset can leave Windows unbootable. Reset from a USB installer, or on a stable machine.
3. A reset only fixes software. If `crash-evidence.csv` shows WHEA or GPU events, or the machine still crashes from a live USB or in the BIOS, it is hardware. Check the warranty before spending a weekend reinstalling.
