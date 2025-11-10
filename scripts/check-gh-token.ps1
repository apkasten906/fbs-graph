<#
.check-gh-token.ps1

PowerShell helper to validate a GitHub token from .env or environment and fetch unresolved
review threads for a PR via the GraphQL API.

Usage examples:
  # Use COPILOT_GRAPHQL_TOKEN from environment or .env
  .\scripts\check-gh-token.ps1 -Owner apkasten906 -Repo fbs-graph -PRNumber 26

  # Specify a different env var name
  .\scripts\check-gh-token.ps1 -Owner apkasten906 -Repo fbs-graph -PRNumber 26 -TokenEnvName MY_TOKEN

  # Prompt for token interactively
  .\scripts\check-gh-token.ps1 -Owner apkasten906 -Repo fbs-graph -PRNumber 26 -Interactive

Notes:
- This script will NOT persist or echo the token.
- It attempts a REST GET against https://api.github.com/ to inspect headers (x-oauth-scopes, x-ratelimit)
  and then runs a GraphQL query to list unresolved review threads for the specified PR.
#>
param(
    [Parameter(Mandatory=$true)][string]$Owner,
    [Parameter(Mandatory=$true)][string]$Repo,
    [Parameter(Mandatory=$true)][int]$PRNumber,
    [string]$TokenEnvName = 'COPILOT_GRAPHQL_TOKEN',
    [switch]$Interactive,
    [string]$OutputFile = ''
)

function Read-TokenFromDotEnv {
    param([string]$Path)
    if (-not (Test-Path -Path $Path)) { return $null }
    $lines = Get-Content -Path $Path -ErrorAction SilentlyContinue
    foreach ($l in $lines) {
        # Build the regex pattern safely using Escape to avoid special chars in the env name
        $pattern = '^\s*' + [regex]::Escape($TokenEnvName) + '\s*=\s*(.+)\s*$'
        $match = [regex]::Match($l, $pattern)
        if ($match.Success) {
            # Trim any surrounding quotes (single or double)
            return $match.Groups[1].Value.Trim("'\"")
        }
    }
    return $null
}

# 1) Obtain token from environment or .env or prompt
$token = $null
if ($Interactive) {
    $token = Read-Host -Prompt "Enter GitHub token (will not be stored)"
} else {
    # Try environment variable with dynamic name
    $envValue = $null
    try {
        $envItem = Get-ChildItem Env:$TokenEnvName -ErrorAction SilentlyContinue
        if ($envItem) { $envValue = $envItem.Value }
    } catch {
        # Ignore errors when attempting to read the environment variable
    }
    if ($envValue) { $token = $envValue }
    if (-not $token) {
        $envFile = Join-Path -Path (Get-Location) -ChildPath '.env'
        $fromEnv = Read-TokenFromDotEnv -Path $envFile
        if ($fromEnv) { $token = $fromEnv }
    }
}

if (-not $token) {
    Write-Host "No token found in environment variable $TokenEnvName or .env. Use -Interactive or set the token in your .env or environment." -ForegroundColor Yellow
    exit 2
}

# Helper to safely read headers from a WebResponse
function Get-HeaderValue($resp, $name) {
    if ($null -eq $resp) { return $null }
    if ($resp.Headers.Contains($name)) { return $resp.Headers[$name] }
    return $null
}

