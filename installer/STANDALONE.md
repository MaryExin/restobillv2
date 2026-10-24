# Lightem standalone setup

This is a separate Windows/Mac installer edition. It installs the desktop POS, backend, Composer dependencies and private PHP/Apache/MariaDB services. Client computers do not need XAMPP. The original `installer:*` and `setup:*` commands continue to build the XAMPP edition.

## Build commands

Run the complete build on a Mac with the project's dependencies and offline packaging/runtime caches prepared:

```sh
npm run standalone -- installer:all --offline
```

This builds the Windows and Mac full installers with one build ID, prepares their update feed, builds both native setup apps with both full installers embedded, and creates the combined ZIP. To combine already-built matching setup apps:

```sh
npm run standalone -- installer:bundle
```

A fix for one platform can be delivered through the same shared setup screen
without rebuilding the other platform's full installer. Keep the working full
installer and its `release-entry.json` in its existing output folder, build only
the changed platform with the same semantic version and a newer build ID, then
rebuild both native setup wrappers:

```sh
npm run standalone -- installer:win --offline --version 0.0.1 --build-id 20261001100000
npm run standalone -- installer:release
npm run standalone -- setup:win --offline
npm run standalone -- setup:mac --offline
npm run standalone -- installer:bundle
```

Both wrappers embed the corrected Windows installer and the unchanged Mac
package. Their common bundle build ID is the newer of the two full installer
build IDs. Each embedded installer keeps its own version/build ID and checksum;
the selected platform's identity controls update comparisons, labels and saved
installer filenames. The Mac setup wrapper is rebuilt to include the new
Windows option, while the working Mac `.pkg` remains byte-for-byte unchanged.
Different semantic versions or mixed standalone/XAMPP editions are rejected.

Individual steps are available:

```sh
npm run standalone -- installer:win --offline --version 0.0.2 --build-id 20261001090000
npm run standalone -- installer:mac --offline --version 0.0.2 --build-id 20261001090000
npm run standalone -- installer:release
npm run standalone -- setup:win --offline
npm run standalone -- setup:mac --offline
npm run standalone -- installer:bundle
```

Output is isolated under `release/standalone/full-setup/` and `release/standalone/setup-app/`. Staging is under `installer/stage/standalone/`. The final download is `Lightem-Standalone-Setup-<version>-<buildId>-Windows-and-Mac.zip`. The command accepts npm's standard `--` separator; it is one `standalone` script followed by a subcommand.

Vendor packages default to `installer/cache/build-vendor`; override with `--vendor /path/to/vendor`. Only declared Composer packages are included. No deployment credentials, uploaded images, existing accounts or sales rows are packaged. See [runtime preparation](runtime/README.md) for pinned binary sources, integrity checks, licenses and cache preparation. The runtime currently uses PHP 8.2.4, Apache 2.4.56 and MariaDB 10.4.28; validate newer runtime versions before replacing that pinned set. Runtime binaries are assembled from verified development inputs; XAMPP itself is not installed on customer devices.

## Installation

Extract the combined ZIP, then open the native Windows setup executable or extract the Mac ZIP and open `Lightem Setup.app`. Both show the Windows/Mac selection screen. The **Copy data from XAMPP** checkbox appears above the platform cards and starts unchecked. Leave it unchecked to install without inspecting or starting XAMPP. Selecting this computer installs locally; selecting the other OS saves its default full installer for another computer. To import on another computer, open that platform's native setup app from the combined ZIP there.

Install the standalone server on the main store computer. New Windows installations use `http://<store-computer-LAN-IP>:8080/api` for POS/tablet devices; macOS uses `http://<store-computer-LAN-IP>:8080/api`. Existing Windows standalone installations retain their recorded HTTP port when updated. The backend accepts local/private network clients. MariaDB listens on loopback port 3307 only. The database names remain `db_cnc_pos` and `reports_database`. Root and application accounts receive generated passwords; credentials are never included in the public installation descriptor. Administrator/root control of the host still permits access to its local files.

Windows installs a separate **Lightem Pos Standalone** desktop app and profile. It uses `C:\ProgramData\LightemStandalone` and the `LightemDatabase` / `LightemApache` services. macOS uses `/Library/Application Support/LightemStandalone`, versioned binaries under `/Library/Lightem/runtime`, and launchd jobs `com.lightem.standalone.database` / `com.lightem.standalone.http`. Services start automatically with the operating system. On Apple Silicon, the bundled Intel server binaries need Rosetta; its first installation requires internet. Installation is otherwise offline.

Fresh installs create empty databases and an initial administrator login. Configure the store before trading. Close connected standalone POS applications before updating. The installer checks its own occupied ports and service ownership before replacement.

