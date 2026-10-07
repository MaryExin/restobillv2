# Pure functions and mocked inventory only. Never execute the installer body,
# start services, or change ACLs/databases when running this fixture.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$source = Join-Path $PSScriptRoot '../windows/install-standalone.ps1'
$tokens = $null; $parseErrors = $null
$tree = [Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
foreach ($name in @('Get-StandaloneHttpPort', 'Get-InstallationKind', 'Get-RuntimeConfigurations',
    'Get-DesktopEndpointConfiguration', 'Set-DesktopLocalEndpoint', 'Write-Utf8File',
    'Assert-StandaloneServersStopped', 'Assert-StandaloneDesktopDestination', 'Assert-ListenerOwners', 'Test-HttpRuntime',
    'Test-DatabaseManagerHttp', 'Set-LanFirewallRule', 'Save-RuntimeState', 'Test-PendingServiceRecovery',
    'Get-XamppCopyMode', 'Assert-XamppDatabaseRunning', 'Assert-BackendComplete',
    'Test-XamppCopySource', 'Get-XamppSourceCheckArguments', 'Test-XamppSourceConfiguration', 'Invoke-BundledPhp', 'Copy-XamppMedia')) {
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
function Expect-Rejection([scriptblock]$Action, [string]$Description) {
    $rejected = $false
    try { & $Action | Out-Null } catch { $rejected = $true }
    Assert-Test $rejected $Description
}
$tempBase = [IO.Path]::GetTempPath()
if ([IO.Directory]::Exists('/private/tmp')) { $tempBase = '/private/tmp' }
$temp = Join-Path $tempBase ('lightem-coexistence-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
$checkedPaths = New-Object 'System.Collections.Generic.List[string]'
function Assert-NoReparsePoint([string]$Path, [switch]$Recurse) { $script:checkedPaths.Add($Path) }
function Set-PrivateAcl([string]$Path, [switch]$Directory) {}
function Assert-PrivateRecoveryPath([string]$Path) {}
function Assert-RuntimeFiles([string]$Root, $Manifest) {}
$installerId = 'com.lenard.restobill.setup'
$databasePort = 3307
$httpPort = 8080
$copyExistingStore = $false
$runtimeState = $null
$lightemRoot = Join-Path $temp 'standalone'
$runtimeRoot = Join-Path $lightemRoot 'runtime/pinned'
$configRoot = Join-Path $lightemRoot 'config'
$runtimeStatePath = Join-Path $lightemRoot 'standalone-runtime.json'
$apacheConfig = Join-Path $configRoot 'httpd.conf'
$databaseConfig = Join-Path $configRoot 'my.ini'
$PayloadRoot = Join-Path $temp 'payload'
$AppRoot = Join-Path $temp 'app'
$documentRoot = Join-Path $lightemRoot 'backend'
$dataRoot = Join-Path $lightemRoot 'data'
$legacyWebRoot = Join-Path $temp 'xampp/htdocs'
$xamppRoot = Join-Path $temp 'xampp'
$xamppWebRoot = $legacyWebRoot
$hash = 'a' * 64
foreach ($path in @($runtimeRoot, $configRoot, $PayloadRoot, $documentRoot, $dataRoot, $legacyWebRoot, (Join-Path $AppRoot 'resources'))) {
    [IO.Directory]::CreateDirectory($path) | Out-Null
}
try {
    Assert-Test ((Get-StandaloneHttpPort) -eq 8080) 'new standalone installations use the independent HTTP port'
    foreach ($port in @(80, 8080)) {
        Assert-Test ((Get-StandaloneHttpPort ([pscustomobject]@{httpPort=$port})) -eq $port) 'existing supported HTTP port is preserved'
        $config = Get-RuntimeConfigurations 'C:\runtime' 'C:\state' $false $port
        Assert-Test ($config.Apache.Contains("Listen 0.0.0.0:$port`n") -and $config.Apache.Contains("ServerName localhost:$port")) 'Apache listens on the selected LAN API port'
        Assert-Test ($config.Database.Contains('port=3307') -and $config.Database.Contains('bind-address=127.0.0.1')) 'HTTP selection does not change private database port or binding'
        Assert-Test ($config.Apache.Contains('Alias /lightem-db "C:/state/phpmyadmin"') -and -not $config.Apache.Contains('Alias /phpmyadmin ')) 'database manager uses a separate URL path for browser cookie isolation'
        Assert-Test ($config.Apache.Contains('RedirectMatch 302 "^/phpmyadmin(/.*)?$" "/lightem-db$1"') -and $config.Apache.Contains('RedirectMatch 302 "^/lightem-db$" "/lightem-db/"')) 'old private-port bookmarks redirect to canonical manager route with trailing slash'
        Assert-Test ($config.Apache.Contains('Require ip 127.0.0.1 ::1') -and $config.Apache.Contains('Require expr "%{HTTP_HOST}') -and $config.Apache.Contains('<Directory "C:/state/phpmyadmin">')) 'new manager URL retains loopback and hostname access controls on the private files'
    }
    foreach ($value in @($null, '8080', 0, 1, 443, 3306, 3307, 8081, 65536, 80.1, $true)) {
        Expect-Rejection { Get-StandaloneHttpPort ([pscustomobject]@{httpPort=$value}) } 'malformed or unsupported stored port is rejected'
    }
    Expect-Rejection { Get-StandaloneHttpPort ([pscustomobject]@{}) } 'missing stored HTTP port cannot be silently changed'

    [IO.File]::WriteAllText((Join-Path $legacyWebRoot '.env'), 'unrelated XAMPP app settings')
    [IO.File]::WriteAllText((Join-Path $temp 'xampp/php.ini'), ';extension=gd')
    $checkedPaths.Clear()
    Assert-Test ((Get-InstallationKind $runtimeStatePath $documentRoot $dataRoot $legacyWebRoot) -eq 'Fresh') 'incomplete unrelated XAMPP with GD disabled does not cause migration'
    Assert-Test (-not $checkedPaths.Contains($legacyWebRoot)) 'independent source selection does not inspect or require XAMPP paths'
    Assert-Test ([IO.File]::ReadAllText((Join-Path $temp 'xampp/php.ini')) -ceq ';extension=gd') 'existing XAMPP PHP configuration stays unchanged'
    [IO.File]::WriteAllText((Join-Path $dataRoot 'existing-sales.ibd'), 'existing')
    Expect-Rejection { Get-InstallationKind $runtimeStatePath $documentRoot $dataRoot $legacyWebRoot } 'unmarked private database files remain protected'
    Remove-Item -LiteralPath (Join-Path $dataRoot 'existing-sales.ibd')
    $state = [pscustomobject]@{installerId=$installerId;runtimeKind='standalone';formatVersion=1;status='ready';databasePort=3307;httpPort=80;buildId='20260928000000';sourceKind='legacy';runtimeRoot=$runtimeRoot;runtimeManifestSha256=$hash}
    foreach ($status in @('ready', 'initializing')) {
        $state.status = $status; $state.sourceKind = 'fresh'
        foreach ($port in @(80,8080)) {
            $state.httpPort = $port
            [IO.File]::WriteAllText($runtimeStatePath, ($state | ConvertTo-Json))
            Assert-Test ((Get-InstallationKind $runtimeStatePath $documentRoot $dataRoot $legacyWebRoot) -eq 'Standalone') 'ready and interrupted private installs keep their supported port and data'
        }
    }
    $state.sourceKind = 'legacy'
    [IO.File]::WriteAllText($runtimeStatePath, ($state | ConvertTo-Json))
    Assert-Test ((Get-InstallationKind $runtimeStatePath $documentRoot $dataRoot $legacyWebRoot) -eq 'Standalone') 'unfinished migration remains an owned standalone installation'

    # Execute the production preflight branch with only source access mocked.
    # No source database is listening, and the fixture's GD remains disabled.
    $sourcePreflightNodes = @($tree.FindAll({ param($node)
        $node -is [Management.Automation.Language.IfStatementAst] -and
        $node.Clauses[0].Item1.Extent.Text -ceq '$copyExistingStore' -and
        $node.Extent.Text.Contains('Test-XamppCopySource $manifest $runtimeManifest')
    }, $true))
    Assert-Test ($sourcePreflightNodes.Count -eq 1) 'fixture identifies the actual optional source preflight branch'
    $sourcePreflight = [scriptblock]::Create($sourcePreflightNodes[0].Extent.Text)
    $sourceCheckDefinition = $tree.Find({ param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-XamppCopySource'
    }, $false)
    $sourceAccessCalls = 0
    function Write-SetupLog([string]$Message) {}
    function Test-XamppCopySource($Manifest, $RuntimeManifest) {
        $script:sourceAccessCalls++
        throw 'Unexpected XAMPP source access in a default-off installation.'
    }
    $managed = $false; $runtimeState = $null; $manifest = @{}; $runtimeManifest = @{}
    $copyExistingStore = Get-XamppCopyMode 'Fresh' $null $false
    & $sourcePreflight
    Assert-Test ($sourceAccessCalls -eq 0) 'default-off fresh setup skips source preflight with XAMPP stopped and GD disabled'
    Assert-Test ([IO.File]::ReadAllText((Join-Path $temp 'xampp/php.ini')) -ceq ';extension=gd') 'default-off preflight leaves XAMPP PHP configuration untouched'
    foreach ($sourceKind in @('legacy', 'xampp-copy')) {
        $state.sourceKind = $sourceKind
        $beforeState = $state | ConvertTo-Json -Compress
        $beforeMarker = [IO.File]::ReadAllText($runtimeStatePath)
        $message = ''
        try {
            $copyExistingStore = Get-XamppCopyMode 'Standalone' $state $false
            & $sourcePreflight
        } catch { $message = $_.Exception.Message }
        Assert-Test ($message.Contains('Select Copy data from XAMPP') -and $message.Contains('preserved')) "unfinished $sourceKind copy requires explicit opt-in with recovery guidance"
        Assert-Test ($sourceAccessCalls -eq 0) "unfinished $sourceKind copy is rejected before source preflight"
        Assert-Test (($state | ConvertTo-Json -Compress) -ceq $beforeState -and [IO.File]::ReadAllText($runtimeStatePath) -ceq $beforeMarker) "default-off $sourceKind retry preserves its existing state and marker"
        Assert-Test (Get-XamppCopyMode 'Standalone' $state $true) "explicit opt-in resumes an unfinished $sourceKind copy"
    }
    . ([scriptblock]::Create($sourceCheckDefinition.Extent.Text))
    $copyExistingStore = $false
    $state.sourceKind = 'fresh'
    Assert-Test (-not (Get-XamppCopyMode 'Standalone' $state $true)) 'interrupted empty store cannot switch to overwriting from XAMPP'
    $state.sourceKind = 'unexpected'
    Expect-Rejection { Get-XamppCopyMode 'Standalone' $state $true } 'unknown interrupted data choice is rejected'
    $state.sourceKind = 'legacy'
    $state.status = 'ready'
    [IO.File]::WriteAllText($runtimeStatePath, ($state | ConvertTo-Json))
    Assert-Test ((Get-InstallationKind $runtimeStatePath $documentRoot $dataRoot $legacyWebRoot) -eq 'Standalone') 'completed migrated standalone remains updateable'
    Assert-Test (-not (Get-XamppCopyMode 'Standalone' $state $true)) 'existing ready standalone takes priority over a new copy request'
    Assert-Test (Get-XamppCopyMode 'Fresh' $null $true) 'explicit copy option selects source copying for a fresh destination'
    Assert-Test (-not (Get-XamppCopyMode 'Fresh' $null $false)) 'new empty store remains available when copy option is absent'
    $state.status = 'initializing'; $state.sourceKind = 'fresh'
    $state.httpPort = 80; $httpPort = 8080
    Assert-Test (-not (Test-PendingServiceRecovery $state @{} $hash)) 'pending service recovery rejects a different selected HTTP port'
    $state.httpPort = 8080
    Assert-Test (Test-PendingServiceRecovery $state @{} $hash) 'pending service recovery retains matching supported port with ownership checks'
    $state.httpPort = 3306
    Assert-Test (-not (Test-PendingServiceRecovery $state @{} $hash)) 'pending service recovery rejects an unsupported HTTP port'

    $mapped = "LOCAL: http://localhost`r`nWEB: https://store.example`r`nTENANT: STORE`r`n"
    Assert-Test ((Get-DesktopEndpointConfiguration $mapped 8080) -ceq $mapped.Replace('http://localhost', 'http://localhost:8080')) 'local endpoint changes while WEB and TENANT settings are preserved'
    Assert-Test ((Get-DesktopEndpointConfiguration $mapped.Replace('http://localhost', 'http://localhost:8080') 80) -ceq $mapped) 'updating existing port80 standalone restores its port80 endpoint'
    foreach ($endpoint in @('http://192.168.1.25', 'https://store.example', 'http://localhost:9090', 'http://localhost/custom', 'http://localhost?store=2')) {
        $config = "LOCAL: $endpoint`nWEB: keep`nTENANT: keep`n"
        Assert-Test ((Get-DesktopEndpointConfiguration $config 8080) -ceq $config) 'intentional remote or custom desktop endpoint is preserved'
    }
    foreach ($endpoint in @('http://localhost', 'http://127.0.0.1:80', 'http://[::1]:8080')) {
        Assert-Test ((Get-DesktopEndpointConfiguration $endpoint 8080).StartsWith('LOCAL: http://localhost:8080')) 'legacy bare loopback endpoint acquires the selected private port'
    }
    Assert-Test ((Get-DesktopEndpointConfiguration "WEB: https://web.example`nTENANT: X`n" 8080).StartsWith("LOCAL: http://localhost:8080`nWEB:")) 'missing local entry can be added without losing other settings'
    Expect-Rejection { Get-DesktopEndpointConfiguration "LOCAL: http://localhost`nLOCAL: http://192.168.1.25" 8080 } 'ambiguous duplicate local entries are rejected'
    [IO.File]::WriteAllText((Join-Path $AppRoot 'resources/ip.txt'), $mapped)
    Set-DesktopLocalEndpoint
    Assert-Test ([IO.File]::ReadAllText((Join-Path $AppRoot 'resources/ip.txt')) -ceq $mapped.Replace('http://localhost', 'http://localhost:8080')) 'installed editable endpoint uses selected port after settings restoration'

    $listeners = @([pscustomobject]@{LocalPort=80}, [pscustomobject]@{LocalPort=3306})
    function Get-NetTCPConnection { param($State) return $script:listeners }
    $processExecutable = 'C:\unrelated\httpd.exe'
    function Get-CimInstance { param($ClassName, $Filter) return [pscustomobject]@{ExecutablePath=$script:processExecutable} }
    Assert-ListenerOwners 8080 @('C:\private\httpd.exe')
    Assert-Test $true 'XAMPP listeners on80 and3306 do not conflict with private HTTP preflight'
    $listeners = @([pscustomobject]@{LocalPort=8080;OwningProcess=23})
    Expect-Rejection { Assert-ListenerOwners 8080 @('C:\private\httpd.exe') } 'an unrelated process on8080 is rejected rather than stopped'
    $listeners = @([pscustomobject]@{LocalPort=80}, [pscustomobject]@{LocalPort=3306})
    Assert-StandaloneServersStopped
    Assert-Test $true 'running XAMPP on80 and3306 does not block private backend rollback'
    foreach ($port in @(8080,3307)) {
        $listeners = @([pscustomobject]@{LocalPort=$port})
        Expect-Rejection { Assert-StandaloneServersStopped } 'active private server prevents replacing its backend during rollback'
    }
    $httpPort = 80
    $listeners = @([pscustomobject]@{LocalPort=80})
    Expect-Rejection { Assert-StandaloneServersStopped } 'old port80 standalone is still protected during rollback'

    $requests = New-Object 'System.Collections.Generic.List[string]'
    function Invoke-WebRequest {
        param([switch]$UseBasicParsing, [string]$Uri, [int]$TimeoutSec)
        $script:requests.Add($Uri)
        if ($Uri.EndsWith('/lightem-db/')) { return [pscustomobject]@{StatusCode=200;Content='<input name="pma_username">'} }
        $php = [IO.File]::ReadAllText($script:probePath)
        $nonce = [regex]::Match($php, "'nonce'=>'([^']+)'").Groups[1].Value
        return [pscustomobject]@{Content=(@{nonce=$nonce;phpVersion='8.2.4'} | ConvertTo-Json)}
    }
    foreach ($port in @(80,8080)) {
        $httpPort = $port; $requests.Clear()
        Test-HttpRuntime '8.2.4'; Test-DatabaseManagerHttp
        Assert-Test ($requests.Count -eq 2 -and @($requests | Where-Object { -not $_.StartsWith("http://127.0.0.1:$port/") }).Count -eq 0) 'backend and phpMyAdmin probes use the selected private port'
        Assert-Test ($requests[1] -ceq "http://127.0.0.1:$port/lightem-db/") 'database manager health probe uses the distinct cookie path'
        Assert-Test (@(Get-ChildItem -LiteralPath $documentRoot -Filter 'lightem-setup-check-*').Count -eq 0) 'temporary HTTP probe is removed after checking'
    }
    $apachePath = 'C:\private\httpd.exe'
    $script:firewallPort = 0
    function Get-NetFirewallRule { param($Name, $ErrorAction) return $null }
    function New-NetFirewallRule { param($Name,$DisplayName,$Direction,$Action,$Protocol,$LocalPort,$RemoteAddress,$Profile,$Program) $script:firewallPort=$LocalPort }
    Set-LanFirewallRule
    Assert-Test ($firewallPort -eq 8080) 'LAN firewall opens the private HTTP port only'
    [IO.File]::WriteAllText((Join-Path $PayloadRoot 'runtime-manifest.json'), '{}')
    Save-RuntimeState 'ready' ([pscustomobject]@{version='0.0.1';buildId='20260928000000'}) @{}
    $saved = Get-Content -LiteralPath $runtimeStatePath -Raw | ConvertFrom-Json
    Assert-Test ($saved.httpPort -eq 8080 -and $saved.databasePort -eq 3307 -and $saved.sourceKind -eq 'fresh') 'saved runtime marker records independent HTTP and DB ports'
    $copyExistingStore = $true
    Save-RuntimeState 'initializing' ([pscustomobject]@{version='0.0.1';buildId='20260928000000'}) @{}
    $saved = Get-Content -LiteralPath $runtimeStatePath -Raw | ConvertFrom-Json
    Assert-Test ($saved.sourceKind -eq 'xampp-copy' -and $saved.httpPort -eq 8080) 'interrupted copying is persisted before private data initialization'
    $copyExistingStore = $false

    $listeners = @()
    $message = ''
    try { Assert-XamppDatabaseRunning } catch { $message = $_.Exception.Message }
    Assert-Test ($message.Contains('Start MySQL in the XAMPP Control Panel') -and $message.Contains('does not start or change XAMPP services')) 'stopped source MySQL gives manual-start guidance without service mutation'
    $listeners = @([pscustomobject]@{LocalPort=3306;OwningProcess=91})
    Expect-Rejection { Assert-XamppDatabaseRunning } 'foreign source DB listener is rejected'
    $processExecutable = Join-Path $xamppRoot 'mysql/bin/mysqld.exe'
    Assert-XamppDatabaseRunning
    Assert-Test $true 'already-running recognized XAMPP MySQL can be read without starting or stopping it'
    foreach ($relative in @('api/bootstrap.php', 'api/login.php', 'api/pos_lan_health.php', 'api/read_transaction_records.php', 'api/config.php', 'src/Database.php', 'src/JWTCodec.php', 'src/UserGateway.php', 'vendor/autoload.php', '.env')) {
        $file = Join-Path $xamppWebRoot $relative
        [IO.Directory]::CreateDirectory((Split-Path -Parent $file)) | Out-Null
        [IO.File]::WriteAllText($file, 'fixture source preserved')
    }
    $invocations = New-Object 'System.Collections.Generic.List[object]'
    $inventoryChecked = $false
    $badInventory = $false
    $failSourceCheck = $false
    $failSourceConfiguration = $false
    function Assert-RuntimeFiles([string]$Root, $Manifest) {
        if ($script:badInventory) { throw 'changed bundled runtime fixture' }
        $script:inventoryChecked = $true
    }
    function Invoke-CheckedProcess([string]$File, [string[]]$Arguments, [string]$Label, [int]$TimeoutSeconds = 180) {
        if (-not $script:inventoryChecked) { throw 'runtime invoked before verification' }
        $ini = if ($Arguments[0] -eq '-c') { [IO.File]::ReadAllText($Arguments[1]) } else { '' }
        $script:invocations.Add([pscustomobject]@{File=$File;Arguments=$Arguments;Path=$env:PATH;Scan=$env:PHP_INI_SCAN_DIR;Ini=$ini})
        if ($script:failSourceConfiguration -and $Label -eq 'Checking the XAMPP source host and database port before connecting') { throw 'unchecked source host or port fixture' }
        if ($script:failSourceCheck -and $Label -eq 'Checking the XAMPP store using the bundled PHP runtime') { throw 'source verification failed fixture' }
        return '{}'
    }
    $originalPath = $env:PATH
    $originalScan = $env:PHP_INI_SCAN_DIR
    Test-XamppCopySource ([pscustomobject]@{runtimeSha256=$hash}) @{}
    $payloadPhp = Join-Path $PayloadRoot 'runtime/php/php.exe'
    Assert-Test ($invocations.Count -eq 3 -and @($invocations | Where-Object {$_.File -cne $payloadPhp}).Count -eq 0) 'copy preflight executes only the verified bundled PHP binary'
    Assert-Test ($invocations[0].Arguments[0] -eq '-n' -and $invocations[1].Arguments[0] -eq '-c') 'runtime inventory uses no ini and source verification uses private ini'
    Assert-Test ($invocations[1].Ini.Contains('extension=gd') -and $invocations[1].Ini.Contains((Join-Path $PayloadRoot 'runtime/php/ext').Replace('\','/'))) 'bundled preflight enables its own GD and extension directory'
    Assert-Test ($invocations[1].Path.StartsWith((Join-Path $PayloadRoot 'runtime/php') + ';') -and -not $invocations[1].Scan) 'bundled PHP dependencies take precedence and source scan directory is ignored'
    Assert-Test ($invocations[1].Arguments[2] -ceq '-r' -and $invocations[1].Arguments[4] -ceq (Join-Path $PayloadRoot 'verify.php') -and $invocations[1].Arguments[5] -ceq $xamppWebRoot -and $invocations[2].Arguments[2] -ceq (Join-Path $PayloadRoot 'verify.php')) 'source host and port are checked before SQL verification with paths passed as argv'
    Assert-Test ($env:PATH -ceq $originalPath -and $env:PHP_INI_SCAN_DIR -ceq $originalScan) 'process environment is restored after source verification'
    Assert-Test (-not (Test-Path -LiteralPath (Join-Path $PayloadRoot 'preflight-state/php.ini'))) 'temporary source-check configuration is removed'
    Assert-Test ([IO.File]::ReadAllText((Join-Path $xamppRoot 'php.ini')) -ceq ';extension=gd') 'copy preflight leaves source GD disabled'
    $failSourceConfiguration = $true; $invocations.Clear()
    Expect-Rejection { Test-XamppCopySource ([pscustomobject]@{runtimeSha256=$hash}) @{} } 'unchecked source host or port fails preflight'
    Assert-Test ($invocations.Count -eq 2 -and -not (Test-Path -LiteralPath (Join-Path $PayloadRoot 'preflight-state/php.ini'))) 'source configuration rejection prevents SQL verification and removes temporary ini'
    $failSourceConfiguration = $false
    $badInventory = $true; $invocations.Clear()
    Expect-Rejection { Test-XamppCopySource ([pscustomobject]@{runtimeSha256=$hash}) @{} } 'changed bundled runtime is rejected before execution'
    Assert-Test ($invocations.Count -eq 0) 'unverified bundled PHP never executes'
    $badInventory = $false; $failSourceCheck = $true
    Expect-Rejection { Test-XamppCopySource ([pscustomobject]@{runtimeSha256=$hash}) @{} } 'source validation error fails preflight before private copy'
    Assert-Test ($env:PATH -ceq $originalPath -and $env:PHP_INI_SCAN_DIR -ceq $originalScan -and -not (Test-Path -LiteralPath (Join-Path $PayloadRoot 'preflight-state/php.ini'))) 'failed source verification restores environment and removes temporary ini'
    $failSourceCheck = $false
    $mediaDirectories = @('api/images')
    [IO.Directory]::CreateDirectory((Join-Path $xamppWebRoot 'api/images')) | Out-Null
    $sourceImage = Join-Path $xamppWebRoot 'api/images/store-logo.png'
    [IO.File]::WriteAllText($sourceImage, 'image fixture')
    Copy-XamppMedia
    Assert-Test ([IO.File]::ReadAllText((Join-Path $documentRoot 'api/images/store-logo.png')) -ceq 'image fixture' -and [IO.File]::ReadAllText($sourceImage) -ceq 'image fixture') 'store media is copied into private storage while source remains intact'

    $newApp = Join-Path $temp 'new-app'
    Assert-StandaloneDesktopDestination $newApp
    Assert-Test $true 'new application destination is allowed'
    [IO.Directory]::CreateDirectory($newApp) | Out-Null
    Assert-StandaloneDesktopDestination $newApp
    Assert-Test $true 'empty application destination is allowed'
    [IO.File]::WriteAllText((Join-Path $newApp 'existing.txt'), 'keep')
    Expect-Rejection { Assert-StandaloneDesktopDestination $newApp } 'nonempty unrecognized folder cannot be overwritten'
    [IO.Directory]::CreateDirectory((Join-Path $newApp 'resources')) | Out-Null
    $release = Join-Path $newApp 'resources/system-release.json'
    [IO.File]::WriteAllText($release, '{"platform":"win32"}')
    Expect-Rejection { Assert-StandaloneDesktopDestination $newApp } 'existing XAMPP desktop without standalone metadata is protected'
    [IO.File]::WriteAllText($release, '{"platform":"win32","runtimeKind":"standalone"}')
    Assert-StandaloneDesktopDestination $newApp
    Assert-Test $true 'recognized standalone desktop may be updated in its existing destination'
    Expect-Rejection { Assert-StandaloneDesktopDestination $newApp -RequireEmpty } 'changed destination cannot replace an app absent from the recovery backup'
    [IO.File]::WriteAllText($release, '{"platform":"darwin","runtimeKind":"standalone"}')
    Expect-Rejection { Assert-StandaloneDesktopDestination $newApp } 'wrong-platform desktop cannot be overwritten'
    Write-Output "Completed $count Windows coexistence checks without changing services or databases."
} finally { Remove-Item -LiteralPath $temp -Recurse -Force }
