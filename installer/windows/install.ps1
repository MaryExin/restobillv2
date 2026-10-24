#requires -Version 5.1
#requires -RunAsAdministrator
<#
Installs the local runtime used by the Lightem POS desktop installer.
Run only from the elevated NSIS installer. No passwords are command arguments.
Existing databases are never copied, deleted, or reimported by this script.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PayloadRoot,
    [Parameter(Mandatory = $true)][string]$AppRoot,
    [switch]$CheckOnly,
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
$xamppRoot = 'C:\xampp'
$documentRoot = Join-Path $xamppRoot 'htdocs'
$installerId = 'com.lenard.restobill.setup'
$markerName = '.lightem-managed-install.json'
$runId = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$stateRoot = Join-Path $env:ProgramData 'Lightem\Installer'
$logPath = Join-Path $stateRoot "logs\setup-$runId.log"
$backupRoot = Join-Path $stateRoot "backups\$runId"
$credentialsPath = Join-Path $stateRoot "credentials\initial-access-$runId.txt"
$phpPath = Join-Path $xamppRoot 'php\php.exe'
$apachePath = Join-Path $xamppRoot 'apache\bin\httpd.exe'
$mysqlPath = Join-Path $xamppRoot 'mysql\bin\mysqld.exe'
$managed = $false
$legacy = $false
$backupMade = $false
$backendChanged = $false
$provisionSucceeded = $false
$success = $false
$mutexAcquired = $false
$mutex = $null
$probePath = $null
$serviceSnapshots = @{}
$createdServices = New-Object System.Collections.Generic.List[string]
$backendEntries = @('api', 'src', 'vendor', '.env', '.htaccess', $markerName)

function Write-SetupLog([string]$Message) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    Write-Output $line
}

