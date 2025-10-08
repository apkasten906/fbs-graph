# set CFBD key
# PowerShell:   
$env:CFBD_KEY="AA0okF/lE7un15VjY0TNHKZzNfVnK9OzH7dS2FHWGE6h3LD2SK1nIQp20Oq7UZvA"
$env:MODE = "full"
$env:YEAR = "2025"
# macOS/Linux:  export CFBD_KEY="pk_..."

# Debug: Print environment variables
Write-Host "[DEBUG] CFBD_KEY: $env:CFBD_KEY"
Write-Host "[DEBUG] MODE: $env:MODE"
Write-Host "[DEBUG] YEAR: $env:YEAR"

# Set CFBD_KEY from .env if not already set
if (-not $env:CFBD_KEY) {
	if (Test-Path "./.env") {
		Get-Content .env | ForEach-Object {
			if ($_ -match '^(CFBD_KEY)=(.*)$') {
				$env:CFBD_KEY = $matches[2].Trim()
				Write-Host "[DEBUG] Loaded CFBD_KEY from .env"
			}
		}
	} else {
		Write-Warning ".env file not found and CFBD_KEY not set."
	}
}

Write-Host "[DEBUG] Starting fetch:confs"
if (-not (npm run fetch:confs)) { Write-Error "fetch:confs failed"; exit 1 }
Write-Host "[DEBUG] Starting fetch:teams"
if (-not (npm run fetch:teams)) { Write-Error "fetch:teams failed"; exit 1 }


Write-Host "[DEBUG] Starting seasons:make"
if (-not (npm run seasons:make)) { Write-Error "seasons:make failed"; exit 1 }

# Set MODE and YEAR for fetch:schedules
Write-Host "[DEBUG] Starting fetch:schedules (MODE=$env:MODE, YEAR=$env:YEAR)"
if (-not (npm run fetch:schedules)) { Write-Error "fetch:schedules failed"; exit 1 }



Write-Host "[DEBUG] Starting fetch:ap"
if (-not (npm run fetch:ap)) { Write-Error "fetch:ap failed"; exit 1 }
Write-Host "[DEBUG] Starting fetch:elo"
if (-not (npm run fetch:elo)) { Write-Error "fetch:elo failed"; exit 1 }
Write-Host "[DEBUG] Starting fetch:sp"
if (-not (npm run fetch:sp)) { Write-Error "fetch:sp failed"; exit 1 }

Write-Host "[DEBUG] Starting import:csv"
if (-not (npm run import:csv)) { Write-Error "import:csv failed"; exit 1 }
# Write-Host "[DEBUG] Starting dev"
# if (-not (npm run dev)) { Write-Error "dev failed"; exit 1 }
