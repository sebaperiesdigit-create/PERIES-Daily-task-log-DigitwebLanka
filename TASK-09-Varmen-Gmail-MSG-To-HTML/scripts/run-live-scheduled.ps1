# Wrapper invoked by the daily Windows Scheduled Task ("Task09-WelfareLoanLiveSync").
# Runs the real live Gmail + Varmen DB pipeline unattended and appends a
# timestamped summary to logs/scheduled-run.log so it can be spot-checked
# without needing to watch every run live. See docs/HANDOVER.md for the
# decision that authorized this (2026-09-07).

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $root "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir "scheduled-run.log"

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$start = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "===== Run started: $start =====" -Encoding utf8

try {
    $nodeExe = "C:\Program Files\nodejs\node.exe"
    $output = & $nodeExe "--env-file=.env" "src/run-live.js" 2>&1
    $output | Add-Content -Path $logFile -Encoding utf8
    $exitCode = $LASTEXITCODE
    $end = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    if ($exitCode -eq 0) {
        Add-Content -Path $logFile -Value "===== Run finished OK: $end =====" -Encoding utf8
    } else {
        Add-Content -Path $logFile -Value "===== Run FAILED (exit code $exitCode): $end =====" -Encoding utf8
    }
} catch {
    $end = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "===== Run FAILED (exception): $($_.Exception.Message) - $end =====" -Encoding utf8
}

Add-Content -Path $logFile -Value "" -Encoding utf8