function Write-SetupFailureSummary([string]$Message) {
    if (-not $ErrorSummaryPath) { return }
    try {
        # A private NSIS temporary file carries the failure independently of
        # the regular log, which may not exist when startup/ACL checks fail.
        Assert-NoReparsePoint $ErrorSummaryPath
        $safe = [regex]::Replace($Message, '(?im)\b([a-z0-9_]*(?:password|passwd|pwd|secret_key|token)[a-z0-9_]*)\s*[=:]\s*(?:"[^"]*"|''[^'']*''|\S+)', '$1=[redacted]')
        if ($safe.Length -gt 1200) { $safe = $safe.Substring(0, 1200) }
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

function Set-PrivateAcl([string]$Path, [switch]$Directory, [string]$ReadIdentity = '') {
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
        $rule = New-Object Security.AccessControl.FileSystemAccessRule(
            $sid, 'FullControl', $inheritance, 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    if ($ReadIdentity -and $ReadIdentity -notin @('LocalSystem', 'NT AUTHORITY\SYSTEM')) {
        $account = New-Object Security.Principal.NTAccount($ReadIdentity)
        $sid = $account.Translate([Security.Principal.SecurityIdentifier])
        $rule = New-Object Security.AccessControl.FileSystemAccessRule(
            $sid, 'ReadAndExecute', $inheritance, 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
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

function Assert-RuntimeService([string]$Name, [string]$ExpectedPath) {
    $service = Get-RuntimeService $Name
    if ($service) {
        $executable = [IO.Path]::GetFullPath((Get-ServiceExecutable $service.PathName))
        if (-not $executable.Equals($ExpectedPath, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Service $Name belongs to another installation ($executable). It will not be replaced."
        }
        if (-not $serviceSnapshots.ContainsKey($Name)) {
            $serviceSnapshots[$Name] = @{ State = $service.State; StartMode = $service.StartMode }
        }
    }
    return $service
}

function Assert-PortOwner([int]$Port, [string]$ServiceName, [string]$ExpectedPath) {
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object { $_.LocalPort -eq $Port })
    foreach ($listener in $listeners) {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if (-not $processInfo -or -not $processInfo.ExecutablePath -or
            -not $processInfo.ExecutablePath.Equals($ExpectedPath, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Port $Port is already used by another program (PID $($listener.OwningProcess)). Free this port and run setup again."
        }
        $service = Get-RuntimeService $ServiceName
        if (-not $service -or $service.State -ne 'Running') {
            throw "XAMPP is using port $Port without the expected $ServiceName Windows service. Stop that component in XAMPP Control Panel, then run setup again."
        }
        # Apache listeners may be children of the registered service process.
        $ancestor = $processInfo
        $belongsToService = $false
        for ($depth = 0; $depth -lt 8 -and $ancestor; $depth++) {
            if ($ancestor.ProcessId -eq $service.ProcessId) { $belongsToService = $true; break }
            if (-not $ancestor.ParentProcessId) { break }
            $ancestor = Get-CimInstance Win32_Process -Filter "ProcessId=$($ancestor.ParentProcessId)"
        }
        if (-not $belongsToService) { throw "Port $Port is not owned by the validated $ServiceName service. Stop the separate process before setup." }
    }
}

function Get-XamppInstallationState([string]$Root) {
    Assert-NoReparsePoint $Root
    if (-not (Test-Path -LiteralPath $Root)) { return 'Absent' }
    $item = Get-Item -LiteralPath $Root -Force -ErrorAction Stop
    if (-not $item.PSIsContainer) {
        throw "The XAMPP destination is a file, not a directory: $Root. Setup kept it unchanged."
    }
    # Include hidden entries. A directory containing even one file or child
    # folder must keep the existing compatibility checks, never a fresh install.
    $entries = @(Get-ChildItem -LiteralPath $Root -Force -ErrorAction Stop | Select-Object -First 1)
    if ($entries.Count -eq 0) { return 'Empty' }
    return 'Existing'
}

function Assert-XamppVersion($Manifest) {
    foreach ($file in @($phpPath, $apachePath, $mysqlPath, (Join-Path $xamppRoot 'mysql\bin\my.ini'))) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "C:\xampp is not a complete compatible XAMPP installation: missing $file" }
    }
    $version = Invoke-CheckedProcess $phpPath @('-r', 'echo PHP_VERSION;') 'Checking PHP version'
    if ($version -ne [string]$Manifest.phpVersion) { throw "Existing PHP version $version does not match required $($Manifest.phpVersion). C:\xampp will not be overwritten." }
    $versionText = ''
    foreach ($name in @('readme_en.txt', 'readme_de.txt', 'properties.ini')) {
        $file = Join-Path $xamppRoot $name
        if (Test-Path -LiteralPath $file) { $versionText += "`n" + (Get-Content -LiteralPath $file -Raw) }
    }
    $baseVersion = ([string]$Manifest.xamppVersion -replace '-0$', '')
    if ($versionText -notmatch ('(?im)(?:XAMPP[^\r\n]*|^version\s*=\s*)' + [regex]::Escape($baseVersion) + '(?:-0)?(?:[^\d.]|$)')) {
        throw "Cannot confirm XAMPP $($Manifest.xamppVersion) in C:\xampp. A different or unrecognized installation will not be overwritten."
    }
}

function Stop-Apache {
    $service = Get-Service -Name 'Apache2.4' -ErrorAction SilentlyContinue
    if ($service -and $service.Status -ne 'Stopped') {
        Stop-Service -Name 'Apache2.4' -ErrorAction Stop
        $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(45))
    }
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

function Restore-DesktopSettings {
    if (-not $DesktopRecoveryRoot -or -not (Test-Path -LiteralPath (Join-Path $DesktopRecoveryRoot 'recovery.json'))) { return }
    foreach ($name in @('ip.txt', 'printer.txt', 'businessInfo.json', 'pos-config.json', 'printer_categories.json', 'business-info-backups')) {
        $source = Join-Path $DesktopRecoveryRoot "app\resources\$name"
        if (Test-Path -LiteralPath $source) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $AppRoot 'resources') -Recurse -Force
        }
    }
    Write-SetupLog 'Previous terminal, server, business, and printer settings restored.'
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

function Ensure-RuntimeServices {
    if (-not (Get-RuntimeService 'Apache2.4')) {
        Invoke-CheckedProcess $apachePath @('-k', 'install', '-n', 'Apache2.4', '-f', 'C:/xampp/apache/conf/httpd.conf') 'Registering Apache service' | Out-Null
        $createdServices.Add('Apache2.4')
    }
    if (-not (Get-RuntimeService 'mysql')) {
        Invoke-CheckedProcess $mysqlPath @('--install', 'mysql', '--defaults-file=C:\xampp\mysql\bin\my.ini') 'Registering MySQL service' | Out-Null
        $createdServices.Add('mysql')
    }
    foreach ($name in @('mysql', 'Apache2.4')) {
        Set-Service -Name $name -StartupType Automatic
        Start-Service -Name $name
        (Get-Service $name).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
    }
    $deadline = (Get-Date).AddSeconds(60)
    do {
        $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
        if (($listeners.LocalPort -contains 80) -and ($listeners.LocalPort -contains 3306)) { break }
        if ((Get-Date) -ge $deadline) { throw 'Apache/MySQL services did not open ports 80 and 3306 in time.' }
        Start-Sleep -Milliseconds 500
    } while ($true)
    Assert-PortOwner 80 'Apache2.4' $apachePath
    Assert-PortOwner 443 'Apache2.4' $apachePath
    Assert-PortOwner 3306 'mysql' $mysqlPath
}

function Start-DatabaseForPreflight {
    # Existing stopped databases can be checked without requiring the operator
    # to open XAMPP. Every service change here is undone before preflight exits.
    $service = Get-RuntimeService 'mysql'
    if (-not $service) {
        Write-SetupLog 'Temporarily registering the local database service for upgrade checks.'
        Invoke-CheckedProcess $mysqlPath @('--install', 'mysql', '--defaults-file=C:\xampp\mysql\bin\my.ini') 'Preparing database verification' | Out-Null
        $createdServices.Add('mysql')
        Set-Service -Name 'mysql' -StartupType Manual
    } elseif ($service.State -notin @('Running', 'Stopped')) {
        throw 'The local database service is changing state. Let it finish starting or stopping, then rerun setup.'
    } elseif ($service.StartMode -eq 'Disabled') {
        Set-Service -Name 'mysql' -StartupType Manual
    }
    if ((Get-Service 'mysql').Status -ne 'Running') {
        Write-SetupLog 'Starting the local database to verify the existing installation.'
        Start-Service -Name 'mysql'
        (Get-Service 'mysql').WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
    }
    $deadline = (Get-Date).AddSeconds(60)
    while (-not (@(Get-NetTCPConnection -State Listen -ErrorAction Stop).LocalPort -contains 3306)) {
        if ((Get-Date) -ge $deadline) { throw 'The existing MySQL service did not open port 3306 for verification.' }
        Start-Sleep -Milliseconds 500
    }
    Assert-PortOwner 3306 'mysql' $mysqlPath
}

function Restore-PreflightDatabaseState {
    if ($createdServices.Contains('mysql')) {
        Stop-Service -Name 'mysql'
        (Get-Service 'mysql').WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
        Invoke-CheckedProcess (Join-Path $env:SystemRoot 'System32\sc.exe') @('delete', 'mysql') 'Removing temporary database verification service' | Out-Null
        $deadline = (Get-Date).AddSeconds(30)
        while (Get-RuntimeService 'mysql') {
            if ((Get-Date) -ge $deadline) { throw 'The temporary MySQL service is still being removed. Wait briefly before retrying setup.' }
            Start-Sleep -Milliseconds 300
        }
        $createdServices.Remove('mysql') | Out-Null
    } elseif ($serviceSnapshots.ContainsKey('mysql')) {
        $snapshot = $serviceSnapshots['mysql']
        if ($snapshot.State -eq 'Stopped') {
            Stop-Service -Name 'mysql'
            (Get-Service 'mysql').WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
        }
        $startType = switch ($snapshot.StartMode) { 'Auto' { 'Automatic' } 'Disabled' { 'Disabled' } default { 'Manual' } }
        Set-Service -Name 'mysql' -StartupType $startType
    }
}

function Backup-Backend {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    Set-PrivateAcl $backupRoot -Directory
    foreach ($entry in $backendEntries) {
        $source = Join-Path $documentRoot $entry
        if (Test-Path -LiteralPath $source) {
            Assert-NoReparsePoint $source -Recurse
            Copy-Item -LiteralPath $source -Destination $backupRoot -Recurse -Force
        }
    }
    $script:backupMade = $true
    Write-SetupLog "Backend recovery copy saved to $backupRoot. Databases and uploads are preserved."
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

function Set-RuntimeDirectoryPermissions {
    $identity = (Get-RuntimeService 'Apache2.4').StartName
    if ($identity -in @('LocalSystem', 'NT AUTHORITY\SYSTEM')) {
        $sid = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
    } else {
        $sid = (New-Object Security.Principal.NTAccount($identity)).Translate([Security.Principal.SecurityIdentifier])
    }
    foreach ($relative in @('api\images', 'api\uploads', 'uploads', 'profile_pictures', 'item_pictures', 'pos_second_screen')) {
        $directory = Join-Path $documentRoot $relative
        Assert-NoReparsePoint $directory
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        $acl = Get-Acl -LiteralPath $directory
        $rule = New-Object Security.AccessControl.FileSystemAccessRule(
            $sid, 'Modify', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
        $acl.SetAccessRule($rule)
        Set-Acl -LiteralPath $directory -AclObject $acl
    }
}

function Test-HttpRuntime([string]$ExpectedPhpVersion) {
    $nonce = [Guid]::NewGuid().ToString('N')
    $name = "lightem-setup-check-$([Guid]::NewGuid().ToString('N')).php"
    $script:probePath = Join-Path $documentRoot $name
    $probe = "<?php header('Content-Type: application/json'); header('Cache-Control: no-store'); echo json_encode(['nonce'=>'$nonce','phpVersion'=>PHP_VERSION]);"
    [IO.File]::WriteAllText($script:probePath, $probe, (New-Object Text.UTF8Encoding($false)))
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1/$name" -TimeoutSec 15
        $result = $response.Content | ConvertFrom-Json
        if ($result.nonce -ne $nonce -or $result.phpVersion -ne $ExpectedPhpVersion) {
            throw 'The localhost web server did not execute the expected PHP runtime.'
        }
    } finally {
        Remove-Item -LiteralPath $script:probePath -Force -ErrorAction SilentlyContinue
        $script:probePath = $null
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

try {
    Assert-NoReparsePoint $stateRoot -Recurse
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
    if (-not $mutexAcquired) { throw 'Another Lightem runtime installation is already running.' }
    Write-SetupLog 'Checking the all-in-one payload and existing device.'
    $PayloadRoot = [IO.Path]::GetFullPath($PayloadRoot)
    $AppRoot = [IO.Path]::GetFullPath($AppRoot)
    Assert-NoReparsePoint $PayloadRoot -Recurse
    Assert-NoReparsePoint $xamppRoot
    Assert-NoReparsePoint $documentRoot
    $requiredFiles = @('manifest.json', 'verify.php', 'database\primary.sql', 'database\report.sql', 'database\schema-manifest.json')
    if (-not $CheckOnly) { $requiredFiles += @('xampp-installer.exe', 'provision.php', 'backend\api\bootstrap.php', 'backend\src\Database.php', 'backend\vendor\autoload.php') }
    foreach ($name in $requiredFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $PayloadRoot $name) -PathType Leaf)) { throw "Incomplete installer payload: $name" }
    }
    $manifest = Get-Content -LiteralPath (Join-Path $PayloadRoot 'manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.xamppVersion -ne '8.2.4-0' -or $manifest.phpVersion -ne '8.2.4' -or
        $manifest.xamppSha256 -notmatch '^[0-9a-fA-F]{64}$' -or
        $manifest.backendSha256 -notmatch '^[0-9a-fA-F]{64}$' -or -not $manifest.version -or [string]$manifest.buildId -notmatch '^\d{1,20}$') {
        throw 'Unsupported or incomplete installer manifest.'
    }
    $desktopRelease = Join-Path $AppRoot 'resources\system-release.json'
    if ($CheckOnly -and (Test-Path -LiteralPath $desktopRelease)) {
        Assert-NoReparsePoint $desktopRelease
        Assert-NoDowngrade (Get-Content -LiteralPath $desktopRelease -Raw | ConvertFrom-Json) $manifest
    }
    $xamppInstaller = Join-Path $PayloadRoot 'xampp-installer.exe'
    if (-not $CheckOnly) {
        $actualHash = (Get-FileHash -LiteralPath $xamppInstaller -Algorithm SHA256).Hash
        if ($actualHash -ne $manifest.xamppSha256) { throw 'The bundled XAMPP installer checksum does not match the manifest.' }
    }
    Assert-RuntimeService 'Apache2.4' $apachePath | Out-Null
    Assert-RuntimeService 'mysql' $mysqlPath | Out-Null
    Assert-PortOwner 80 'Apache2.4' $apachePath
    Assert-PortOwner 443 'Apache2.4' $apachePath
    Assert-PortOwner 3306 'mysql' $mysqlPath
    $markerPath = Join-Path $documentRoot $markerName
    if (Test-Path -LiteralPath $markerPath) {
        Assert-NoReparsePoint $markerPath
        $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
        if ($marker.installerId -ne $installerId) { throw 'The existing backend ownership marker belongs to a different installer.' }
        Assert-NoDowngrade $marker $manifest
        $managed = $true
    } elseif (@($backendEntries | Where-Object { $_ -ne '.htaccess' -and (Test-Path -LiteralPath (Join-Path $documentRoot $_)) }).Count -gt 0) {
        $legacyFiles = @('api\bootstrap.php', 'api\config.php', 'api\read_transaction_records.php', 'src\Database.php', 'src\JWTCodec.php', 'vendor\autoload.php', '.env')
        if (@($legacyFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $documentRoot $_) -PathType Leaf) }).Count -gt 0) {
            throw 'C:\xampp\htdocs already contains an unrelated or incomplete backend. Setup will not overwrite it.'
        }
        $legacy = $true
    }
    $xamppState = Get-XamppInstallationState $xamppRoot
    if ($xamppState -eq 'Existing') {
        Write-SetupLog 'C:\xampp contains files or folders. Checking the existing runtime before making changes.'
        Assert-XamppVersion $manifest
        Write-SetupLog 'Reusing compatible XAMPP 8.2.4-0.'
    } else {
        if ($xamppState -eq 'Empty') {
            Write-SetupLog 'C:\xampp is empty. The bundled XAMPP runtime will be installed automatically.'
        }
        if (-not $CheckOnly) {
            # Recheck immediately before handing the destination to XAMPP.
            if ((Get-XamppInstallationState $xamppRoot) -eq 'Existing') {
                throw 'C:\xampp changed during setup and is no longer empty. Its contents have been preserved; run setup again to check them.'
            }
            Write-SetupLog 'Installing XAMPP 8.2.4-0 at C:\xampp. This can take several minutes.'
            Invoke-CheckedProcess $xamppInstaller @('--mode', 'unattended', '--unattendedmodeui', 'none', '--prefix', $xamppRoot) 'Installing XAMPP' 1200 | Out-Null
            Assert-XamppVersion $manifest
        }
    }
    if ($CheckOnly) {
        if ($managed -or $legacy) {
            Start-DatabaseForPreflight
            Invoke-CheckedProcess $phpPath @((Join-Path $PayloadRoot 'verify.php'), '--root', $documentRoot, '--payload', $PayloadRoot, '--before-update') 'Checking backend compatibility before replacing the desktop' | Out-Null
            Restore-PreflightDatabaseState
        }
        Backup-Desktop
        Write-SetupLog 'Pre-installation checks passed. The existing installation has not been replaced.'
        $success = $true
        exit 0
    }
    Restore-DesktopSettings
    Ensure-RuntimeServices
    if ($managed -or $legacy) {
        foreach ($entry in $backendEntries) { Assert-NoReparsePoint (Join-Path $documentRoot $entry) -Recurse }
        Invoke-CheckedProcess $phpPath @((Join-Path $PayloadRoot 'verify.php'), '--root', $documentRoot, '--payload', $PayloadRoot, '--before-update') 'Checking existing Lightem installation before update' | Out-Null
        # Re-running the same build repairs files and permissions too; it never
        # imports existing databases or replaces their configuration.
    }
    if (-not $success) {
        Stop-Apache
        Backup-Backend
        $backendChanged = $true
        Copy-BackendOverlay
        $provisionArguments = @((Join-Path $PayloadRoot 'provision.php'), '--root', $documentRoot, '--payload', $PayloadRoot, '--credentials', $credentialsPath)
        if ($legacy) { $provisionArguments += '--adopt-existing' }
        Write-SetupLog 'Provisioning the local backend. Existing databases and local configuration are preserved during updates.'
        Invoke-CheckedProcess $phpPath $provisionArguments 'Provisioning Lightem backend' 600 | Out-Null
        $provisionSucceeded = $true
        Set-RuntimeDirectoryPermissions
        $apacheIdentity = (Get-RuntimeService 'Apache2.4').StartName
        foreach ($file in @((Join-Path $documentRoot '.env'), (Join-Path $documentRoot 'api\config.php'))) {
            if (Test-Path -LiteralPath $file) { Set-PrivateAcl $file -ReadIdentity $apacheIdentity }
        }
        if (Test-Path -LiteralPath $credentialsPath) { Set-PrivateAcl $credentialsPath }
        Invoke-CheckedProcess $phpPath @((Join-Path $PayloadRoot 'verify.php'), '--root', $documentRoot, '--payload', $PayloadRoot) 'Verifying installed PHP dependencies and databases' | Out-Null
        Ensure-RuntimeServices
        Test-HttpRuntime $manifest.phpVersion
        if (-not (Test-Path -LiteralPath $markerPath)) { throw 'Provisioning did not create the installation ownership marker.' }
        Set-DesktopConfigPermissions
        Write-SetupLog 'Installation verified. Apache and MySQL will start automatically with Windows.'
        if (Test-Path -LiteralPath $credentialsPath) { Write-SetupLog "Initial access details are stored in the administrator-only file: $credentialsPath" }
        $success = $true
    }
    if ($success -and $ShowInitialLogin) {
        $loginPath = [IO.Path]::ChangeExtension($credentialsPath, '.login.txt')
        if (Test-Path -LiteralPath $loginPath) {
            Set-PrivateAcl $loginPath
            Write-SetupLog "Opening initial POS login details. Protected login-only file: $loginPath"
            try {
                Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\notepad.exe') -ArgumentList (ConvertTo-ProcessArgument $loginPath) | Out-Null
            } catch {
                Write-SetupLog "Login details could not be opened automatically. An administrator can open: $loginPath"
            }
        }
    }
} catch {
    $failure = $_.Exception.Message
    Write-SetupFailureSummary $failure
    if (Test-Path -LiteralPath $logPath) { Write-SetupLog "ERROR: $failure" } else { Write-Error $failure -ErrorAction Continue }
    # Once fresh provisioning has committed its databases, the matching local
    # settings and marker are required to adopt them on a retry. A later HTTP,
    # permissions, or desktop failure must not restore an empty web root and
    # strand those databases without their generated configuration.
    $retainFreshBackend = $provisionSucceeded -and -not $managed -and -not $legacy
    if ($retainFreshBackend) {
        Write-SetupLog 'Fresh databases were provisioned successfully. Their backend, configuration, and ownership marker are retained so running this installer again can finish setup safely.'
    }
    if ($backendChanged -and $backupMade -and -not $retainFreshBackend) {
        try {
            Stop-Apache
            foreach ($entry in $backendEntries) {
                $destination = Join-Path $documentRoot $entry
                if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
                $source = Join-Path $backupRoot $entry
                if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $documentRoot -Recurse -Force }
            }
            Write-SetupLog "Previous backend files restored from $backupRoot. No databases were removed."
        } catch {
            Write-SetupLog "RECOVERY REQUIRED: Automatic file restore failed. Recovery copy: $backupRoot. $($_.Exception.Message)"
        }
    }
    foreach ($name in @('Apache2.4', 'mysql')) {
        if ($CheckOnly -and $name -ne 'mysql') { continue }
        try {
            if ($createdServices.Contains($name)) {
                Stop-Service -Name $name -ErrorAction SilentlyContinue
                Invoke-CheckedProcess (Join-Path $env:SystemRoot 'System32\sc.exe') @('delete', $name) "Removing newly created $name service" | Out-Null
            } elseif ($serviceSnapshots.ContainsKey($name)) {
                $snapshot = $serviceSnapshots[$name]
                $startType = switch ($snapshot.StartMode) { 'Auto' { 'Automatic' } 'Disabled' { 'Disabled' } default { 'Manual' } }
                Set-Service -Name $name -StartupType $startType
                if ($snapshot.State -eq 'Running') { Start-Service -Name $name } else { Stop-Service -Name $name -ErrorAction SilentlyContinue }
            }
        } catch { Write-SetupLog "Service recovery for $name needs attention: $($_.Exception.Message)" }
    }
    if (-not $CheckOnly) {
        try { Restore-Desktop } catch { Write-SetupLog "DESKTOP RECOVERY REQUIRED: $($_.Exception.Message). Backup: $DesktopRecoveryRoot" }
    }
    if (Test-Path -LiteralPath $credentialsPath) { Write-SetupLog "Retained initial-access recovery file: $credentialsPath" }
    Write-Output "Setup failed. See $logPath"
} finally {
    if ($probePath -and (Test-Path -LiteralPath $probePath)) { Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue }
    if ($mutexAcquired) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}

if ($success) { exit 0 }
exit 1
