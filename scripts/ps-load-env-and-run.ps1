param(
  [Parameter(Mandatory=$true)]
  [string] $ScriptPath,
  [string] $EnvFile = "${PWD}\ .env",
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]] $RemainingArgs
)

# Resolve workspace-root .env by default when EnvFile wasn't explicitly provided
if ($EnvFile -eq "${PWD}\ .env") {
  $possible = Join-Path -Path (Get-Location) -ChildPath '.env'
  if (Test-Path $possible) { $EnvFile = $possible } else { $EnvFile = $null }
}

function Import-DotEnv($path) {
  if (-not $path) { return }
  if (-not (Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    if ($line.StartsWith('#')) { return }
    $parts = $line -split '=', 2
    if ($parts.Count -lt 2) { return }
    $k = $parts[0].Trim()
    $v = $parts[1].Trim().Trim('"')
    if ($k) { Set-Item -Path "env:$k" -Value $v }
  }
}

try {
  Import-DotEnv -path $EnvFile
} catch {
  Write-Verbose "Failed to load .env: $_"
}

if (-not (Test-Path $ScriptPath)) {
  Write-Error "Script path not found: $ScriptPath"
  exit 2
}

# Invoke the target script with remaining args, preserving exit code
& $ScriptPath @RemainingArgs
$LASTEXITCODE
