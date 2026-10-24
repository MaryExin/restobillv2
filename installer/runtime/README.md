# Lightem private runtime

This is a separate build flavor. It packages only the PHP, Apache and MariaDB
components needed by Lightem. It never installs XAMPP, XAMPP Manager,
FTP, sample databases or a shared web root on the customer's computer.

The standalone installer also packages [phpMyAdmin](../phpmyadmin/README.md)
separately for authenticated database access from this computer's browser.

`prepare.cjs` reads pinned build inputs, copies an explicit allowlist of runtime
files, relocates the macOS Mach-O dependencies to `@loader_path`, and writes an
inventory of SHA-256 digests. Code and notices are the only input: no source
`htdocs`, `etc`, `var`, `data`, credentials, logs or settings are copied.

The initial component versions deliberately match the existing deployment:
PHP 8.2.4, Apache 2.4.56 and MariaDB 10.4.28. These older versions require a
separate component upgrade before treating a deployment as internet-facing.
The HTTP API can be reachable on the local network; MariaDB must listen only on
loopback and have per-installation credentials. Do not expose its port remotely.

macOS binaries are x86_64 and need Rosetta on Apple Silicon. They are copied
from the developer's pinned installation as build inputs, not run from it after
installation. Only the individual files listed in `sources.lock.json` are used.
Apple system frameworks are the only permitted external linked dependencies.
Windows input is the official Apache Friends portable archive, stripped down
at build time; its archive digest and per-file digests are pinned in the lock.

To refresh a cache deliberately (after reviewing changed hashes):

    node installer/runtime/prepare.cjs seed --platform darwin --source /path/to/pinned/runtime
    node installer/runtime/prepare.cjs seed --platform win32 --source /path/to/extracted/xampp

Subsequent installer builds use `prepareRuntime({platform, payload, offline})`.
`payload/runtime` contains the verified tree and `runtime-manifest.json`.
The cached tree can be copied to another build machine without XAMPP installed.
The lock file is reviewed source; cache files are ignored build artifacts.

Runtime configs, service accounts, backend files and database data are created
by the standalone platform installer. They are never taken from these inputs.
Original licenses and the MariaDB third-party notice accompany the runtime.
The binaries are redistributed under their original licenses; source releases
are linked in `NOTICE.md` and must remain available when distributing builds.

For Windows, `node installer/runtime/fetch.cjs` downloads the pinned official
portable archive, verifies its SHA-256 and size, extracts it only as a build
input, and prepares the stripped runtime. Add `--offline` to require the cached
archive. No installer executable is run. macOS bootstrap SQL comes from the
matching official MariaDB `mariadb-10.4.28` source tag, because the Mac distributor
omits several initialization files. Those SQL files contain system definitions,
not a customer's database. The GIS template substitutes only the three official
bootstrap delimiter placeholders; the source hash is locked before substitution.

Verification:

    node --test installer/runtime/*.test.cjs
    python3 installer/runtime/smoke-mac.py
    python3 installer/runtime/smoke-migration.py

The Mac smoke test uses the actual standalone installer's configuration writer,
an empty temporary database and ephemeral loopback ports. It denies all reads
of `/Applications/XAMPP`, checks password authentication and PHP over production
Apache, then stops its isolated processes and deletes the fixture. It does not
create OS users, register services, alter existing databases or validate the
installed service-account ACLs. Windows runtime files and PE dependency imports
are verified; full Windows service installation requires a Windows test device.

The migration smoke test starts two disposable MariaDB servers from the private
runtime, both with generated passwords and ephemeral loopback ports. It creates
a synthetic legacy store named `festivalmall` / `festivalmall_report`, then runs
the real migration into `db_cnc_pos` / `reports_database`. Its checks cover row
values, cross-database views and foreign keys, stored programs, unchanged source
settings and data, and a verified resume. Reads of `/Applications/XAMPP` are
denied throughout; no customer database or installed service is used. Both
temporary servers and all fixture files are removed even when a check fails.

Windows PHP and Apache include the matching app-local Visual C++ runtime DLLs
from the verified portable archive. Windows TLS explicitly uses its bundled
CA file; macOS TLS uses the operating system /etc/ssl/cert.pem trust bundle.
The installed config must set both curl.cainfo and openssl.cafile so compiled
vendor defaults cannot point back to an old XAMPP installation.
