; Included by the all-in-one electron-builder NSIS configuration only.
!include "LogicLib.nsh"
!ifndef LIGHTEM_SETUP_PAYLOAD_DIR
  !define LIGHTEM_SETUP_PAYLOAD_DIR "${PROJECT_DIR}\installer\stage\win32-x64\setup"
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

  ; ExecToStack also captures PowerShell parse/startup errors, which can happen
  ; before install.ps1 creates its log. Prefer the script's bounded error summary
  ; when available: a late error may exceed the plugin's captured-output limit.
  Function LightemReadFailure
    StrCpy $LightemFailure $LightemOutput
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
!endif

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Install or Update Lightem POS"
  !define MUI_WELCOMEPAGE_TEXT "This wizard installs or updates the Lightem POS desktop app and its local server.$\r$\n$\r$\nSetup checks this device, preserves existing sales data and settings, and configures Apache and MySQL to start with Windows.$\r$\n$\r$\nClose Lightem POS before continuing."
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
  StrCpy $LightemRecoveryRoot "$LightemProgramData\Lightem\Installer\desktop-recovery-${VERSION}-$0-$1"
  SetOutPath "$PLUGINSDIR\lightem-preflight"
  File /oname=install.ps1 "${PROJECT_DIR}\installer\windows\install.ps1"
  File /oname=manifest.json "${LIGHTEM_SETUP_PAYLOAD_DIR}\manifest.json"
  File /oname=verify.php "${LIGHTEM_SETUP_PAYLOAD_DIR}\verify.php"
  SetOutPath "$PLUGINSDIR\lightem-preflight\database"
  File /oname=primary.sql "${LIGHTEM_SETUP_PAYLOAD_DIR}\database\primary.sql"
  File /oname=report.sql "${LIGHTEM_SETUP_PAYLOAD_DIR}\database\report.sql"
  File /oname=schema-manifest.json "${LIGHTEM_SETUP_PAYLOAD_DIR}\database\schema-manifest.json"
  StrCpy $LightemErrorPath "$PLUGINSDIR\lightem-setup-error.txt"
  Delete "$LightemErrorPath"
  nsExec::ExecToStack '"$LightemPowerShell" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lightem-preflight\install.ps1" -PayloadRoot "$PLUGINSDIR\lightem-preflight" -AppRoot "$INSTDIR" -CheckOnly -DesktopRecoveryRoot "$LightemRecoveryRoot" -InstallerRegistryKey "${INSTALL_REGISTRY_KEY}" -UninstallRegistryKey "${UNINSTALL_REGISTRY_KEY}" -RegistryHive "$LightemRegistryHive" -ErrorSummaryPath "$LightemErrorPath"'
  Pop $LightemExitCode
  Pop $LightemOutput
  DetailPrint "$LightemOutput"
  ${If} $LightemExitCode != 0
    Call LightemReadFailure
    MessageBox MB_ICONSTOP|MB_OK "This device did not pass the installation checks. No existing app or backend was replaced.$\r$\n$\r$\n$LightemFailure$\r$\n$\r$\nSetup logs, if created:$\r$\n$LightemProgramData\Lightem\Installer\logs$\r$\n$\r$\nSend this error message or the latest setup log for help."
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
  nsExec::ExecToStack '"$LightemPowerShell" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\setup\install.ps1" -PayloadRoot "$INSTDIR\resources\setup" -AppRoot "$INSTDIR" -DesktopRecoveryRoot "$LightemRecoveryRoot" -ErrorSummaryPath "$LightemErrorPath" $1'
  Pop $LightemExitCode
  Pop $LightemOutput
  DetailPrint "$LightemOutput"
  ${If} $LightemExitCode != 0
    Call LightemReadFailure
    MessageBox MB_ICONSTOP|MB_OK "Lightem setup could not finish the local server installation.$\r$\n$\r$\n$LightemFailure$\r$\n$\r$\nExisting databases have not been removed. Setup logs, if created:$\r$\n$LightemProgramData\Lightem\Installer\logs$\r$\n$\r$\nSend this error message or the latest setup log for help."
    SetErrorLevel 1
    Abort
  ${EndIf}
  DetailPrint "Lightem POS and its local server are ready."
!macroend

; Deliberately retain C:\xampp and its databases when uninstalling the desktop.
; A desktop app uninstall must never erase the restaurant's sales data.
