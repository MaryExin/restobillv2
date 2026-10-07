# Lightem all-in-one setup

For the separate build with its own server services and no XAMPP dependency, see [Standalone setup](STANDALONE.md). Use `npm run standalone -- installer:all --offline` to build it, or `npm run standalone -- installer:bundle` to combine its already-built setup apps. The commands below continue to build the XAMPP edition.

**Lightem Setup** is a native app with matching Windows and Mac builds and the same light-blue Windows/Mac selection screen. It installs the POS desktop application, **XAMPP 8.2.4-0 / PHP 8.2.4**, the PHP backend, its Composer dependencies, environment configuration, and databases named **`db_cnc_pos`** and **`reports_database`**. End users do not need Node, Composer, a terminal, or a separate XAMPP download.

`npm run installer:bundle` puts both setup apps into a single **Windows-and-Mac.zip** download. Extract it, open the Windows `.exe` or extract the Mac ZIP and open **Lightem Setup.app**. Choose the current computer's operating system in the app to install, update, or repair the system. Choosing the other system saves its complete installer for another computer. Both full installers are embedded, so this works offline. The setup app opens the operating system's installation wizard when administrator access is needed.

## Installation and updates

- A fresh device receives empty primary/report databases, default store settings, and a generated administrator login. No sales, customers, existing accounts, cloud credentials, or signing keys from the build computer are copied. Finish store, product, receipt and printer configuration before trading.
- An existing recognizable Lightem installation is checked before an update. Its databases, `.env`, API database configuration, receipt/printer settings and uploads are retained. App and backend recovery copies are kept outside the web root. An unrelated application or different XAMPP version is rejected.
- On Windows, an absent or completely empty `C:\xampp` folder receives the bundled XAMPP automatically. A nonempty folder, including hidden files or leftover subfolders, must pass the existing runtime checks; setup preserves its contents if the runtime is incomplete.
- A build record lets setup reject older releases. Re-running the same release can repair the app/backend without reimporting the databases.
- Apache and MySQL start automatically with the operating system. The default local ports remain **80 and 3306**, because the existing POS contains calls to `http://localhost/api`.
- Uninstalling the Windows desktop app deliberately retains XAMPP and the databases.

The app checks for releases at startup and every six hours. Use **System updates → Check for updates** or **Ctrl+Shift+U** (Mac: **Cmd+Shift+U**) for a manual check; press Alt to reveal the Windows menu. The user chooses when to install. Downloaded packages must match the release's size and SHA256 before they can launch. Offline devices can run the exact same full setup package from a USB drive.

Default feed: `https://github.com/MaryExin/restobillv2/releases/latest/download/latest.json`.

The updater checks the **current device**. This does not create a remote inventory or tracking dashboard for all customer machines.

## Building the setup apps

Keep the project's normal `npm run dist` / `dist:mac` commands for desktop-only builds. Use the following commands for complete installers and updates:

```sh
# Use the same version and UTC build ID for both artifacts.
npm run installer:win -- --version 0.0.2 --build-id 20261001090000
npm run installer:mac -- --version 0.0.2 --build-id 20261001090000
npm run installer:release
npm run setup:win
npm run setup:mac
npm run installer:bundle
```

Mac defaults to a universal app for Intel and Apple Silicon. Build its package on macOS. Windows targets x64 and can be packaged on Windows or from macOS using electron-builder's tools. The compiler needs the project dependencies (`npm ci`) and the existing working XAMPP Composer vendor directory. The default vendor source is this device's XAMPP `htdocs/vendor`; override with `--vendor /path/to/vendor` or `LIGHTEM_VENDOR_DIR` on another build computer. Only Composer's declared packages and autoloader are copied, including their license files.

The first online build downloads/caches the pinned XAMPP installer and Electron packaging tools. Add `-- --offline` to either `setup:` command, or `--offline` after the existing arguments on either `installer:` command, for subsequent builds with all dependencies and tools already cached. Offline mode checks tool caches before packaging and blocks network downloads. Installation itself embeds the XAMPP runtime, vendor files, backend and POS app.

The user-facing apps and combined download are under `release/setup-app/`. The complete Windows `.exe` and Mac `.pkg` that they launch are under `release/full-setup/`; these are also the online update payloads. Both platform builds must have matching versions/build IDs before packaging the selection apps. Staging files and runtime caches under `installer/stage/` and `installer/cache/` are ignored by Git. Versioned source and schema files contain no deployment credentials. Never commit the device's `.env`, database dumps with rows, or private signing credentials.

## Publishing an online update

1. Build both installers with the same version and build ID, then run `npm run installer:release`.
2. Create a GitHub release in `MaryExin/restobillv2` with the tag printed by that command, such as `v0.0.2-20261001090000`.
3. Upload the Windows `.exe`, Mac `.pkg`, and the combined `release/full-setup/latest.json` to that release. Keep it a draft until all three assets have uploaded and installation has passed on test devices.
4. Publish it as the latest stable release. Already-installed apps will discover it automatically.

