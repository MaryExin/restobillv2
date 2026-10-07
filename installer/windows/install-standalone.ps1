#requires -Version 5.1
#requires -RunAsAdministrator
<#
Standalone Lightem server installation. Runtime and databases belong to Lightem,
not XAMPP. The legacy installer is intentionally maintained separately.
Run from the elevated standalone NSIS installer; no database passwords appear
in command arguments. Never execute this file merely to test its functions.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PayloadRoot,
    [Parameter(Mandatory = $true)][string]$AppRoot,
    [switch]$CheckOnly,
    [switch]$CheckAppDestinationOnly,
    [switch]$RequireEmptyAppDestination,
    [switch]$CopyXamppStore,
    [switch]$ShowInitialLogin,
    [string]$ErrorSummaryPath = '',
    [string]$DesktopRecoveryRoot = '',
    [string]$InstallerRegistryKey = '',
    [string]$UninstallRegistryKey = '',
    [ValidateSet('HKLM', 'HKCU')][string]$RegistryHive = 'HKLM'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$installerId = 'com.lenard.restobill.setup'
$markerName = '.lightem-managed-install.json'
$runId = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$lightemRoot = Join-Path $env:ProgramData 'LightemStandalone'
$stateRoot = Join-Path $lightemRoot 'Installer'
$documentRoot = Join-Path $lightemRoot 'backend'
$dataRoot = Join-Path $lightemRoot 'data'
$configRoot = Join-Path $lightemRoot 'config'
$secretRoot = Join-Path $lightemRoot 'secrets'
$databaseBackupRoot = Join-Path $lightemRoot 'database-backups'
$databaseManagerRoot = Join-Path $lightemRoot 'phpmyadmin'
$databaseManagerTemp = Join-Path $lightemRoot 'phpmyadmin-temp'
$databaseManagerSecret = Join-Path $secretRoot 'phpmyadmin-cookie.txt'
$runtimeStatePath = Join-Path $lightemRoot 'standalone-runtime.json'
$rootPasswordPath = Join-Path $secretRoot 'database-root.txt'
$initSqlPath = Join-Path $secretRoot 'database-init.sql'
$logPath = Join-Path $stateRoot "logs\standalone-$runId.log"
$backupRoot = Join-Path $stateRoot "backups\standalone-$runId"
$credentialsPath = Join-Path $stateRoot "credentials\initial-access-$runId.txt"
$xamppRoot = 'C:\xampp'
$xamppWebRoot = Join-Path $xamppRoot 'htdocs'
$copyExistingStore = $false
$apacheService = 'LightemApache'
$databaseService = 'LightemDatabase'
$apacheIdentity = "NT SERVICE\$apacheService"
$databaseIdentity = "NT SERVICE\$databaseService"
$databasePort = 3307
$httpPort = 8080
$serviceSnapshots = @{}
$createdServices = New-Object System.Collections.Generic.List[string]
$runtimeState = $null
$runtimeRoot = $null
$phpPath = $null
$phpIniPath = Join-Path $configRoot 'php.ini'
$apachePath = $null
$mysqlPath = $null
$apacheConfig = Join-Path $configRoot 'httpd.conf'
$databaseConfig = Join-Path $configRoot 'my.ini'
$managed = $false
$success = $false
$backupMade = $false
$backendChanged = $false
$databaseManagerChanged = $false
$provisionSucceeded = $false
$preflightDatabaseTouched = $false
$runtimeServicesChanged = $false
$firewallChanged = $false
$mutexAcquired = $false
$mutex = $null
$probePath = $null
$backendEntries = @('api', 'src', 'vendor', '.env', '.htaccess', $markerName)
$mediaDirectories = @('api\images', 'api\uploads', 'images', 'uploads', 'profile_pictures', 'item_pictures', 'pos_second_screen', 'pos_db_backup')


function Write-SetupLog([string]$Message) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    try { Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8 -ErrorAction Stop }
    catch { Write-Warning "Could not append to setup log: $logPath" }
    Write-Output $line
}

function Write-SetupFailureSummary([string]$Message) {
    if (-not $ErrorSummaryPath) { return }
    try {
        # A private NSIS temporary file carries the failure independently of
        # the regular log, which may not exist when startup/ACL checks fail.
        Assert-NoReparsePoint $ErrorSummaryPath
        $safe = [regex]::Replace($Message, '(?im)\b([a-z0-9_]*(?:password|passwd|pwd|secret_key|token)[a-z0-9_]*)\s*[=:]\s*(?:"[^"]*"|''[^'']*''|\S+)', '$1=[redacted]')
        $location = ''
        if (Test-Path -LiteralPath $logPath -PathType Leaf) {
            $location = "`r`n`r`nFull setup log (administrator access):`r`n$logPath"
        }
        $limit = [Math]::Max(0, 1200 - $location.Length)
        if ($safe.Length -gt $limit) { $safe = $safe.Substring(0, $limit) }
        $safe += $location
        [IO.File]::WriteAllText($ErrorSummaryPath, $safe, (New-Object Text.UnicodeEncoding($false, $false)))
    } catch {
        # The captured process output remains available to NSIS if this file
        # cannot be written; reporting must never replace the original error.
    }
}

function Assert-NoReparsePoint([string]$Path, [switch]$Recurse) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "A symbolic link or junction is not allowed in installation paths: $cursor"
            }
        }
        $parent = Split-Path -Parent $cursor
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
    if ($Recurse -and (Test-Path -LiteralPath $Path)) {
        $linked = Get-ChildItem -LiteralPath $Path -Force -Recurse |
            Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } |
            Select-Object -First 1
        if ($linked) { throw "A symbolic link or junction is not allowed in the payload or backend: $($linked.FullName)" }
    }
}

function ConvertTo-ProcessArgument([string]$Value) {
    # CommandLineToArgvW quoting, including a trailing backslash in a quoted path.
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}

function Invoke-CheckedProcess {
    param([string]$File, [string[]]$Arguments, [string]$Label, [int]$TimeoutSeconds = 180)
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $File
    $info.Arguments = (($Arguments | ForEach-Object { ConvertTo-ProcessArgument $_ }) -join ' ')
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.WorkingDirectory = Split-Path -Parent $File
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw "$Label did not start." }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            $process.Kill()
            throw "$Label timed out after $TimeoutSeconds seconds. Check running processes before retrying."
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            # The provision/verify tools deliberately never print credentials.
            $details = ($stderr + "`n" + $stdout).Trim()
            $details = [regex]::Replace($details, '(?im)(password|secret_key|token)\s*[=:]\s*\S+', '$1=[redacted]')
            if ($details.Length -gt 2500) { $details = $details.Substring(0, 2500) }
            throw "$Label failed (exit $($process.ExitCode)). $details"
        }
        return $stdout.Trim()
    } finally {
        $process.Dispose()
    }
}

function Get-RuntimeService([string]$Name) {
    return Get-CimInstance Win32_Service -Filter "Name='$Name'"
}

function Get-ServiceExecutable([string]$CommandLine) {
    if ($CommandLine -match '^\s*"([^"]+)"') { return $Matches[1] }
    if ($CommandLine -match '^\s*(.+?\.exe)(?:\s|$)') { return $Matches[1] }
    throw 'Cannot safely identify an existing service executable.'
}

function Assert-NoDowngrade($Existing, $Incoming) {
    Add-Type -AssemblyName System.Numerics
    if ([string]$Existing.buildId -notmatch '^\d{1,20}$' -or [string]$Incoming.buildId -notmatch '^\d{1,20}$') {
        throw 'Installation metadata has an invalid build number; refusing to replace it.'
    }
    $oldVersion = [Version]([string]$Existing.version -replace '-.*$', '')
    $newVersion = [Version]([string]$Incoming.version -replace '-.*$', '')
    if ($newVersion -lt $oldVersion -or [Numerics.BigInteger]::Parse([string]$Incoming.buildId) -lt [Numerics.BigInteger]::Parse([string]$Existing.buildId)) {
        throw "This device has a newer Lightem build ($($Existing.version), $($Existing.buildId)). Use the same or a newer installer; downgrades are blocked."
    }
}

function Backup-Desktop {
    if (-not $DesktopRecoveryRoot -or -not (Test-Path -LiteralPath (Join-Path $AppRoot 'resources\app.asar'))) { return }
    Assert-NoReparsePoint $AppRoot -Recurse
    $running = Get-CimInstance Win32_Process | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith(($AppRoot.TrimEnd('\') + '\'), [StringComparison]::OrdinalIgnoreCase)
    } | Select-Object -First 1
    if ($running) { throw 'Lightem POS is still running. Close the desktop app and run the installer again.' }
    Assert-NoReparsePoint $DesktopRecoveryRoot
    if (Test-Path -LiteralPath $DesktopRecoveryRoot) { throw 'The desktop recovery directory already exists. Close other installers and retry.' }
    New-Item -ItemType Directory -Path $DesktopRecoveryRoot -Force | Out-Null
    Set-PrivateAcl $DesktopRecoveryRoot -Directory
    $destination = Join-Path $DesktopRecoveryRoot 'app'
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Write-SetupLog "Saving the existing desktop application before update: $DesktopRecoveryRoot"
    foreach ($item in Get-ChildItem -LiteralPath $AppRoot -Force) {
        if ($item.Name -eq 'resources' -and $item.PSIsContainer) {
            $resourceDestination = Join-Path $destination 'resources'
            New-Item -ItemType Directory -Path $resourceDestination -Force | Out-Null
            foreach ($resource in Get-ChildItem -LiteralPath $item.FullName -Force) {
                if ($resource.Name -ne 'setup') { Copy-Item -LiteralPath $resource.FullName -Destination $resourceDestination -Recurse -Force }
            }
        } else { Copy-Item -LiteralPath $item.FullName -Destination $destination -Recurse -Force }
    }
    $registryFiles = @()
    foreach ($key in @($InstallerRegistryKey, $UninstallRegistryKey)) {
        if (-not $key) { continue }
        if ($key -notmatch '^Software\\[A-Za-z0-9\\ {}._-]+$') { throw 'Unexpected installer registry path.' }
        $registryFile = Join-Path $DesktopRecoveryRoot "registry-$($registryFiles.Count).reg"
        $providerHive = if ($RegistryHive -eq 'HKLM') { 'HKEY_LOCAL_MACHINE' } else { 'HKEY_CURRENT_USER' }
        if (Test-Path -LiteralPath "Registry::$providerHive\$key") {
            Invoke-CheckedProcess (Join-Path $env:SystemRoot 'System32\reg.exe') @('export', "$RegistryHive\$key", $registryFile, '/y') 'Saving desktop registration' | Out-Null
            $registryFiles += $registryFile
        }
    }
    @{ appRoot = $AppRoot; registryFiles = $registryFiles; complete = $true } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DesktopRecoveryRoot 'recovery.json') -Encoding UTF8
}

function Restore-DesktopSettingsFrom([string]$SourceResources) {
    $resources = Join-Path $AppRoot 'resources'
    $editable = @('ip.txt', 'printer.txt', 'businessInfo.json', 'pos-config.json', 'printer_categories.json')
    foreach ($root in @($SourceResources, $resources)) {
        Assert-NoReparsePoint $root
        if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'The desktop settings recovery directory is missing.' }
        foreach ($name in @($editable + 'business-info-backups')) {
            $path = Join-Path $root $name
            Assert-NoReparsePoint $path -Recurse
            if ($name -in $editable -and (Test-Path -LiteralPath $path) -and -not (Test-Path -LiteralPath $path -PathType Leaf)) {
                throw "An editable desktop setting is not a regular file: $name"
            }
        }
    }
    # The previous profile must stay authoritative even when it lacks a file.
    # Keep pristine images defaults for tenant-aware backfill after restoration.
    foreach ($name in $editable) {
        $path = Join-Path $resources $name
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
    }
    foreach ($name in @($editable + 'business-info-backups')) {
        $source = Join-Path $SourceResources $name
        if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $resources -Recurse -Force }
    }
}

