# Bundled database browser

Standalone installers include phpMyAdmin 5.2.3 separately from the pinned PHP,
Apache and MariaDB runtime. Adding the browser does not replace database files,
change their schema, upgrade the server runtime or copy database credentials.

The build input is the complete official all-languages ZIP, including Composer
dependencies and license notices. Its SHA-256 is pinned from the project's
[published checksum](https://files.phpmyadmin.net/phpMyAdmin/5.2.3/phpMyAdmin-5.2.3-all-languages.zip.sha256).
The [official downloads page](https://www.phpmyadmin.net/downloads/) identifies
5.2.3 as the stable release compatible with the bundled PHP 8.2 and MariaDB 10.4.
The optional `setup/` wizard is removed deterministically; all other upstream
files are retained. The prepared inventory is also pinned in `source.lock.json`.
The original GPL license and third-party notices remain in the distribution.

Fetch once on the build computer:

```sh
node installer/phpmyadmin/fetch.cjs
```

Then `node installer/phpmyadmin/fetch.cjs --offline` and the existing standalone
offline build commands use the verified cache. A complete prepared cache works
without its ZIP. If only the ZIP is cached, setup extracts it offline after
verifying the pinned archive hash and size. Missing or modified cached inputs
stop the build. No Composer install or network access is needed on the client.

The builder adds `setup/phpmyadmin/`, `setup/phpmyadmin-manifest.json` and
`setup/verify-phpmyadmin.php`. The main manifest includes `phpMyAdminVersion` and
`phpMyAdminSha256`; the latter authenticates the ordered per-file hash/size
inventory. Both platform installers verify the pristine payload before adding
their generated configuration. The verifier intentionally rejects local
`config.inc.php`, extra files, missing dependencies and symbolic links.

macOS setup serves the installed copy at `http://localhost:8080/lightem-db/`. Windows
uses `/lightem-db/` on its recorded server port: port 8080 for new installs,
or port 80 for older installations that retain it. Older Windows standalone
`/phpmyadmin/` bookmarks redirect to `/lightem-db/` on that same port. Older Mac
`/admin/` links redirect to `/lightem-db/`, preserving the remaining path and query;
the Mac `/phpmyadmin/` route remains unavailable.
The `/lightem-db/` path separates browser login cookies from XAMPP's `/phpmyadmin/`.
Mac standalone uses port 8080, leaving port 80 available for XAMPP Apache.
Apache limits this route to `127.0.0.1` and `::1`; POS clients on the network do
not receive access. Cookie authentication asks for database credentials and
always connects to the private database on `127.0.0.1:3307`. The persistent
cookie-encryption secret and writable temporary directory are created on each
device; they are not distributed in the offline package. The setup wizard and
private dependency/configuration paths remain inaccessible over HTTP.

Checks:

```sh
node --test installer/phpmyadmin/prepare.test.cjs installer/tests/build.test.cjs installer/tests/phpmyadmin-config.test.cjs
# On macOS with the verified runtime and browser-manager caches:
python3 installer/tests/phpmyadmin-smoke.py
```

The Node tests use tiny isolated distributions and a real ZIP to prove offline
extraction, integrity enforcement and separation from the runtime. When the
private Mac PHP cache is available, they also execute the actual install-time
PHP verifier against the same inventory.

The HTTP smoke test starts an isolated Apache/PHP process on a temporary port,
with access to installed databases blocked. It checks the login page, referenced
JavaScript/CSS, case-insensitive PHP handling, denied private files, local Host
restrictions, and denial of LAN access while the POS API remains reachable.
It does not start or change a database, register services, or alter the installed
application. The platform installers also require a working login page before
reporting success.
