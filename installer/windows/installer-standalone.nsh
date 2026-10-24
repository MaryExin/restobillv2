; Included by the standalone electron-builder NSIS configuration only.
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WinMessages.nsh"
!ifndef LIGHTEM_SETUP_PAYLOAD_DIR
  !define LIGHTEM_SETUP_PAYLOAD_DIR "${PROJECT_DIR}\installer\stage\standalone\win32-x64\setup"
!endif

!ifndef BUILD_UNINSTALLER
  Var LightemRecoveryRoot
  Var LightemOldAppRoot
  Var LightemRegistryHive
  Var LightemPowerShell
  Var LightemProgramData
  Var LightemExitCode
  Var LightemOutput
  Var LightemErrorPath
  Var LightemFailure
  Var LightemSummary
  Var LightemSummaryHandle
  Var LightemSummaryLine
  Var LightemSummaryLength
  Var LightemReportSummary
  Var LightemDiagnosticReport
  Var LightemReportHandle
  Var LightemReportDirectory
  Var LightemPreflightWindow
  Var LightemPreflightLabel
  Var LightemPreflightText
  Var LightemFailureStage
  Var LightemCheckedAppRoot
  Var LightemDestinationArgs
  Var LightemCopyArgs
  Var LightemCommandLine
  Var LightemCopyOption

  ; customInit runs before the wizard is visible. Keep an independent window
  ; responsive while extracting the runtime and checking/backing up the store.
  Function LightemShowPreflight
    ${IfNot} ${Silent}
      ${If} $LightemPreflightWindow == ""
        Banner::show /set 76 "Preparing Lightem POS setup" /set 1030 "$LightemPreflightText" "$(^SetupCaption)"
        Banner::getWindow
        Pop $LightemPreflightWindow
      ${Else}
        GetDlgItem $LightemPreflightLabel $LightemPreflightWindow 1030
        SendMessage $LightemPreflightLabel ${WM_SETTEXT} 0 "STR:$LightemPreflightText"
      ${EndIf}
    ${EndIf}
  FunctionEnd

  Function LightemHidePreflight
    ${If} $LightemPreflightWindow != ""
      Banner::destroy
      StrCpy $LightemPreflightWindow ""
    ${EndIf}
  FunctionEnd

  ; Make a new, administrator-only directory atomically. Reports must survive
  ; PLUGINSDIR cleanup so Notepad can be opened without holding the setup mutex.
  ; Never reuse a predictable file or follow an existing report directory.
  Function LightemCreateReportDirectory
    StrCpy $LightemReportDirectory ""
    System::Store "S"
    System::Alloc 16
    Pop $0
    ${If} $0 != 0
      System::Call 'ole32::CoCreateGuid(p r0) i.r1'
      ${If} $1 == 0
        System::Call 'ole32::StringFromGUID2(p r0, w.r2, i 39) i.r1'
      ${EndIf}
      System::Free $0
      ${If} $1 == 39
        ; Program Files is administrator-writable, unlike the launching user's
        ; TEMP parent where a protected child could still be moved/replaced.
        StrCpy $LightemReportDirectory "$COMMONFILES64\LightemSetupReport-$2"
        System::Call 'advapi32::ConvertStringSecurityDescriptorToSecurityDescriptorW(w "O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)", i 1, *p.r0, p 0) i.r1'
        ${If} $1 != 0
          ; The NSIS setup stub is 32-bit, including on 64-bit Windows.
          System::Call '*(i 12, p r0, i 0) p.r2'
          StrCpy $3 0
          ${If} $2 != 0
            System::Call 'kernel32::CreateDirectoryW(w "$LightemReportDirectory", p r2) i.r3'
            System::Free $2
          ${EndIf}
          System::Call 'kernel32::LocalFree(p r0) p'
          ${If} $3 == 0
            StrCpy $LightemReportDirectory ""
          ${EndIf}
        ${Else}
          StrCpy $LightemReportDirectory ""
        ${EndIf}
      ${EndIf}
    ${EndIf}
    System::Store "L"
  FunctionEnd

  ; ExecToStack also captures PowerShell parse/startup errors, which can happen
  ; before install.ps1 creates its log. Prefer the script's bounded error summary
  ; when available: a late error may exceed the plugin's captured-output limit.
  Function LightemReadFailure
    StrCpy $LightemFailure $LightemOutput
    ; Captured startup output can contain command arguments. Keep it in the
    ; existing error dialog only; the report accepts the redacted PS summary.
    StrCpy $LightemReportSummary "Setup could not create a safe error summary. The original error is shown in the setup dialog. Include a screenshot of that message when asking for help."
    ClearErrors
    FileOpen $LightemSummaryHandle "$LightemErrorPath" r
    ${IfNot} ${Errors}
      StrCpy $LightemSummary ""
      lightem_summary_read:
        ClearErrors
        FileReadUTF16LE $LightemSummaryHandle $LightemSummaryLine 1300
        IfErrors lightem_summary_done
        StrCpy $LightemSummary "$LightemSummary$LightemSummaryLine"
        StrLen $LightemSummaryLength $LightemSummary
        IntCmp $LightemSummaryLength 1300 lightem_summary_done lightem_summary_read lightem_summary_done
      lightem_summary_done:
      FileClose $LightemSummaryHandle
      ${If} $LightemSummary != ""
        StrCpy $LightemFailure $LightemSummary
        StrCpy $LightemReportSummary $LightemSummary
      ${EndIf}
    ${EndIf}
    ${If} $LightemExitCode == "error"
      StrCpy $LightemFailure "Windows could not start PowerShell at:$\r$\n$LightemPowerShell$\r$\n$LightemFailure"
    ${ElseIf} $LightemExitCode == "timeout"
      StrCpy $LightemFailure "PowerShell timed out. Check whether setup is still running before trying again.$\r$\n$LightemFailure"
    ${ElseIf} $LightemFailure == ""
      StrCpy $LightemFailure "PowerShell exited with code $LightemExitCode without reporting an error message."
    ${EndIf}
    StrLen $LightemSummaryLength $LightemFailure
    ${If} $LightemSummaryLength > 1200
      StrCpy $LightemFailure $LightemFailure 1200
      StrCpy $LightemFailure "$LightemFailure$\r$\n[Further details may be available in the setup log.]"
    ${EndIf}
    DetailPrint "$LightemFailure"
  FunctionEnd

  ; Ordinary Explorer windows cannot read the protected server logs. Open a
  ; bounded report using this elevated installer. Its private directory survives
  ; setup exit; leaving Notepad open must not block another installation attempt.
  ; No database/configuration file is copied here.
  Function LightemOpenFailureReport
    Call LightemCreateReportDirectory
    ${If} $LightemReportDirectory == ""
      DetailPrint "Could not create a private diagnostic report. The original error remains in the setup dialog."
      Return
    ${EndIf}
    StrCpy $LightemDiagnosticReport "$LightemReportDirectory\lightem-setup-diagnostic-report.txt"
    ClearErrors
    FileOpen $LightemReportHandle "$LightemDiagnosticReport" w
    ${If} ${Errors}
      DetailPrint "Could not create the diagnostic report. The original error remains in the setup dialog."
      Return
    ${EndIf}
    FileWriteUTF16LE /BOM $LightemReportHandle "LIGHTEM POS STANDALONE SETUP ${VERSION}$\r$\n$\r$\n"
    FileWriteUTF16LE $LightemReportHandle "Stage: $LightemFailureStage$\r$\nExit code: $LightemExitCode$\r$\n$\r$\n"
    FileWriteUTF16LE $LightemReportHandle "$LightemReportSummary$\r$\n$\r$\n"
    FileWriteUTF16LE $LightemReportHandle "Full setup logs require administrator access:$\r$\n$LightemProgramData\LightemStandalone\Installer\logs$\r$\n$\r$\n"
    FileWriteUTF16LE $LightemReportHandle "Use File > Save As to keep this report in Documents or on your USB drive before closing it. Send the saved report when asking for help.$\r$\n"
    FileClose $LightemReportHandle
    ${If} ${Errors}
      DetailPrint "Could not finish the diagnostic report. The original error remains in the setup dialog."
      Return
    ${EndIf}
    ${IfNot} ${Silent}
      ClearErrors
      Exec '"$SYSDIR\notepad.exe" "$LightemDiagnosticReport"'
      ${If} ${Errors}
        DetailPrint "Could not open Notepad. Diagnostic report: $LightemDiagnosticReport"
      ${EndIf}
    ${EndIf}
  FunctionEnd

  ; Run before electron-builder can uninstall or extract desktop files. A
  ; manually chosen folder must never overwrite a different application.
  Function LightemValidateInstallLocation
    Delete "$LightemErrorPath"
    nsExec::ExecToStack '"$LightemPowerShell" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lightem-preflight\install.ps1" -PayloadRoot "$PLUGINSDIR\lightem-preflight" -AppRoot "$INSTDIR" -CheckAppDestinationOnly $LightemDestinationArgs -ErrorSummaryPath "$LightemErrorPath"'
    Pop $LightemExitCode
    Pop $LightemOutput
    ${If} $LightemExitCode != 0
      Call LightemHidePreflight
      StrCpy $LightemFailureStage "Desktop installation folder checks"
      Call LightemReadFailure
      MessageBox MB_ICONSTOP|MB_OK "This installation folder cannot be used. Existing applications have not been replaced.$\r$\n$\r$\n$LightemFailure$\r$\n$\r$\nRun setup again and choose a new empty folder for Lightem Pos Standalone."
      Call LightemOpenFailureReport
      SetErrorLevel 1
      Quit
    ${EndIf}
  FunctionEnd

  Function LightemSelectStoreCopy
    StrCpy $LightemCopyArgs ""
    ; The setup app passes this flag only when its optional copy box is checked.
    ; Direct and silent setup default to a new store without probing XAMPP.
    ; PowerShell validates owned stores: ready stores ignore the flag and a
    ; pending copy can resume only when copying is explicitly requested again.
    ${GetParameters} $LightemCommandLine
    ClearErrors
    ${GetOptions} $LightemCommandLine "/COPYXAMPP" $LightemCopyOption
    ${IfNot} ${Errors}
      StrCpy $LightemCopyArgs "-CopyXamppStore"
    ${EndIf}
  FunctionEnd
