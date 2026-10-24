#!/usr/bin/env node
// One download carries both native setup apps with the same selection screen.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const JSZip=require('jszip');
const {pipeline}=require('node:stream/promises');
async function bundle(standalone=false) {
  const root=path.resolve(__dirname,'../../release',...(standalone?['standalone']:[]),'setup-app');
  const windows=JSON.parse(fs.readFileSync(path.join(root,'win32-x64/launcher-entry.json'),'utf8'));
  const mac=JSON.parse(fs.readFileSync(path.join(root,'darwin-universal/launcher-entry.json'),'utf8'));
  if(windows.version!==mac.version || windows.buildId!==mac.buildId) throw new Error('Both platforms must use the same release.');
  if([windows,mac].some(release=>(release.runtimeKind==='standalone')!==standalone))throw new Error('Do not mix standalone and XAMPP setup apps.');
  const entries=[];
  for(const release of [windows,mac]){
    const file=path.basename(release.file);
    const absolute=path.join(root,`${release.platform}-${release.arch}`,file);
    const digest=crypto.createHash('sha256');
    for await(const chunk of fs.createReadStream(absolute))digest.update(chunk);
    const actual=digest.digest('hex');
    if(actual!==release.sha256 || fs.statSync(absolute).size!==release.size) throw new Error(`Installer integrity check failed: ${file}`);
    entries.push({release,file,absolute,folder:release.platform==='win32'?'Windows':'Mac'});
  }
  const file=path.join(root,`${standalone?'Lightem-Standalone-Setup':'Lightem-Setup'}-${windows.version}-${windows.buildId}-Windows-and-Mac.zip`);
  const archive=new JSZip();
  for(const entry of entries) archive.file(`Lightem Setup/${entry.folder}/${entry.file}`,fs.createReadStream(entry.absolute));
  archive.file('Lightem Setup/READ ME FIRST.txt',`LIGHTEM SETUP — ${windows.version} (build ${windows.buildId})\n\nWindows: open the Windows folder and run ${path.basename(windows.file)}.\nMac: open the Mac folder, extract ${path.basename(mac.file)}, and open Lightem Setup.app.\n\nBoth apps show the same Windows/Mac selection screen.\nChoose this computer's system to install or update everything.\nChoose the other system to save its installer for another computer.\nThe Check for updates button looks for releases online.\n\nBoth full installers are embedded for offline installation.\nDatabase names after setup: db_cnc_pos and reports_database.\nExisting sales and settings are preserved. Close the POS before installing.\nApple Silicon requires Rosetta; its first installation needs internet.\n\nNew installations create an empty store and an initial administrator login.\nConfigure your business, products, receipts and printers before trading.\n\nIF INSTALLATION FAILS\nThis text file contains instructions, not the installation log.\nWindows: keep the error shown in the dialog. The latest setup log is under C:\\ProgramData\\Lightem\\Installer\\logs.\nMac: in the macOS Installer, choose Window > Installer Log (Command+L), select Show All Logs, and save the log. The detailed Lightem log is /var/log/lightem-setup.log.\n`);
  if(standalone){
    archive.file('Lightem Setup/READ ME FIRST.txt',`LIGHTEM STANDALONE SETUP — ${windows.version} (setup bundle ${windows.buildId})

Windows: open Windows/${windows.file}.
Mac: extract Mac/${mac.file}, then open Lightem Setup.app.

Both native apps show the same Windows/Mac selection screen.
Each app includes both full offline installers.
Choose this computer's system to install or update locally.
Choose the other system to save its installer for another computer.
The selected platform's actual version and build appear in the setup screen.
The Check for updates button checks this computer online.

This build includes Lightem's own PHP, Apache and MariaDB services.
XAMPP is not installed or required.
Install on the main store computer. Other devices connect to its API over the local network; the database port stays private.

Databases: db_cnc_pos and reports_database.
Database browser on the store computer only:
New Windows standalone: http://localhost:8080/lightem-db/
Older Windows standalone installations that retain port 80: http://localhost/lightem-db/
Mac standalone: http://localhost:8080/lightem-db/
Existing Windows standalone updates keep their current server port. Older Windows standalone /phpmyadmin/ bookmarks redirect to /lightem-db/ on that same port.
Mac standalone moves earlier port-80 installations to port 8080. Older Mac /admin/ bookmarks redirect to /lightem-db/ on port 8080. XAMPP keeps port 80 and /phpmyadmin/.
Tablets use http://<computer-LAN-IP>:8080/api for Mac and new Windows standalone installs. Update existing Mac tablet connection settings to include :8080.
Sign in with the database username/password from the protected initial-access file.
Windows credentials: C:\\ProgramData\\LightemStandalone\\Installer\\credentials
Mac credentials: /Library/Application Support/LightemStandalone/secrets
Use administrator access to read those files. The POS login is separate.

Windows installs a separate Lightem Pos Standalone app with its own settings.
Windows and Mac: Copy data from XAMPP is optional and unchecked by default above the OS choices.
Unchecked: install without checking or starting XAMPP. New installations create an empty standalone store.
Checked: copy db_cnc_pos and reports_database from XAMPP. Keep XAMPP MySQL running and pause sales until the copy finishes.
Existing standalone updates keep their own data regardless of the checkbox. Interrupted imports require selecting it again to resume.
To import on another computer, open that platform's setup app from this combined ZIP there. Saving the other OS exports its default installer.
Setup uses its own PHP even when XAMPP GD is disabled.
The copied store is separate; future sales are not synchronized between the two servers.
XAMPP can stay running on port 80, including its original database browser and apps.
Its PHP configuration (including disabled GD) and databases are not changed.
Close connected standalone POS apps before updating standalone.
Windows: after administrator approval, wait for the preparation window to finish extracting files, checking the store and saving the existing app. The installation wizard opens afterward; the offline package needs no update download.
Before retrying an older failed installer, close its setup and Notepad error report.
Mac: close POS on every connected device before installing or updating.
Existing standalone store data and settings are preserved during updates.
Windows updates support older databases without the optional custom-discount mapping and archive-log tables, without creating or altering tables. Custom discount setup stays unavailable when its mapping table is absent; built-in discounts retain their existing behavior.
Fresh installations create an empty store and an initial administrator login.
Tenant, printer, business and terminal configuration from the build's public files is included automatically.
Editable files are beside app.asar in the installed app's resources folder (Contents/Resources on Mac).
Setup fills missing or blank settings while retaining existing customized values. Review the bundled receipt and printer defaults for this device.
Apple Silicon needs Rosetta; its first installation needs internet.

IF INSTALLATION FAILS
Windows opens a diagnostic report in Notepad and exits without waiting for you to close the report. Use File > Save As to keep it.
Windows full logs (administrator access): C:\\ProgramData\\LightemStandalone\\Installer\\logs
Mac detailed log: /var/log/lightem-standalone-setup.log
Mac Installer: Window > Installer Log (Command+L), then Show All Logs.
`);
  }
  await pipeline(archive.generateNodeStream({streamFiles:true,compression:'STORE'}),fs.createWriteStream(file));
  console.log(`Combined download ready: ${file}`);
}
if(require.main===module)bundle().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={bundle};
