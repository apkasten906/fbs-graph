<#
check-gh-token2.ps1
Simpler, robust script to validate GitHub token and list unresolved PR review threads.
#>
param(
  [Parameter(Mandatory=$true)][string]$Owner,
  [Parameter(Mandatory=$true)][string]$Repo,
  [Parameter(Mandatory=$true)][int]$PRNumber,
  [string]$TokenEnvName = 'COPILOT_GRAPHQL_TOKEN',
  [switch]$Interactive,
  [string]$OutputFile = ''
)

function Read-TokenFromDotEnv([string]$path, [string]$name) {
  if (-not (Test-Path $path)) { return $null }
  $lines = Get-Content -Path $path -ErrorAction SilentlyContinue
  foreach ($l in $lines) {
    $m = [regex]::Match($l, "^\s*" + [regex]::Escape($name) + "\s*=\s*(.+)\s*$")
    if ($m.Success) { return $m.Groups[1].Value.Trim('"') }
  }
  return $null
}

# get token
$token = $null
if ($Interactive) {
  $token = Read-Host -AsSecureString -Prompt 'Enter GitHub token (input hidden)'
  $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))
} else {
  try {
    $envItem = Get-Item -Path ("env:$TokenEnvName") -ErrorAction SilentlyContinue
    if ($envItem) { $token = $envItem.Value }
  } catch {}
  if (-not $token) {
    $token = Read-TokenFromDotEnv -path (Join-Path (Get-Location) '.env') -name $TokenEnvName
  }
}

if (-not $token) {
  Write-Host "No token found in environment or .env. Use -Interactive to type one." -ForegroundColor Yellow
  exit 2
}

# quick REST test
try {
  $headers = @{ Authorization = "token $token"; 'User-Agent' = 'check-gh-token' }
  $resp = Invoke-WebRequest -Uri 'https://api.github.com/' -Method Get -Headers $headers -UseBasicParsing -ErrorAction Stop
  $scopes = $resp.Headers['x-oauth-scopes'] -join ', '
  Write-Host "REST OK. Scopes: $scopes" -ForegroundColor Green
} catch {
  Write-Host "REST token test failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 3
}

# build inline query (no GraphQL variables to avoid PowerShell parsing issues)
$query = 'query { repository(owner: "' + $Owner + '", name: "' + $Repo + '") { pullRequest(number: ' + $PRNumber + ') { reviewThreads(first: 100) { nodes { isResolved comments(first: 50) { nodes { author { login } body createdAt path } } } } } }'
$body = @{ query = $query } | ConvertTo-Json -Depth 10

try {
  $gql = Invoke-RestMethod -Uri 'https://api.github.com/graphql' -Method Post -Headers @{ Authorization = "bearer $token"; 'User-Agent' = 'check-gh-token' } -Body $body -ContentType 'application/json' -ErrorAction Stop
} catch {
  Write-Host "GraphQL request failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 4
}

if ($gql.errors) {
  Write-Host "GraphQL returned errors:" -ForegroundColor Red
  $gql.errors | ForEach-Object { Write-Host " - $($_.message)" }
  exit 5
}

$threads = $gql.data.repository.pullRequest.reviewThreads.nodes
$unresolved = $threads | Where-Object { -not $_.isResolved }
if (-not $unresolved -or $unresolved.Count -eq 0) {
  Write-Host "No unresolved review threads for PR #$PRNumber" -ForegroundColor Green
  exit 0
}

$out = foreach ($t in $unresolved) {
  foreach ($c in $t.comments.nodes) {
    [PSCustomObject]@{
      Path = $c.path
      Author = $c.author.login
      CreatedAt = $c.createdAt
      BodySnippet = ($c.body -split "\r?\n" | Select-Object -First 4) -join " `n"
    }
  }
}

if ($OutputFile) { $out | ConvertTo-Json -Depth 5 | Out-File -FilePath $OutputFile -Encoding UTF8; Write-Host "Wrote $OutputFile" -ForegroundColor Green } else { $out | Format-Table -AutoSize }

Write-Host 'Done.' -ForegroundColor Green
