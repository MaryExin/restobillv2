#!/usr/bin/env python3
"""Exercise standalone provisioning with the real macOS service identities.

Run explicitly as root after reviewing this file. The existing _lightemdb and
_lightemhttp accounts are required; this test never creates accounts, registers
services, reads installed settings/data, or opens XAMPP. It uses only temporary
databases, random loopback ports and a read-only runtime/payload. Every child is
sandboxed against XAMPP. Cleanup kills only child process groups started here.
"""
import argparse
import grp
import hashlib
import json
import os
import pathlib
import pwd
import secrets
import shutil
import signal
import socket
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request


REPO = pathlib.Path(__file__).resolve().parents[2]
ENV = {'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'PHP_INI_SCAN_DIR': ''}


def extract(source, start, end):
    if source.count(start) != 1 or source.count(end) != 1:
        raise RuntimeError('Production source boundaries changed; review smoke test.')
    return source.split(start, 1)[1].split(end, 1)[0]


def free_port(exclude=()):
    for _ in range(20):
        with socket.socket() as connection:
            connection.bind(('127.0.0.1', 0))
            port = connection.getsockname()[1]
        if port not in exclude and port not in (80, 3306, 3307):
            return port
    raise RuntimeError('Could not reserve an isolated test port.')


class Fixture:
    def __init__(self, runtime, payload):
        read_only = [runtime, payload, pathlib.Path('/Library/Application Support/LightemStandalone'),
                     pathlib.Path('/Library/LaunchDaemons'), pathlib.Path('/Applications')]
        profile = ('(version 1)(allow default)'
                   '(deny file-read* (subpath "/Applications/XAMPP"))'
                   '(deny file-write* ' + ' '.join('(subpath ' + json.dumps(str(path)) + ')'
                                                 for path in read_only) + ')')
        self.policy = ['/usr/bin/sandbox-exec', '-p', profile]
        # Keep the complete Unix socket path below Darwin's 104-byte limit.
        self.base = pathlib.Path(tempfile.mkdtemp(prefix='lt-svc-', dir='/private/tmp'))
        self.identity = (self.base.stat().st_dev, self.base.stat().st_ino)
        self.nonce = secrets.token_hex(24)
        self.token = self.base / '.fixture-owner'
        self.token.write_text(self.nonce)
        self.token.chmod(0o600)
        self.base.chmod(0o711)
        self.children = []
        self.phase = 'initializing fixture'
        self.env = dict(ENV)

    def start(self, args, user=None, group=None, env=None, capture=False):
        options = {}
        if user is not None:
            options.update(user=user, group=group, extra_groups=[])
        process = subprocess.Popen(
            self.policy + [str(argument) for argument in args],
            env=env or self.env, cwd=self.base, start_new_session=True,
            stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
            stderr=subprocess.PIPE if capture else subprocess.DEVNULL,
            text=True, **options)
        self.children.append(process)
        return process

    def run(self, args, timeout=60, **options):
        process = self.start(args, capture=True, **options)
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            raise RuntimeError('Command timed out during ' + self.phase) from None
        # Raw helper output can contain generated credentials on failure. Never
        # print it, or put credentials on the command line/in the environment.
        if process.returncode:
            raise RuntimeError('{} failed during {} (exit {}). Output suppressed to protect temporary credentials.'
                               .format(pathlib.Path(str(args[0])).name, self.phase, process.returncode))
        self.children.remove(process)
        return stdout

    def shell(self, script, env):
        return self.run(['/bin/bash', '-Eeu', '-o', 'pipefail', '-c', script], env=env)

    def passed(self, message):
        print('PASS: ' + message, flush=True)

    def close(self):
        # A foreground Apache parent owns its worker process group. No name,
        # port, PID file, system-service or account based termination is used.
        for process in reversed(self.children):
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait(timeout=10)
        self.children.clear()
        info = self.base.lstat()
        if (self.base.parent != pathlib.Path('/private/tmp')
                or not self.base.name.startswith('lt-svc-')
                or not stat.S_ISDIR(info.st_mode)
                or (info.st_dev, info.st_ino) != self.identity
                or self.token.is_symlink()
                or self.token.read_text() != self.nonce):
            raise RuntimeError('Fixture identity changed; refusing recursive cleanup.')
        shutil.rmtree(self.base)
        print('Isolated test processes stopped and temporary fixture removed.', flush=True)


def check_mode(path, owner, group, mode):
    info = path.stat()
    if (info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode)) != (owner, group, mode):
        raise RuntimeError('Unexpected production permissions on ' + path.name)


