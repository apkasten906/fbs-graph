Param(
    [Parameter(Mandatory=$true)][string]$Owner,
    [Parameter(Mandatory=$true)][string]$Repo,
    [Parameter(Mandatory=$true)][int]$PRNumber
)

# Construct the GraphQL query the token-check script uses.
# Use a proper PowerShell here-string: the opening @" must be alone on its line
$query = @"
query {
  repository(owner: "$Owner", name: "$Repo") {
    pullRequest(number: $PRNumber) {
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
"@

Write-Host '---GRAPHQL QUERY START---'
Write-Host $query
Write-Host '---GRAPHQL QUERY END---'

# Also print a one-line compact version (collapse newlines/extra spaces) for easy HTTP POSTing
$compact = ($query -split '\n' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }) -join ' '
$compact = $compact -replace '\s+', ' '
Write-Host '---COMPACT QUERY---'
Write-Host $compact

exit 0