function Restore-DesktopSettings {
    if (-not $DesktopRecoveryRoot -or -not (Test-Path -LiteralPath (Join-Path $DesktopRecoveryRoot 'recovery.json'))) { return }
    Restore-DesktopSettingsFrom (Join-Path $DesktopRecoveryRoot 'app\resources')
    Write-SetupLog 'Previous terminal, server, business, and printer settings restored.'
}

function Restore-PreviousStandaloneDesktopSettings {
    if (-not $runtimeState -or $runtimeState.status -ne 'ready' -or
        ($DesktopRecoveryRoot -and (Test-Path -LiteralPath (Join-Path $DesktopRecoveryRoot 'recovery.json')))) { return }
    # Earlier standalone builds shared the legacy desktop identity. A new
    # separate desktop can copy that owned store's settings without removing
    # its old application. Existing recovery settings always take priority.
    foreach ($hive in @('HKEY_LOCAL_MACHINE', 'HKEY_CURRENT_USER')) {
        $key = "Registry::$hive\Software\ad006819-e4dd-5b91-aefa-49424bec529f"
        $registration = Get-ItemProperty -LiteralPath $key -Name InstallLocation -ErrorAction SilentlyContinue
        if (-not $registration -or -not $registration.InstallLocation) { continue }
        $oldRoot = [IO.Path]::GetFullPath([string]$registration.InstallLocation)
        if ($oldRoot.TrimEnd('\', '/').Equals($AppRoot.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase)) { continue }
        Assert-NoReparsePoint $oldRoot
        $oldResources = Join-Path $oldRoot 'resources'
        Assert-NoReparsePoint $oldResources
        $oldRelease = Join-Path $oldResources 'system-release.json'
        $oldAsar = Join-Path $oldResources 'app.asar'
        foreach ($path in @($oldRelease, $oldAsar)) { Assert-NoReparsePoint $path }
        if (-not (Test-Path -LiteralPath $oldRelease -PathType Leaf) -or -not (Test-Path -LiteralPath $oldAsar -PathType Leaf)) { continue }
        $release = Get-Content -LiteralPath $oldRelease -Raw | ConvertFrom-Json
        if ($null -eq $release.PSObject.Properties['runtimeKind'] -or $release.runtimeKind -ne 'standalone' -or
            $null -eq $release.PSObject.Properties['platform'] -or $release.platform -ne 'win32' -or
            $null -eq $release.PSObject.Properties['version'] -or [string]$release.version -cne [string]$runtimeState.version -or
            $null -eq $release.PSObject.Properties['buildId'] -or [string]$release.buildId -cne [string]$runtimeState.buildId) { continue }
        Restore-DesktopSettingsFrom $oldResources
        Write-SetupLog 'Existing standalone terminal, business, and printer settings copied to the separate desktop. Its previous application was preserved.'
        return
    }
}

function Restore-Desktop {
    if (-not $DesktopRecoveryRoot -or -not (Test-Path -LiteralPath (Join-Path $DesktopRecoveryRoot 'recovery.json'))) { return }
    $recovery = Get-Content -LiteralPath (Join-Path $DesktopRecoveryRoot 'recovery.json') -Raw | ConvertFrom-Json
    if ($recovery.complete -ne $true) { throw 'The desktop recovery copy is incomplete.' }
    $oldRoot = [string]$recovery.appRoot
    Assert-NoReparsePoint $oldRoot
    New-Item -ItemType Directory -Path $oldRoot -Force | Out-Null
    foreach ($item in Get-ChildItem -LiteralPath (Join-Path $DesktopRecoveryRoot 'app') -Force) {
        Copy-Item -LiteralPath $item.FullName -Destination $oldRoot -Recurse -Force
    }
    foreach ($file in @($recovery.registryFiles)) {
        Invoke-CheckedProcess (Join-Path $env:SystemRoot 'System32\reg.exe') @('import', [string]$file) 'Restoring desktop registration' | Out-Null
    }
    Write-SetupLog "Previous desktop application and registration restored at $oldRoot. Recovery copy: $DesktopRecoveryRoot"
}

function Copy-BackendOverlay {
    foreach ($directory in @('api', 'src', 'vendor')) {
        $source = Join-Path $PayloadRoot "backend\$directory"
        $destination = Join-Path $documentRoot $directory
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        foreach ($item in Get-ChildItem -LiteralPath $source -Force) {
            if ($directory -eq 'api' -and $item.Name -eq 'config.php') { continue }
            # Uploaded media and existing runtime output belong to this device.
            if ($item.PSIsContainer -and $item.Name -match '^(images?|uploads?|backups?|logs?|receipts?)$' -and
                (Test-Path -LiteralPath (Join-Path $destination $item.Name))) { continue }
            Copy-Item -LiteralPath $item.FullName -Destination $destination -Recurse -Force
        }
    }
}

function Test-HttpRuntime([string]$ExpectedPhpVersion) {
    $nonce = [Guid]::NewGuid().ToString('N')
    $name = "lightem-setup-check-$([Guid]::NewGuid().ToString('N')).php"
    $script:probePath = Join-Path $documentRoot $name
    $probe = "<?php header('Content-Type: application/json'); header('Cache-Control: no-store'); echo json_encode(['nonce'=>'$nonce','phpVersion'=>PHP_VERSION]);"
    [IO.File]::WriteAllText($script:probePath, $probe, (New-Object Text.UTF8Encoding($false)))
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$httpPort/$name" -TimeoutSec 15
        $result = $response.Content | ConvertFrom-Json
        if ($result.nonce -ne $nonce -or $result.phpVersion -ne $ExpectedPhpVersion) {
            throw 'The localhost web server did not execute the expected PHP runtime.'
        }
    } finally {
        Remove-Item -LiteralPath $script:probePath -Force -ErrorAction SilentlyContinue
        $script:probePath = $null
    }
}

function Install-DatabaseManager($Manifest) {
    $source = Join-Path $PayloadRoot 'phpmyadmin'
    Assert-NoReparsePoint $source -Recurse
    Assert-NoReparsePoint $databaseManagerRoot -Recurse
    # Verify the clean distribution before adding this device's private config.
    Invoke-LightemPhp @((Join-Path $PayloadRoot 'verify-phpmyadmin.php'), '--root', $source,
        '--sha256', [string]$Manifest.phpMyAdminSha256, '--version', [string]$Manifest.phpMyAdminVersion) 'Verifying the bundled database manager' | Out-Null
    $script:databaseManagerChanged = $true
    if (Test-Path -LiteralPath $databaseManagerRoot) { Remove-Item -LiteralPath $databaseManagerRoot -Recurse -Force }
    Copy-Item -LiteralPath $source -Destination $databaseManagerRoot -Recurse -Force
    Invoke-LightemPhp @((Join-Path $PayloadRoot 'phpmyadmin-config.php'), '--root', $databaseManagerRoot,
        '--temp-dir', $databaseManagerTemp, '--secret-file', $databaseManagerSecret) 'Configuring password-based database manager access' | Out-Null
    Set-PrivateAcl $databaseManagerSecret
    Set-PrivateAcl $databaseManagerRoot -Directory -ReadIdentity $apacheIdentity
    Set-PrivateAcl (Join-Path $databaseManagerRoot 'config.inc.php') -ReadIdentity $apacheIdentity
}

function Restore-DatabaseManager {
    if (-not $databaseManagerChanged -or -not $backupMade) { return }
    Assert-NoReparsePoint $databaseManagerRoot -Recurse
    $source = Join-Path $backupRoot 'phpmyadmin'
    if (Test-Path -LiteralPath $databaseManagerRoot) { Remove-Item -LiteralPath $databaseManagerRoot -Recurse -Force }
    if (Test-Path -LiteralPath $source) {
        Assert-NoReparsePoint $source -Recurse
        Copy-Item -LiteralPath $source -Destination $databaseManagerRoot -Recurse -Force
        Set-PrivateAcl $databaseManagerRoot -Directory -ReadIdentity $apacheIdentity
        $configuration = Join-Path $databaseManagerRoot 'config.inc.php'
        if (Test-Path -LiteralPath $configuration) { Set-PrivateAcl $configuration -ReadIdentity $apacheIdentity }
    }
    # The cookie secret stays private and stable even when a first install fails.
    # No database credentials, database files, or schema are changed here.
}

function Test-DatabaseManagerHttp {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$httpPort/lightem-db/" -TimeoutSec 15
    if ($response.StatusCode -ne 200 -or $response.Content -notmatch 'name=["'']pma_username["'']') {
        throw 'The local database manager did not display its password login form.'
    }
}

function Set-DesktopConfigPermissions {
    $resources = Join-Path $AppRoot 'resources'
    Assert-NoReparsePoint $resources
    $users = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')
    foreach ($name in @('ip.txt', 'printer.txt', 'businessInfo.json', 'pos-config.json', 'printer_categories.json')) {
        $file = Join-Path $resources $name
        if ($name -eq 'printer_categories.json' -and -not (Test-Path -LiteralPath $file)) {
            [IO.File]::WriteAllText($file, '{}', (New-Object Text.UTF8Encoding($false)))
        }
        if (-not (Test-Path -LiteralPath $file)) { continue }
        Assert-NoReparsePoint $file
        $acl = Get-Acl -LiteralPath $file
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($users, 'Modify', 'Allow')
        $acl.SetAccessRule($rule)
        Set-Acl -LiteralPath $file -AclObject $acl
    }
    # The app writes dated business-information backups at this existing location.
    $directory = Join-Path $resources 'business-info-backups'
    Assert-NoReparsePoint $directory
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $acl = Get-Acl -LiteralPath $directory
    $rule = New-Object Security.AccessControl.FileSystemAccessRule(
        $users, 'Modify', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
    $acl.SetAccessRule($rule)
    Set-Acl -LiteralPath $directory -AclObject $acl
}

# These ACLs deliberately exclude BUILTIN\Users. Ordinary desktop users use
# the HTTP API; they do not read the PHP configuration, passwords, or DB files.
function Set-PrivateAcl {
    param([string]$Path, [switch]$Directory, [string]$ReadIdentity = '',
        [string[]]$ReadIdentities = @(), [string[]]$ModifyIdentities = @())
    Assert-NoReparsePoint $Path
    if ($Directory) {
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    } else {
        $acl = New-Object Security.AccessControl.FileSecurity
        $inheritance = [Security.AccessControl.InheritanceFlags]::None
    }
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
    foreach ($sidText in @('S-1-5-18', 'S-1-5-32-544')) {
        $sid = New-Object Security.Principal.SecurityIdentifier($sidText)
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
            $sid, 'FullControl', $inheritance, 'None', 'Allow')))
    }
    if ($ReadIdentity) { $ReadIdentities += $ReadIdentity }
    foreach ($identity in @($ReadIdentities + $ModifyIdentities | Select-Object -Unique)) {
        $sid = (New-Object Security.Principal.NTAccount($identity)).Translate([Security.Principal.SecurityIdentifier])
        $rights = if ($ModifyIdentities -contains $identity) { 'Modify' } else { 'ReadAndExecute' }
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
            $sid, $rights, $inheritance, 'None', 'Allow')))
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Write-Utf8File([string]$Path, [string]$Contents) {
    Assert-NoReparsePoint $Path
    [IO.File]::WriteAllText($Path, $Contents, (New-Object Text.UTF8Encoding($false)))
}

function Get-StandaloneHttpPort($State = $null) {
    if ($null -eq $State) { return 8080 }
    $property = $State.PSObject.Properties['httpPort']
    if ($null -eq $property -or ($property.Value -isnot [int] -and $property.Value -isnot [long]) -or
        $property.Value -notin @(80, 8080)) {
        throw 'The standalone runtime marker has an unsupported HTTP port. Its server configuration and databases were preserved.'
    }
    return [int]$property.Value
}