# 2) Test token via a lightweight REST request to inspect scopes
Write-Host "Testing token against https://api.github.com/ ..."
try {
    $headers = @{ Authorization = "token $token"; 'User-Agent' = 'fbs-graph-token-check' }
    $test = Invoke-WebRequest -Uri 'https://api.github.com/' -Method Get -Headers $headers -UseBasicParsing -ErrorAction Stop
    $scopes = Get-HeaderValue $test 'x-oauth-scopes'
    $rate = Get-HeaderValue $test 'x-ratelimit-remaining'
    Write-Host "HTTP OK - token accepted by REST endpoint." -ForegroundColor Green
    if ($scopes) { Write-Host "Scopes: $scopes" -ForegroundColor Gray }
    if ($rate)   { Write-Host "Rate remaining: $rate" -ForegroundColor Gray }
} catch {
    $err = $_.Exception.Response
    if ($err -and $err.StatusCode) {
        Write-Host "REST test failed with HTTP status: $($err.StatusCode)" -ForegroundColor Red
    } else {
        Write-Host "REST test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host "Common causes: token missing, token lacks repo/pull request access, token needs org SSO authorization, or token expired." -ForegroundColor Yellow
    exit 3
}

# 3) Run GraphQL to fetch unresolved review threads for the PR
$graphqlUrl = 'https://api.github.com/graphql'

# Use a here-string template for the GraphQL query and inject variables using -f to avoid brace/quoting issues
$queryTemplate = @'
query {
  repository(owner: "{0}", name: "{1}") {
    pullRequest(number: {2}) {
      reviewThreads(first: 100) {
        nodes {
          isResolved
          comments(first: 50) {
            nodes {
              author { login }
              body
              createdAt
              path
            }
          }
        }
      }
    }
  }
}
'@

$query = $queryTemplate -f $Owner, $Repo, $PRNumber
$body = @{ query = $query } | ConvertTo-Json -Depth 10

Write-Host "Querying GraphQL for unresolved review threads on $Owner/$Repo PR #$PRNumber ..."
try {
    $resp = Invoke-RestMethod -Uri $graphqlUrl -Method Post -Headers @{ Authorization = "bearer $token"; 'User-Agent' = 'fbs-graph-token-check' } -Body $body -ContentType 'application/json' -ErrorAction Stop
} catch {
    Write-Host "GraphQL query failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "If this is a fine-grained token ensure it has 'Pull requests: Read' or repository access to the target repo. If the repo is in an org, grant SSO access as required." -ForegroundColor Yellow
    exit 4
}

if ($resp.errors) {
    Write-Host "GraphQL errors:" -ForegroundColor Red
    $resp.errors | ForEach-Object { Write-Host " - $($_.message)" }
    exit 5
}

$threads = $resp.data.repository.pullRequest.reviewThreads.nodes
$unresolved = $threads | Where-Object { -not $_.isResolved }
if (-not $unresolved -or $unresolved.Count -eq 0) {
    Write-Host "No unresolved review threads found on PR #$PRNumber." -ForegroundColor Green
    exit 0
}

# Format output
$out = @()
foreach ($t in $unresolved) {
    foreach ($c in $t.comments.nodes) {
        $snippet = ($c.body -split "\r?\n" | Select-Object -First 4) -join " `n"
        $out += [PSCustomObject]@{
            Path = $c.path
            Author = $c.author.login
            CreatedAt = $c.createdAt
            BodySnippet = $snippet
        }
    }
}

if ($OutputFile) {
    $out | ConvertTo-Json -Depth 5 | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "Wrote unresolved thread summary to $OutputFile" -ForegroundColor Green
} else {
    $out | Format-Table -AutoSize
}

Write-Host "Done." -ForegroundColor Green
<#
.check-gh-token.ps1

PowerShell helper to validate a GitHub token from .env or environment and fetch unresolved
review threads for a PR via the GraphQL API.

Usage examples:
  # Use COPILOT_GRAPHQL_TOKEN from environment or .env
  .\scripts\check-gh-token.ps1 -Owner apkasten906 -Repo fbs-graph -PRNumber 26

  # Specify a different env var name
  .\scripts\check-gh-token.ps1 -Owner apkasten906 -Repo fbs-graph -PRNumber 26 -TokenEnvName MY_TOKEN

  # Prompt for token interactively
  .\scripts\check-gh-token.ps1 -Owner apkasten906 -Repo fbs-graph -PRNumber 26 -Interactive

Notes:
- This script will NOT persist or echo the token.
- It attempts a REST GET against https://api.github.com/ to inspect headers (x-oauth-scopes, x-ratelimit)
  and then runs a GraphQL query to list unresolved review threads for the specified PR.
#>
param(
    [Parameter(Mandatory=$true)][string]$Owner,
    [Parameter(Mandatory=$true)][string]$Repo,
    [Parameter(Mandatory=$true)][int]$PRNumber,
    [string]$TokenEnvName = 'COPILOT_GRAPHQL_TOKEN',
    [switch]$Interactive,
    [string]$OutputFile = ''
)

function Read-TokenFromDotEnv {
    param([string]$Path)
    if (-not (Test-Path -Path $Path)) { return $null }
    $lines = Get-Content -Path $Path -ErrorAction SilentlyContinue
    foreach ($l in $lines) {
        # Build the regex pattern without embedding ${} in a double-quoted string to avoid parsing issues
        $pattern = '^\s*' + [regex]::Escape($TokenEnvName) + '\s*=\s*(.+)\s*$'
        $match = [regex]::Match($l, $pattern)
        if ($match.Success) {
            return $match.Groups[1].Value.Trim('"')
        }
    }
    return $null
}

# 1) Obtain token from environment or .env or prompt
$token = $null
if ($Interactive) {
    $token = Read-Host -Prompt "Enter GitHub token (will not be stored)"
} else {
    # Try environment variable with dynamic name
    $envValue = $null
    try {
        $envItem = Get-ChildItem Env:$TokenEnvName -ErrorAction SilentlyContinue
        if ($envItem) { $envValue = $envItem.Value }
    } catch {
        # Ignore errors when attempting to read the environment variable
    }
    if ($envValue) { $token = $envValue }
    if (-not $token) {
        $envFile = Join-Path -Path (Get-Location) -ChildPath '.env'
        $fromEnv = Read-TokenFromDotEnv -Path $envFile
        if ($fromEnv) { $token = $fromEnv }
    }
}

if (-not $token) {
    Write-Host "No token found in environment variable $TokenEnvName or .env. Use -Interactive or set the token in your .env or environment." -ForegroundColor Yellow
    exit 2
}

# Helper to safe header access
function Get-HeaderValue($resp, $name) {
    if ($null -eq $resp) { return $null }
    if ($resp.Headers.Contains($name)) { return $resp.Headers[$name] }
    return $null
}

# 2) Test token via a lightweight REST request to inspect scopes
Write-Host "Testing token against https://api.github.com/ ..."
try {
    $headers = @{ Authorization = "token $token"; 'User-Agent' = 'fbs-graph-token-check' }
    $test = Invoke-WebRequest -Uri 'https://api.github.com/' -Method Get -Headers $headers -UseBasicParsing -ErrorAction Stop
    $scopes = Get-HeaderValue $test 'x-oauth-scopes'
    $rate = Get-HeaderValue $test 'x-ratelimit-remaining'
    Write-Host "HTTP OK — token accepted by REST endpoint." -ForegroundColor Green
    Write-Host "Scopes: $($scopes -join ', ')" -ForegroundColor Gray
    Write-Host "Rate remaining: $rate" -ForegroundColor Gray
} catch {
    $err = $_.Exception.Response
    if ($err -and $err.StatusCode) {
        Write-Host "REST test failed with HTTP status: $($err.StatusCode)" -ForegroundColor Red
    } else {
        Write-Host "REST test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host "Common causes: token missing, token lacks repo/pull request access, token needs org SSO authorization, or token expired." -ForegroundColor Yellow
    exit 3
}

# 3) Run GraphQL to fetch unresolved review threads for the PR
$graphqlUrl = 'https://api.github.com/graphql'
# Build a concrete query that inlines owner/repo/PR to avoid variable parsing issues in PowerShell
$query = 'query { repository(owner: "' + $Owner + '", name: "' + $Repo + '") { pullRequest(number: ' + $PRNumber + ') { reviewThreads(first: 100) { nodes { isResolved comments(first: 50) { nodes { author { login } body createdAt path } } } } } }'
$body = @{ query = $query } | ConvertTo-Json -Depth 10

Write-Host "Querying GraphQL for unresolved review threads on $Owner/$Repo PR #$PRNumber ..."
try {
    $resp = Invoke-RestMethod -Uri $graphqlUrl -Method Post -Headers @{ Authorization = "bearer $token"; 'User-Agent' = 'fbs-graph-token-check' } -Body $body -ContentType 'application/json' -ErrorAction Stop
} catch {
    Write-Host "GraphQL query failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "If this is a fine-grained token ensure it has 'Pull requests: Read' or repository access to the target repo. If the repo is in an org, grant SSO access as required." -ForegroundColor Yellow
    exit 4
}

if ($resp.errors) {
    Write-Host "GraphQL errors:" -ForegroundColor Red
    $resp.errors | ForEach-Object { Write-Host " - $($_.message)" }
    exit 5
}

$threads = $resp.data.repository.pullRequest.reviewThreads.nodes
$unresolved = $threads | Where-Object { -not $_.isResolved }
if (-not $unresolved -or $unresolved.Count -eq 0) {
    Write-Host "No unresolved review threads found on PR #$PRNumber." -ForegroundColor Green
    exit 0
}

# Format output
$out = @()
foreach ($t in $unresolved) {
    foreach ($c in $t.comments.nodes) {
        $snippet = $c.body -split "\r?\n" | Select-Object -First 4 -Join " `n"
        $out += [PSCustomObject]@{
            Path = $c.path
            Author = $c.author.login
            CreatedAt = $c.createdAt
            BodySnippet = $snippet
        }
    }
}

if ($OutputFile) {
    $out | ConvertTo-Json -Depth 5 | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "Wrote unresolved thread summary to $OutputFile" -ForegroundColor Green
} else {
    $out | Format-Table -AutoSize
}

Write-Host "Done." -ForegroundColor Green
