param([Parameter(Mandatory = $true)][string]$RepoPath)
$ErrorActionPreference = "Stop"
$repo = (& git -C $RepoPath rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0) { throw "RepoPath must be inside your Git repository." }
$patchFile = Join-Path $PSScriptRoot "nutrition-phase.patch"
& git -C $repo apply --check --whitespace=nowarn $patchFile
if ($LASTEXITCODE -ne 0) { throw "Patch context differs from your checkout. No patch files were applied. Keep your current files and inspect the conflicting changes before applying." }
& git -C $repo apply --whitespace=nowarn $patchFile
if ($LASTEXITCODE -ne 0) { throw "Git could not apply the patch. Review git status before continuing." }
Write-Host "Nutrition and Phase Management coach patch applied. Run the checks and migration in README.md before deployment."