function Assert-StandaloneDesktopDestination([string]$Root, [switch]$RequireEmpty) {
    Assert-NoReparsePoint $Root -Recurse
    if (-not (Test-Path -LiteralPath $Root)) { return }
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { throw 'Choose an empty folder for Lightem POS Standalone; the selected destination is a file.' }
    if (@(Get-ChildItem -LiteralPath $Root -Force).Count -eq 0) { return }
    if ($RequireEmpty) { throw 'Choose an empty folder when changing the standalone installation destination; another existing application folder was not backed up.' }
    $releasePath = Join-Path $Root 'resources\system-release.json'
    if (-not (Test-Path -LiteralPath $releasePath -PathType Leaf)) {
        throw 'This folder contains an existing application or other files. Choose an empty folder for Lightem POS Standalone; the existing XAMPP application will not be replaced.'
    }
    $release = Get-Content -LiteralPath $releasePath -Raw | ConvertFrom-Json
    if ($null -eq $release.PSObject.Properties['runtimeKind'] -or $release.runtimeKind -ne 'standalone' -or
        $null -eq $release.PSObject.Properties['platform'] -or $release.platform -ne 'win32') {
        throw 'This folder belongs to another application. Choose an empty folder for Lightem POS Standalone or its existing standalone installation folder.'
    }
}

function Get-DesktopEndpointConfiguration([string]$Contents, [ValidateSet(80, 8080)][int]$Port) {
    $origin = if ($Port -eq 80) { 'http://localhost' } else { "http://localhost:$Port" }
    $matches = [regex]::Matches($Contents, '(?im)^[ \t]*LOCAL[ \t]*:[ \t]*([^\r\n]*)')
    if ($matches.Count -gt 1) { throw 'The desktop server configuration contains multiple LOCAL entries. Keep one LOCAL entry before updating.' }
    if ($matches.Count -eq 1) {
        $value = $matches[0].Groups[1].Value.Trim()
    } elseif ($Contents -match '(?im)^[ \t]*(WEB|TENANT)[ \t]*:') { $value = '' }
    else { $value = $Contents.Trim() }
    if ($value) {
        $uri = $null
        $parsed = [Uri]::TryCreate($value, [UriKind]::Absolute, [ref]$uri)
        if ($parsed -and ($uri.Scheme -ne 'http' -or $uri.Host -notin @('localhost', '127.0.0.1', '[::1]', '::1') -or
            $uri.Port -notin @(80, 8080) -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment -or $uri.UserInfo)) {
            return $Contents # Keep intentional remote or customized API endpoints.
        }
        if (-not $parsed -and $matches.Count -eq 1) { return $Contents }
        if (-not $parsed -and $matches.Count -eq 0 -and $Contents -notmatch '(?im)^[ \t]*(WEB|TENANT)[ \t]*:') { return $Contents }
    }
    if ($matches.Count -eq 1) {
        $match = $matches[0]
        return $Contents.Substring(0, $match.Index) + "LOCAL: $origin" + $Contents.Substring($match.Index + $match.Length)
    }
    if ($value -and $parsed) { return "LOCAL: $origin`nWEB: `nTENANT: `n" }
    return "LOCAL: $origin`n" + $Contents
}

function Set-DesktopLocalEndpoint {
    $path = Join-Path $AppRoot 'resources\ip.txt'
    Assert-NoReparsePoint $path
    $contents = if (Test-Path -LiteralPath $path -PathType Leaf) { [IO.File]::ReadAllText($path) } else { "WEB: `nTENANT: `n" }
    $updated = Get-DesktopEndpointConfiguration $contents $httpPort
    if ($updated -cne $contents -or -not (Test-Path -LiteralPath $path)) { Write-Utf8File $path $updated }
}

function Complete-DesktopSettings {
    $resources = Join-Path $AppRoot 'resources'
    $defaults = Join-Path $resources 'images'
    foreach ($root in @($resources, $defaults)) {
        Assert-NoReparsePoint $root
        foreach ($name in @('ip.txt', 'printer.txt', 'businessInfo.json', 'pos-config.json', 'printer_categories.json')) {
            Assert-NoReparsePoint (Join-Path $root $name)
        }
    }
    # The images copies are pristine packaged defaults. Restore saved values
    # first, then fill earlier blank defaults without resetting custom settings.
    Invoke-BundledPhp (Join-Path $PayloadRoot 'runtime') '' @('-n', (Join-Path $PayloadRoot 'desktop-settings.php'),
        '--resources', $resources, '--defaults', $defaults) 'Completing desktop tenant, business, and printer settings' | Out-Null
}

function Assert-StandaloneServersStopped {
    if (@(Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq $httpPort -or $_.LocalPort -eq $databasePort }).Count -gt 0) {
        throw 'A standalone server is still running. Backend recovery was left in its protected backup rather than replacing active files.'
    }
}

function Assert-BackendComplete([string]$Root) {
    foreach ($relative in @('api\bootstrap.php', 'api\login.php', 'api\pos_lan_health.php',
        'api\read_transaction_records.php', 'api\config.php', 'src\Database.php',
        'src\JWTCodec.php', 'src\UserGateway.php', 'vendor\autoload.php', '.env')) {
        if (-not (Test-Path -LiteralPath (Join-Path $Root $relative) -PathType Leaf)) {
            throw "The existing Lightem backend is incomplete: $relative. Restore its protected settings/backup before migrating; existing databases were preserved."
        }
    }
    Assert-NoReparsePoint $Root -Recurse
}

function Get-InstallationKind {
    param([string]$StatePath, [string]$BackendRoot, [string]$DatabaseRoot, [string]$LegacyBackendRoot)
    # XAMPP is a separate installation. Its files, PHP extensions and services
    # cannot determine whether this private destination is safe to initialize.
    foreach ($path in @($StatePath, $BackendRoot, $DatabaseRoot)) { Assert-NoReparsePoint $path }
    if (Test-Path -LiteralPath $StatePath -PathType Leaf) {
        $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
        if ($state.installerId -ne $installerId -or $state.runtimeKind -ne 'standalone' -or $state.formatVersion -ne 1 -or
            $state.status -notin @('initializing', 'ready') -or $state.databasePort -ne 3307 -or
            [string]$state.buildId -notmatch '^\d{1,20}$') {
            throw 'The standalone runtime marker is unrecognized. Its files and databases will not be replaced.'
        }
        Get-StandaloneHttpPort $state | Out-Null
        return 'Standalone'
    }
    foreach ($path in @($BackendRoot, $DatabaseRoot)) {
        if ((Test-Path -LiteralPath $path) -and @(Get-ChildItem -LiteralPath $path -Force).Count -gt 0) {
            throw "Existing files without a standalone ownership marker were found at $path. Setup will not initialize or overwrite them."
        }
    }
    return 'Fresh'
}

function Get-XamppCopyMode([string]$Kind, $State, [bool]$Requested) {
    if ($Kind -eq 'Fresh') { return $Requested }
    if ($Kind -ne 'Standalone' -or $null -eq $State) { throw 'Cannot determine the existing standalone installation mode.' }
    if ($State.status -eq 'ready') { return $false }
    if ($State.status -ne 'initializing' -or $null -eq $State.PSObject.Properties['sourceKind'] -or
        $State.sourceKind -notin @('fresh', 'legacy', 'xampp-copy')) {
        throw 'The interrupted standalone installation has an unknown source. Its data and credentials were preserved.'
    }
    # Keep the original data choice, but require explicit permission on this
    # attempt before reading XAMPP. Never reinterpret a partial copy as empty.
    $copyInProgress = $State.sourceKind -in @('legacy', 'xampp-copy')
    if ($copyInProgress -and -not $Requested) {
        throw 'An earlier XAMPP import is unfinished. Select Copy data from XAMPP and run setup again to resume it. Existing standalone data and credentials were preserved; XAMPP was not checked or changed.'
    }
    return $copyInProgress
}

function Assert-XamppDatabaseRunning {
    $expectedMysql = Join-Path $xamppRoot 'mysql\bin\mysqld.exe'
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq 3306 })
    if ($listeners.Count -eq 0) {
        throw 'Copying the XAMPP store requires its MySQL database to be running on port 3306. Start MySQL in the XAMPP Control Panel, pause sales while copying, and run setup again. Setup does not start or change XAMPP services.'
    }
    Assert-ListenerOwners 3306 @($expectedMysql)
}

function Get-XamppSourceCheckArguments([string]$VerifierPath, [string]$SourceRoot) {
    # Parse settings without opening a database connection. Paths are argv
    # values, never PHP source interpolation; no credentials are printed.
    $code = @'
require $argv[1];
try {
    [, $settings] = lightemSettings(lightemRoot($argv[2]));
    if (!in_array((string)$settings['host'], ['localhost', '127.0.0.1'], true) || lightemDatabasePort($settings['port'] ?? 3306) !== 3306) {
        throw new LightemSetupException('The XAMPP copy source must use localhost or 127.0.0.1 on port 3306. A remote host or custom database port requires a separately reviewed copy; setup has not connected to that database.');
    }
    echo "XAMPP source uses the verified local database port.\n";
} catch (Throwable $error) { lightemFail($error); }
'@
    return @('-r', $code, $VerifierPath, $SourceRoot)
}

function Test-XamppSourceConfiguration([string]$Runtime, [string]$Ini) {
    $arguments = @(Get-XamppSourceCheckArguments (Join-Path $PayloadRoot 'verify.php') $xamppWebRoot)
    Invoke-BundledPhp $Runtime $Ini $arguments 'Checking the XAMPP source host and database port before connecting' | Out-Null
}

function Test-XamppCopySource($Manifest, $RuntimeManifest) {
    Assert-BackendComplete $xamppWebRoot
    Assert-XamppDatabaseRunning
    $payloadRuntime = Join-Path $PayloadRoot 'runtime'
    # Never execute XAMPP PHP. Verify the incoming pinned runtime inventory
    # before its first execution, including during NSIS preflight.
    Assert-RuntimeFiles $payloadRuntime $RuntimeManifest
    Invoke-BundledPhp $payloadRuntime '' @('-n', (Join-Path $PayloadRoot 'verify-runtime.php'), '--root', $payloadRuntime,
        '--platform', 'win32', '--sha256', [string]$Manifest.runtimeSha256) 'Verifying the bundled preflight runtime' | Out-Null
    $preflightState = Join-Path $PayloadRoot 'preflight-state'
    foreach ($relative in @('', 'logs\apache', 'temp', 'sessions')) {
        $directory = if ($relative) { Join-Path $preflightState $relative } else { $preflightState }
        Assert-NoReparsePoint $directory
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        Set-PrivateAcl $directory -Directory
    }
    $preflightIni = Join-Path $preflightState 'php.ini'
    $configuration = Get-RuntimeConfigurations $payloadRuntime $preflightState $false $httpPort
    Write-Utf8File $preflightIni $configuration.Php
    Set-PrivateAcl $preflightIni
    try {
        Test-XamppSourceConfiguration $payloadRuntime $preflightIni
        Invoke-BundledPhp $payloadRuntime $preflightIni @((Join-Path $PayloadRoot 'verify.php'), '--root', $xamppWebRoot,
            '--payload', $PayloadRoot, '--before-update') 'Checking the XAMPP store using the bundled PHP runtime' | Out-Null
    } finally { Remove-Item -LiteralPath $preflightIni -Force -ErrorAction SilentlyContinue }
}

function Copy-XamppMedia {
    foreach ($relative in $mediaDirectories) {
        $source = Join-Path $xamppWebRoot $relative
        $destination = Join-Path $documentRoot $relative
        if (Test-Path -LiteralPath $source) {
            Assert-NoReparsePoint $source -Recurse
            Assert-NoReparsePoint $destination -Recurse
            New-Item -ItemType Directory -Path $destination -Force | Out-Null
            foreach ($item in Get-ChildItem -LiteralPath $source -Force) { Copy-Item -LiteralPath $item.FullName -Destination $destination -Recurse -Force }
        }
    }
}

