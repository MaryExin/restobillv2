# Run with Windows PowerShell 5.1 or PowerShell 7. This only loads the diagnostic
# functions; it never executes provisioning, services, or the installer body.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$source = Join-Path $PSScriptRoot '../windows/install.ps1'
$tokens = $null
$parseErrors = $null
$tree = [System.Management.Automation.Language.Parser]::ParseFile(
    $source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw ($parseErrors | Out-String) }

foreach ($name in @('Assert-NoReparsePoint', 'Write-SetupFailureSummary')) {
    $definition = $tree.Find({
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $false)
    if (-not $definition) { throw "Missing diagnostic function: $name" }
    . ([scriptblock]::Create($definition.Extent.Text))
}

$tempBase = [IO.Path]::GetTempPath()
# macOS's default /var temp path traverses a symlink. The production helper
# rejects junctions/symlinks, so use its canonical temporary root for this test.
if ([IO.Directory]::Exists('/private/tmp')) { $tempBase = '/private/tmp' }
$temp = Join-Path $tempBase ('lightem-error-test-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
$count = 0
function Assert-Test([bool]$Condition, [string]$Description) {
    if (-not $Condition) { throw "FAIL: $Description" }
    $script:count++
    Write-Output "PASS: $Description"
}
try {
    $ErrorSummaryPath = Join-Path $temp 'error.txt'
    Assert-NoReparsePoint $ErrorSummaryPath
    Write-SetupFailureSummary ('Cannot open ' + [char]0x00E9 + ' folder. Retry setup.')
    $bytes = [IO.File]::ReadAllBytes($ErrorSummaryPath)
    Assert-Test ($bytes[0] -eq [byte][char]'C' -and $bytes[1] -eq 0) 'summary is UTF-16LE without a byte-order mark for NSIS'
    Assert-Test ([Text.Encoding]::Unicode.GetString($bytes).Contains([char]0x00E9)) 'summary preserves Unicode failure text'

    Write-SetupFailureSummary 'DB_PASSWORD="private password"; pwd: hidden token=''private token'' SECRET_KEY=hidden backend failed'
    $safe = [IO.File]::ReadAllText($ErrorSummaryPath, [Text.Encoding]::Unicode)
    Assert-Test ($safe -notmatch 'private|hidden') 'quoted, unquoted, and prefixed credential values are redacted'
    Assert-Test ($safe.Contains('backend failed')) 'diagnostic context remains readable'

    Write-SetupFailureSummary ('x' * 4000)
    Assert-Test (([IO.File]::ReadAllText($ErrorSummaryPath, [Text.Encoding]::Unicode)).Length -eq 1200) 'late failure is bounded independently of earlier process output'

    $ErrorSummaryPath = Join-Path $temp 'missing-parent/error.txt'
    Write-SetupFailureSummary 'original installation failure'
    Assert-Test (-not (Test-Path -LiteralPath $ErrorSummaryPath)) 'an unwritable summary does not throw or create directories'

    $ErrorSummaryPath = ''
    $output = @(Write-SetupFailureSummary 'optional argument omitted')
    Assert-Test ($output.Count -eq 0) 'existing callers can omit the summary path without side effects'
    Write-Output "Completed $count diagnostic checks; full installer syntax parsed successfully."
} finally {
    [IO.Directory]::Delete($temp, $true)
}