**Windows coexistence:** new standalone installations use HTTP port 8080. Only checking **Copy data from XAMPP** requests source inspection and copying into the private databases. Unchecked setup creates an empty store when no standalone store exists; it does not require XAMPP to be installed or running. Keep the recognized `C:\xampp` MySQL server running on localhost port 3306 and pause sales during the copy. For direct or unattended Windows setup, `/COPYXAMPP` explicitly requests a copy; the default without it starts empty when no private store exists. Setup validates both databases with its own bundled PHP, copies settings/media and data, then checks the copy against the source. XAMPP PHP is never executed or reconfigured, so GD may remain disabled or absent there. XAMPP services and their startup settings are not changed. Its apps and database browser continue using their original server on port 80.

The Windows desktop has a separate install identity, directory and settings, and rejects a destination containing another app. Existing XAMPP sales, POS logins and settings are retained in the copied backend; the standalone database account gets a generated password. The two stores are independent after copying; they do not synchronize subsequent changes. If source data changes while copying, setup refuses to activate an inconsistent copy. The original databases stay intact.

Existing Windows standalone updates preserve their private databases and recorded port (80 for older installations, 8080 for new ones), without copying over them from XAMPP. When upgrading an earlier standalone desktop that shared the old app name, setup copies only its proven matching terminal, printer and business settings to the new separate app; the previous application remains installed. An unfinished copy retains its private data and credentials; select the import checkbox again to resume it. With import unchecked, setup stops before accessing XAMPP and explains how to resume instead of replacing partial data with an empty store. If another program occupies standalone's selected port or database port 3307, setup stops without changing that program.

Windows updates and copies of older stores accept the complete absence of two legacy optional tables: `tbl_pos_discount_type_sales_type` and `tbl_pos_zreading_archive_log`. Setup preserves that schema rather than creating these tables. Without the discount mapping table, custom discount setup is unavailable and custom-discount queries return no options; built-in statutory/manual discounts continue to use their existing behavior. An authorized database reset skips only these two tables when absent. Missing columns in a present table, and missing required tables, still block an update. Fresh databases must pass the complete bundled schema check. Verification reports the absent optional tables in `optionalTablesUnavailable`.

**macOS coexistence:** standalone uses HTTP port 8080, including when updating an earlier standalone installation from port 80. Local desktop connection settings follow the new port; intentionally configured remote servers are preserved. Only checking **Copy data from XAMPP** copies a recognized local XAMPP store with both databases, backend settings and media. Default setup ignores XAMPP and creates an empty store when no standalone store exists. Keep XAMPP MySQL running and pause sales on connected devices during the copy. Its services and startup jobs are not stopped or reconfigured. Setup verifies schema, rows and stored database objects before activating the private backend. Existing POS logins and JWT settings are retained, and the application database password is rotated. The original XAMPP files/databases remain available for recovery. Interrupted migrations require the import checkbox to be selected again and may resume only when both source and copied data still match the saved verification record; changed data requires review. Failed checks stop setup without silently replacing an unrecognized database. Keep XAMPP until migration and store testing have succeeded.

Operational database backups use the private `database-backups` directory outside the web root. Installer recovery copies and generated credential files remain administrator-only.

## Desktop configuration included in the build

Standalone builds use the desktop settings in this checkout's `public/` folder: `ip.txt`, `printer.txt`, `businessInfo.json`, `pos-config.json`, and `printer_categories.json`. The tenant is taken from `public/ip.txt` (currently `CRABSNCRACK`). The builder changes only the `LOCAL` address to `http://localhost:8080`; it preserves the source `WEB` and `TENANT` values. Product and sales sync resolve their online server from `TENANT`. The current source `WEB: https://` is a placeholder, not a resolved server address.

These files are written beside `app.asar` in the installed Windows app's `resources/` folder, and under `/Applications/Lightem Pos.app/Contents/Resources/` on Mac. Matching copies are packaged in `resources/images/` and the frontend bundle. The original `public/` files are not modified by the build. Edit those source files before building for a different store or terminal. Receipt and printer defaults are copied as provided, including any placeholders in the source.

Updates restore existing desktop settings first, then fill missing or blank values from the packaged defaults. Existing nonblank tenant, endpoint, printer, business and terminal settings are retained. A different existing tenant is not populated with this build's store profile. Existing arrays are retained, including deliberately empty printer category lists. This repairs the blank tenant from earlier standalone installers without resetting databases or overwriting configured devices.

Electron generates the application archive, native unpacked modules, icons and Windows elevation helper. Standalone updates use `system-release.json` and the built-in updater; the legacy `app-update.yml` file is not needed.

The Mac build produces a default `.pkg` and a separate `-import-xampp.pkg` with the same application/backend payload. Only the protected installer script's fixed import selection differs. Both checksums are recorded in release metadata and both variants are embedded in each native setup app; the checkbox selects the verified variant without writing a shared migration flag to the client. Online updates use the default package and preserve the existing standalone store. Keep the import package with its release when publishing setup bundles.

## Browser database access

On macOS and new Windows standalone installations, open **http://localhost:8080/lightem-db/** on the store computer. Windows installations that retain port 80 use **http://localhost/lightem-db/**. Windows updates keep the recorded server port, and older standalone `/phpmyadmin/` links redirect to `/lightem-db/` on that same port. Older Mac `/admin/` links redirect to `/lightem-db/`, preserving the remaining path and query.