!endif

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Install or Update Lightem POS"
  !define MUI_WELCOMEPAGE_TEXT "This wizard installs or updates Lightem Pos Standalone and its private server and database, which start with Windows.$\r$\n$\r$\nAn existing standalone store keeps its data and settings. A new store starts empty by default. XAMPP data is copied only when that option was selected on the setup screen.$\r$\n$\r$\nClose the standalone desktop before continuing. For an optional XAMPP copy, keep its MySQL running and pause sales and changes until setup finishes."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; This hook runs after NSIS resolves the registered install path, and before
; uninstallOldVersion removes any previous desktop files.
!macro customInit
  InitPluginsDir
  ReadEnvStr $LightemProgramData "ProgramData"
  ${If} $LightemProgramData == ""
    StrCpy $LightemProgramData "$APPDATA"
  ${EndIf}
  StrCpy $LightemPowerShell "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
  IfFileExists "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe" 0 +2
    StrCpy $LightemPowerShell "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
  StrCpy $LightemRegistryHive "HKLM"
  ReadRegStr $LightemOldAppRoot HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $LightemOldAppRoot == ""
    ReadRegStr $LightemOldAppRoot HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $LightemOldAppRoot != ""
      StrCpy $LightemRegistryHive "HKCU"
      StrCpy $INSTDIR $LightemOldAppRoot
    ${EndIf}
  ${EndIf}
  ${If} $LightemOldAppRoot != ""
  ${AndIf} $INSTDIR != $LightemOldAppRoot
    MessageBox MB_ICONSTOP|MB_OK "Update Lightem POS in its existing installation folder:$\r$\n$LightemOldAppRoot"
    SetErrorLevel 1
    Quit
  ${EndIf}
  System::Call 'kernel32::GetCurrentProcessId() i .r0'
  System::Call 'kernel32::GetTickCount() i .r1'
  StrCpy $LightemRecoveryRoot "$LightemProgramData\LightemStandalone\Installer\desktop-recovery-${VERSION}-$0-$1"
  StrCpy $LightemPreflightText "Extracting setup files. This may take a few minutes."
  Call LightemShowPreflight
  SetOutPath "$PLUGINSDIR\lightem-preflight"
  File /oname=install.ps1 "${PROJECT_DIR}\installer\windows\install-standalone.ps1"
  File /oname=manifest.json "${LIGHTEM_SETUP_PAYLOAD_DIR}\manifest.json"
  File /oname=runtime-manifest.json "${LIGHTEM_SETUP_PAYLOAD_DIR}\runtime-manifest.json"
  ; Source-store checks use our verified PHP and extensions, regardless of the
  ; PHP version or disabled extensions configured in the existing XAMPP server.
  File "${LIGHTEM_SETUP_PAYLOAD_DIR}\*.php"
  SetOutPath "$PLUGINSDIR\lightem-preflight\database"
  File "${LIGHTEM_SETUP_PAYLOAD_DIR}\database\*.sql"
  File /oname=schema-manifest.json "${LIGHTEM_SETUP_PAYLOAD_DIR}\database\schema-manifest.json"
  SetOutPath "$PLUGINSDIR\lightem-preflight\runtime"
  File /r "${LIGHTEM_SETUP_PAYLOAD_DIR}\runtime\*.*"
  StrCpy $LightemPreflightText "Checking this device and the existing store. Please wait."
  Call LightemShowPreflight
  StrCpy $LightemErrorPath "$PLUGINSDIR\lightem-setup-error.txt"
  StrCpy $LightemDestinationArgs ""
  Call LightemValidateInstallLocation
  StrCpy $LightemCheckedAppRoot "$INSTDIR"
  Call LightemSelectStoreCopy
  StrCpy $LightemPreflightText "Checking the database and saving the existing app. Please wait."
  Call LightemShowPreflight
  Delete "$LightemErrorPath"
  nsExec::ExecToStack '"$LightemPowerShell" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lightem-preflight\install.ps1" -PayloadRoot "$PLUGINSDIR\lightem-preflight" -AppRoot "$INSTDIR" -CheckOnly -DesktopRecoveryRoot "$LightemRecoveryRoot" -InstallerRegistryKey "${INSTALL_REGISTRY_KEY}" -UninstallRegistryKey "${UNINSTALL_REGISTRY_KEY}" -RegistryHive "$LightemRegistryHive" -ErrorSummaryPath "$LightemErrorPath" $LightemCopyArgs'
  Pop $LightemExitCode
  Pop $LightemOutput
  Call LightemHidePreflight
  DetailPrint "$LightemOutput"
  ${If} $LightemExitCode != 0
    StrCpy $LightemFailureStage "Pre-installation checks"
    Call LightemReadFailure
    MessageBox MB_ICONSTOP|MB_OK "This device did not pass the installation checks. No existing app or backend was replaced.$\r$\n$\r$\n$LightemFailure$\r$\n$\r$\nAfter you close this message, a diagnostic report will open in Notepad. Use File > Save As to keep it and send it for help.$\r$\n$\r$\nFull logs require administrator access:$\r$\n$LightemProgramData\LightemStandalone\Installer\logs"
    Call LightemOpenFailureReport
    SetErrorLevel 1
    Quit
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  Page custom LightemCheckInstallLocation
  Function LightemCheckInstallLocation
    ${If} $LightemOldAppRoot != ""
    ${AndIf} $INSTDIR != $LightemOldAppRoot
      MessageBox MB_ICONSTOP|MB_OK "To preserve update recovery, use the existing Lightem POS folder:$\r$\n$LightemOldAppRoot$\r$\n$\r$\nRun setup again without changing the installation folder."
      SetErrorLevel 1
      Quit
    ${EndIf}
    StrCpy $LightemDestinationArgs ""
    ${If} $INSTDIR != $LightemCheckedAppRoot
      ; The preflight recovery copy belongs to the original folder. A changed
      ; destination must be empty, even when another standalone copy is there.
      StrCpy $LightemDestinationArgs "-RequireEmptyAppDestination"
    ${EndIf}
    Call LightemValidateInstallLocation
    Abort ; No additional page is needed when the folder is correct.
  FunctionEnd