def wait_tcp(process, port):
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError('Isolated server exited before becoming ready.')
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.25):
                return
        except OSError:
            time.sleep(0.2)
    raise RuntimeError('Isolated server did not become ready.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', required=True, type=pathlib.Path,
                        help='Existing read-only /Library/Lightem/runtime/<buildId> directory')
    parser.add_argument('--payload', type=pathlib.Path,
                        default=REPO / 'installer/stage/standalone/darwin-universal/setup')
    args = parser.parse_args()
    if sys.platform != 'darwin' or os.geteuid() != 0:
        raise RuntimeError('This explicit service-identity smoke test requires macOS root; nothing was changed.')
    runtime = args.runtime.resolve(strict=True)
    payload = args.payload.resolve(strict=True)
    if runtime.parent != pathlib.Path('/Library/Lightem/runtime') or not runtime.name.isdigit():
        raise RuntimeError('Runtime must be an installed versioned standalone directory.')
    frozen_payload = (payload.parent == pathlib.Path('/private/tmp')
                      and payload.name.startswith('lightem-service-proof-payload-'))
    if REPO / 'installer/stage/standalone' not in payload.parents and not frozen_payload:
        raise RuntimeError('Payload must be standalone staging or an explicitly frozen smoke payload.')
    for relative in ['bin/php', 'bin/mysqld', 'bin/mysql_install_db', 'bin/httpd', 'bin/mysqldump']:
        if not (runtime / relative).is_file():
            raise RuntimeError('Standalone runtime is incomplete.')
    manifest = json.loads((payload / 'manifest.json').read_text())
    if manifest.get('runtimeKind') != 'standalone' or manifest.get('platform') != 'darwin':
        raise RuntimeError('Payload is not a standalone macOS build.')
    for relative in ['.env', 'api/config.php']:
        if (payload / 'backend' / relative).exists():
            raise RuntimeError('Payload contains existing installation settings.')
    if any(file.is_symlink() for file in payload.rglob('*')):
        raise RuntimeError('Smoke payload must contain only regular files and directories.')
    for name in ['provision.php', 'verify.php', 'database-admin.php']:
        if (payload / name).read_bytes() != (REPO / 'installer/common' / name).read_bytes():
            raise RuntimeError('Staged common helper differs from current source: ' + name)
    database_user, http_user = pwd.getpwnam('_lightemdb'), pwd.getpwnam('_lightemhttp')
    database_group, http_group = grp.getgrnam('_lightemdb'), grp.getgrnam('_lightemhttp')
    if (not 0 < database_user.pw_uid < 500 or not 0 < http_user.pw_uid < 500
            or database_user.pw_uid == http_user.pw_uid
            or database_user.pw_gid != database_group.gr_gid
            or http_user.pw_gid != http_group.gr_gid):
        raise RuntimeError('Expected existing dedicated system service identities were not found.')

    source = (REPO / 'installer/mac-standalone/postinstall').read_text()
    path_checks = 'die() {' + extract(source, '\ndie() {', '# BEGIN STANDALONE PROCESS CHECKS')
    bootstrap = extract(source, '# BEGIN STANDALONE BOOTSTRAP\n', '# END STANDALONE BOOTSTRAP')
    configuration = extract(source, '# BEGIN STANDALONE CONFIGURATION\n', '# END STANDALONE CONFIGURATION')
    configuration = configuration.split('\nregister_service()', 1)[0]
    storage_start = 'mkdir -p "$STATE/logs/http" "$STATE/logs/database" "$STATE/run/http" "$STATE/run/database"'
    storage = storage_start + extract(source, storage_start, "\nstep 'Initializing or checking the private database'")
    backend_start = 'chown -R root:_lightemhttp "$WEBROOT"'
    backend_permissions = backend_start + extract(source, backend_start, '\nrun_php "$PAYLOAD/verify.php" --root "$WEBROOT" --payload "$PAYLOAD"')
    if any(token in path_checks + bootstrap + configuration + storage + backend_permissions
           for token in ['launchctl', 'LaunchDaemons', 'dscl', 'ensure_service_account']):
        raise RuntimeError('Extracted test functions unexpectedly contain service/account management.')
    print('Source postinstall SHA256: ' + hashlib.sha256(source.encode()).hexdigest(), flush=True)
    fixture = Fixture(runtime, payload)
    try:
        state = fixture.base / 'Application Support/LightemStandalone'
        data, web = state / 'data', state / 'backend'
        if len(os.fsencode(state / 'run/database/mysql.sock')) >= 104:
            raise RuntimeError('Fixture socket path exceeds the macOS limit.')
        state.mkdir(parents=True)
        state.parent.chmod(0o755)
        state.chmod(0o711)
        for relative in ['accounts', 'secrets', 'backups', 'config', 'run', 'logs', 'backend', 'data', 'database-backups']:
            (state / relative).mkdir(mode=0o700)
        # Installer.app supplies a private root-only TMPDIR. Reproduce it for
        # every child so the real bootstrap/config must select service storage.
        installer_sandbox = fixture.base / 'PKInstallSandbox.fixture'
        installer_sandbox.mkdir(mode=0o700)
        installer_tmp = installer_sandbox / 'tmp'
        installer_tmp.mkdir(mode=0o700)
        fixture.env['TMPDIR'] = str(installer_tmp) + '/'
        shell_env = {**fixture.env, 'STATE': str(state), 'DATA': str(data), 'WEBROOT': str(web),
                     'RUNTIME': str(runtime), 'STEP': 'Isolated service smoke', 'LOG': str(fixture.base / 'smoke.log')}
        fixture.phase = 'simulating Installer.app root-only TMPDIR'
        denied_tmp_probe = ('import os,sys; sys.exit(0 if '
                            'os.environ.get("TMPDIR")==sys.argv[1]+"/" and '
                            'not os.access(sys.argv[1], os.R_OK|os.W_OK|os.X_OK) else 1)')
        fixture.run(['/usr/bin/python3', '-c', denied_tmp_probe, installer_tmp],
                    user=database_user.pw_uid, group=database_group.gr_gid)
        check_mode(installer_sandbox, 0, 0, 0o700)
        check_mode(installer_tmp, 0, 0, 0o700)
        fixture.passed('Installer.app TMPDIR is inherited and inaccessible to _lightemdb')
        fixture.phase = 'production storage permissions'
        fixture.shell('exec 3>&2\n' + path_checks + storage, shell_env)
        check_mode(data, database_user.pw_uid, database_group.gr_gid, 0o700)
        check_mode(state / 'run/database/tmp', database_user.pw_uid, database_group.gr_gid, 0o700)
        check_mode(state / 'database-backups', http_user.pw_uid, http_group.gr_gid, 0o700)
        fixture.phase = 'production database bootstrap under Application Support'
        fixture.shell(bootstrap + '\nbootstrap_database\n', shell_env)
        fixture.passed('actual bootstrap_database ignores inaccessible Installer TMPDIR; path with spaces and _lightemdb ownership')
        php = [runtime / 'bin/php', '-n']
        secret, init = state / 'secrets/database-root.txt', state / 'run/database-init.sql'
        fixture.phase = 'private administrator init-file generation'
        fixture.run(php + [payload / 'database-admin.php', '--data-dir', data,
                           '--credentials', secret, '--prepare-init-file', init])
        os.chown(init, 0, database_group.gr_gid)
        init.chmod(0o640)
        check_mode(secret, 0, 0, 0o600)
        dbport, httpport = free_port(), free_port()
        while httpport == dbport:
            httpport = free_port((dbport,))

        def configure():
            fixture.shell(configuration + '\nwrite_configuration\n', shell_env)
            substitutions = [('database.cnf', 'port=3307', 'port=' + str(dbport)),
                             ('php.ini', 'mysqli.default_port=3307', 'mysqli.default_port=' + str(dbport)),
                             ('httpd.conf', 'Listen 80', 'Listen 127.0.0.1:' + str(httpport))]
            for filename, before, after in substitutions:
                file = state / 'config' / filename
                text = file.read_text()
                if text.count(before) != 1:
                    raise RuntimeError('Production configuration changed: ' + filename)
                file.write_text(text.replace(before, after))
            check_mode(state / 'config/database.cnf', 0, database_group.gr_gid, 0o640)
            check_mode(state / 'config/httpd.conf', 0, http_group.gr_gid, 0o640)
            if ('tmpdir="' + str(state / 'run/database/tmp') + '"') not in (state / 'config/database.cnf').read_text().splitlines():
                raise RuntimeError('Production database configuration lacks its explicit service-owned temporary directory.')

        fixture.phase = 'production configuration and private database startup'
        configure()
        db = fixture.start([runtime / 'bin/mysqld', '--defaults-file=' + str(state / 'config/database.cnf')],
                           user=database_user.pw_uid, group=database_group.gr_gid)
        wait_tcp(db, dbport)
        fixture.phase = 'administrator security and exact temporary datadir verification'
        fixture.run(php + [payload / 'database-admin.php', '--data-dir', data,
                           '--credentials', secret, '--database-port', dbport])
        init.unlink()
        configure()
        fixture.passed('real _lightemdb process, protected init-file, password auth, loopback binding and exact datadir')
        fixture.phase = 'clean backend staging and fresh database provisioning'
        for relative in ['api', 'src', 'vendor']:
            shutil.copytree(payload / 'backend' / relative, web / relative)
        fixture.run(php + [payload / 'provision.php', '--root', web, '--payload', payload,
                           '--credentials', state / 'secrets/initial-access.txt',
                           '--bootstrap-password-file', secret, '--database-port', dbport,
                           '--mysqldump-path', runtime / 'bin/mysqldump',
                           '--runtime-group', '_lightemhttp', '--backup-dir', state / 'database-backups'], timeout=120)
        fixture.shell(backend_permissions, shell_env)
        for relative in ['.env', 'api/config.php']:
            check_mode(web / relative, 0, http_group.gr_gid, 0o640)
        fixture.run(php + [payload / 'verify.php', '--root', web, '--payload', payload])
        fixture.passed('fresh db_cnc_pos/reports_database provisioning, protected application credentials and schema verification')

        fixture.phase = 'HTTP worker permissions and actual database access'
        probe = web / 'service-smoke.php'
        probe.write_text('''<?php
header('Content-Type: application/json');
$state = dirname(__DIR__);
$config = require __DIR__ . '/api/config.php';
$pdo = new PDO('mysql:host=127.0.0.1;port=' . $config['port'] . ';dbname=' . $config['db'], $config['user'], $config['pass'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$report = new PDO('mysql:host=127.0.0.1;port=' . $config['port'] . ';dbname=' . $config['report_db'], $config['user'], $config['pass']);
$result = ['uid'=>posix_geteuid(), 'php'=>PHP_VERSION, 'timezone'=>date_default_timezone_get(), 'ini'=>php_ini_loaded_file(), 'db'=>$pdo->query('SELECT DATABASE()')->fetchColumn(), 'report'=>$report->query('SELECT DATABASE()')->fetchColumn(), 'databaseTmpdir'=>rtrim($pdo->query('SELECT @@tmpdir')->fetchColumn(), '/'), 'envReadable'=>is_readable(__DIR__ . '/.env'), 'rootSecretDenied'=>!is_readable($state . '/secrets/database-root.txt'), 'dataDenied'=>!is_readable($state . '/data'), 'uploadsWritable'=>file_put_contents(__DIR__ . '/uploads/worker-proof.txt', 'proof')===5, 'backupsWritable'=>file_put_contents($state . '/database-backups/worker-proof.txt', 'proof')===5];
echo json_encode($result);
''')
        os.chown(probe, 0, http_group.gr_gid)
        probe.chmod(0o640)
        for relative, content in [('images/service-smoke.jpg', b'fixture-image'),
                                  ('uploads/service-smoke.PHP', b'<?php echo "must-not-execute";')]:
            target = web / relative
            target.write_bytes(content)
            os.chown(target, http_user.pw_uid, http_group.gr_gid)
            target.chmod(0o640)
        fixture.run([runtime / 'bin/httpd', '-t', '-f', state / 'config/httpd.conf'])
        http = fixture.start([runtime / 'bin/httpd', '-DFOREGROUND', '-f', state / 'config/httpd.conf'])
        wait_tcp(http, httpport)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        url = 'http://127.0.0.1:' + str(httpport) + '/'
        with opener.open(url + probe.name, timeout=10) as response:
            result = json.loads(response.read())
        expected = {'uid': http_user.pw_uid, 'php': manifest['phpVersion'], 'timezone': 'Asia/Manila',
                    'ini': str(state / 'config/php.ini'), 'db': 'db_cnc_pos', 'report': 'reports_database',
                    'databaseTmpdir': str(state / 'run/database/tmp'),
                    'envReadable': True, 'rootSecretDenied': True, 'dataDenied': True,
                    'uploadsWritable': True, 'backupsWritable': True}
        if result != expected:
            raise RuntimeError('HTTP service identity/configuration/permissions probe failed.')
        fixture.passed('running database uses its private service tmpdir despite inherited root-only Installer TMPDIR')
        for relative in ['.env', 'api/config.php', 'api/import_db.php', 'src/service-smoke.php', 'uploads/service-smoke.PHP']:
            try:
                opener.open(url + relative, timeout=5).close()
            except urllib.error.HTTPError as error:
                if error.code == 403:
                    continue
            raise RuntimeError('HTTP did not deny protected path: ' + relative)
        with opener.open(url + 'images/service-smoke.jpg', timeout=5) as response:
            if response.headers.get_content_type() != 'image/jpeg' or response.read() != b'fixture-image':
                raise RuntimeError('HTTP static image delivery failed.')
        denied_script = 'import os,sys; sys.exit(0 if not os.access(sys.argv[1], os.R_OK) else 1)'
        fixture.run(['/usr/bin/python3', '-c', denied_script, web / 'api/config.php'],
                    user=database_user.pw_uid, group=database_group.gr_gid)
        fixture.passed('real _lightemhttp worker can use both databases and private backups; service separation and HTTP restrictions hold')
        fixture.passed('standalone service smoke complete; XAMPP access denied for every child')
    finally:
        fixture.close()


if __name__ == '__main__':
    def interrupted(signum, frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupted)
    try:
        main()
    except KeyboardInterrupt:
        print('Smoke test interrupted.', file=sys.stderr)
        sys.exit(130)
    except Exception as error:
        # Do not expose PDO/helper exception payloads or generated secrets.
        print('FAIL: ' + str(error), file=sys.stderr)
        sys.exit(1)