The `/lightem-db/` path keeps standalone browser login cookies separate from XAMPP's `/phpmyadmin/`. On macOS, XAMPP can use port 80 while standalone uses 8080. Update tablet API settings to `http://<Mac-LAN-IP>:8080/api` after upgrading an earlier port-80 standalone installation. The old Mac standalone `/phpmyadmin/` route is no longer served.

phpMyAdmin is included in the standalone installer and works offline without XAMPP or DBeaver. Sign in with the generated database username and password, not the POS login. The server is fixed to `127.0.0.1:3307`; both `db_cnc_pos` and `reports_database` are available according to the account's database privileges. Import, export and SQL actions use those same privileges.

Database credentials are in the protected `initial-access-*.txt` file: on macOS under `/Library/Application Support/LightemStandalone/secrets`, and on Windows under `C:\ProgramData\LightemStandalone\Installer\credentials`. Use administrator access to read that file. Updates keep the existing credentials. Do not use an empty root password.

The browser manager accepts only loopback connections with a localhost/loopback Host header. Other POS devices continue using the LAN API; they cannot open this database manager. Cookie authentication requires a password; no database login is stored in the phpMyAdmin configuration. Its per-device cookie key and temporary files are private. Setup does not create phpMyAdmin storage tables or upgrade either database.

The official phpMyAdmin distribution is separately pinned and verified; see [browser-manager packaging](phpmyadmin/README.md). A browser-manager update does not change the server-runtime hash or database engine.

## Updates

Standalone metadata uses `runtimeKind: standalone` and `latest-standalone.json`. The app checks online using the same update menu/timer as the XAMPP edition, but rejects releases from the other edition. Offline updates use the same full installer from the ZIP. Frontend/backend updates retain existing databases and settings; a different server-runtime hash requires a separately tested engine migration and is deliberately rejected.

Full releases normally use the same version/build ID for both platforms. A
standalone platform-only fix may retain the other platform's earlier build at
the same semantic version. Keep every platform's release URL, build ID and
checksum accurate when publishing the combined feed; retain the existing Mac
asset at its original URL if its package is unchanged. `installer:release`
prints the standalone GitHub release tag. Rebuild both native setup wrappers
and the combined ZIP so either platform-selection screen exports the current
Windows and Mac packages. Scripts do not publish releases or install into the
development machine.

Both edition feeds currently use GitHub's `releases/latest/download` address. When making a release the latest stable release, attach **both** `latest.json` and `latest-standalone.json`, retaining the unchanged edition's last valid feed. Each feed points to its own versioned installer URLs. This keeps both channels reachable when only one edition changes. Keep the release a draft until all assets are uploaded and clean-device and existing-store installation tests pass.

## Diagnostics and validation

Windows logs: `C:\ProgramData\LightemStandalone\Installer\logs`. Mac log: `/var/log/lightem-standalone-setup.log`; macOS Installer also shows the failed step. The bundled README is instructions, not an installation log.

After Windows administrator approval, a preparation window stays visible while setup extracts its embedded files, checks the device/database and backs up the existing app. These checks happen before the installation wizard and before replacing the app. Offline setup does not download another update. Close any older setup attempt and its Notepad report before retrying with this build.

Windows setup opens a diagnostic report in Administrator Notepad after an installation failure, then exits without waiting for Notepad. The report stays in a new administrator-only `LightemSetupReport-{GUID}` folder under Common Files; keeping it open no longer blocks another setup attempt. Use **File > Save As** to keep a copy in Documents or on USB. The report includes the exact full log path when logging started; the log folder is hidden under ProgramData and requires administrator access. An interrupted first installation may leave a Windows service even if no desktop app is installed. Setup can complete its service account configuration only when the stopped service, protected installation marker, configuration paths and original runtime inventory prove it belongs to that unfinished setup. Unrelated services and completed installations with changed service accounts are preserved for review.

```sh
npm run installer:test
node --test installer/runtime/*.test.cjs
bash -n installer/mac-standalone/postinstall
# Windows-compatible PowerShell fixture suite; does not install services:
pwsh -NoProfile -File installer/tests/windows-standalone.test.ps1
pwsh -NoProfile -File installer/tests/windows-standalone-recovery.test.ps1
pwsh -NoProfile -File installer/tests/windows-coexistence.test.ps1
pwsh -NoProfile -File installer/tests/windows-desktop-transition.test.ps1
# Optional isolated Mac-host smoke for Windows browser routing (no live database access):
python3 installer/tests/phpmyadmin-smoke.py --windows-routes
```

The runtime tests include fresh MariaDB initialization, authenticated PHP/DB access, and Apache/PHP under a sandbox that denies access to XAMPP. Disposable database tests cover migration, preservation, failure rollback and resume verification. These checks supplement actual Windows and Mac installation/upgrade/reboot testing; they do not replace it. Packages are unsigned unless signing credentials are configured.
