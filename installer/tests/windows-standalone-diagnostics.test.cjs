const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../windows/installer-standalone.nsh'), 'utf8');
function block(start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, end);
  return source.slice(from, to);
}

test('both failure hooks open the report before quitting or aborting setup', () => {
  for (const [macro, ending, stage] of [['customInit', 'Quit', 'Pre-installation checks'], ['customInstall', 'Abort', 'Local server installation']]) {
    const hook = block(`!macro ${macro}\n`, '!macroend');
    const failure = hook.slice(hook.indexOf('${If} $LightemExitCode != 0'));
    assert.match(failure, new RegExp(`StrCpy \\$LightemFailureStage "${stage}"`));
    const read = failure.indexOf('Call LightemReadFailure');
    const message = failure.indexOf('MessageBox MB_ICONSTOP|MB_OK');
    const report = failure.indexOf('Call LightemOpenFailureReport');
    const exit = failure.indexOf(`\n    ${ending}`);
    assert(read >= 0 && message > read && report > message && exit > report);
    assert.match(failure, /Use File > Save As/);
    assert.match(failure, /Full logs require administrator access/);
  }
});

test('the report accepts only the redacted PowerShell summary or a safe generic startup fallback', () => {
  const read = block('Function LightemReadFailure\n', 'FunctionEnd');
  assert.match(read, /StrCpy \$LightemReportSummary "Setup could not create a safe error summary\./);
  assert.match(read, /StrCpy \$LightemReportSummary \$LightemSummary/);
  assert.doesNotMatch(read, /StrCpy \$LightemReportSummary \$(?:LightemOutput|LightemFailure)\b/);
  const report = block('Function LightemOpenFailureReport\n', 'FunctionEnd');
  assert.doesNotMatch(report, /\$(?:LightemOutput|LightemFailure|LightemSummary)\b/);
  assert.match(report, /FileWriteUTF16LE \$LightemReportHandle "\$LightemReportSummary/);
  assert.doesNotMatch(report, /CopyFiles|FileRead|database-root|config\.php|\.env/);
});

test('the private report survives setup exit and Notepad cannot hold the installer mutex', () => {
  const report = block('Function LightemOpenFailureReport\n', 'FunctionEnd');
  assert.match(report, /Call LightemCreateReportDirectory[\s\S]*\$\{If\} \$LightemReportDirectory == ""[\s\S]*Return/);
  assert.match(report, /StrCpy \$LightemDiagnosticReport "\$LightemReportDirectory\\lightem-setup-diagnostic-report\.txt"/);
  assert.match(report, /FileWriteUTF16LE \/BOM/);
  assert.match(report, /LightemStandalone\\Installer\\logs/);
  assert.match(report, /Use File > Save As to keep this report/);
  assert.match(report, /\$\{IfNot\} \$\{Silent\}[\s\S]*Exec '"\$SYSDIR\\notepad\.exe" "\$LightemDiagnosticReport"'/);
  assert.doesNotMatch(report, /ExecWait|ExecShell|powershell|cmd\.exe|\$PLUGINSDIR/i);
  assert.doesNotMatch(source, /(?:Delete|RMDir).*\$(?:LightemDiagnosticReport|LightemReportDirectory)/, 'report must remain available after the nonblocking launch');
  assert.match(report, /Could not open Notepad/);
});

test('a report directory is created with a private ACL before any report is written', () => {
  const create = block('Function LightemCreateReportDirectory\n', 'FunctionEnd');
  assert.match(create, /CoCreateGuid/);
  assert.match(create, /StrCpy \$LightemReportDirectory "\$COMMONFILES64\\LightemSetupReport-\$2"/);
  assert.doesNotMatch(create, /"\$(?:TEMP|PLUGINSDIR)\\/, 'report parent must not be writable by an unelevated launcher');
  assert.match(create, /O:BAG:BAD:P\(A;OICI;FA;;;SY\)\(A;OICI;FA;;;BA\)/);
  assert(create.indexOf('ConvertStringSecurityDescriptorToSecurityDescriptorW') < create.indexOf('CreateDirectoryW'), 'private security descriptor exists when the directory is created');
  assert.match(create, /CreateDirectoryW\(w "\$LightemReportDirectory", p r2\) i\.r3/);
  assert.match(create, /\$\{If\} \$3 == 0[\s\S]*StrCpy \$LightemReportDirectory ""/);
  assert.match(create, /\$\{Else\}[\s\S]*StrCpy \$LightemReportDirectory ""/, 'ACL conversion failure must not fall back to inherited permissions');
  assert.match(create, /System::Free \$0/);
  assert.match(create, /System::Free \$2/);
  assert.match(create, /LocalFree\(p r0\)/);
  assert.match(create, /System::Store "S"[\s\S]*System::Store "L"/, 'native calls preserve installer registers');
  assert.doesNotMatch(create, /CreateDirectory |FileOpen|Delete |Exec|powershell|cmd\.exe/i, 'no existing directory is reused or shell helper required');
});

test('interactive preflight is visible before extraction through checks and backup', () => {
  const show = block('Function LightemShowPreflight\n', 'FunctionEnd');
  assert.match(show, /\$\{IfNot\} \$\{Silent\}[\s\S]*Banner::show/);
  assert.match(show, /Banner::show[^\n]+"\$\(\^SetupCaption\)"/, 'another launch can focus this banner through the existing installer mutex handler');
  assert.match(show, /Banner::getWindow\s+Pop \$LightemPreflightWindow/);
  assert.match(show, /SendMessage \$LightemPreflightLabel \$\{WM_SETTEXT\}/);
  const hide = block('Function LightemHidePreflight\n', 'FunctionEnd');
  assert.match(hide, /\$\{If\} \$LightemPreflightWindow != ""[\s\S]*Banner::destroy[\s\S]*StrCpy \$LightemPreflightWindow ""/);
  const init = block('!macro customInit\n', '!macroend');
  const firstShow = init.indexOf('Call LightemShowPreflight');
  assert(firstShow >= 0 && firstShow < init.indexOf('File /oname=install.ps1'), 'show before the first payload file is extracted');
  const checks = init.indexOf(' -CheckOnly ');
  assert(init.lastIndexOf('Call LightemShowPreflight', checks) > init.indexOf('Call LightemSelectStoreCopy'), 'update feedback after resolving the explicit store-copy option');
  assert(init.indexOf('Call LightemHidePreflight', checks) > checks, 'keep visible throughout database verification and desktop backup');
  assert(init.indexOf('Call LightemHidePreflight', checks) < init.indexOf('MessageBox', checks), 'dismiss feedback before a preflight failure dialog');
  assert(init.lastIndexOf('Call LightemHidePreflight') > init.lastIndexOf('Call LightemShowPreflight'), 'dismiss feedback before the wizard opens');
  assert.doesNotMatch(init.slice(firstShow, checks), /RMDir|DeleteRegKey|uninstallOldVersion/, 'preflight cannot replace the app');
});

test('preflight feedback cannot hide failed destination checks', () => {
  const body = block('Function LightemValidateInstallLocation\n', 'FunctionEnd');
  assert(body.indexOf('Call LightemHidePreflight') >= 0 && body.indexOf('Call LightemHidePreflight') < body.indexOf('MessageBox'));
});

test('both desktop destination checks run before files can be replaced and fail closed', () => {
  const initial = block('!macro customInit\n','!macroend');
  const guard = initial.indexOf('Call LightemValidateInstallLocation');
  assert(guard > initial.indexOf('File /oname=install.ps1'), 'destination checker is extracted first');
  assert(guard < initial.indexOf(' -CheckOnly '), 'destination validation precedes full setup preflight');
  assert.match(initial, /StrCpy \$LightemCheckedAppRoot "\$INSTDIR"/);
  const changed = block('Function LightemCheckInstallLocation\n','FunctionEnd');
  assert.match(changed, /\$\{If\} \$INSTDIR != \$LightemCheckedAppRoot[\s\S]*StrCpy \$LightemDestinationArgs "-RequireEmptyAppDestination"[\s\S]*Call LightemValidateInstallLocation/);
  const check = block('Function LightemValidateInstallLocation\n','FunctionEnd');
  assert.match(check, /-AppRoot "\$INSTDIR" -CheckAppDestinationOnly \$LightemDestinationArgs -ErrorSummaryPath/);
  assert.match(check, /\$\{If\} \$LightemExitCode != 0[\s\S]*SetErrorLevel 1[\s\S]*Quit/);
  assert.doesNotMatch(check, /DeleteRegKey|RMDir|CopyFiles/);
});

test('direct and silent setup skip XAMPP without probing or prompting unless copying was requested', () => {
  const selection = block('Function LightemSelectStoreCopy\n','FunctionEnd');
  assert.match(selection, /^Function LightemSelectStoreCopy\s+StrCpy \$LightemCopyArgs ""/);
  assert.doesNotMatch(selection, /IfFileExists|standalone-runtime\.json/, 'explicit opt-in reaches PowerShell for both fresh installs and pending-copy recovery');
  assert.match(selection, /\$\{GetOptions\} \$LightemCommandLine "\/COPYXAMPP" \$LightemCopyOption/);
  assert.match(selection, /ClearErrors\s+\$\{GetOptions\}[^\n]+\s+\$\{IfNot\} \$\{Errors\}\s+StrCpy \$LightemCopyArgs "-CopyXamppStore"\s+\$\{EndIf\}/);
  assert.equal((selection.match(/StrCpy \$LightemCopyArgs "-CopyXamppStore"/g) || []).length, 1, 'only the explicit option enables copying');
  assert.doesNotMatch(selection, /C:\\xampp|MessageBox|\$\{Silent\}|Call |Exec/i, 'both interactive and silent setup resolve the flag without reading or starting XAMPP');
  assert.doesNotMatch(source, /(?:IfFileExists|FileOpen|Exec[^\n]*)[^\n]*C:\\xampp/i, 'the NSIS wrapper never reads or starts XAMPP itself');
});

test('the same optional copy flag reaches preflight and installation without weakening own-store checks', () => {
  for (const macro of ['customInit','customInstall']) {
    const hook = block(`!macro ${macro}\n`,'!macroend');
    const command = hook.split('\n').find(line => line.includes('nsExec::ExecToStack') && line.includes('-PayloadRoot'));
    assert.ok(command.includes('$LightemCopyArgs'), macro+' forwards the same store choice to PowerShell');
  }
  const welcome = block('!macro customWelcomePage\n', '!macroend');
  assert.match(welcome, /A new store starts empty by default/);
  assert.match(welcome, /An existing standalone store keeps its data and settings/);
  assert.match(welcome, /XAMPP data is copied only when that option was selected/);
});

test('source-store preflight includes the complete private runtime and shared PHP helpers', () => {
  const preflight = block('!macro customInit\n','!macroend');
  assert.match(preflight, /File \/oname=runtime-manifest\.json/);
  assert.match(preflight, /File "\$\{LIGHTEM_SETUP_PAYLOAD_DIR\}\\\*\.php"/);
  assert.match(preflight, /SetOutPath "\$PLUGINSDIR\\lightem-preflight\\runtime"[\s\S]*File \/r "\$\{LIGHTEM_SETUP_PAYLOAD_DIR\}\\runtime\\\*\.\*"/);
  assert.match(preflight, /File "\$\{LIGHTEM_SETUP_PAYLOAD_DIR\}\\database\\\*\.sql"/);
  assert(preflight.indexOf('Call LightemSelectStoreCopy') < preflight.indexOf(' -CheckOnly '));
  assert.doesNotMatch(preflight, /xampp\\php|xampp\\mysql|Stop-Service/i, 'NSIS does not use or change source services/runtime');
});