!macroend

; Runtime setup is synchronous: a failed runtime install fails the wizard.
!macro customInstall
  SetDetailsPrint both
  DetailPrint "Installing and checking the local Lightem POS server..."
  StrCpy $1 ""
  ${IfNot} ${Silent}
    StrCpy $1 "-ShowInitialLogin"
  ${EndIf}
  Delete "$LightemErrorPath"
  nsExec::ExecToStack '"$LightemPowerShell" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\setup\install.ps1" -PayloadRoot "$INSTDIR\resources\setup" -AppRoot "$INSTDIR" -DesktopRecoveryRoot "$LightemRecoveryRoot" -ErrorSummaryPath "$LightemErrorPath" $1 $LightemCopyArgs'
  Pop $LightemExitCode
  Pop $LightemOutput
  DetailPrint "$LightemOutput"
  ${If} $LightemExitCode != 0
    StrCpy $LightemFailureStage "Local server installation"
    Call LightemReadFailure
    MessageBox MB_ICONSTOP|MB_OK "Lightem setup could not finish the local server installation.$\r$\n$\r$\n$LightemFailure$\r$\n$\r$\nExisting databases have not been removed. After you close this message, a diagnostic report will open in Notepad. Use File > Save As to keep it and send it for help.$\r$\n$\r$\nFull logs require administrator access:$\r$\n$LightemProgramData\LightemStandalone\Installer\logs"
    Call LightemOpenFailureReport
    SetErrorLevel 1
    Abort
  ${EndIf}
  DetailPrint "Lightem POS and its local server are ready."
!macroend

; Retain ProgramData\LightemStandalone and its databases when uninstalling the desktop.
; A desktop app uninstall must never erase the restaurant's sales data.
