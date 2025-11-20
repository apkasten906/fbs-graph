# set CFBD key
# PowerShell:
$env:CFBD_KEY=$null
$env:MODE = "full"
$env:YEAR = "2025"
# macOS/Linux:  export CFBD_KEY="pk_..."

function GetLocalEnvVariable {
  param (
    [string]$RequiredVar = "",
    [string]$EnvFilePath = "./.env",
    [switch]$Debug = $false
  )

  $value = $null

  if (-not (Test-Path $EnvFilePath)) {
    Write-Warning "$EnvFilePath not found."
    return $value
  }

  if ((Test-Path $EnvFilePath) -and (-not $value)) {
    Get-Content $EnvFilePath | ForEach-Object {
      if ($_ -match "^($RequiredVar)=(.*)$") {
        $value = $matches[2].Trim()
        if ($Debug) { Write-Host "[DEBUG] Loaded $RequiredVar from .env" $value -ForegroundColor Green }
      }
    }
  }
  else {
    Write-Warning ".env file not found and $RequiredVar not set."
  }

  return $value
}

$env:CFBD_KEY = GetLocalEnvVariable -RequiredVar "CFBD_KEY" 

if (-not $env:CFBD_KEY) {
  Write-Error "CFBD_KEY is not set. Please set it in the environment or in the .env file."
  exit 1
}

# Debug: Print environment variables
Write-Host "[DEBUG] CFBD_KEY: $env:CFBD_KEY"
Write-Host "[DEBUG] MODE: $env:MODE"
Write-Host "[DEBUG] YEAR: $env:YEAR"

Write-Host "[DEBUG] Starting fetch:confs"
if (-not (npm run fetch:confs)) { Write-Error "fetch:confs failed"; exit 1 }
Write-Host "[DEBUG] Starting fetch:teams"
if (-not (npm run fetch:teams)) { Write-Error "fetch:teams failed"; exit 1 }


Write-Host "[DEBUG] Starting seasons:make"
if (-not (npm run seasons:make)) { Write-Error "seasons:make failed"; exit 1 }

# Set MODE and YEAR for fetch:schedules
Write-Host "[DEBUG] Starting fetch:schedules (MODE=$env:MODE, YEAR=$env:YEAR)"
if (-not (npm run fetch:schedules)) { Write-Error "fetch:schedules failed"; exit 1 }



Write-Host "[DEBUG] Starting fetch:all-ranks"
if (-not (npm run fetch:all-ranks)) { Write-Error "fetch:all-ranks failed"; exit 1 }
Write-Host "[DEBUG] Starting fetch:elo"
if (-not (npm run fetch:elo)) { Write-Error "fetch:elo failed"; exit 1 }
Write-Host "[DEBUG] Starting fetch:sp"
if (-not (npm run fetch:sp)) { Write-Error "fetch:sp failed"; exit 1 }

Write-Host "[DEBUG] Starting import:csv"
if (-not (npm run import:csv)) { Write-Error "import:csv failed"; exit 1 }
# Write-Host "[DEBUG] Starting dev"
# if (-not (npm run dev)) { Write-Error "dev failed"; exit 1 }
