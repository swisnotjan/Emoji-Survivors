param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Pattern,

  [Parameter(Position = 1)]
  [string]$Path = "."
)

$rg = Get-Command rg -ErrorAction SilentlyContinue
$repoRoot = Split-Path -Parent $PSScriptRoot
$localRg = Join-Path $repoRoot "tools\\rg.exe"
$rgCandidates = @()

if (Test-Path $localRg) {
  $rgCandidates += $localRg
}

if ($rg) {
  $rgCandidates += $rg.Source
}

foreach ($rgCandidate in $rgCandidates) {
  try {
    & $rgCandidate -n --hidden --glob "!output/**" $Pattern $Path
    exit $LASTEXITCODE
  } catch {
  }
}

Get-ChildItem -Path $Path -Recurse -File |
  Where-Object { $_.FullName -notmatch "\\output\\" } |
  Select-String -Pattern $Pattern
