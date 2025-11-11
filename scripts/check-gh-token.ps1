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
  
  [switch]$DryRun,
  [switch]$CaptureRaw,

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
  
  # Repository names do not allow underscores; usernames/orgs historically allow hyphens
  # and alphanumeric characters. Use a slightly different pattern for repos.
  if ($Type -eq 'Repo') {
    if ($Name -notmatch '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$') {
      Write-Host "Error: $Type contains invalid characters. Only alphanumeric and hyphens allowed for repository names." -ForegroundColor Red
      return $false
    }
  } else {
    if ($Name -notmatch '^[a-zA-Z0-9]([a-zA-Z0-9-_]*[a-zA-Z0-9])?$') {
      Write-Host "Error: $Type contains invalid characters. Only alphanumeric, hyphens, and underscores allowed." -ForegroundColor Red
      return $false
    }
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

# If requested, build the GraphQL query and JSON body and print them without requiring a token.
if ($DryRun) {
  $query = 'query($owner:String!,$name:String!,$pr:Int!){ repository(owner:$owner, name:$name) { pullRequest(number:$pr) { reviewThreads(first: 100) { nodes { isResolved comments(first: 50) { nodes { author { login } body createdAt path } } } } } } }'
  $variables = @{ owner = $Owner; name = $Repo; pr = $PRNumber }
  $body = @{ query = $query; variables = $variables } | ConvertTo-Json -Depth 10
  Write-Host 'DRYRUN: GraphQL query (with variables):' -ForegroundColor Yellow
  Write-Host $query
  Write-Host 'DRYRUN: Variables:' -ForegroundColor Yellow
  Write-Host ($variables | ConvertTo-Json -Depth 5)
  Write-Host 'DRYRUN: JSON body to POST:' -ForegroundColor Yellow
  Write-Host $body
  exit 0
}

# If requested, print the raw UTF-8 bytes and headers that would be sent to GitHub (no token printed)
if ($CaptureRaw) {
  $query = 'query($owner:String!,$name:String!,$pr:Int!){ repository(owner:$owner, name:$name) { pullRequest(number:$pr) { reviewThreads(first: 100) { nodes { isResolved comments(first: 50) { nodes { author { login } body createdAt path } } } } } } }'
  $variables = @{ owner = $Owner; name = $Repo; pr = $PRNumber }
  $body = @{ query = $query; variables = $variables } | ConvertTo-Json -Depth 10

  # Prepare UTF8 bytes (no BOM)
  $utf8 = [System.Text.Encoding]::UTF8
  $bytes = $utf8.GetBytes($body)

  Write-Host 'CAPTURERAW: JSON body (string):' -ForegroundColor Yellow
  Write-Host $body
  Write-Host 'CAPTURERAW: UTF-8 bytes (length:' ($bytes.Length) '):' -ForegroundColor Yellow
  # Print first 512 bytes as hex and decimal for inspection
  $preview = $bytes[0..([Math]::Min($bytes.Length-1,511))]
  $hex = ($preview | ForEach-Object { $_.ToString('x2') }) -join ' '
  Write-Host $hex

  # Print any non-printable characters positions (if any)
  $nonPrintable = @()
  for ($i=0; $i -lt $bytes.Length; $i++) {
    $b = $bytes[$i]
    if ($b -lt 0x20 -and $b -ne 0x09 -and $b -ne 0x0a -and $b -ne 0x0d) { $nonPrintable += $i }
  }
  if ($nonPrintable.Count -gt 0) {
    Write-Host 'CAPTURERAW: Non-printable byte indexes:' -ForegroundColor Yellow
    Write-Host ($nonPrintable -join ', ')
  } else {
    Write-Host 'CAPTURERAW: No suspicious non-printable bytes found.' -ForegroundColor Green
  }

  Write-Host 'CAPTURERAW: Content-Type: application/json; charset=utf-8' -ForegroundColor Yellow
  Write-Host 'CAPTURERAW: Authorization: (not printed)'
  exit 0
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

 # build query using GraphQL variables to avoid quoting issues
 $query = 'query($owner:String!,$name:String!,$pr:Int!){ repository(owner:$owner, name:$name) { pullRequest(number:$pr) { reviewThreads(first: 100) { nodes { isResolved comments(first: 50) { nodes { author { login } body createdAt path } } } } } } }'
 $variables = @{ owner = $Owner; name = $Repo; pr = $PRNumber }
 $body = @{ query = $query; variables = $variables } | ConvertTo-Json -Depth 10

try {
  $headersGql = @{ Authorization = "bearer $token"; 'User-Agent' = 'check-gh-token' ; 'Content-Type' = 'application/json' }
  $gql = Invoke-RestMethod -Uri 'https://api.github.com/graphql' -Method Post -Headers $headersGql -Body $body -ErrorAction Stop
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
