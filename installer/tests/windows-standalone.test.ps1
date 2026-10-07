# Pure functions and mocked service inventory only. This file never dot-sources
# or executes the installer body, changes ACLs, or starts a server/service.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$source = Join-Path $PSScriptRoot '../windows/install-standalone.ps1'
$tokens = $null
$parseErrors = $null
$tree = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw ($parseErrors | Out-String) }
foreach ($name in @('Assert-NoReparsePoint', 'Assert-BackendComplete', 'Get-InstallationKind', 'Get-StandaloneHttpPort',
    'Assert-Manifest', 'Assert-RuntimeFiles', 'Get-ServiceExecutable', 'Get-OwnedService',
    'Split-ServiceCommandLine', 'Test-ServiceConfigArgument', 'Test-PendingServiceCommand',
    'Test-NativeApacheServiceCommand', 'Get-ApacheServiceConfigArgs', 'Assert-ApacheServiceConfigEvidence',
    'Assert-ServiceRegistrationSnapshot', 'Test-ServiceRecoveryOwnership', 'Set-VirtualServiceIdentity', 'Initialize-ServiceRegistration', 'Stop-OwnedService',
    'Assert-ListenerOwners', 'Get-RuntimeConfigurations', 'ConvertTo-ProcessArgument',
    'Install-DatabaseManager', 'Restore-DatabaseManager', 'Test-DatabaseManagerHttp')) {
    $definition = $tree.Find({ param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
    }, $false)
    if (-not $definition) { throw "Missing function $name" }
    . ([scriptblock]::Create($definition.Extent.Text))
}
$tempBase = [IO.Path]::GetTempPath()
if ([IO.Directory]::Exists('/private/tmp')) { $tempBase = '/private/tmp' }
$temp = Join-Path $tempBase ('lightem-standalone-test-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
$count = 0
$installerId = 'com.lenard.restobill.setup'
$markerName = '.lightem-managed-install.json'
$databasePort = 3307
$httpPort = 8080
$serviceSnapshots = @{}
function Assert-Test([bool]$Condition, [string]$Description) {
    if (-not $Condition) { throw "FAIL: $Description" }
    $script:count++
    Write-Output "PASS: $Description"
}
function Expect-Rejection([scriptblock]$Action, [string]$Description) {
    $rejected = $false
    try { & $Action | Out-Null } catch { $rejected = $true }
    Assert-Test $rejected $Description
}
function Write-Fixture([string]$Path, [string]$Value) {
    [IO.Directory]::CreateDirectory((Split-Path -Parent $Path)) | Out-Null
    [IO.File]::WriteAllText($Path, $Value)
}
try {
    $statePath = Join-Path $temp 'standalone-runtime.json'
    $backend = Join-Path $temp 'backend'
    $data = Join-Path $temp 'data'
    $legacy = Join-Path $temp 'xampp/htdocs'
    Assert-Test ((Get-InstallationKind $statePath $backend $data $legacy) -eq 'Fresh') 'missing XAMPP and private data select fresh standalone installation'
    Assert-Test (-not (Test-Path -LiteralPath (Join-Path $temp 'xampp'))) 'detection never creates an XAMPP directory'
    [IO.Directory]::CreateDirectory($backend) | Out-Null
    [IO.Directory]::CreateDirectory($data) | Out-Null
    Assert-Test ((Get-InstallationKind $statePath $backend $data $legacy) -eq 'Fresh') 'empty private destinations remain fresh'
    Write-Fixture (Join-Path $data 'ibdata1') 'restaurant data'
    Expect-Rejection { Get-InstallationKind $statePath $backend $data $legacy } 'unmarked existing DB files cannot be initialized or replaced'
    Assert-Test ([IO.File]::ReadAllText((Join-Path $data 'ibdata1')) -eq 'restaurant data') 'classification preserves existing database bytes'
    [IO.File]::Delete((Join-Path $data 'ibdata1'))
    Write-Fixture (Join-Path $legacy '.env') 'legacy setting'
    Assert-Test ((Get-InstallationKind $statePath $backend $data $legacy) -eq 'Fresh') 'an incomplete XAMPP backend does not block independent installation'
    foreach ($name in @('api/bootstrap.php', 'api/login.php', 'api/pos_lan_health.php', 'api/read_transaction_records.php',
        'api/config.php', 'src/Database.php', 'src/JWTCodec.php', 'src/UserGateway.php', 'vendor/autoload.php')) {
        Write-Fixture (Join-Path $legacy $name) 'fixture'
    }
    Assert-Test ((Get-InstallationKind $statePath $backend $data $legacy) -eq 'Fresh') 'recognized XAMPP stays separate from a new private store'
    Write-Fixture (Join-Path $legacy $markerName) (@{ installerId = 'another-product' } | ConvertTo-Json)
    Assert-Test ((Get-InstallationKind $statePath $backend $data $legacy) -eq 'Fresh') 'unrelated XAMPP applications do not affect private installation'
    [IO.File]::Delete((Join-Path $legacy $markerName))
    $state = @{ installerId = $installerId; formatVersion = 1; runtimeKind = 'standalone'; status = 'initializing'; databasePort = 3307; httpPort = 8080; sourceKind = 'fresh'; buildId = '20261001120000' }
    Write-Fixture $statePath ($state | ConvertTo-Json)
    Assert-Test ((Get-InstallationKind $statePath $backend $data $legacy) -eq 'Standalone') 'owned interrupted initialization is recognized without resetting data'
    $state.status = 'ready'
    Write-Fixture $statePath ($state | ConvertTo-Json)
    Assert-Test ((Get-InstallationKind $statePath $backend $data $legacy) -eq 'Standalone') 'owned standalone installation takes priority over retained XAMPP files'
    $state.databasePort = 3306
    Write-Fixture $statePath ($state | ConvertTo-Json)
    Expect-Rejection { Get-InstallationKind $statePath $backend $data $legacy } 'malformed standalone metadata cannot target the legacy DB port'
    [IO.File]::Delete($statePath)

    $manifest = [pscustomobject]@{ runtimeKind = 'standalone'; phpVersion = '8.2.4'; backendSha256 = ('a' * 64); runtimeSha256 = ('b' * 64); version = '0.0.1'; buildId = '20261001120000'; phpMyAdminVersion = '5.2.3'; phpMyAdminSha256 = ('d' * 64) }
    $runtime = [pscustomobject]@{ schemaVersion = 1; platform = 'win32'; arch = 'x64'; versions = [pscustomobject]@{ php = '8.2.4' }; sha256 = ('b' * 64); files = [pscustomobject]@{ 'dummy.txt' = [pscustomobject]@{ sha256 = ('c' * 64) } } }
    Assert-Manifest $manifest $runtime
    Assert-Test $true 'standalone metadata matches the runtime payload contract'
    $manifest.runtimeKind = 'xampp'
    Expect-Rejection { Assert-Manifest $manifest $runtime } 'legacy build cannot run the standalone installer'
    $manifest.runtimeKind = 'standalone'
    $runtime.platform = 'darwin'
    Expect-Rejection { Assert-Manifest $manifest $runtime } 'macOS runtime is rejected on the Windows path'
    $runtime.platform = 'win32'
    $manifest.phpMyAdminSha256 = 'missing'
    Expect-Rejection { Assert-Manifest $manifest $runtime } 'a manager payload without a pinned inventory hash is rejected'
    $manifest.phpMyAdminSha256 = 'd' * 64

    $runtimeRoot = Join-Path $temp 'runtime'
    $files = @{}
    foreach ($name in @('apache/bin/httpd.exe', 'php/php.exe', 'php/php8apache2_4.dll',
        'mysql/bin/mysqld.exe', 'mysql/bin/mysql_install_db.exe', 'mysql/bin/mysqldump.exe', 'mysql/bin/mysql.exe')) {
        $file = Join-Path $runtimeRoot $name
        Write-Fixture $file "portable runtime fixture $name"
        $files[$name] = @{ sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash; size = (Get-Item -LiteralPath $file).Length }
    }
    $runtime.files = ($files | ConvertTo-Json | ConvertFrom-Json)
    Assert-RuntimeFiles $runtimeRoot $runtime
    Assert-Test $true 'every required portable runtime executable is hashed'
    Write-Fixture (Join-Path $runtimeRoot 'unexpected.dll') 'unlisted library'
    Expect-Rejection { Assert-RuntimeFiles $runtimeRoot $runtime } 'unlisted DLLs cannot alter runtime dependency loading'
    [IO.File]::Delete((Join-Path $runtimeRoot 'unexpected.dll'))
    Write-Fixture (Join-Path $runtimeRoot 'php/php.exe') 'changed binary'
    Expect-Rejection { Assert-RuntimeFiles $runtimeRoot $runtime } 'altered runtime binaries are rejected'
    $runtime.files = [pscustomobject]@{ '../outside.exe' = [pscustomobject]@{ sha256 = ('a' * 64) } }
    Expect-Rejection { Assert-RuntimeFiles $runtimeRoot $runtime } 'runtime paths cannot escape their private destination'

    $configs = Get-RuntimeConfigurations 'C:\ProgramData\LightemStandalone\runtime\abc' 'C:\ProgramData\LightemStandalone' $true
    Assert-Test ($configs.Database.Contains('bind-address=127.0.0.1') -and $configs.Database.Contains('port=3307')) 'database listens on the dedicated loopback port only'
    Assert-Test ($configs.Database.Contains('init-file="C:/ProgramData/LightemStandalone/secrets/database-init.sql"')) 'new DB credentials are applied before the first network connection'
    Assert-Test (-not ((Get-RuntimeConfigurations 'C:\r' 'C:\s' $false).Database.Contains('init-file'))) 'normal server restarts never reset administrator credentials'
    Assert-Test ($configs.Apache.Contains('Listen 0.0.0.0:8080')) 'the authenticated backend remains available to LAN devices'
    Assert-Test ($configs.Apache.Contains('LightemStandalone/backend') -and $configs.Php.Contains('LightemStandalone/runtime')) 'web and PHP configuration use only Lightem-owned paths'
    Assert-Test (-not (($configs.Values -join "`n") -match '(?i)c:/xampp|manager-osx')) 'new server configuration has no XAMPP installation dependency'
    Assert-Test ($configs.Apache.Contains('Require all denied') -and $configs.Apache.Contains('(src|vendor|pos_db_backup)')) 'private backend source, configuration, and legacy DB dumps are denied over HTTP'
    Assert-Test ($configs.Apache.Contains('import_db\\.php')) 'the obsolete unauthenticated database import endpoint is blocked'
    Assert-Test ($configs.Php.Contains('curl.cainfo=') -and $configs.Php.Contains('openssl.cafile=')) 'outgoing TLS uses the bundled certificate store without XAMPP'
    Expect-Rejection { Get-RuntimeConfigurations "C:\bad`"path" 'C:\state' $false } 'unsafe configuration paths cannot inject Apache directives'
    Assert-Test ((ConvertTo-ProcessArgument 'C:\Program Files\Lightem\') -eq '"C:\Program Files\Lightem\\"') 'service command quoting preserves spaced paths and trailing backslashes'
    Assert-Test ($configs.Apache.Contains('Alias /lightem-db "C:/ProgramData/LightemStandalone/phpmyadmin"')) 'database manager code is aliased from outside the POS backend'
    $managerBlock = [regex]::Match($configs.Apache, '(?s)<Directory "[^"\r\n]+/phpmyadmin">(.*?)</Directory>').Groups[1].Value
    Assert-Test ($managerBlock.Contains('Require ip 127.0.0.1 ::1') -and $managerBlock.Contains('<RequireAll>') -and -not $managerBlock.Contains('Require local')) 'database browser permits only loopback clients, not the computer LAN address'
    $hostExpression = [regex]::Match($managerBlock, 'Require expr "%\{HTTP_HOST\} =~ m#(.+)#"').Groups[1].Value
    Assert-Test ($hostExpression -ne '' -and $hostExpression.EndsWith('$')) 'PowerShell preserves the complete anchored Apache Host expression'
    foreach ($hostName in @('localhost', 'LOCALHOST', 'localhost:80', '127.0.0.1', '127.0.0.1:8080', '[::1]', '[::1]:80')) {
        Assert-Test ([regex]::IsMatch($hostName, $hostExpression)) "local manager Host is accepted: $hostName"
    }
    foreach ($hostName in @('192.168.1.2', 'localhost.attacker.test', 'example.test', '127.0.0.2', 'localhost@attacker.test', '[::1].attacker.test')) {
        Assert-Test (-not [regex]::IsMatch($hostName, $hostExpression)) "nonlocal manager Host is denied: $hostName"
    }
    Assert-Test ($managerBlock.Contains('AllowOverride None') -and $managerBlock.Contains('Options -Indexes -Includes -ExecCGI')) 'manager distribution cannot override its HTTP restrictions'
    Assert-Test ($managerBlock.Contains('php_admin_value session.save_path "C:/ProgramData/LightemStandalone/phpmyadmin-temp"') -and $managerBlock.Contains('session.cookie_httponly On') -and $managerBlock.Contains('session.cookie_samesite Lax')) 'manager sessions use a separate private directory and protected cookies'
    Assert-Test ($managerBlock.Contains('config.*\.php') -and $managerBlock.Contains('phpmyadmin-manifest\.json')) 'manager configuration and inventory are denied over HTTP'
    $managerDeny = [regex]::Match($configs.Apache, '<DirectoryMatch "([^"\r\n]+/phpmyadmin/[^"\r\n]+)">').Groups[1].Value
    foreach ($relative in @('vendor/autoload.php', 'VENDOR/autoload.php', 'libraries/classes/Config.php', 'templates/login.twig', 'setup/index.php', 'sql/create_tables.sql', 'doc/index.html')) {
        Assert-Test ([regex]::IsMatch('C:/ProgramData/LightemStandalone/phpmyadmin/' + $relative, $managerDeny)) "manager internal path is denied: $relative"
    }
    Assert-Test (-not [regex]::IsMatch('C:/ProgramData/LightemStandalone/phpmyadmin/js/vendor/jquery/jquery.min.js', $managerDeny)) 'manager browser JavaScript dependencies remain accessible'

    $fakeService = $null
    function Get-RuntimeService([string]$Name) { return $script:fakeService }
    $expectedExe = Join-Path $temp 'owned/httpd.exe'
    $config = Join-Path $temp 'private/httpd.conf'
    Assert-Test ($null -eq (Get-OwnedService 'LightemApache' $expectedExe 'NT SERVICE\LightemApache' $config) -and $serviceSnapshots.Count -eq 0) 'a missing Windows service is accepted without a phantom ownership snapshot'
    foreach ($argument in @('C:\Program Files\Lightem\', 'plain', '', 'a"quoted"value', '--defaults-file=C:\ProgramData\Lightem\my.ini')) {
        $parsed = @(Split-ServiceCommandLine (ConvertTo-ProcessArgument $argument))
        Assert-Test ($parsed.Count -eq 1 -and $parsed[0] -ceq $argument) 'service argument parsing preserves Windows quoting exactly'
    }
    Expect-Rejection { Split-ServiceCommandLine '"unterminated.exe' } 'unmatched service command quotes fail closed'
    $fakeService = [pscustomobject]@{ PathName = ('"' + $expectedExe + '" -f "' + $config + '"'); StartName = 'NT SERVICE\LightemApache'; State = 'Running'; StartMode = 'Auto' }
    $result = Get-OwnedService 'LightemApache' $expectedExe 'NT SERVICE\LightemApache' $config
    Assert-Test ($result.State -eq 'Running' -and $serviceSnapshots.ContainsKey('LightemApache')) 'matching virtual service identity is snapshotted for rollback'
    $fakeService.StartName = 'LocalSystem'
    Expect-Rejection { Get-OwnedService 'LightemApache' $expectedExe 'NT SERVICE\LightemApache' $config } 'foreign or overprivileged service identity is not adopted'
    $fakeService.StartName = 'NT SERVICE\LightemApache'
    $fakeService.PathName = '"unrelated.exe" -f "' + $config + '"'
    Expect-Rejection { Get-OwnedService 'LightemApache' $expectedExe 'NT SERVICE\LightemApache' $config } 'an unrelated executable using the reserved service name is preserved'

    $serviceSnapshots.Clear()
    $databaseService = 'LightemDatabase'
    $apacheService = 'LightemApache'
    $databaseIdentity = 'NT SERVICE\LightemDatabase'
    $apacheIdentity = 'NT SERVICE\LightemApache'
    $mysqlPath = Join-Path $temp 'owned/mysql/mysqld.exe'
    $apachePath = $expectedExe
    $databaseConfig = Join-Path $temp 'private/my.ini'
    $apacheConfig = $config
    $databaseCommand = (ConvertTo-ProcessArgument $mysqlPath) + ' ' + (ConvertTo-ProcessArgument ('--defaults-file=' + $databaseConfig)) + ' LightemDatabase'
    $apacheCommand = (ConvertTo-ProcessArgument $apachePath) + ' -k runservice -n LightemApache -f ' + (ConvertTo-ProcessArgument $apacheConfig)
    $nativeApacheCommand = (ConvertTo-ProcessArgument $apachePath) + ' -k runservice'
    $registryReads = 0
    function New-ApacheRegistryFixture($Kind, [string[]]$Values) {
        $key = [pscustomobject]@{ Kind = $Kind; Values = $Values }
        $key | Add-Member -MemberType ScriptMethod -Name GetValueKind -Value { param($Name) return $this.Kind }
        $key | Add-Member -MemberType ScriptMethod -Name GetValue -Value { param($Name, $Default, $Options) return ,$this.Values }
        $key | Add-Member -MemberType ScriptMethod -Name Close -Value { }
        return $key
    }
    $fakeApacheRegistry = New-ApacheRegistryFixture ([Microsoft.Win32.RegistryValueKind]::MultiString) @('-f', $apacheConfig)
    function Get-ApacheServiceRegistryKey {
        $script:registryReads++
        if ($null -eq $script:fakeApacheRegistry) { throw 'Fixture missing Apache Parameters registry key' }
        return $script:fakeApacheRegistry
    }
    $fakeService = [pscustomobject]@{ PathName = $databaseCommand; StartName = 'LocalSystem'; State = 'Stopped'; StartMode = 'Manual' }
    Expect-Rejection { Get-OwnedService $databaseService $mysqlPath $databaseIdentity $databaseConfig } 'unmanaged or ready installs cannot adopt a LocalSystem service without pending proof'
    $fakeService.State = 'Running'
    Expect-Rejection { Get-OwnedService $databaseService $mysqlPath $databaseIdentity $databaseConfig -AllowPendingRegistration } 'a running LocalSystem service cannot use pending-registration recovery'
    $fakeService.State = 'Stopped'
    foreach ($badCommand in @(
        ((ConvertTo-ProcessArgument (Join-Path $temp 'foreign/mysqld.exe')) + ' "--defaults-file=' + $databaseConfig + '" LightemDatabase'),
        ($databaseCommand.Replace($databaseConfig, ($databaseConfig + '.foreign'))),
        ($databaseCommand.Replace($databaseConfig, (Join-Path $temp 'foreign/my.ini'))),
        ($databaseCommand + ' "--defaults-file=' + $databaseConfig + '"'),
        ($databaseCommand + ' --datadir=C:\unrelated-data'),
        ($databaseCommand + ' --defaults-extra-file=C:\unrelated.ini'))) {
        $fakeService.PathName = $badCommand
        Expect-Rejection { Get-OwnedService $databaseService $mysqlPath $databaseIdentity $databaseConfig -AllowPendingRegistration } 'pending recovery rejects foreign executables, ambiguous configurations and extra overrides'
    }
    $fakeService.PathName = $databaseCommand
    $fakeService.StartName = 'NT AUTHORITY\NetworkService'
    Expect-Rejection { Get-OwnedService $databaseService $mysqlPath $databaseIdentity $databaseConfig -AllowPendingRegistration } 'pending recovery accepts only the native registration LocalSystem identity'
    $fakeService.StartName = 'LocalSystem'
    $pendingService = Get-OwnedService $databaseService $mysqlPath $databaseIdentity $databaseConfig -AllowPendingRegistration
    Assert-Test ($pendingService.StartName -eq 'LocalSystem' -and $serviceSnapshots[$databaseService].PendingRegistration -and -not $serviceSnapshots[$databaseService].IdentityChanged) 'pending preflight records the interrupted registration without changing its service account'
    Assert-Test ($serviceSnapshots[$databaseService].StartName -eq 'LocalSystem' -and $serviceSnapshots[$databaseService].State -eq 'Stopped') 'pending snapshot preserves the exact original account and stopped state for rollback'

    $fakeService.StartName = $databaseIdentity
    $fakeService.PathName = $databaseCommand.Replace($databaseConfig, ($databaseConfig + '.spoof'))
    Expect-Rejection { Get-OwnedService $databaseService $mysqlPath $databaseIdentity $databaseConfig } 'ordinary owned services also reject a configuration filename suffix spoof'

    $serviceSnapshots.Clear()
    $fakeService = [pscustomobject]@{ PathName = $nativeApacheCommand; StartName = 'LocalSystem'; State = 'Stopped'; StartMode = 'Auto' }
    Expect-Rejection { Get-OwnedService $apacheService $apachePath $apacheIdentity $apacheConfig } 'native Apache registry evidence alone cannot authorize unmanaged or ready service adoption'
    $fakeApacheRegistry = $null
    Expect-Rejection { Get-OwnedService $apacheService $apachePath $apacheIdentity $apacheConfig -AllowPendingRegistration } 'native Apache recovery rejects missing registry configuration'
    $fakeApacheRegistry = New-ApacheRegistryFixture ([Microsoft.Win32.RegistryValueKind]::String) @('-f', $apacheConfig)
    Expect-Rejection { Get-OwnedService $apacheService $apachePath $apacheIdentity $apacheConfig -AllowPendingRegistration } 'native Apache recovery requires REG_MULTI_SZ rather than a string lookalike'
    foreach ($badArguments in @(@('-f', ($apacheConfig + '.foreign')), @('-f', $apacheConfig, '-D', 'injected'), @('-f'), @('-d', $apacheConfig))) {
        $fakeApacheRegistry = New-ApacheRegistryFixture ([Microsoft.Win32.RegistryValueKind]::MultiString) $badArguments
        Expect-Rejection { Get-OwnedService $apacheService $apachePath $apacheIdentity $apacheConfig -AllowPendingRegistration } 'native Apache recovery rejects wrong, incomplete or additional registry configuration arguments'
    }
    $fakeApacheRegistry = New-ApacheRegistryFixture ([Microsoft.Win32.RegistryValueKind]::MultiString) @('-f', $apacheConfig)
    $fakeService.State = 'Running'
    Expect-Rejection { Get-OwnedService $apacheService $apachePath $apacheIdentity $apacheConfig -AllowPendingRegistration } 'native Apache recovery cannot adopt a running LocalSystem service'
    $fakeService.State = 'Stopped'
    $registryReadsBefore = $registryReads
    Get-OwnedService $apacheService $apachePath $apacheIdentity $apacheConfig -AllowPendingRegistration | Out-Null
    Assert-Test ($serviceSnapshots[$apacheService].NativeApacheConfigArgs.Count -eq 2 -and $registryReads -gt $registryReadsBefore -and $fakeService.StartName -eq 'LocalSystem' -and $fakeService.PathName -ceq $nativeApacheCommand) 'native Apache preflight reads and snapshots registry proof without changing the service'
    $fakeApacheRegistry.Values[1] = $apacheConfig + '.changed'
    Expect-Rejection { Assert-ServiceRegistrationSnapshot $apacheService $fakeService } 'registry configuration changed after native Apache preflight blocks registration'
    Assert-Test (-not (Test-ServiceRecoveryOwnership $apacheService)) 'native Apache rollback preserves a service whose registry proof changed'
    $fakeApacheRegistry.Values[1] = $apacheConfig
    $serviceSnapshots[$apacheService].TargetPathName = $apacheCommand
    $fakeService.PathName = $apacheCommand
    Assert-Test (Test-ServiceRecoveryOwnership $apacheService) 'normalized Apache command retains its verified native registry evidence'
    $fakeApacheRegistry.Values[1] = $apacheConfig + '.changed'
    Assert-Test (-not (Test-ServiceRecoveryOwnership $apacheService)) 'normalizing Apache ImagePath does not bypass later registry ownership checks'
    $fakeApacheRegistry.Values[1] = $apacheConfig
    $serviceSnapshots.Clear()
    $fakeService.PathName = $nativeApacheCommand
    $fakeService.StartName = $apacheIdentity
    Get-OwnedService $apacheService $apachePath $apacheIdentity $apacheConfig -AllowPendingRegistration | Out-Null
    Assert-Test ($serviceSnapshots[$apacheService].PendingRegistration -and -not $serviceSnapshots[$apacheService].IdentityChanged) 'native Apache with an already isolated account can finish an interrupted registration'

    # Registration calls are captured; no SCM, process, ACL, registry or SQL
    # operation is executed by this test on either host platform.
    $serviceSnapshots.Clear()
    $fakeServices = @{
        LightemDatabase = [pscustomobject]@{ PathName = $databaseCommand; StartName = 'LocalSystem'; State = 'Stopped'; StartMode = 'Manual' }
        LightemApache = [pscustomobject]@{ PathName = $nativeApacheCommand; StartName = $apacheIdentity; State = 'Stopped'; StartMode = 'Auto' }
    }
    function Get-RuntimeService([string]$Name) { return $script:fakeServices[$Name] }
    Get-OwnedService $databaseService $mysqlPath $databaseIdentity $databaseConfig -AllowPendingRegistration | Out-Null
    Get-OwnedService $apacheService $apachePath $apacheIdentity $apacheConfig -AllowPendingRegistration | Out-Null
    $registrationCalls = New-Object System.Collections.Generic.List[object]
    $createdServices = New-Object System.Collections.Generic.List[string]
    $failIdentityChange = $false
    $ignoreIdentityChange = $false
    $failPathChange = $false
    $savedSystemRoot = $env:SystemRoot
    $env:SystemRoot = Join-Path $temp 'Windows'
    function Invoke-CheckedProcess {
        param([string]$File, [string[]]$Arguments, [string]$Label, [int]$TimeoutSeconds = 180)
        $script:registrationCalls.Add([pscustomobject]@{ File = $File; Arguments = $Arguments; Label = $Label })
        if ($Arguments[0] -eq '--install-manual') {
            $script:fakeServices[$databaseService] = [pscustomobject]@{ PathName = $databaseCommand; StartName = 'LocalSystem'; State = 'Stopped'; StartMode = 'Manual' }
        } elseif ($Arguments[0] -eq '-k' -and $Arguments[1] -eq 'install') {
            $script:fakeServices[$apacheService] = [pscustomobject]@{ PathName = $nativeApacheCommand; StartName = 'LocalSystem'; State = 'Stopped'; StartMode = 'Manual' }
            $script:fakeApacheRegistry = New-ApacheRegistryFixture ([Microsoft.Win32.RegistryValueKind]::MultiString) @('-f', $apacheConfig)
        } elseif ($Arguments[0] -eq 'config' -and $Arguments[2] -eq 'obj=') {
            if ($Arguments[3].StartsWith('NT SERVICE\', [StringComparison]::OrdinalIgnoreCase) -and
                ($Arguments.Count -ne 4 -or $Arguments -contains 'password=' -or $Arguments -contains '')) {
                throw 'Fixture SCM rejects a non-NULL virtual service password (1057)'
            }
            if (-not $script:ignoreIdentityChange) { $script:fakeServices[$Arguments[1]].StartName = $Arguments[3] }
            if ($script:failIdentityChange) { throw 'Fixture interruption during service account configuration' }
        } elseif ($Arguments[0] -eq 'config' -and $Arguments[2] -eq 'binPath=') {
            if ($script:serviceSnapshots.ContainsKey($Arguments[1]) -and
                $script:serviceSnapshots[$Arguments[1]].TargetPathName -cne $Arguments[3]) {
                throw 'Target service command was not recorded before SCM mutation'
            }
            $script:fakeServices[$Arguments[1]].PathName = $Arguments[3]
            if ($script:failPathChange) { throw 'Fixture interruption during service command configuration' }
        }
        return ''
    }
    function Set-Service { param([string]$Name, [string]$StartupType)
        $script:registrationCalls.Add([pscustomobject]@{ File = 'Set-Service'; Arguments = @($Name, $StartupType); Label = 'Fixture startup type' })
    }
    try {
        Expect-Rejection { Set-VirtualServiceIdentity 'UnrelatedService' 'Unexpected account fixture' } 'virtual account helper rejects unrelated service names without calling SCM'
        Assert-Test ($registrationCalls.Count -eq 0) 'virtual account validation never falls back to a system account'
        Assert-Test (Test-ServiceRecoveryOwnership $databaseService) 'recovery accepts the original pending service command and account'
        Assert-Test (Test-ServiceRecoveryOwnership $apacheService) 'recovery accepts the original private service command and account'
        Assert-Test (-not (Test-ServiceRecoveryOwnership 'UnrelatedService')) 'recovery never grants ownership of another Windows service name'
        $fakeServices[$databaseService].PathName += ' --datadir=C:\foreign'
        Expect-Rejection { Initialize-ServiceRegistration } 'a service command changed after preflight is rejected before any registration writes'
        Assert-Test (-not (Test-ServiceRecoveryOwnership $databaseService)) 'rollback cannot stop or overwrite a foreign service command rejected by preflight revalidation'
        Assert-Test ($registrationCalls.Count -eq 0) 'rejected service race produces no SCM mutations'
        $fakeServices[$databaseService].PathName = $databaseCommand
        $fakeServices[$databaseService].State = 'Running'
        Expect-Rejection { Initialize-ServiceRegistration } 'a pending service started after preflight is never reconfigured'
        $fakeServices[$databaseService].State = 'Stopped'
        $fakeServices[$databaseService].StartName = 'NT AUTHORITY\NetworkService'
        Expect-Rejection { Initialize-ServiceRegistration } 'a service account changed after preflight is never reconfigured'
        Assert-Test (-not (Test-ServiceRecoveryOwnership $databaseService)) 'rollback cannot stop or overwrite a changed foreign service account'
        $fakeServices[$databaseService].StartName = $databaseIdentity
        Assert-Test (-not (Test-ServiceRecoveryOwnership $databaseService)) 'an unrecorded account change is not attributed to this installer'
        $fakeServices[$databaseService].StartName = 'LocalSystem'
        $targetCommand = $databaseCommand.Replace('owned', 'updated-runtime')
        $fakeServices[$databaseService].PathName = $targetCommand
        Assert-Test (-not (Test-ServiceRecoveryOwnership $databaseService)) 'an unrecorded command change cannot be restored from a stale snapshot'
        $serviceSnapshots[$databaseService].TargetPathName = $targetCommand
        Assert-Test (Test-ServiceRecoveryOwnership $databaseService) 'recovery accepts only the explicitly recorded target command for this run'
        $fakeServices[$databaseService].PathName += ' --datadir=C:\foreign'
        Assert-Test (-not (Test-ServiceRecoveryOwnership $databaseService)) 'a suffix added to the recorded target command remains foreign'
        $fakeServices[$databaseService].PathName = $databaseCommand
        $serviceSnapshots[$databaseService].Remove('TargetPathName')
        $savedService = $fakeServices[$apacheService]
        $fakeServices.Remove($apacheService)
        Expect-Rejection { Initialize-ServiceRegistration } 'a service removed after preflight is not silently recreated'
        Assert-Test (-not (Test-ServiceRecoveryOwnership $apacheService)) 'recovery leaves a service that disappeared after preflight untouched'
        $fakeServices[$apacheService] = $savedService
        Initialize-ServiceRegistration
        Assert-Test ($fakeServices[$databaseService].StartName -eq $databaseIdentity -and $serviceSnapshots[$databaseService].IdentityChanged) 'full installation finishes the proven pending private database account assignment'
        $pendingIdentityCalls = @($registrationCalls | Where-Object { $_.Arguments.Count -gt 2 -and $_.Arguments[0] -eq 'config' -and $_.Arguments[2] -eq 'obj=' })
        Assert-Test ($pendingIdentityCalls.Count -eq 1 -and $pendingIdentityCalls[0].Arguments.Count -eq 4 -and $pendingIdentityCalls[0].Arguments[3] -ceq $databaseIdentity -and -not ($pendingIdentityCalls[0].Arguments -contains 'password=')) 'pending database recovery omits the password argument required to preserve the NULL virtual-account password'
        Assert-Test (Test-ServiceRecoveryOwnership $databaseService) 'recovery accepts this run recorded private identity and target command'
        Assert-Test ($serviceSnapshots[$databaseService].TargetPathName -ceq $databaseCommand -and $serviceSnapshots[$apacheService].TargetPathName -ceq $apacheCommand) 'service target commands are tracked before changing their SCM configuration'
        Assert-Test (-not $serviceSnapshots[$apacheService].IdentityChanged -and $createdServices.Count -eq 0) 'pending repair preserves existing private accounts and does not recreate either service'
        Assert-Test (@($registrationCalls | Where-Object { $_.Arguments -contains '--install-manual' -or $_.Arguments -contains 'install' }).Count -eq 0) 'resuming service registration does not call native service creation again'

        $registrationCalls.Clear()
        $fakeServices[$databaseService].StartName = 'LocalSystem'
        $fakeServices[$apacheService].PathName = $nativeApacheCommand
        $serviceSnapshots[$databaseService].IdentityChanged = $false
        $failIdentityChange = $true
        Expect-Rejection { Initialize-ServiceRegistration } 'an interrupted pending identity change reports failure'
        Assert-Test ($serviceSnapshots[$databaseService].IdentityChanged -and $serviceSnapshots[$databaseService].StartName -eq 'LocalSystem') 'rollback evidence is recorded before an identity-changing command can fail'
        Assert-Test (Test-ServiceRecoveryOwnership $databaseService) 'recovery recognizes an identity change even when its SCM command subsequently fails'
        $failIdentityChange = $false
        $fakeServices[$databaseService].StartName = 'LocalSystem'
        $ignoreIdentityChange = $true
        Expect-Rejection { Initialize-ServiceRegistration } 'SCM success without the private service account is rejected before service startup'
        $ignoreIdentityChange = $false
        $failPathChange = $true
        Expect-Rejection { Initialize-ServiceRegistration } 'an interrupted service command change reports failure'
        Assert-Test (Test-ServiceRecoveryOwnership $databaseService) 'recovery recognizes its recorded target command after an interrupted SCM update'
        $failPathChange = $false

        $registrationCalls.Clear()
        $serviceSnapshots.Clear()
        Expect-Rejection { Initialize-ServiceRegistration } 'a named service absent from preflight snapshots cannot be adopted during registration'
        Assert-Test (-not (Test-ServiceRecoveryOwnership $databaseService)) 'a service neither snapshotted nor created by this run has no recovery permission'
        Assert-Test ($registrationCalls.Count -eq 0) 'an unexpected existing service causes no service writes'
        $fakeServices.Clear()
        Initialize-ServiceRegistration
        Assert-Test ($createdServices.Count -eq 2 -and $fakeServices[$databaseService].StartName -eq $databaseIdentity -and $fakeServices[$apacheService].StartName -eq $apacheIdentity) 'fresh installation still registers both native services under their dedicated identities'
        $freshIdentityCalls = @($registrationCalls | Where-Object { $_.Arguments.Count -gt 2 -and $_.Arguments[0] -eq 'config' -and $_.Arguments[2] -eq 'obj=' })
        Assert-Test ($freshIdentityCalls.Count -eq 2 -and @($freshIdentityCalls | Where-Object { $_.Arguments.Count -ne 4 -or $_.Arguments -contains 'password=' -or $_.Arguments -contains '' }).Count -eq 0 -and
            $freshIdentityCalls[0].Arguments[3] -ceq $databaseIdentity -and $freshIdentityCalls[1].Arguments[3] -ceq $apacheIdentity) 'fresh database and Apache account assignments omit passwords and preserve their exact private identities'
        Assert-Test ((Test-ServiceRecoveryOwnership $databaseService) -and (Test-ServiceRecoveryOwnership $apacheService)) 'newly created services require their exact configured runtime and private account for recovery'
        $fakeServices[$apacheService].PathName = $nativeApacheCommand
        $fakeServices[$apacheService].StartName = 'LocalSystem'
        Assert-Test (Test-ServiceRecoveryOwnership $apacheService) 'cleanup recognizes actual newly registered native Apache ImagePath with its registry arguments'
        $fakeApacheRegistry.Values[1] = $apacheConfig + '.foreign'
        Assert-Test (-not (Test-ServiceRecoveryOwnership $apacheService)) 'new native Apache cleanup rejects replaced registry configuration'
        $fakeApacheRegistry.Values[1] = $apacheConfig
        $fakeServices[$databaseService].StartName = 'LocalSystem'
        Assert-Test (Test-ServiceRecoveryOwnership $databaseService) 'new service recovery recognizes the native LocalSystem registration window'
        $fakeServices[$databaseService].PathName = $databaseCommand.Replace($databaseConfig, ($databaseConfig + '.foreign'))
        Assert-Test (-not (Test-ServiceRecoveryOwnership $databaseService)) 'new service recovery rejects a config filename suffix spoof'
        $fakeServices[$databaseService].PathName = $databaseCommand.Replace($mysqlPath, (Join-Path $temp 'foreign/mysqld.exe'))
        Assert-Test (-not (Test-ServiceRecoveryOwnership $databaseService)) 'new service recovery rejects a replaced executable despite the same service name'
        $fakeServices[$databaseService].PathName = $databaseCommand
        $fakeServices[$databaseService].StartName = 'NT AUTHORITY\NetworkService'
        Assert-Test (-not (Test-ServiceRecoveryOwnership $databaseService)) 'new service recovery rejects a replaced service account'

        # Execute the production shutdown helper and actual catch recovery loop
        # with stale snapshots. Captured mocks prove rejection does not become
        # an unsafe service write during cleanup of the original exception.
        $serviceSnapshots.Clear()
        $createdServices.Clear()
        $fakeServices[$databaseService] = [pscustomobject]@{ PathName = $databaseCommand; StartName = $databaseIdentity; State = 'Running'; StartMode = 'Auto' }
        $fakeServices[$apacheService] = [pscustomobject]@{ PathName = $apacheCommand; StartName = $apacheIdentity; State = 'Running'; StartMode = 'Auto' }
        Get-OwnedService $databaseService $mysqlPath $databaseIdentity $databaseConfig | Out-Null
        Get-OwnedService $apacheService $apachePath $apacheIdentity $apacheConfig | Out-Null
        $fakeServices[$databaseService].PathName = $databaseCommand.Replace($mysqlPath, (Join-Path $temp 'foreign/mysqld.exe'))
        $fakeServices[$apacheService].StartName = 'NT AUTHORITY\NetworkService'
        $stopCalls = New-Object System.Collections.Generic.List[string]
        $recoveryMessages = New-Object System.Collections.Generic.List[string]
        function Get-Service { param([string]$Name, [string]$ErrorAction)
            return [pscustomobject]@{ Status = $script:fakeServices[$Name].State }
        }
        function Stop-Service { param([string]$Name, [string]$ErrorAction) $script:stopCalls.Add($Name) }
        function Start-Service { param([string]$Name)
            $script:registrationCalls.Add([pscustomobject]@{ File = 'Start-Service'; Arguments = @($Name); Label = 'Fixture service start' })
        }
        function Write-SetupLog([string]$Message) { $script:recoveryMessages.Add($Message) }
        Expect-Rejection { Stop-OwnedService $databaseService } 'production shutdown refuses a service whose executable changed after preflight'
        Assert-Test ($stopCalls.Count -eq 0) 'production shutdown does not call Stop-Service for a rejected foreign service'
        $recoveryLoops = @($tree.FindAll({ param($node)
            $node -is [System.Management.Automation.Language.ForEachStatementAst] -and
                $node.Extent.Text.Contains("'Restoring service runtime'")
        }, $true))
        if ($recoveryLoops.Count -ne 1) { throw 'Cannot uniquely locate the production service rollback loop.' }
        $registrationCalls.Clear()
        & ([scriptblock]::Create($recoveryLoops[0].Extent.Text))
        Assert-Test ($registrationCalls.Count -eq 0 -and $stopCalls.Count -eq 0 -and $recoveryMessages.Count -eq 2) 'actual catch recovery preserves changed service commands/accounts without SCM writes or restart'
    } finally { $env:SystemRoot = $savedSystemRoot }

    $listeners = @([pscustomobject]@{ LocalPort = 3307; LocalAddress = '127.0.0.1'; OwningProcess = 91 })
    $processInfo = [pscustomobject]@{ ExecutablePath = $expectedExe }
    function Get-NetTCPConnection { param($State, $ErrorAction) return $script:listeners }
    function Get-CimInstance { param($ClassName, $Filter) return $script:processInfo }
    Assert-ListenerOwners 3307 @($expectedExe)
    Assert-Test $true 'the expected private loopback listener is accepted'
    $listeners[0].LocalAddress = '0.0.0.0'
    Expect-Rejection { Assert-ListenerOwners 3307 @($expectedExe) } 'database LAN exposure blocks installation'
    $listeners[0].LocalAddress = '127.0.0.1'
    $processInfo.ExecutablePath = 'another-server.exe'
    Expect-Rejection { Assert-ListenerOwners 3307 @($expectedExe) } 'unrelated programs occupying the DB port are not stopped'

    # Extracted installer functions operate only inside this disposable fixture.
    # ACL and PHP invocations are observed rather than touching Windows services.
    $PayloadRoot = Join-Path $temp 'manager-payload'
    $databaseManagerRoot = Join-Path $temp 'manager-installed'
    $databaseManagerTemp = Join-Path $temp 'manager-temp'
    $databaseManagerSecret = Join-Path $temp 'private/phpmyadmin-cookie.txt'
    $backupRoot = Join-Path $temp 'manager-backup'
    $apacheIdentity = 'NT SERVICE\LightemApache'
    $backupMade = $true
    $databaseManagerChanged = $false
    $managerCalls = New-Object System.Collections.Generic.List[object]
    $aclCalls = New-Object System.Collections.Generic.List[object]
    $rejectManagerPayload = $false
    Write-Fixture (Join-Path $PayloadRoot 'phpmyadmin/index.php') 'new manager code'
    Write-Fixture (Join-Path $databaseManagerRoot 'index.php') 'old manager code'
    Write-Fixture (Join-Path $databaseManagerRoot 'removed.php') 'obsolete old code'
    Write-Fixture $databaseManagerSecret 'persistent private cookie key'
    Write-Fixture (Join-Path $backupRoot 'phpmyadmin/index.php') 'old manager code'
    Write-Fixture (Join-Path $backupRoot 'phpmyadmin/config.inc.php') 'old cookie config'
    [IO.Directory]::CreateDirectory($databaseManagerTemp) | Out-Null
    function Invoke-LightemPhp([string[]]$Arguments, [string]$Label, [int]$TimeoutSeconds = 180) {
        $script:managerCalls.Add([pscustomobject]@{ Arguments = $Arguments; Label = $Label })
        if ($Arguments[0].EndsWith('verify-phpmyadmin.php')) {
            if ($script:rejectManagerPayload) { throw 'Fixture manager inventory rejection' }
        } elseif ($Arguments[0].EndsWith('phpmyadmin-config.php')) {
            Write-Fixture (Join-Path $databaseManagerRoot 'config.inc.php') 'generated private cookie config'
        } else { throw 'Unexpected PHP command in manager-only installation' }
    }
    function Set-PrivateAcl {
        param([string]$Path, [switch]$Directory, [string]$ReadIdentity = '', [string[]]$ReadIdentities = @(), [string[]]$ModifyIdentities = @())
        $script:aclCalls.Add([pscustomobject]@{ Path = $Path; Directory = $Directory; ReadIdentity = $ReadIdentity; ModifyIdentities = $ModifyIdentities })
    }
    $rejectManagerPayload = $true
    Expect-Rejection { Install-DatabaseManager $manifest } 'invalid manager inventory fails before replacing installed code'
    Assert-Test (([IO.File]::ReadAllText((Join-Path $databaseManagerRoot 'index.php'))) -eq 'old manager code') 'failed manager verification leaves the old code intact'
    $rejectManagerPayload = $false
    $managerCalls.Clear()
    Install-DatabaseManager $manifest
    Assert-Test ($managerCalls.Count -eq 2 -and $managerCalls[0].Arguments[0].EndsWith('verify-phpmyadmin.php') -and $managerCalls[1].Arguments[0].EndsWith('phpmyadmin-config.php')) 'clean manager verification precedes per-device configuration'
    Assert-Test (($managerCalls[0].Arguments -contains $manifest.phpMyAdminSha256) -and ($managerCalls[0].Arguments -contains $manifest.phpMyAdminVersion)) 'manager verification uses the release-pinned version and digest'
    Assert-Test (($managerCalls[1].Arguments -contains $databaseManagerTemp) -and ($managerCalls[1].Arguments -contains $databaseManagerSecret)) 'shared configuration helper receives the private manager temp and persistent key paths'
    Assert-Test (([IO.File]::ReadAllText((Join-Path $databaseManagerRoot 'index.php'))) -eq 'new manager code' -and -not (Test-Path -LiteralPath (Join-Path $databaseManagerRoot 'removed.php'))) 'manager update replaces code cleanly without stale executable files'
    Assert-Test ([IO.File]::ReadAllText($databaseManagerSecret) -eq 'persistent private cookie key') 'manager update never replaces the existing cookie secret'
    $secretAcl = @($aclCalls | Where-Object { $_.Path -eq $databaseManagerSecret })
    Assert-Test ($secretAcl.Count -gt 0 -and $secretAcl[0].ReadIdentity -eq '' -and $secretAcl[0].ModifyIdentities.Count -eq 0) 'source cookie key remains administrator-only'
    $codeAcl = @($aclCalls | Where-Object { $_.Path -eq $databaseManagerRoot })
    Assert-Test ($codeAcl.Count -gt 0 -and $codeAcl[0].ReadIdentity -eq $apacheIdentity -and $codeAcl[0].ModifyIdentities.Count -eq 0) 'Apache receives read-only manager code access'
    Restore-DatabaseManager
    Assert-Test ([IO.File]::ReadAllText((Join-Path $databaseManagerRoot 'index.php')) -eq 'old manager code' -and [IO.File]::ReadAllText((Join-Path $databaseManagerRoot 'config.inc.php')) -eq 'old cookie config') 'rollback restores the previous manager code and configuration together'
    [IO.Directory]::Delete((Join-Path $backupRoot 'phpmyadmin'), $true)
    Restore-DatabaseManager
    Assert-Test (-not (Test-Path -LiteralPath $databaseManagerRoot) -and [IO.File]::ReadAllText($databaseManagerSecret) -eq 'persistent private cookie key') 'rollback removes a newly introduced manager while preserving its private key'
    $managerHtml = '<input name="pma_username"><input name="pma_password">'
    function Invoke-WebRequest { param([switch]$UseBasicParsing, $Uri, $TimeoutSec)
        if ($Uri -ne 'http://127.0.0.1:8080/lightem-db/') { throw 'Unexpected manager probe URL' }
        return [pscustomobject]@{ StatusCode = 200; Content = $script:managerHtml }
    }
    Test-DatabaseManagerHttp
    Assert-Test $true 'manager health probe requires the localhost credential login form'
    $managerHtml = 'unrelated app page'
    Expect-Rejection { Test-DatabaseManagerHttp } 'an HTTP 200 response without the manager login form fails installation'

    $text = [IO.File]::ReadAllText($source)
    Assert-Test ($text.Contains("'backend', 'config', 'phpmyadmin', 'standalone-runtime.json'") -and $text.Contains('Restore-DatabaseManager')) 'manager backup and rollback are integrated with standalone recovery'
    Assert-Test ($text.Contains('-RemoteAddress LocalSubnet -Profile Private,Domain') -and -not $text.Contains('-LocalPort 3307')) 'only the API receives a local-network firewall exception'
    $nsis = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../windows/installer-standalone.nsh'))
    Assert-Test ($nsis.Contains('install-standalone.ps1') -and $nsis.Contains('runtime-manifest.json') -and $nsis.Contains('-CheckOnly')) 'separate NSIS build preserves the before-desktop preflight workflow'
    Assert-Test ($nsis.Contains('LightemStandalone\Installer') -and -not $nsis.Contains('windows\install.ps1"')) 'standalone NSIS logs and source script are distinct from the legacy installer'
    Assert-Test ($nsis.Contains('${PROJECT_DIR}\installer\stage\standalone\win32-x64\setup')) 'NSIS preflight reads the standalone build stage used by build.cjs'
    Write-Output "Completed $count standalone Windows checks without changing services, ACLs, or databases."
} finally {
    [IO.Directory]::Delete($temp, $true)
}
