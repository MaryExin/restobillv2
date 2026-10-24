# Read-only fixture checks. Never run the installer body or modify services/ACLs.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$source = Join-Path $PSScriptRoot '../windows/install-standalone.ps1'
$tokens = $null; $parseErrors = $null
$tree = [Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
foreach ($name in @('Assert-NoReparsePoint', 'Assert-PrivateRecoveryAcl', 'Get-StandaloneHttpPort', 'Test-PendingServiceRecovery', 'Write-SetupFailureSummary', 'Write-SetupLog')) {
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
$lightemRoot = Join-Path $tempBase ('lightem-recovery-test-' + [Guid]::NewGuid().ToString('N'))
$runtimeRoot = Join-Path $lightemRoot 'runtime/pinned'
$configRoot = Join-Path $lightemRoot 'config'
$runtimeStatePath = Join-Path $lightemRoot 'standalone-runtime.json'
$apacheConfig = Join-Path $configRoot 'httpd.conf'
$databaseConfig = Join-Path $configRoot 'my.ini'
$installerId = 'com.lenard.restobill.setup'
$hash = 'a' * 64
$httpPort = 8080
[IO.Directory]::CreateDirectory($runtimeRoot) | Out-Null
[IO.Directory]::CreateDirectory($configRoot) | Out-Null
try {
    $acl = [pscustomobject]@{ OwnerSid = 'S-1-5-32-544'; Rules = @(); AccessDescriptor = 'D:' }
    $acl | Add-Member ScriptMethod GetSecurityDescriptorSddlForm { param($sections) $this.AccessDescriptor }
    $acl | Add-Member ScriptMethod GetOwner { param($type) [pscustomobject]@{ Value = $this.OwnerSid } }
    $acl | Add-Member ScriptMethod GetAccessRules { param($explicit, $inherited, $type) $this.Rules }
    $userSid = 'S-1-5-21-1-2-3-1001'
    foreach ($descriptor in @('', 'D:NO_ACCESS_CONTROL', 'D:PNO_ACCESS_CONTROL')) {
        $acl.AccessDescriptor = $descriptor
        Expect-Rejection { Assert-PrivateRecoveryAcl 'fixture' $acl $userSid } 'absent or null DACL cannot authorize recovery'
    }
    $acl.AccessDescriptor = 'D:'
    foreach ($owner in @('S-1-5-18', 'S-1-5-32-544', $userSid)) {
        $acl.OwnerSid = $owner
        Assert-PrivateRecoveryAcl 'fixture' $acl $userSid
        Assert-Test $true "protected recovery owner is accepted: $owner"
    }
    $acl.OwnerSid = 'S-1-5-32-545'
    Expect-Rejection { Assert-PrivateRecoveryAcl 'fixture' $acl $userSid } 'user-owned marker cannot authorize service adoption'
    $acl.OwnerSid = 'S-1-5-32-544'
    foreach ($right in @('Write', 'Delete', 'DeleteSubdirectoriesAndFiles', 'ChangePermissions', 'TakeOwnership', 'FullControl')) {
        $acl.Rules = @([pscustomobject]@{ AccessControlType = 'Allow'; FileSystemRights = [Security.AccessControl.FileSystemRights]$right; IdentityReference = [pscustomobject]@{ Value = 'S-1-5-32-545' } })
        Expect-Rejection { Assert-PrivateRecoveryAcl 'fixture' $acl $userSid } "untrusted recovery ACL cannot grant $right"
    }
    $acl.Rules[0].FileSystemRights = [Security.AccessControl.FileSystemRights]::ReadAndExecute
    Assert-PrivateRecoveryAcl 'fixture' $acl $userSid
    Assert-Test $true 'read-only service/user permissions do not authorize writes'

    $checkedPaths = New-Object 'System.Collections.Generic.List[string]'
    $inventoryChecks = 0
    $badPath = ''
    $badInventory = $false
    function Assert-PrivateRecoveryPath([string]$Path) {
        $script:checkedPaths.Add($Path)
        if ($Path -eq $script:badPath) { throw 'untrusted ACL fixture' }
    }
    function Assert-RuntimeFiles([string]$Root, $Manifest) {
        $script:inventoryChecks++
        if ($script:badInventory) { throw 'changed runtime fixture' }
    }
    $runtimeFile = Join-Path $runtimeRoot 'mysqld.exe'
    [IO.File]::WriteAllText($runtimeFile, 'fixture')
    $state = [pscustomobject]@{ installerId = $installerId; status = 'initializing'; runtimeKind = 'standalone'; formatVersion = 1; databasePort = 3307; httpPort = 8080; runtimeManifestSha256 = $hash; runtimeRoot = $runtimeRoot }
    Assert-Test (Test-PendingServiceRecovery $state @{} $hash) 'exact protected interrupted runtime can authorize pending service checks'
    Assert-Test ($inventoryChecks -eq 1 -and $checkedPaths.Contains($runtimeStatePath) -and $checkedPaths.Contains($runtimeFile) -and $checkedPaths.Contains($databaseConfig) -and $checkedPaths.Contains($apacheConfig)) 'ownership marker, runtime files and both configurations require proof'
    $state.status = 'ready'
    Assert-Test (-not (Test-PendingServiceRecovery $state @{} $hash)) 'a completed installation never permits LocalSystem adoption'
    $state.status = 'initializing'
    Assert-Test (-not (Test-PendingServiceRecovery $state @{} ('b' * 64))) 'different runtime bytes cannot authorize interrupted registration recovery'
    $state.installerId = 'unrelated'
    Assert-Test (-not (Test-PendingServiceRecovery $state @{} $hash)) 'foreign installation marker is rejected'
    $state.installerId = $installerId
    $state.runtimeRoot = Join-Path $lightemRoot 'elsewhere'
    Assert-Test (-not (Test-PendingServiceRecovery $state @{} $hash)) 'different runtime location is rejected'
    $state.runtimeRoot = $runtimeRoot
    $badInventory = $true
    Expect-Rejection { Test-PendingServiceRecovery $state @{} $hash } 'tampered runtime cannot authorize service recovery'
    $badInventory = $false
    $badPath = $runtimeStatePath
    Expect-Rejection { Test-PendingServiceRecovery $state @{} $hash } 'unprotected state marker prevents recovery'
    $badPath = $databaseConfig
    Expect-Rejection { Test-PendingServiceRecovery $state @{} $hash } 'unprotected database configuration prevents recovery'

    $ErrorSummaryPath = Join-Path $lightemRoot 'summary.txt'
    $logPath = Join-Path $lightemRoot 'standalone-fixture.log'
    Write-SetupFailureSummary 'password="private value"; setup failed'
    $summary = [IO.File]::ReadAllText($ErrorSummaryPath, [Text.Encoding]::Unicode)
    Assert-Test ($summary.Contains('setup failed') -and -not $summary.Contains('private value') -and -not $summary.Contains($logPath)) 'early failure is redacted without claiming a log exists'
    [IO.File]::WriteAllText($logPath, 'fixture')
    Write-SetupFailureSummary ('x' * 4000)
    $summary = [IO.File]::ReadAllText($ErrorSummaryPath, [Text.Encoding]::Unicode)
    Assert-Test ($summary.Length -eq 1200 -and $summary.Contains($logPath) -and $summary.Contains('administrator access')) 'bounded diagnostic report retains the exact protected log location'
    $logPath = Join-Path $lightemRoot 'missing-parent/setup.log'
    $output = @(Write-SetupLog 'original failure remains available' 3>$null)
    Assert-Test (($output -join '').Contains('original failure remains available')) 'an unwritable log does not abort failure recovery or hide its message'
    Write-Output "Completed $count recovery and diagnostic checks."
} finally {
    [IO.Directory]::Delete($lightemRoot, $true)
}
