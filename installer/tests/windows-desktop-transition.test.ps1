# Isolated desktop-settings fixtures. Never execute the installer body or read
# the real registry, services, credentials, databases, or installed application.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$source = Join-Path $PSScriptRoot '../windows/install-standalone.ps1'
$tokens = $null; $parseErrors = $null
$tree = [Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
foreach ($name in @('Assert-NoReparsePoint', 'Restore-DesktopSettingsFrom', 'Restore-DesktopSettings', 'Restore-PreviousStandaloneDesktopSettings')) {
    $definition = $tree.Find({ param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $false)
    if (-not $definition) { throw "Missing function $name" }
    . ([scriptblock]::Create($definition.Extent.Text))
}
$count = 0
function Assert-Test([bool]$Condition, [string]$Description) {
    if (-not $Condition) { throw "FAIL: $Description" }
    $script:count++
    Write-Output "PASS: $Description"
}
$registryCalls = New-Object System.Collections.Generic.List[string]
$messages = New-Object System.Collections.Generic.List[string]
$registrations = @{}
function Get-ItemProperty {
    param([string]$LiteralPath, [string]$Name, [string]$ErrorAction)
    if ($Name -ne 'InstallLocation' -or $LiteralPath -notmatch '^Registry::(HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER)\\Software\\ad006819-e4dd-5b91-aefa-49424bec529f$') {
        throw 'Unexpected registry lookup from settings transition'
    }
    $script:registryCalls.Add($LiteralPath)
    if ($script:registrations.ContainsKey($Matches[1])) { return [pscustomobject]@{InstallLocation=$script:registrations[$Matches[1]]} }
    return $null
}
function Write-SetupLog([string]$Message) { $script:messages.Add($Message) }
$tempBase = [IO.Path]::GetTempPath()
if ([IO.Directory]::Exists('/private/tmp')) { $tempBase = '/private/tmp' }
$fixture = Join-Path $tempBase ('lightem-desktop-transition-' + [Guid]::NewGuid().ToString('N'))
$AppRoot = Join-Path $fixture 'new-app'
$oldApp = Join-Path $fixture 'old-app'
$oldResources = Join-Path $oldApp 'resources'
$newResources = Join-Path $AppRoot 'resources'
$DesktopRecoveryRoot = Join-Path $fixture 'recovery'
$runtimeState = [pscustomobject]@{status='ready';version='0.0.1';buildId='20260928004944'}
$allowlist = @('ip.txt','printer.txt','businessInfo.json','pos-config.json','printer_categories.json')
[IO.Directory]::CreateDirectory($oldResources) | Out-Null
[IO.Directory]::CreateDirectory($newResources) | Out-Null
function Write-OldRelease($Overrides = @{}) {
    $release = @{runtimeKind='standalone';platform='win32';version='0.0.1';buildId='20260928004944'}
    foreach ($entry in $Overrides.GetEnumerator()) { $release[$entry.Key] = $entry.Value }
    [IO.File]::WriteAllText((Join-Path $oldResources 'system-release.json'), ($release | ConvertTo-Json))
}
function Reset-NewSettings {
    foreach ($name in $allowlist) { [IO.File]::WriteAllText((Join-Path $newResources $name), 'new-default-' + $name) }
    $backups = Join-Path $newResources 'business-info-backups'
    if (Test-Path -LiteralPath $backups) { Remove-Item -LiteralPath $backups -Recurse -Force }
    $script:registryCalls.Clear(); $script:messages.Clear()
}
function Assert-NewSettings([string]$Description) {
    $unchanged = $true
    foreach ($name in $allowlist) { if ([IO.File]::ReadAllText((Join-Path $newResources $name)) -ne ('new-default-' + $name)) { $unchanged = $false } }
    Assert-Test $unchanged $Description
}
try {
    Write-OldRelease
    [IO.File]::WriteAllText((Join-Path $oldResources 'app.asar'), 'old-desktop-bytes')
    [IO.File]::WriteAllText((Join-Path $newResources 'app.asar'), 'new-desktop-bytes')
    foreach ($name in $allowlist) { [IO.File]::WriteAllText((Join-Path $oldResources $name), 'old-owned-' + $name) }
    [IO.Directory]::CreateDirectory((Join-Path $oldResources 'business-info-backups')) | Out-Null
    [IO.File]::WriteAllText((Join-Path $oldResources 'business-info-backups/business.json'), 'old-owned-backup')
    [IO.File]::WriteAllText((Join-Path $oldResources 'unrelated-secret.txt'), 'never-copy')
    $registrations['HKEY_LOCAL_MACHINE'] = $oldApp
    Reset-NewSettings
    Restore-PreviousStandaloneDesktopSettings
    foreach ($name in $allowlist) {
        Assert-Test ([IO.File]::ReadAllText((Join-Path $newResources $name)) -eq ('old-owned-' + $name)) "copies the owned standalone setting: $name"
        Assert-Test ([IO.File]::ReadAllText((Join-Path $oldResources $name)) -eq ('old-owned-' + $name)) "preserves the old setting: $name"
    }
    Assert-Test ([IO.File]::ReadAllText((Join-Path $newResources 'business-info-backups/business.json')) -eq 'old-owned-backup') 'copies existing business settings backups'
    Assert-Test ([IO.File]::ReadAllText((Join-Path $oldResources 'app.asar')) -eq 'old-desktop-bytes' -and [IO.File]::ReadAllText((Join-Path $newResources 'app.asar')) -eq 'new-desktop-bytes') 'never replaces either desktop executable archive'
    Assert-Test (-not (Test-Path -LiteralPath (Join-Path $newResources 'unrelated-secret.txt'))) 'does not copy files outside the settings allowlist'
    Assert-Test ($messages.Count -eq 1 -and $messages[0] -match 'previous application was preserved') 'records successful settings transition without logging contents'

    Reset-NewSettings
    [IO.Directory]::CreateDirectory($DesktopRecoveryRoot) | Out-Null
    [IO.File]::WriteAllText((Join-Path $DesktopRecoveryRoot 'recovery.json'), '{}')
    Restore-PreviousStandaloneDesktopSettings
    Assert-NewSettings 'current standalone recovery settings take priority over old-ID settings'
    Assert-Test ($registryCalls.Count -eq 0) 'does not inspect the old desktop when current recovery exists'
    Remove-Item -LiteralPath $DesktopRecoveryRoot -Recurse -Force

    foreach ($state in @($null, [pscustomobject]@{status='initializing';version='0.0.1';buildId='20260928004944'})) {
        Reset-NewSettings
        $runtimeState = $state
        Restore-PreviousStandaloneDesktopSettings
        Assert-NewSettings 'fresh or initializing standalone setup does not import old desktop settings'
        Assert-Test ($registryCalls.Count -eq 0) 'fresh/copy setup never reads old desktop registration'
    }
    $runtimeState = [pscustomobject]@{status='ready';version='0.0.1';buildId='20260928004944'}
    foreach ($mismatch in @(@{runtimeKind='xampp'},@{runtimeKind=$null},@{platform='darwin'},@{version='0.0.2'},@{buildId='20260927004944'})) {
        Reset-NewSettings
        Write-OldRelease $mismatch
        Restore-PreviousStandaloneDesktopSettings
        Assert-NewSettings ('does not import unproven desktop settings: ' + ($mismatch | ConvertTo-Json -Compress))
        Assert-Test ($messages.Count -eq 0) 'unproven metadata cannot report a successful settings copy'
    }
    Write-OldRelease
    foreach ($missing in @('system-release.json','app.asar')) {
        Reset-NewSettings
        $file = Join-Path $oldResources $missing
        $bytes = [IO.File]::ReadAllBytes($file)
        Remove-Item -LiteralPath $file
        Restore-PreviousStandaloneDesktopSettings
        Assert-NewSettings "does not copy an incomplete old desktop missing $missing"
        [IO.File]::WriteAllBytes($file,$bytes)
    }

    Reset-NewSettings
    $registrations['HKEY_LOCAL_MACHINE'] = $AppRoot
    Restore-PreviousStandaloneDesktopSettings
    Assert-NewSettings 'same destination is not treated as an old desktop settings source'

    Reset-NewSettings
    $registrations.Clear()
    $registrations['HKEY_CURRENT_USER'] = $oldApp
    Restore-PreviousStandaloneDesktopSettings
    Assert-Test ([IO.File]::ReadAllText((Join-Path $newResources 'printer.txt')) -eq 'old-owned-printer.txt') 'discovers an old standalone desktop registered for the current user'

    Reset-NewSettings
    $registrations.Clear()
    Restore-PreviousStandaloneDesktopSettings
    Assert-NewSettings 'missing old desktop registration keeps clean defaults'

    Reset-NewSettings
    $registrations['HKEY_LOCAL_MACHINE'] = $oldApp
    $oldIp = Join-Path $oldResources 'ip.txt'
    Remove-Item -LiteralPath $oldIp
    New-Item -ItemType SymbolicLink -Path $oldIp -Target (Join-Path $oldResources 'unrelated-secret.txt') | Out-Null
    $rejected = $false
    try { Restore-PreviousStandaloneDesktopSettings } catch { $rejected = $true }
    Assert-Test $rejected 'a linked settings file cannot redirect the privileged copy'
    Assert-NewSettings 'rejects linked settings before copying the first allowlisted file'
    Remove-Item -LiteralPath $oldIp
    [IO.File]::WriteAllText($oldIp,'old-owned-ip.txt')

    $text = [IO.File]::ReadAllText($source)
    Assert-Test ($text.IndexOf('        Restore-DesktopSettings') -lt $text.IndexOf('        Restore-PreviousStandaloneDesktopSettings') -and $text.IndexOf('        Restore-PreviousStandaloneDesktopSettings') -lt $text.IndexOf('        Set-DesktopLocalEndpoint')) 'integration restores proven settings before applying the owned backend port'
    Write-Output "Completed $count desktop transition checks using temporary files and a mocked registry only."
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force
}
