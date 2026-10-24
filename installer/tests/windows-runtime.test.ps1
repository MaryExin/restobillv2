# Tests destination detection on temporary fixtures without running XAMPP,
# service operations, provisioning, or any other installer actions.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$source = Join-Path $PSScriptRoot '../windows/install.ps1'
$tokens = $null
$parseErrors = $null
$tree = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw ($parseErrors | Out-String) }
foreach ($name in @('Assert-NoReparsePoint', 'Get-XamppInstallationState')) {
    $definition = $tree.Find({
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $false)
    if (-not $definition) { throw "Missing installation function: $name" }
    . ([scriptblock]::Create($definition.Extent.Text))
}
$tempBase = [IO.Path]::GetTempPath()
if ([IO.Directory]::Exists('/private/tmp')) { $tempBase = '/private/tmp' }
$temp = Join-Path $tempBase ('lightem-runtime-test-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
$count = 0
function Assert-Test([bool]$Condition, [string]$Description) {
    if (-not $Condition) { throw "FAIL: $Description" }
    $script:count++
    Write-Output "PASS: $Description"
}
try {
    $missing = Join-Path $temp 'missing-xampp'
    Assert-Test ((Get-XamppInstallationState $missing) -eq 'Absent') 'missing XAMPP destination permits fresh installation'
    Assert-Test (-not (Test-Path -LiteralPath $missing)) 'detection does not create or change the destination'

    $root = Join-Path $temp 'xampp'
    [IO.Directory]::CreateDirectory($root) | Out-Null
    Assert-Test ((Get-XamppInstallationState $root) -eq 'Empty') 'existing empty folder permits fresh installation'

    $hidden = Join-Path $root '.existing-data'
    [IO.File]::WriteAllText($hidden, 'preserve this content')
    if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
        [IO.File]::SetAttributes($hidden, [IO.FileAttributes]::Hidden)
    }
    Assert-Test ((Get-XamppInstallationState $root) -eq 'Existing') 'hidden files retain compatibility checks instead of triggering a fresh install'
    Assert-Test ([IO.File]::ReadAllText($hidden) -eq 'preserve this content') 'existing files are never removed or overwritten by detection'
    [IO.File]::Delete($hidden)

    [IO.Directory]::CreateDirectory((Join-Path $root 'mysql')) | Out-Null
    Assert-Test ((Get-XamppInstallationState $root) -eq 'Existing') 'even an empty leftover component directory requires compatibility checks'
    $data = Join-Path $root 'mysql/db_cnc_pos.ibd'
    [IO.File]::WriteAllText($data, 'existing database fixture')
    Assert-Test ((Get-XamppInstallationState $root) -eq 'Existing') 'incomplete XAMPP with database files cannot become a fresh install'
    Assert-Test ([IO.File]::ReadAllText($data) -eq 'existing database fixture') 'database fixture content is preserved'

    $file = Join-Path $temp 'file-instead-of-folder'
    [IO.File]::WriteAllText($file, 'keep')
    $rejected = $false
    try { Get-XamppInstallationState $file | Out-Null } catch { $rejected = $true }
    Assert-Test ($rejected -and [IO.File]::ReadAllText($file) -eq 'keep') 'a file occupying the installation path is rejected and retained'
    Write-Output "Completed $count XAMPP destination checks."
} finally {
    [IO.Directory]::Delete($temp, $true)
}