For new customers, also upload the two native setup apps or the combined Windows-and-Mac ZIP from `release/setup-app/`. Rebuild those apps for each release so their embedded offline installers stay current. Their **Check this computer for updates** button checks the same release feed.

Do not upload a desktop-only installer to this feed: a system update must deliver the matching backend. Changing installer bytes after generating `latest.json` requires recalculating its size and SHA256. For one platform only, its directory also has an individual `latest.json`.

No GitHub release is published by the build scripts. Building is local and does not update the XAMPP/app installed on the development computer.

## Recovery and platform details

If a Windows installation check fails, the dialog displays the PowerShell error. Failures that occur before the regular log is created (for example, a PowerShell startup error) are captured too. For failures after logging starts, open the newest `setup-*.log` under `%ProgramData%\Lightem\Installer\logs`. The bundle's `READ ME FIRST.txt` is only setup instructions; Windows creates its diagnostic logs on the device being installed. Keep the reported error when requesting support; do not disable installation checks to continue.

Windows logs and recovery copies: `%ProgramData%\Lightem\Installer\`. The PHP API is installed in `C:\xampp\htdocs\api`, with sibling `src`, `vendor`, and `.env`. Initial login and database-recovery files are protected by administrator ACLs.

Mac installation failures report the failed step and exit code to the macOS Installer log. Choose **Window → Installer Log** (**Command+L**), select **Show All Logs**, and save it when requesting support. Detailed output remains in the protected `/var/log/lightem-setup.log`; the latest failure summary is `/Library/Application Support/Lightem/last-setup-error.txt`. In Terminal, `sudo tail -n 60 /var/log/lightem-setup.log` displays recent details. If that file does not exist, use the macOS Installer log; setup may have failed before Lightem could create its log.

Mac recovery files: `/Library/Application Support/Lightem/backups/`. The API is under `/Applications/XAMPP/xamppfiles/htdocs/api`. On fresh installation the POS-only initial login is copied to the installing user's Desktop; the complete recovery file remains administrator-only.

Mac setup waits up to 30 seconds after requesting Apache shutdown, checking that port 80 is free and XAMPP's Apache workers have exited before replacing backend files. The same check protects rollback. If shutdown cannot be confirmed, setup retains the files and recovery copies for troubleshooting instead of forcing processes to exit.

If a Mac's backend files were removed but its managed-installation marker remains, setup treats it as a repair. It uses surviving settings or a complete protected local backup, verifies the existing databases from a private staging folder, then restores the backend and missing settings. Conflicting backup settings or missing recovery files stop setup before replacement. This does not create new databases or reset existing sales/accounts. Deleting the desktop app alone does not require resetting the backend or databases.

XAMPP's matching Mac release uses Intel binaries. **Apple Silicon needs Rosetta**; a first-time Rosetta installation requires internet from Apple. Once Rosetta is present, the bundled Mac installer can run offline. Setup requests the operating system's normal administrator authorization.

Mac setup runs the bundled XAMPP installer with its normal public-file permissions while keeping Lightem settings and backups private. It also repairs the known XAMPP shortcuts and adds Apple Silicon handling to the stock XAMPP Manager launcher, retaining the Manager's administrator prompt. The original launcher is backed up before modification. Re-running setup applies this repair to an existing installation without resetting databases; it does not recursively relax backend or database permissions.

Existing database columns are verified before upgrades. A release requiring new schema columns must include a separately reviewed migration process; setup currently stops with a clear migration-required error rather than changing an existing database. Fresh schemas are derived from the project's available SQL schema snapshots, with indexes/constraints retained and all application rows and historical counters removed. Only reviewed permission/discount defaults and a new local store/login are seeded.

The current packages are unsigned unless release signing credentials are configured in the build environment. Windows and macOS may show their normal publisher-verification prompts. Production distribution should use your Windows signing certificate and Apple Developer signing/notarization.

## Validation

```sh
npm run installer:test
# Windows PowerShell: checks error reporting without running installer actions.
powershell -NoProfile -File installer/tests/windows-diagnostics.test.ps1
powershell -NoProfile -File installer/tests/windows-runtime.test.ps1
# Mac PHP: isolated filesystem recovery checks, no database access.
/Applications/XAMPP/xamppfiles/bin/php installer/tests/recovery.test.php
```

Also lint the PHP helpers with XAMPP PHP and validate `installer/mac/postinstall` with `bash -n`. A clean-device installation and an upgrade with existing sales must be smoke-tested on each target OS before publishing. Test interrupted installs, occupied ports, a different XAMPP version, downgrade rejection, preserved uploads/settings, generated login, restart service behavior, and an online update from a previously installed build.

References: [XAMPP 8.2.4 release](https://www.apachefriends.org/blog/new_xampp_20230408.html), [electron-builder NSIS customization](https://www.electron.build/v26/docs/nsis/).
