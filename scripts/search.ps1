param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Pattern,

  [Parameter(Position = 1)]
  [string]$Path = "."
)

$rg = Get-Command rg -ErrorAction SilentlyContinue
if ($rg) {
  try {
    & $rg.Source -n --hidden --glob "!output/**" $Pattern $Path
    exit $LASTEXITCODE
  } catch {
  }
}

Get-ChildItem -Path $Path -Recurse -File |
  Where-Object { $_.FullName -notmatch "\\output\\" } |
  Select-String -Pattern $Pattern