function Assert-Manifest($Manifest, $RuntimeManifest) {
    if ($Manifest.runtimeKind -ne 'standalone' -or $Manifest.phpVersion -ne '8.2.4' -or
        $Manifest.backendSha256 -notmatch '^[0-9a-fA-F]{64}$' -or -not $Manifest.version -or
        [string]$Manifest.buildId -notmatch '^\d{1,20}$' -or
        $Manifest.phpMyAdminVersion -ne '5.2.3' -or $Manifest.phpMyAdminSha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Unsupported standalone installer manifest.' }
    if ($RuntimeManifest.schemaVersion -ne 1 -or $RuntimeManifest.platform -ne 'win32' -or
        $RuntimeManifest.arch -ne 'x64' -or -not $RuntimeManifest.files -or
        $RuntimeManifest.versions.php -ne $Manifest.phpVersion -or $RuntimeManifest.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or
        $Manifest.runtimeSha256 -ne $RuntimeManifest.sha256) {
        throw 'Unsupported standalone runtime manifest.'
    }
}

function Assert-RuntimeFiles([string]$Root, $RuntimeManifest) {
    Assert-NoReparsePoint $Root -Recurse
    foreach ($property in $RuntimeManifest.files.PSObject.Properties) {
        $relative = [string]$property.Name
        $entry = $property.Value
        if ($relative -match '[\\:\x00-\x1f]' -or $relative -match '(^|/)\.\.?(/|$)' -or
            [IO.Path]::IsPathRooted($relative) -or $entry.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
            throw 'The runtime file manifest contains an unsafe path or checksum.'
        }
        $file = Join-Path $Root $relative
        if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or
            (Get-Item -LiteralPath $file).Length -ne $entry.size -or
            (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.sha256) {
            throw "Standalone runtime file is missing or changed: $relative"
        }
    }
    $prefix = [IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
    foreach ($file in Get-ChildItem -LiteralPath $Root -Recurse -Force -File) {
        $relative = $file.FullName.Substring($prefix.Length).Replace('\', '/')
        if ($relative -ne 'runtime-manifest.json' -and -not $RuntimeManifest.files.PSObject.Properties[$relative]) {
            throw "The runtime contains an unlisted file: $relative"
        }
    }
    foreach ($relative in @('apache\bin\httpd.exe', 'php\php.exe', 'php\php8apache2_4.dll',
        'mysql\bin\mysqld.exe', 'mysql\bin\mysql_install_db.exe', 'mysql\bin\mysqldump.exe', 'mysql\bin\mysql.exe')) {
        if (-not (Test-Path -LiteralPath (Join-Path $Root $relative) -PathType Leaf)) { throw "Incomplete standalone runtime: $relative" }
    }
}

function Split-ServiceCommandLine([string]$CommandLine) {
    # Parse Windows double-quote/backslash argument rules without invoking a
    # shell. In particular, a config filename must be a complete argument,
    # never merely a substring of another filename or command-line option.
    $arguments = New-Object System.Collections.Generic.List[string]
    $position = 0
    while ($position -lt $CommandLine.Length) {
        while ($position -lt $CommandLine.Length -and [char]::IsWhiteSpace($CommandLine[$position])) { $position++ }
        if ($position -ge $CommandLine.Length) { break }
        $value = New-Object Text.StringBuilder
        $quoted = $false
        while ($position -lt $CommandLine.Length) {
            $character = $CommandLine[$position]
            if (-not $quoted -and [char]::IsWhiteSpace($character)) { break }
            if ($character -eq '\') {
                $slashes = 0
                while ($position -lt $CommandLine.Length -and $CommandLine[$position] -eq '\') { $slashes++; $position++ }
                if ($position -lt $CommandLine.Length -and $CommandLine[$position] -eq '"') {
                    [void]$value.Append(('\' * [int][Math]::Floor($slashes / 2)))
                    if ($slashes % 2) { [void]$value.Append('"'); $position++; continue }
                } else { [void]$value.Append(('\' * $slashes)); continue }
                $character = '"'
            }
            if ($character -eq '"') {
                if ($quoted -and $position + 1 -lt $CommandLine.Length -and $CommandLine[$position + 1] -eq '"') {
                    [void]$value.Append('"'); $position += 2; continue
                }
                $quoted = -not $quoted
            } else { [void]$value.Append($character) }
            $position++
        }
        if ($quoted) { throw 'Cannot safely parse an existing service command with unmatched quotes.' }
        $arguments.Add($value.ToString())
    }
    return $arguments.ToArray()
}

function Test-ServiceConfigArgument([string[]]$Arguments, [string]$ExpectedConfig) {
    $configurations = New-Object System.Collections.Generic.List[string]
    for ($index = 1; $index -lt $Arguments.Count; $index++) {
        $argument = $Arguments[$index]
        if ($argument.StartsWith('--defaults-file=', [StringComparison]::OrdinalIgnoreCase)) {
            $configurations.Add($argument.Substring('--defaults-file='.Length))
        } elseif ($argument -eq '-f' -or $argument -eq '--defaults-file') {
            $index++
            if ($index -ge $Arguments.Count) { return $false }
            $configurations.Add($Arguments[$index])
        } elseif ($argument.StartsWith('-f', [StringComparison]::Ordinal)) {
            $configurations.Add($argument.Substring(2))
        } elseif ($argument.StartsWith('--defaults-extra-file', [StringComparison]::OrdinalIgnoreCase) -or $argument -eq '--no-defaults') {
            return $false
        }
    }
    return $configurations.Count -eq 1 -and $configurations[0].Equals($ExpectedConfig, [StringComparison]::OrdinalIgnoreCase)
}

function Test-PendingServiceCommand([string]$Name, [string[]]$Arguments, [string]$ExpectedConfig) {
    if ($Name -eq 'LightemDatabase') {
        return $Arguments.Count -eq 3 -and
            $Arguments[1].Equals(('--defaults-file=' + $ExpectedConfig), [StringComparison]::OrdinalIgnoreCase) -and
            $Arguments[2].Equals($Name, [StringComparison]::OrdinalIgnoreCase)
    }
    if ($Name -eq 'LightemApache') {
        return $Arguments.Count -eq 7 -and $Arguments[1] -eq '-k' -and $Arguments[2] -eq 'runservice' -and
            $Arguments[3] -eq '-n' -and $Arguments[4].Equals($Name, [StringComparison]::OrdinalIgnoreCase) -and
            $Arguments[5] -eq '-f' -and $Arguments[6].Equals($ExpectedConfig, [StringComparison]::OrdinalIgnoreCase)
    }
    return $false
}

function Test-NativeApacheServiceCommand([string]$Name, [string[]]$Arguments) {
    return $Name -eq 'LightemApache' -and $Arguments.Count -eq 3 -and
        $Arguments[1] -ceq '-k' -and $Arguments[2] -ceq 'runservice'
}

function Get-ApacheServiceRegistryKey {
    return Get-Item -LiteralPath 'Registry::HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\LightemApache\Parameters' -ErrorAction Stop
}

function Get-ApacheServiceConfigArgs {
    $key = Get-ApacheServiceRegistryKey
    try {
        if ($key.GetValueKind('ConfigArgs') -ne [Microsoft.Win32.RegistryValueKind]::MultiString) {
            throw 'The private Apache service ConfigArgs registry value is not REG_MULTI_SZ.'
        }
        $value = $key.GetValue('ConfigArgs', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        if ($value -isnot [string[]] -or $value.Count -ne 2 -or $value[0] -cne '-f' -or -not $value[1]) {
            throw 'The private Apache service registry contains unexpected configuration arguments.'
        }
        return $value
    } finally { if ($key) { $key.Close() } }
}

function Assert-ApacheServiceConfigEvidence([string[]]$ExpectedArguments) {
    $actual = @(Get-ApacheServiceConfigArgs)
    if ($ExpectedArguments.Count -ne 2 -or $actual.Count -ne 2 -or
        $actual[0] -cne $ExpectedArguments[0] -or $actual[1] -cne $ExpectedArguments[1]) {
        throw 'The private Apache service registry configuration changed after preflight; setup preserved the service.'
    }
}

function Get-OwnedService([string]$Name, [string]$ExpectedPath, [string]$ExpectedIdentity, [string]$ExpectedConfig,
    [switch]$AllowPendingRegistration) {
    $service = Get-RuntimeService $Name
    if (-not $service) { return $null }
    $arguments = @(Split-ServiceCommandLine $service.PathName)
    if ($arguments.Count -eq 0) { throw "Windows service $Name has an empty executable command." }
    $path = [IO.Path]::GetFullPath($arguments[0])
    $privateIdentity = $service.StartName.Equals($ExpectedIdentity, [StringComparison]::OrdinalIgnoreCase)
    # The caller may enable this only after validating the protected pending
    # marker, matching pinned runtime and protected write ACLs. Preflight only
    # records the exception; it never changes a Windows service.
    $pending = $AllowPendingRegistration -and $service.State -eq 'Stopped' -and
        $service.StartName.Equals('LocalSystem', [StringComparison]::OrdinalIgnoreCase) -and
        (Test-PendingServiceCommand $Name $arguments $ExpectedConfig)
    $configMatches = Test-ServiceConfigArgument $arguments $ExpectedConfig
    $nativeApacheArguments = $null
    if ($AllowPendingRegistration -and $service.State -eq 'Stopped' -and
        ($privateIdentity -or $service.StartName.Equals('LocalSystem', [StringComparison]::OrdinalIgnoreCase)) -and
        $path.Equals($ExpectedPath, [StringComparison]::OrdinalIgnoreCase) -and
        (Test-NativeApacheServiceCommand $Name $arguments)) {
        # Apache's native installer puts only "httpd.exe -k runservice" in
        # ImagePath. Its -f argument is a separate REG_MULTI_SZ ConfigArgs.
        $nativeApacheArguments = @(Get-ApacheServiceConfigArgs)
        $configMatches = $nativeApacheArguments[1].Equals($ExpectedConfig, [StringComparison]::OrdinalIgnoreCase)
        $pending = $configMatches
    }
    if (-not $path.Equals($ExpectedPath, [StringComparison]::OrdinalIgnoreCase) -or
        -not ($privateIdentity -or $pending) -or -not $configMatches) {
        throw "Windows service $Name is not owned by this Lightem installation; setup will not change it. Executable: $path. Account: $($service.StartName). Expected configuration matches: $configMatches."
    }
    if (-not $serviceSnapshots.ContainsKey($Name)) {
        $serviceSnapshots[$Name] = @{ State = $service.State; StartMode = $service.StartMode; PathName = $service.PathName;
            StartName = $service.StartName; PendingRegistration = [bool]$pending; IdentityChanged = $false }
        if ($nativeApacheArguments) { $serviceSnapshots[$Name].NativeApacheConfigArgs = $nativeApacheArguments }
    }
    return $service
}

function Assert-ServiceRegistrationSnapshot([string]$Name, $Service) {
    if (-not $Service -or -not $serviceSnapshots.ContainsKey($Name)) {
        throw "Windows service $Name appeared or disappeared after preflight; setup will not change it."
    }
    $snapshot = $serviceSnapshots[$Name]
    if (-not ([string]$Service.PathName).Equals([string]$snapshot.PathName, [StringComparison]::Ordinal) -or
        -not ([string]$Service.StartName).Equals([string]$snapshot.StartName, [StringComparison]::OrdinalIgnoreCase) -or
        $Service.State -ne 'Stopped') {
        throw "Windows service $Name changed after preflight; setup will not change it."
    }
    if ($snapshot.ContainsKey('NativeApacheConfigArgs')) { Assert-ApacheServiceConfigEvidence $snapshot.NativeApacheConfigArgs }
}

function Test-ServiceRecoveryOwnership([string]$Name) {
    # Recovery must not undo the safety decision that rejected a service which
    # changed after preflight. Accept only the original identity/command or
    # changes explicitly recorded by this installer before calling the SCM.
    try {
        if ($Name -eq $databaseService) {
            $expectedPath = $mysqlPath; $expectedConfig = $databaseConfig; $expectedIdentity = $databaseIdentity
        } elseif ($Name -eq $apacheService) {
            $expectedPath = $apachePath; $expectedConfig = $apacheConfig; $expectedIdentity = $apacheIdentity
        } else { return $false }
        $service = Get-RuntimeService $Name
        if (-not $service) { return $false }
        if ($serviceSnapshots.ContainsKey($Name)) {
            $snapshot = $serviceSnapshots[$Name]
            if ($snapshot.ContainsKey('NativeApacheConfigArgs')) { Assert-ApacheServiceConfigEvidence $snapshot.NativeApacheConfigArgs }
            $knownCommand = ([string]$service.PathName).Equals([string]$snapshot.PathName, [StringComparison]::Ordinal)
            if (-not $knownCommand -and $snapshot.ContainsKey('TargetPathName')) {
                $knownCommand = ([string]$service.PathName).Equals([string]$snapshot.TargetPathName, [StringComparison]::Ordinal)
            }
            $knownAccount = ([string]$service.StartName).Equals([string]$snapshot.StartName, [StringComparison]::OrdinalIgnoreCase)
            if (-not $knownAccount -and $snapshot.IdentityChanged) {
                $knownAccount = ([string]$service.StartName).Equals($expectedIdentity, [StringComparison]::OrdinalIgnoreCase)
            }
            return $knownCommand -and $knownAccount
        }
        if (-not $createdServices.Contains($Name)) { return $false }
        $arguments = @(Split-ServiceCommandLine $service.PathName)
        $nativeApache = Test-NativeApacheServiceCommand $Name $arguments
        if ($arguments.Count -eq 0 -or (-not $nativeApache -and -not (Test-PendingServiceCommand $Name $arguments $expectedConfig))) { return $false }
        $path = [IO.Path]::GetFullPath($arguments[0])
        if ($Name -eq $apacheService) { Assert-ApacheServiceConfigEvidence @('-f', $expectedConfig) }
        return $path.Equals($expectedPath, [StringComparison]::OrdinalIgnoreCase) -and
            ($nativeApache -or (Test-ServiceConfigArgument $arguments $expectedConfig)) -and
            (([string]$service.StartName).Equals($expectedIdentity, [StringComparison]::OrdinalIgnoreCase) -or
                ([string]$service.StartName).Equals('LocalSystem', [StringComparison]::OrdinalIgnoreCase))
    } catch {
        # An unavailable service inventory or malformed command cannot confer
        # permission to stop, reconfigure or restart a service during rollback.
        return $false
    }
}

function Assert-ListenerOwners([int]$Port, [string[]]$AllowedPaths) {
    foreach ($listener in @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port })) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if (-not $process -or -not $process.ExecutablePath -or
            -not @($AllowedPaths | Where-Object { $_.Equals($process.ExecutablePath, [StringComparison]::OrdinalIgnoreCase) }).Count) {
            throw "Port $Port belongs to another program (PID $($listener.OwningProcess)); setup will not stop or replace it."
        }
        if ($Port -eq $databasePort -and $listener.LocalAddress -ne '127.0.0.1') {
            throw 'The private Lightem database is listening outside loopback; installation stopped.'
        }
    }
}

function Stop-OwnedService([string]$Name) {
    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($service -and $Name -in @($apacheService, $databaseService) -and -not (Test-ServiceRecoveryOwnership $Name)) {
        throw "Windows service $Name changed since setup checked it; the service was preserved."
    }
    if ($service -and $service.Status -ne 'Stopped') {
        Stop-Service -Name $Name -ErrorAction Stop
        $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
    }
}

function Wait-PortClosed([int]$Port) {
    $deadline = (Get-Date).AddSeconds(45)
    while (@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port }).Count -gt 0) {
        if ((Get-Date) -ge $deadline) { throw "Port $Port did not close after shutdown. No further files will be replaced." }
        Start-Sleep -Milliseconds 300
    }
}

function Wait-ExecutableStopped([string]$Path) {
    $deadline = (Get-Date).AddSeconds(45)
    while (@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.Equals($Path, [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0) {
        if ((Get-Date) -ge $deadline) { throw "Server workers did not finish stopping: $Path. No process was forcibly killed." }
        Start-Sleep -Milliseconds 300
    }
}

function Start-OwnedService([string]$Name, [int]$Port, [string]$ExpectedPath) {
    if ($Name -in @($apacheService, $databaseService) -and -not (Test-ServiceRecoveryOwnership $Name)) {
        throw "Windows service $Name no longer matches setup's ownership record; it was not started."
    }
    Start-Service -Name $Name
    (Get-Service -Name $Name).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
    $deadline = (Get-Date).AddSeconds(60)
    do {
        Assert-ListenerOwners $Port @($ExpectedPath)
        if (@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port }).Count -gt 0) { return }
        if ((Get-Date) -ge $deadline) { throw "$Name did not open its expected port $Port." }
        Start-Sleep -Milliseconds 300
    } while ($true)
}

function Invoke-BundledPhp([string]$Runtime, [string]$Ini, [string[]]$Arguments, [string]$Label, [int]$TimeoutSeconds = 180) {
    $previousPath = $env:PATH
    $previousScanDirectory = $env:PHP_INI_SCAN_DIR
    try {
        $env:PATH = (Join-Path $Runtime 'php') + ';' + (Join-Path $Runtime 'apache\bin') + ';' + $previousPath
        $env:PHP_INI_SCAN_DIR = ''
        $configurationArguments = if ($Ini) { @('-c', $Ini) } else { @() }
        return Invoke-CheckedProcess (Join-Path $Runtime 'php\php.exe') ($configurationArguments + $Arguments) $Label $TimeoutSeconds
    } finally {
        $env:PATH = $previousPath
        $env:PHP_INI_SCAN_DIR = $previousScanDirectory
    }
}

function Invoke-LightemPhp([string[]]$Arguments, [string]$Label, [int]$TimeoutSeconds = 180) {
    return Invoke-BundledPhp $runtimeRoot $phpIniPath $Arguments $Label $TimeoutSeconds
}

function Set-VirtualServiceIdentity([string]$Name, [string]$Label) {
    if ($Name -notin @('LightemDatabase', 'LightemApache')) { throw 'Unexpected private service account name.' }
    $identity = 'NT SERVICE\' + $Name
    $sc = Join-Path $env:SystemRoot 'System32\sc.exe'
    # ChangeServiceConfigW requires a NULL password for virtual accounts.
    # Omitting password= preserves NULL; an explicit empty string is invalid.
    # https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-changeserviceconfigw
    Invoke-CheckedProcess $sc @('config', $Name, 'obj=', $identity) $Label | Out-Null
}

function Initialize-ServiceRegistration {
    $sc = Join-Path $env:SystemRoot 'System32\sc.exe'
    # Recheck both services before making the first change. Any recognized
    # pending LocalSystem registration must still match its preflight snapshot.
    foreach ($name in @($databaseService, $apacheService)) {
        $service = Get-RuntimeService $name
        if ($service -or $serviceSnapshots.ContainsKey($name)) { Assert-ServiceRegistrationSnapshot $name $service }
    }
    $service = Get-RuntimeService $databaseService
    if ($service) { Assert-ServiceRegistrationSnapshot $databaseService $service }
    if (-not $service) {
        Invoke-CheckedProcess $mysqlPath @('--install-manual', $databaseService, "--defaults-file=$databaseConfig") 'Registering private database service' | Out-Null
        $createdServices.Add($databaseService)
        Set-VirtualServiceIdentity $databaseService 'Isolating database service account'
    } elseif ($serviceSnapshots[$databaseService].PendingRegistration -and
        -not $service.StartName.Equals($databaseIdentity, [StringComparison]::OrdinalIgnoreCase)) {
        $serviceSnapshots[$databaseService].IdentityChanged = $true
        Set-VirtualServiceIdentity $databaseService 'Finishing private database service registration'
    }
    $service = Get-RuntimeService $apacheService
    if ($service) { Assert-ServiceRegistrationSnapshot $apacheService $service }
    if (-not $service) {
        Invoke-CheckedProcess $apachePath @('-k', 'install', '-n', $apacheService, '-f', $apacheConfig) 'Registering Lightem web service' | Out-Null
        $createdServices.Add($apacheService)
        Set-VirtualServiceIdentity $apacheService 'Isolating web service account'
    } elseif ($serviceSnapshots[$apacheService].PendingRegistration -and
        -not $service.StartName.Equals($apacheIdentity, [StringComparison]::OrdinalIgnoreCase)) {
        $serviceSnapshots[$apacheService].IdentityChanged = $true
        Set-VirtualServiceIdentity $apacheService 'Finishing private web service registration'
    }
    foreach ($entry in @(@($databaseService, $databaseIdentity), @($apacheService, $apacheIdentity))) {
        $service = Get-RuntimeService $entry[0]
        if (-not $service -or $service.State -ne 'Stopped' -or
            -not $service.StartName.Equals($entry[1], [StringComparison]::OrdinalIgnoreCase)) {
            throw "Windows service $($entry[0]) did not acquire its private service account; setup stopped before starting it."
        }
    }
    if (-not (Test-ServiceRecoveryOwnership $apacheService)) {
        throw 'The private Apache service command or registry configuration changed during registration; setup preserved it.'
    }
    $databaseCommand = (ConvertTo-ProcessArgument $mysqlPath) + ' ' + (ConvertTo-ProcessArgument "--defaults-file=$databaseConfig") + ' ' + $databaseService
    $apacheCommand = (ConvertTo-ProcessArgument $apachePath) + ' -k runservice -n ' + $apacheService + ' -f ' + (ConvertTo-ProcessArgument $apacheConfig)
    if ($serviceSnapshots.ContainsKey($databaseService)) { $serviceSnapshots[$databaseService].TargetPathName = $databaseCommand }
    Invoke-CheckedProcess $sc @('config', $databaseService, 'binPath=', $databaseCommand) 'Selecting private database runtime' | Out-Null
    if ($serviceSnapshots.ContainsKey($apacheService)) { $serviceSnapshots[$apacheService].TargetPathName = $apacheCommand }
    Invoke-CheckedProcess $sc @('config', $apacheService, 'binPath=', $apacheCommand) 'Selecting private API runtime' | Out-Null
    foreach ($name in @($databaseService, $apacheService)) {
        Invoke-CheckedProcess $sc @('sidtype', $name, 'unrestricted') "Enabling isolated $name identity" | Out-Null
        Set-Service -Name $name -StartupType Manual
    }
}

function Set-ServiceFilePermissions {
    # Register virtual service accounts first so Windows can resolve their SIDs.
    Set-PrivateAcl $lightemRoot -Directory -ReadIdentities @($apacheIdentity, $databaseIdentity)
    Set-PrivateAcl (Join-Path $lightemRoot 'runtime') -Directory -ReadIdentities @($apacheIdentity, $databaseIdentity)
    Set-PrivateAcl $runtimeRoot -Directory -ReadIdentities @($apacheIdentity, $databaseIdentity)
    Set-PrivateAcl $configRoot -Directory -ReadIdentities @($apacheIdentity, $databaseIdentity)
    Set-PrivateAcl $documentRoot -Directory -ReadIdentity $apacheIdentity
    Set-PrivateAcl $dataRoot -Directory -ModifyIdentities @($databaseIdentity)
    Set-PrivateAcl $secretRoot -Directory
    if (Test-Path -LiteralPath $databaseManagerSecret) { Set-PrivateAcl $databaseManagerSecret }
    if (Test-Path -LiteralPath $databaseManagerRoot) {
        Set-PrivateAcl $databaseManagerRoot -Directory -ReadIdentity $apacheIdentity
        $managerConfiguration = Join-Path $databaseManagerRoot 'config.inc.php'
        if (Test-Path -LiteralPath $managerConfiguration) { Set-PrivateAcl $managerConfiguration -ReadIdentity $apacheIdentity }
    }
    Set-PrivateAcl $stateRoot -Directory
    $serverLogs = Join-Path $lightemRoot 'logs'
    New-Item -ItemType Directory -Path $serverLogs -Force | Out-Null
    Set-PrivateAcl $serverLogs -Directory -ReadIdentities @($apacheIdentity, $databaseIdentity)
    foreach ($name in @('apache', 'mysql')) {
        $identity = if ($name -eq 'apache') { $apacheIdentity } else { $databaseIdentity }
        $directory = Join-Path $serverLogs $name
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        Set-PrivateAcl $directory -Directory -ModifyIdentities @($identity)
    }
    foreach ($relative in @('temp', 'sessions', 'run', 'database-backups', 'phpmyadmin-temp')) {
        $directory = Join-Path $lightemRoot $relative
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        Set-PrivateAcl $directory -Directory -ModifyIdentities @($apacheIdentity)
    }
    foreach ($relative in $mediaDirectories) {
        $directory = Join-Path $documentRoot $relative
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        Set-PrivateAcl $directory -Directory -ModifyIdentities @($apacheIdentity)
    }
    foreach ($relative in @('.env', 'api\config.php')) {
        $file = Join-Path $documentRoot $relative
        if (Test-Path -LiteralPath $file) { Set-PrivateAcl $file -ReadIdentity $apacheIdentity }
    }
    if (Test-Path -LiteralPath $initSqlPath) {
        # The database account can traverse this folder but cannot read the
        # separate root password. Remove this exception after initialization.
        Set-PrivateAcl $secretRoot -Directory -ReadIdentity $databaseIdentity
        Set-PrivateAcl $rootPasswordPath
        Set-PrivateAcl $initSqlPath -ReadIdentity $databaseIdentity
    }
}

function Get-RuntimeConfigurations([string]$Runtime, [string]$State, [bool]$InitializeDatabase, [ValidateSet(80, 8080)][int]$HttpPort = 8080) {
    foreach ($value in @($Runtime, $State)) {
        if ($value -match '["\r\n]') { throw 'An installation path contains characters unsafe for server configuration.' }
    }
    $runtime = $Runtime.Replace('\', '/')
    $state = $State.Replace('\', '/')
    $apache = @"
ServerRoot "$runtime/apache"
Listen 0.0.0.0:$HttpPort
ServerName localhost:$HttpPort
PidFile "$state/run/apache.pid"
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule access_compat_module modules/mod_access_compat.so
LoadModule dir_module modules/mod_dir.so
LoadModule mime_module modules/mod_mime.so
LoadModule log_config_module modules/mod_log_config.so
LoadModule env_module modules/mod_env.so
LoadModule setenvif_module modules/mod_setenvif.so
LoadModule headers_module modules/mod_headers.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule alias_module modules/mod_alias.so
LoadFile "$runtime/php/php8ts.dll"
LoadFile "$runtime/php/libcrypto-3-x64.dll"
LoadFile "$runtime/php/libssl-3-x64.dll"
LoadFile "$runtime/php/libssh2.dll"
LoadFile "$runtime/php/nghttp2.dll"
LoadModule php_module "$runtime/php/php8apache2_4.dll"
PHPIniDir "$state/config"
DocumentRoot "$state/backend"
DirectoryIndex index.php index.html
TypesConfig "$runtime/apache/conf/mime.types"
ErrorLog "$state/logs/apache/error.log"
LogFormat "%h %l %u %t \"%r\" %>s %b" common
CustomLog "$state/logs/apache/access.log" common
ServerTokens Prod
ServerSignature Off
TraceEnable Off
<Directory />
  AllowOverride None
  Require all denied
</Directory>
<Directory "$state/backend">
  Options -Indexes
  AllowOverride All
  Require all granted
</Directory>
<DirectoryMatch "^$([regex]::Escape($state))/backend/(src|vendor|pos_db_backup)(/|`$)">
  Require all denied
</DirectoryMatch>
<FilesMatch "^(\\.|config\\.php`$|import_db\\.php`$)">
  Require all denied
</FilesMatch>
<FilesMatch "\\.php`$">
  SetHandler application/x-httpd-php
</FilesMatch>
<DirectoryMatch "/(images|uploads|profile_pictures|item_pictures|pos_second_screen)(/|`$)">
  AllowOverride None
  <FilesMatch "\\.(php[0-9]?|phtml|phar)`$">
    Require all denied
  </FilesMatch>
</DirectoryMatch>
# A separate URL path keeps browser cookies separate from XAMPP phpMyAdmin.
# Cookies are not isolated by TCP port. Retain old standalone bookmarks via
# an HTTP redirect rather than serving the login form at the old cookie path.
RedirectMatch 302 "^/phpmyadmin(/.*)?`$" "/lightem-db`$1"
RedirectMatch 302 "^/lightem-db`$" "/lightem-db/"
Alias /lightem-db "$state/phpmyadmin"
<Directory "$state/phpmyadmin">
  Options -Indexes -Includes -ExecCGI
  AllowOverride None
  <RequireAll>
    Require ip 127.0.0.1 ::1
    Require expr "%{HTTP_HOST} =~ m#^(?i:localhost|127[.]0[.]0[.]1|\[::1\])(:[0-9]+)?`$#"
  </RequireAll>
  php_admin_value session.save_path "$state/phpmyadmin-temp"
  php_admin_flag session.use_strict_mode On
  php_admin_flag session.cookie_httponly On
  php_admin_value session.cookie_samesite Lax
  <FilesMatch "(?i)\.php`$">
    SetHandler application/x-httpd-php
  </FilesMatch>
  <FilesMatch "(?i)^(config.*\.php|phpmyadmin-manifest\.json|composer\.(json|lock)|package(-lock)?\.json)`$">
    Require all denied
  </FilesMatch>
</Directory>
<DirectoryMatch "(?i)^$([regex]::Escape($state))/phpmyadmin/(libraries|templates|vendor|setup|test|tests|sql|doc|examples)(/|`$)">
  AllowOverride None
  Require all denied
</DirectoryMatch>
"@
    $php = @"
[PHP]
engine=On
short_open_tag=Off
expose_php=Off
display_errors=Off
display_startup_errors=Off
log_errors=On
error_log="$state/logs/apache/php-error.log"
extension_dir="$runtime/php/ext"
extension=curl
extension=fileinfo
extension=gd
extension=mbstring
extension=mysqli
extension=openssl
extension=pdo_mysql
extension=zip
curl.cainfo="$runtime/apache/bin/curl-ca-bundle.crt"
openssl.cafile="$runtime/apache/bin/curl-ca-bundle.crt"
date.timezone=Asia/Manila
memory_limit=256M
max_execution_time=120
upload_max_filesize=32M
post_max_size=40M
upload_tmp_dir="$state/temp"
sys_temp_dir="$state/temp"
session.save_path="$state/sessions"
session.use_strict_mode=1
session.cookie_httponly=1
session.cookie_samesite=Lax
mysqli.default_port=3307
pdo_mysql.default_socket=
"@
    $database = @"
[mysqld]
basedir="$runtime/mysql"
datadir="$state/data"
port=3307
bind-address=127.0.0.1
skip-name-resolve
event-scheduler=OFF
local-infile=0
secure-file-priv=NULL
character-set-server=utf8mb4
collation-server=utf8mb4_general_ci
log-error="$state/logs/mysql/error.log"
tmpdir="$state/data"
[client]
host=127.0.0.1
port=3307
"@
    if ($InitializeDatabase) { $database = $database.Replace('[client]', "init-file=`"$state/secrets/database-init.sql`"`r`n[client]") }
    return @{ Apache = $apache; Php = $php; Database = $database }
}

function Write-RuntimeConfigurations([bool]$InitializeDatabase) {
    $configurations = Get-RuntimeConfigurations $runtimeRoot $lightemRoot $InitializeDatabase $httpPort
    Write-Utf8File $apacheConfig $configurations.Apache
    Write-Utf8File $phpIniPath $configurations.Php
    Write-Utf8File $databaseConfig $configurations.Database
}

function Save-RuntimeState([string]$Status, $Manifest, $RuntimeManifest) {
    $state = @{ formatVersion = 1; installerId = $installerId; runtimeKind = 'standalone'; status = $Status;
        version = [string]$Manifest.version; buildId = [string]$Manifest.buildId; runtimeRoot = $runtimeRoot;
        runtimeManifestSha256 = (Get-FileHash -LiteralPath (Join-Path $PayloadRoot 'runtime-manifest.json') -Algorithm SHA256).Hash;
        databasePort = $databasePort; httpPort = $httpPort;
        sourceKind = $(if ($copyExistingStore) { 'xampp-copy' } elseif ($runtimeState -and $runtimeState.PSObject.Properties['sourceKind']) { [string]$runtimeState.sourceKind } else { 'fresh' }) }
    Write-Utf8File "$runtimeStatePath.tmp" ($state | ConvertTo-Json)
    Move-Item -LiteralPath "$runtimeStatePath.tmp" -Destination $runtimeStatePath -Force
    Set-PrivateAcl $runtimeStatePath
}

function Assert-PrivateRecoveryPath([string]$Path) {
    Assert-NoReparsePoint $Path
    $acl = Get-Acl -LiteralPath $Path
    Assert-PrivateRecoveryAcl $Path $acl ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
}

function Assert-PrivateRecoveryAcl([string]$Path, $Acl, [string]$CurrentUserSid) {
    # An absent/null DACL grants everyone access despite having no Allow ACEs.
    # Check SDDL before enumerating rules; an empty, present DACL is different.
    $accessDescriptor = $Acl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
    if (-not $accessDescriptor.StartsWith('D:', [StringComparison]::Ordinal) -or $accessDescriptor.Contains('NO_ACCESS_CONTROL')) {
        throw "Interrupted setup recovery requires an explicit private access list: $Path"
    }
    $trusted = @('S-1-5-18', 'S-1-5-32-544', $CurrentUserSid)
    $owner = $Acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    if ($owner -notin $trusted) { throw "Interrupted setup recovery requires an administrator-owned path: $Path" }
    $writeRights = [Security.AccessControl.FileSystemRights]'Write, Delete, DeleteSubdirectoriesAndFiles, ChangePermissions, TakeOwnership'
    foreach ($rule in $Acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq 'Allow' -and ($rule.FileSystemRights -band $writeRights) -ne 0 -and
            $rule.IdentityReference.Value -notin $trusted) {
            throw "Interrupted setup recovery requires administrator-only write access: $Path"
        }
    }
}

function Test-PendingServiceRecovery($State, $RuntimeManifest, [string]$IncomingHash) {
    if (-not $State -or $State.status -ne 'initializing' -or $State.installerId -ne $installerId -or
        $State.runtimeKind -ne 'standalone' -or $State.formatVersion -ne 1 -or $State.databasePort -ne 3307 -or
        $State.runtimeManifestSha256 -ne $IncomingHash -or
        -not ([IO.Path]::GetFullPath([string]$State.runtimeRoot)).Equals($runtimeRoot, [StringComparison]::OrdinalIgnoreCase)) {
        return $false
    }
    try { if ((Get-StandaloneHttpPort $State) -ne $httpPort) { return $false } }
    catch { return $false }
    # Only an interrupted setup with its original private marker and exact
    # bundled runtime may finish assigning a service's account. Never infer
    # ownership from a service name alone or from a user-writable marker.
    foreach ($path in @($lightemRoot, $runtimeStatePath, (Join-Path $lightemRoot 'runtime'), $configRoot)) {
        Assert-PrivateRecoveryPath $path
    }
    Assert-RuntimeFiles $runtimeRoot $RuntimeManifest
    foreach ($path in @($runtimeRoot) + @(Get-ChildItem -LiteralPath $runtimeRoot -Recurse -Force | ForEach-Object { $_.FullName })) {
        Assert-PrivateRecoveryPath $path
    }
    foreach ($path in @($apacheConfig, $databaseConfig)) { Assert-PrivateRecoveryPath $path }
    return $true
}

function Publish-InstallationDescriptor($Manifest) {
    $path = Join-Path $lightemRoot 'installation.json'
    $descriptor = @{ formatVersion = 1; installerId = $installerId; runtimeKind = 'standalone';
        version = [string]$Manifest.version; buildId = [string]$Manifest.buildId; httpPort = $httpPort }
    Write-Utf8File "$path.tmp" ($descriptor | ConvertTo-Json)
    Set-PrivateAcl "$path.tmp"
    $acl = Get-Acl -LiteralPath "$path.tmp"
    $users = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($users, 'Read', 'Allow')))
    Set-Acl -LiteralPath "$path.tmp" -AclObject $acl
    Move-Item -LiteralPath "$path.tmp" -Destination $path -Force
}

function Backup-StandaloneBackend {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    Set-PrivateAcl $backupRoot -Directory
    foreach ($entry in @('backend', 'config', 'phpmyadmin', 'standalone-runtime.json', 'installation.json')) {
        $source = Join-Path $lightemRoot $entry
        if (Test-Path -LiteralPath $source) {
            Assert-NoReparsePoint $source -Recurse
            Copy-Item -LiteralPath $source -Destination $backupRoot -Recurse -Force
        }
    }
    $script:backupMade = $true
}

function Set-LanFirewallRule {
    $name = 'LightemStandalone-API-LocalSubnet'
    $existing = Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue
    if ($existing) {
        $application = $existing | Get-NetFirewallApplicationFilter
        if (-not $application.Program.Equals($apachePath, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'The Lightem firewall rule belongs to a different program; it will not be overwritten.'
        }
        Remove-NetFirewallRule -Name $name
    }
    New-NetFirewallRule -Name $name -DisplayName 'Lightem POS API (local network)' -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $httpPort -RemoteAddress LocalSubnet -Profile Private,Domain -Program $apachePath | Out-Null
    $script:firewallChanged = $true
}

if ($CheckAppDestinationOnly) {
    try {
        Assert-StandaloneDesktopDestination $AppRoot -RequireEmpty:$RequireEmptyAppDestination
        exit 0
    } catch {
        Write-SetupFailureSummary $_.Exception.Message
        Write-Output $_.Exception.Message
        exit 1
    }
}

try {
    Assert-StandaloneDesktopDestination $AppRoot
    foreach ($path in @($lightemRoot, $stateRoot, $documentRoot, $dataRoot, $configRoot, $secretRoot, $databaseBackupRoot, $databaseManagerRoot, $databaseManagerTemp)) {
        Assert-NoReparsePoint $path -Recurse
    }
    New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
    Set-PrivateAcl $stateRoot -Directory
    foreach ($name in @('logs', 'backups', 'credentials')) {
        $directory = Join-Path $stateRoot $name
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        Set-PrivateAcl $directory -Directory
    }
    New-Item -ItemType File -Path $logPath -Force | Out-Null
    Set-PrivateAcl $logPath
    $mutex = New-Object Threading.Mutex($false, 'Global\LightemPosRuntimeInstaller')
    try { $mutexAcquired = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $mutexAcquired = $true }
    if (-not $mutexAcquired) { throw 'Another Lightem installer is running.' }
    $PayloadRoot = [IO.Path]::GetFullPath($PayloadRoot)
    $AppRoot = [IO.Path]::GetFullPath($AppRoot)
    Assert-NoReparsePoint $PayloadRoot -Recurse
    Assert-NoReparsePoint $AppRoot -Recurse
    Write-SetupLog 'Checking the standalone package and existing store.'
    $required = @('manifest.json', 'runtime-manifest.json', 'verify.php', 'database\primary.sql', 'database\report.sql', 'database\schema-manifest.json')
    if (-not $CheckOnly) {
        $required += @('provision.php', 'database-admin.php', 'migrate.php', 'verify-runtime.php', 'backend\api\bootstrap.php', 'backend\src\Database.php', 'backend\vendor\autoload.php',
            'phpmyadmin-config.php', 'verify-phpmyadmin.php', 'phpmyadmin-manifest.json', 'phpmyadmin\phpmyadmin-manifest.json', 'phpmyadmin\index.php', 'phpmyadmin\vendor\autoload.php')
    }
    foreach ($relative in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $PayloadRoot $relative) -PathType Leaf)) { throw "Incomplete standalone package: $relative" }
    }
    $manifest = Get-Content -LiteralPath (Join-Path $PayloadRoot 'manifest.json') -Raw | ConvertFrom-Json
    $runtimeManifest = Get-Content -LiteralPath (Join-Path $PayloadRoot 'runtime-manifest.json') -Raw | ConvertFrom-Json
    Assert-Manifest $manifest $runtimeManifest
    $kind = Get-InstallationKind $runtimeStatePath $documentRoot $dataRoot
    $managed = $kind -eq 'Standalone'
    if (-not $managed -and (Test-Path -LiteralPath $databaseManagerRoot) -and @(Get-ChildItem -LiteralPath $databaseManagerRoot -Force).Count -gt 0) {
        throw 'An existing database manager without a standalone ownership marker was preserved. Review that directory before installing.'
    }
    $runtimeHash = (Get-FileHash -LiteralPath (Join-Path $PayloadRoot 'runtime-manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
    $runtimeRoot = Join-Path $lightemRoot "runtime\$($runtimeHash.Substring(0, 16))"
    $phpPath = Join-Path $runtimeRoot 'php\php.exe'
    $apachePath = Join-Path $runtimeRoot 'apache\bin\httpd.exe'
    $mysqlPath = Join-Path $runtimeRoot 'mysql\bin\mysqld.exe'
    $oldApachePath = $apachePath
    $oldMysqlPath = $mysqlPath
    if ($managed) {
        $runtimeState = Get-Content -LiteralPath $runtimeStatePath -Raw | ConvertFrom-Json
        $httpPort = Get-StandaloneHttpPort $runtimeState
        Assert-NoDowngrade $runtimeState $manifest
        $oldRuntime = [IO.Path]::GetFullPath([string]$runtimeState.runtimeRoot)
        $expectedRuntimeParent = (Join-Path $lightemRoot 'runtime').TrimEnd('\') + '\'
        if (-not $oldRuntime.StartsWith($expectedRuntimeParent, [StringComparison]::OrdinalIgnoreCase) -or
            (Split-Path -Parent $oldRuntime) -ne $expectedRuntimeParent.TrimEnd('\')) { throw 'Invalid standalone runtime location in the ownership marker.' }
        Assert-NoReparsePoint $oldRuntime -Recurse
        $oldApachePath = Join-Path $oldRuntime 'apache\bin\httpd.exe'
        $oldMysqlPath = Join-Path $oldRuntime 'mysql\bin\mysqld.exe'
        # Do not change database binary versions implicitly. A future runtime
        # release must provide its own explicit, tested database upgrade path.
        if ($runtimeState.status -eq 'ready' -and $runtimeState.runtimeManifestSha256 -ne $runtimeHash) {
            throw 'This package changes the database runtime. Use a verified runtime-upgrade release; the existing store was preserved.'
        }
        if ($runtimeState.status -eq 'ready') { Assert-BackendComplete $documentRoot }
    }
    $copyExistingStore = Get-XamppCopyMode $kind $runtimeState ([bool]$CopyXamppStore)
    if ($copyExistingStore -and -not (Test-Path -LiteralPath (Join-Path $PayloadRoot 'verify-runtime.php') -PathType Leaf)) {
        throw 'The standalone copy preflight is missing its bundled runtime verifier. Use the complete Windows installer.'
    }
    $allowPendingRegistration = $false
    if ($managed -and $runtimeState.status -eq 'initializing') {
        $pendingServices = @($apacheService, $databaseService | ForEach-Object { Get-RuntimeService $_ } | Where-Object {
            $_ -and $_.State -eq 'Stopped' -and $_.StartName -in @('LocalSystem', $apacheIdentity, $databaseIdentity)
        })
        if ($pendingServices.Count -gt 0) {
            $allowPendingRegistration = Test-PendingServiceRecovery $runtimeState $runtimeManifest $runtimeHash
        }
    }
    foreach ($entry in @(@($apacheService, $oldApachePath, $apacheIdentity, $apacheConfig), @($databaseService, $oldMysqlPath, $databaseIdentity, $databaseConfig))) {
        Get-OwnedService $entry[0] $entry[1] $entry[2] $entry[3] -AllowPendingRegistration:$allowPendingRegistration | Out-Null
    }
    Assert-ListenerOwners $httpPort @($oldApachePath)
    Assert-ListenerOwners $databasePort @($oldMysqlPath)
    $desktopRelease = Join-Path $AppRoot 'resources\system-release.json'
    if (Test-Path -LiteralPath $desktopRelease) {
        Assert-NoDowngrade (Get-Content -LiteralPath $desktopRelease -Raw | ConvertFrom-Json) $manifest
    }
    if ($copyExistingStore) {
        Write-SetupLog 'Checking the XAMPP store for a separate copy. Keep XAMPP MySQL running and pause sales until setup completes.'
        Test-XamppCopySource $manifest $runtimeManifest
    } elseif ($managed -and $runtimeState.status -eq 'ready') {
        if (-not (Test-Path -LiteralPath $rootPasswordPath -PathType Leaf)) { throw 'The private database administrator recovery file is missing.' }
        Assert-RuntimeFiles $oldRuntime $runtimeManifest
        if (-not (Test-ServiceRecoveryOwnership $databaseService)) { throw 'The private database service changed after preflight; it was preserved.' }
        $preflightDatabaseTouched = $true
        if ($serviceSnapshots.ContainsKey($databaseService) -and $serviceSnapshots[$databaseService].StartMode -eq 'Disabled') {
            Set-Service -Name $databaseService -StartupType Manual
        }
        Start-OwnedService $databaseService $databasePort $oldMysqlPath
        Invoke-BundledPhp $oldRuntime $phpIniPath @((Join-Path $PayloadRoot 'verify.php'), '--root', $documentRoot, '--payload', $PayloadRoot, '--before-update') 'Checking the standalone database and backend before update' | Out-Null
    }
    if ($CheckOnly) {
        Backup-Desktop
        Write-SetupLog 'Standalone pre-installation checks passed; the current application and database were not replaced.'
        $success = $true
    } else {
        Assert-RuntimeFiles (Join-Path $PayloadRoot 'runtime') $runtimeManifest
        Restore-DesktopSettings
        Restore-PreviousStandaloneDesktopSettings
        Complete-DesktopSettings
        Set-DesktopLocalEndpoint
        # Only the private standalone services are changed. XAMPP can keep
        # serving its existing applications on its own ports throughout setup.
        $runtimeServicesChanged = $true
        Stop-OwnedService $apacheService
        Wait-PortClosed $httpPort
        Backup-StandaloneBackend
        Stop-OwnedService $databaseService
        Wait-PortClosed $databasePort
        foreach ($path in @($lightemRoot, (Join-Path $lightemRoot 'runtime'), $configRoot, $secretRoot, $documentRoot, $dataRoot)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
            Set-PrivateAcl $path -Directory
        }
        # Apache validates log/PID locations while registering the service.
        # Create protected parents before registration, grant the service SIDs
        # their narrow permissions only after Windows has registered them.
        foreach ($relative in @('logs', 'logs\apache', 'logs\mysql', 'temp', 'sessions', 'run', 'phpmyadmin-temp')) {
            $directory = Join-Path $lightemRoot $relative
            New-Item -ItemType Directory -Path $directory -Force | Out-Null
            Set-PrivateAcl $directory -Directory
        }
        if (-not (Test-Path -LiteralPath $runtimeRoot)) {
            Copy-Item -LiteralPath (Join-Path $PayloadRoot 'runtime') -Destination $runtimeRoot -Recurse -Force
        }
        Assert-RuntimeFiles $runtimeRoot $runtimeManifest
        Invoke-CheckedProcess $phpPath @('-n', (Join-Path $PayloadRoot 'verify-runtime.php'), '--root', $runtimeRoot,
            '--platform', 'win32', '--sha256', [string]$manifest.runtimeSha256) 'Verifying the portable runtime inventory' | Out-Null
        if (-not $managed) { Save-RuntimeState 'initializing' $manifest $runtimeManifest }
        $backendChanged = $true
        Copy-BackendOverlay
        if ($copyExistingStore) { Copy-XamppMedia }
        $newDatabase = -not (Test-Path -LiteralPath (Join-Path $dataRoot 'mysql') -PathType Container)
        if ($newDatabase -and @(Get-ChildItem -LiteralPath $dataRoot -Force).Count -gt 0) {
            throw 'The private database directory is nonempty but incomplete. It was retained for recovery, not reinitialized.'
        }
        Write-RuntimeConfigurations ($newDatabase -or (Test-Path -LiteralPath $initSqlPath))
        Initialize-ServiceRegistration
        Set-ServiceFilePermissions
        Invoke-LightemPhp @('-r', 'if (PHP_VERSION !== "8.2.4") { exit(1); } foreach (["pdo_mysql","mbstring","openssl","fileinfo"] as $e) { if (!extension_loaded($e)) { exit(2); } }') 'Checking the isolated PHP runtime' | Out-Null
        Install-DatabaseManager $manifest
        if ($newDatabase) {
            Write-SetupLog 'Initializing a new private database directory. Existing XAMPP databases are not touched.'
            Invoke-CheckedProcess (Join-Path $runtimeRoot 'mysql\bin\mysql_install_db.exe') @("--datadir=$dataRoot", "--port=$databasePort", '--skip-networking') 'Initializing the private database' 300 | Out-Null
        }
        if (-not (Test-Path -LiteralPath $rootPasswordPath -PathType Leaf)) {
            # Also resumes an interrupted first initialization. The helper
            # rejects datadirs containing any application databases.
            Invoke-LightemPhp @((Join-Path $PayloadRoot 'database-admin.php'), '--prepare-init-file', $initSqlPath, '--credentials', $rootPasswordPath, '--data-dir', $dataRoot) 'Preparing unique database administrator credentials' | Out-Null
            Set-ServiceFilePermissions
        } elseif (-not (Test-Path -LiteralPath $initSqlPath) -and
            (-not $runtimeState -or $runtimeState.status -eq 'initializing') -and
            -not (Test-Path -LiteralPath (Join-Path $documentRoot $markerName))) {
            # An interruption between saving the root secret and its init SQL
            # reuses that same secret. The common helper permits this only for
            # a private system-only datadir, never for existing store tables.
            Invoke-LightemPhp @((Join-Path $PayloadRoot 'database-admin.php'), '--prepare-init-file', $initSqlPath,
                '--resume-init-file', '--credentials', $rootPasswordPath, '--data-dir', $dataRoot) 'Resuming interrupted database initialization' | Out-Null
            Set-ServiceFilePermissions
        }
        if (-not (Test-Path -LiteralPath $rootPasswordPath -PathType Leaf)) { throw 'The private database administrator credential is missing; setup will not reset it.' }
        Write-RuntimeConfigurations (Test-Path -LiteralPath $initSqlPath)
        Start-OwnedService $databaseService $databasePort $mysqlPath
        Invoke-LightemPhp @((Join-Path $PayloadRoot 'database-admin.php'), '--credentials', $rootPasswordPath, '--database-port', "$databasePort", '--data-dir', $dataRoot) 'Checking private database authentication and loopback binding' | Out-Null
        if (Test-Path -LiteralPath $initSqlPath) {
            Remove-Item -LiteralPath $initSqlPath -Force
            Write-RuntimeConfigurations $false
            Set-PrivateAcl $secretRoot -Directory
        }
        if ($copyExistingStore) {
            Assert-XamppDatabaseRunning
            Test-XamppSourceConfiguration $runtimeRoot $phpIniPath
            Write-SetupLog 'Copying and verifying both databases into standalone storage. XAMPP databases, PHP settings and services remain unchanged.'
            Invoke-LightemPhp @((Join-Path $PayloadRoot 'migrate.php'), '--source-root', $xamppWebRoot,
                '--root', $documentRoot, '--payload', $PayloadRoot, '--credentials', $credentialsPath,
                '--bootstrap-password-file', $rootPasswordPath, '--database-port', "$databasePort", '--data-dir', $dataRoot, '--backup-dir', $databaseBackupRoot,
                '--mysqldump-path', (Join-Path $runtimeRoot 'mysql\bin\mysqldump.exe'),
                '--mysql-path', (Join-Path $runtimeRoot 'mysql\bin\mysql.exe')) 'Copying and verifying the existing XAMPP store' 3600 | Out-Null
        } else {
            Invoke-LightemPhp @((Join-Path $PayloadRoot 'provision.php'), '--root', $documentRoot, '--payload', $PayloadRoot,
                '--credentials', $credentialsPath, '--bootstrap-password-file', $rootPasswordPath,
                '--database-port', "$databasePort", '--backup-dir', $databaseBackupRoot, '--mysqldump-path', (Join-Path $runtimeRoot 'mysql\bin\mysqldump.exe')) 'Provisioning the standalone backend' 600 | Out-Null
        }
        $provisionSucceeded = $true
        Set-ServiceFilePermissions
        Invoke-LightemPhp @((Join-Path $PayloadRoot 'verify.php'), '--root', $documentRoot, '--payload', $PayloadRoot) 'Verifying both databases and backend configuration' | Out-Null
        Invoke-CheckedProcess $apachePath @('-t', '-f', $apacheConfig) 'Checking standalone Apache configuration' | Out-Null
        Start-OwnedService $apacheService $httpPort $apachePath
        Test-HttpRuntime $manifest.phpVersion
        Test-DatabaseManagerHttp
        Set-LanFirewallRule
        Set-DesktopConfigPermissions
        Save-RuntimeState 'ready' $manifest $runtimeManifest
        foreach ($name in @($databaseService, $apacheService)) {
            if (-not (Test-ServiceRecoveryOwnership $name)) { throw "Windows service $name changed during setup; its startup settings were preserved." }
            Set-Service -Name $name -StartupType Automatic
        }
        Publish-InstallationDescriptor $manifest
        Write-SetupLog "Standalone Lightem is ready at http://localhost:$httpPort. Its web server and private database start automatically with Windows. XAMPP was not changed."
        if (Test-Path -LiteralPath $credentialsPath) { Write-SetupLog "Protected initial/recovery credentials: $credentialsPath" }
        $success = $true
        if ($ShowInitialLogin) {
            $loginPath = [IO.Path]::ChangeExtension($credentialsPath, '.login.txt')
            if (Test-Path -LiteralPath $loginPath) {
                Set-PrivateAcl $loginPath
                try { Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\notepad.exe') -ArgumentList (ConvertTo-ProcessArgument $loginPath) | Out-Null }
                catch { Write-SetupLog "An administrator can open the initial POS login at $loginPath" }
            }
        }
    }
} catch {
    $failure = $_.Exception.Message
    Write-SetupFailureSummary $failure
    if (Test-Path -LiteralPath $logPath) { Write-SetupLog "ERROR: $failure" } else { Write-Error $failure -ErrorAction Continue }
    if ($runtimeServicesChanged) {
        try { Stop-OwnedService $apacheService; Wait-PortClosed $httpPort } catch { Write-SetupLog "Web service shutdown needs attention: $($_.Exception.Message)" }
        try { Stop-OwnedService $databaseService; Wait-PortClosed $databasePort } catch { Write-SetupLog "Database shutdown needs attention: $($_.Exception.Message)" }
    }
    # A newly committed store must retain its matching secret/configuration and
    # marker on retry. For an update, restore the full previous backend/config.
    $retainNewStore = $provisionSucceeded -and (-not $runtimeState -or $runtimeState.status -ne 'ready')
    if ($backendChanged -and $backupMade -and -not $retainNewStore) {
        try {
            Assert-StandaloneServersStopped
            foreach ($entry in @('backend', 'config')) {
                $source = Join-Path $backupRoot $entry
                $destination = Join-Path $lightemRoot $entry
                if (Test-Path -LiteralPath $source) {
                    if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
                    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
                }
            }
            foreach ($entry in @('standalone-runtime.json', 'installation.json')) {
                if (Test-Path -LiteralPath (Join-Path $backupRoot $entry)) {
                    Copy-Item -LiteralPath (Join-Path $backupRoot $entry) -Destination (Join-Path $lightemRoot $entry) -Force
                }
            }
            Restore-DatabaseManager
            if (Test-Path -LiteralPath (Join-Path $backupRoot 'installation.json')) {
                Publish-InstallationDescriptor (Get-Content -LiteralPath (Join-Path $backupRoot 'installation.json') -Raw | ConvertFrom-Json)
            }
            Set-ServiceFilePermissions
            Write-SetupLog "Previous standalone files restored from $backupRoot. No database was deleted."
        } catch { Write-SetupLog "RECOVERY REQUIRED: $($_.Exception.Message) Backup: $backupRoot" }
    }
    if ($retainNewStore) { Write-SetupLog 'The new database and its credentials were retained together. Run this standalone installer again to complete setup.' }
    if ($runtimeServicesChanged) {
        foreach ($name in @($databaseService, $apacheService)) {
            try {
                if (-not (Test-ServiceRecoveryOwnership $name)) { throw 'The service is missing or changed; setup preserved it instead of restoring stale settings.' }
                if ($serviceSnapshots.ContainsKey($name)) {
                    $snapshot = $serviceSnapshots[$name]
                    Invoke-CheckedProcess (Join-Path $env:SystemRoot 'System32\sc.exe') @('config', $name, 'binPath=', $snapshot.PathName) 'Restoring service runtime' | Out-Null
                    if ($snapshot.IdentityChanged) {
                        $accountArguments = @('config', $name, 'obj=', $snapshot.StartName)
                        if ($snapshot.StartName -eq 'LocalSystem') { $accountArguments += @('password=', '') }
                        Invoke-CheckedProcess (Join-Path $env:SystemRoot 'System32\sc.exe') $accountArguments 'Restoring interrupted service account' | Out-Null
                    }
                    $startType = switch ($snapshot.StartMode) { 'Auto' { 'Automatic' } 'Disabled' { 'Disabled' } default { 'Manual' } }
                    Set-Service -Name $name -StartupType $startType
                    if ($snapshot.State -eq 'Running') { Start-Service -Name $name }
                } elseif ($createdServices.Contains($name)) { Set-Service -Name $name -StartupType Manual }
            } catch { Write-SetupLog "Service recovery for $name needs attention: $($_.Exception.Message)" }
        }
    }
    if (-not $CheckOnly) {
        try {
            Restore-Desktop
            if (Test-Path -LiteralPath (Join-Path $AppRoot 'resources')) { Set-DesktopConfigPermissions }
        } catch { Write-SetupLog "Desktop recovery needs attention: $($_.Exception.Message)" }
    }
    Write-Output "Setup failed. See $logPath"
} finally {
    if ($preflightDatabaseTouched -and ($CheckOnly -or (-not $success -and -not $runtimeServicesChanged))) {
        # Preflight may temporarily start a stopped database to read its schema.
        # Restore service states even when verification throws.
        foreach ($name in @($databaseService)) {
            if ($serviceSnapshots.ContainsKey($name)) {
                try {
                    if (-not (Test-ServiceRecoveryOwnership $name)) { throw "Windows service $name changed; preflight cleanup preserved it." }
                    $snapshot = $serviceSnapshots[$name]
                    if ($snapshot.State -eq 'Stopped') { Stop-OwnedService $name }
                    $startType = switch ($snapshot.StartMode) { 'Auto' { 'Automatic' } 'Disabled' { 'Disabled' } default { 'Manual' } }
                    Set-Service -Name $name -StartupType $startType
                } catch { $success = $false; Write-SetupFailureSummary $_.Exception.Message }
            }
        }
    }
    if ($probePath -and (Test-Path -LiteralPath $probePath)) { Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue }
    if ($mutexAcquired) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
if ($success) { exit 0 }
exit 1
