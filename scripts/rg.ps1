param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$localRg = Join-Path $repoRoot "tools\\rg.exe"
$candidatePaths = @()

if (Test-Path $localRg) {
  $candidatePaths += $localRg
}

$systemRg = Get-Command rg -ErrorAction SilentlyContinue
if ($systemRg -and -not $candidatePaths.Contains($systemRg.Source)) {
  $candidatePaths += $systemRg.Source
}

foreach ($candidate in $candidatePaths) {
  try {
    & $candidate @Args
    exit $LASTEXITCODE
  } catch {
  }
}

Write-Error "ripgrep is unavailable. Expected a usable binary at '$localRg' or on PATH."
exit 1
