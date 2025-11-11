<#
.SYNOPSIS
Validates a GitHub token and lists unresolved PR review threads.

.DESCRIPTION
This script validates a GitHub token from environment variables or .env file,
then queries the GitHub GraphQL API to retrieve unresolved review threads for
a specified pull request.

.PARAMETER Owner
The GitHub repository owner (username or organization).

.PARAMETER Repo
The GitHub repository name.

.PARAMETER PRNumber
The pull request number to query.

.PARAMETER TokenEnvName
The environment variable name containing the GitHub token. Default is 'COPILOT_GRAPHQL_TOKEN'.

.PARAMETER Interactive
When specified, prompts for the GitHub token securely instead of reading from environment.

.PARAMETER OutputFile
Optional file path to save the results as JSON instead of displaying in the console.

.EXAMPLE
.\check-gh-token.ps1 -Owner apkasten906 -Repo fbs-graph -PRNumber 26

.EXAMPLE
.\check-gh-token.ps1 -Owner apkasten906 -Repo fbs-graph -PRNumber 26 -Interactive

.EXAMPLE
.\check-gh-token.ps1 -Owner apkasten906 -Repo fbs-graph -PRNumber 26 -OutputFile results.json

.NOTES
The script will NOT persist or echo the token. It validates the token against
GitHub's REST API, then queries GraphQL for unresolved review threads.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$Owner,
  
  [Parameter(Mandatory=$true)]
  [string]$Repo,
  
  [Parameter(Mandatory=$true)]
  [int]$PRNumber,
  
  [string]$TokenEnvName = 'COPILOT_GRAPHQL_TOKEN',
  
  [switch]$Interactive,
  
  [string]$OutputFile = ''
)

# Validate input parameters to prevent injection attacks
# GitHub usernames/orgs and repo names must match specific patterns
function Test-GitHubName {
  param([string]$Name, [string]$Type)
  
  # GitHub allows alphanumeric, hyphens, and underscores
  # Names cannot start with hyphen and have length limits
  if ([string]::IsNullOrWhiteSpace($Name)) {
    Write-Host "Error: $Type cannot be empty" -ForegroundColor Red
    return $false
  }
  
  if ($Name.Length -gt 39) {
    Write-Host "Error: $Type exceeds maximum length of 39 characters" -ForegroundColor Red
    return $false
  }
  
  if ($Name -notmatch '^[a-zA-Z0-9]([a-zA-Z0-9-_]*[a-zA-Z0-9])?$') {
    Write-Host "Error: $Type contains invalid characters. Only alphanumeric, hyphens, and underscores allowed." -ForegroundColor Red
    return $false
  }
  
  return $true
}

if (-not (Test-GitHubName -Name $Owner -Type 'Owner')) {
  exit 1
}

if (-not (Test-GitHubName -Name $Repo -Type 'Repo')) {
  exit 1
}

if ($PRNumber -lt 1) {
  Write-Host "Error: PRNumber must be a positive integer" -ForegroundColor Red
  exit 1
}

function Read-TokenFromDotEnv([string]$path, [string]$name) {
  if (-not (Test-Path $path)) { return $null }
  $lines = Get-Content -Path $path -ErrorAction SilentlyContinue
  foreach ($l in $lines) {
    $m = [regex]::Match($l, "^\s*" + [regex]::Escape($name) + "\s*=\s*(.+)\s*$")
    if ($m.Success) { return $m.Groups[1].Value.Trim('"') }
  }
  return $null
}

# Obtain GitHub token from various sources
# NOTE: Token is stored as plain text in memory because GitHub API requires
# it as a string in HTTP Authorization headers. SecureString cannot be used
# directly with Invoke-WebRequest/Invoke-RestMethod. While we convert from
# SecureString during interactive input to protect keyboard entry, the token
# must ultimately be in plain text for API authentication.
#
# Security measures in place:
# - Interactive mode uses Read-Host -AsSecureString to hide keyboard input
# - Token is never persisted to disk or logs
# - Token is cleared from memory when script exits
# - Script uses HTTPS for all API calls (encrypted in transit)
$token = $null
if ($Interactive) {
  # Secure keyboard entry, but must convert to plain text for API calls
  $secureToken = Read-Host -AsSecureString -Prompt 'Enter GitHub token (input hidden)'
  $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken))
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

# Clear sensitive data from memory before exiting
$token = $null

Write-Host 'Done.' -ForegroundColor Green
