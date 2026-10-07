#!/usr/bin/env python3
"""Run the real bundled Apache/PHP and phpMyAdmin in a disposable macOS fixture.

No database is started or contacted. Apache is denied outbound connections and
access to installed XAMPP/Lightem data. Only an unprivileged child server on a
random high port is started; no accounts, services, or installed files change.
The production configuration is extracted, with only port and user/group changed.
"""
import argparse
import hashlib
import html.parser
import http.client
import ipaddress
import json
import os
import pathlib
import re
import secrets
import shutil
import signal
import socket
import stat
import subprocess
import sys
import tempfile
import time
import urllib.parse


REPO = pathlib.Path(__file__).resolve().parents[2]
ENV = {'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'PHP_INI_SCAN_DIR': ''}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


class Assets(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'script' and values.get('src'):
            self.urls.append(values['src'])
        if tag == 'link' and values.get('rel') == 'stylesheet' and values.get('href'):
            self.urls.append(values['href'])


class Fixture:
    def __init__(self, runtime, payload):
        self.base = pathlib.Path(tempfile.mkdtemp(prefix='lt-pma-', dir='/private/tmp'))
        self.identity = (self.base.stat().st_dev, self.base.stat().st_ino)
        self.nonce = secrets.token_hex(24)
        self.token = self.base / '.fixture-owner'
        self.token.write_text(self.nonce)
        self.token.chmod(0o600)
        self.children = []
        self.checks = 0
        read_only = [runtime, payload, REPO, pathlib.Path('/Library'), pathlib.Path('/Applications')]
        profile = ('(version 1)(allow default)(deny network-outbound)'
                   '(deny file-read* (subpath "/Applications/XAMPP")'
                   ' (subpath "/Library/Application Support/LightemStandalone"))'
                   '(deny file-write* ' + ' '.join('(subpath ' + json.dumps(str(path)) + ')'
                                                 for path in read_only) + ')')
        self.policy = ['/usr/bin/sandbox-exec', '-p', profile]
        self.env = dict(ENV, TMPDIR=str(self.base))

    def start(self, args, env=None, output=None):
        process = subprocess.Popen(self.policy + [str(arg) for arg in args], cwd=self.base,
                                   env=env or self.env, start_new_session=True, text=True,
                                   stdout=output if output is not None else subprocess.PIPE,
                                   stderr=subprocess.STDOUT)
        self.children.append(process)
        return process

    def run(self, args, env=None):
        process = self.start(args, env)
        output, _ = process.communicate(timeout=45)
        diagnostic = ''
        if pathlib.Path(str(args[0])).name == 'httpd' and '-t' in args:
            # Syntax-only Apache diagnostics cannot contain PHP cookie secrets.
            diagnostic = ': ' + output.strip()[:3000]
        require(process.returncode == 0, pathlib.Path(str(args[0])).name +
                ' failed (exit ' + str(process.returncode) + ')' + diagnostic)
        self.children.remove(process)
        return output

    def passed(self, label):
        self.checks += 1
        print('PASS: ' + label, flush=True)

    def close(self):
        for process in reversed(self.children):
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait(timeout=10)
            if process.stdout:
                process.stdout.close()
        info = self.base.lstat()
        require(self.base.parent == pathlib.Path('/private/tmp') and self.base.name.startswith('lt-pma-')
                and stat.S_ISDIR(info.st_mode) and (info.st_dev, info.st_ino) == self.identity
                and not self.token.is_symlink() and self.token.read_text() == self.nonce,
                'Fixture identity changed; refusing recursive cleanup.')
        shutil.rmtree(self.base)
        print('Isolated Apache stopped; temporary fixture removed.', flush=True)


def request(port, path, host=None, address='127.0.0.1', source=None, headers=None):
    connection = http.client.HTTPConnection(address, port, timeout=10, source_address=source)
    try:
        connection.request('GET', path, headers=dict({'Host': host or 'localhost:' + str(port)}, **(headers or {})))
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()
    finally:
        connection.close()


def lan_addresses():
    result = subprocess.run(['/sbin/ifconfig', '-a'], capture_output=True, text=True, check=True, env=ENV)
    networks = [ipaddress.ip_network(value) for value in ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']]
    return sorted({value for value in re.findall(r'\binet (\d+\.\d+\.\d+\.\d+)\b', result.stdout)
                   if any(ipaddress.ip_address(value) in network for network in networks)})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--windows-routes', action='store_true', help='Exercise Windows canonical and compatibility routes with the real isolated Apache/PHP server.')
    parser.add_argument('--runtime', type=pathlib.Path, default=REPO / 'installer/cache/standalone-runtime/darwin')
    parser.add_argument('--phpmyadmin', type=pathlib.Path, default=REPO / 'installer/cache/phpmyadmin-5.2.3')
    args = parser.parse_args()
    require(sys.platform == 'darwin' and os.geteuid() != 0,
            'Run this macOS fixture as an ordinary user; no root installation is required.')
    runtime, payload = args.runtime.resolve(strict=True), args.phpmyadmin.resolve(strict=True)
    require(all((runtime / name).is_file() for name in ['bin/php', 'bin/httpd', 'modules/libphp.so']),
            'Standalone Apache/PHP runtime is incomplete.')
    require((payload / 'index.php').is_file() and not (payload / 'config.inc.php').exists(),
            'phpMyAdmin input must be pristine prepared code without device configuration.')
    require(not any(path.is_symlink() for path in payload.rglob('*')), 'phpMyAdmin input contains a symlink.')
    source = (REPO / 'installer/mac-standalone/postinstall').read_text()
    start, end = '# BEGIN STANDALONE CONFIGURATION\n', '# END STANDALONE CONFIGURATION'
    require(source.count(start) == 1 and source.count(end) == 1, 'Production configuration boundaries changed.')
    configuration = source.split(start, 1)[1].split(end, 1)[0].split('\nregister_service()', 1)[0]
    require(all(token not in configuration for token in ['launchctl', 'LaunchDaemons', 'dscl', 'ensure_service_account']),
            'Extracted configuration unexpectedly includes service/account changes.')
    print('Production postinstall SHA256: ' + hashlib.sha256(source.encode()).hexdigest(), flush=True)
    fixture = Fixture(runtime, payload)
    try:
        state = fixture.base / 'Application Support/LightemStandalone'
        web, pma = state / 'backend', state / 'phpmyadmin'
        for relative in ['config', 'data', 'run/http', 'run/database', 'run/phpmyadmin', 'logs/http', 'secrets', 'backend']:
            (state / relative).mkdir(parents=True, exist_ok=True)
        shutil.copytree(payload, pma)
        probe = secrets.token_hex(16)
        (web / 'probe.php').write_text('<?php header("Content-Type: text/plain"); echo "' + probe + '";')
        php = runtime / 'bin/php'
        fixture.run([php, '-n', REPO / 'installer/common/phpmyadmin-config.php', '--root', pma,
                     '--temp-dir', state / 'run/phpmyadmin', '--secret-file', state / 'secrets/pma-cookie.txt'])
        fixture.run([php, '-n', '-l', pma / 'config.inc.php'])
        cfg = json.loads(fixture.run([php, '-n', '-r', 'require $argv[1]; echo json_encode($cfg, JSON_THROW_ON_ERROR);', pma / 'config.inc.php']))
        server = cfg['Servers']['1']
        require(server['auth_type'] == 'cookie' and server['host'] == '127.0.0.1' and server['port'] == '3307'
                and server['AllowNoPassword'] is False and cfg['AllowArbitraryServer'] is False
                and cfg['ZeroConf'] is False and cfg['TempDir'] == str(state / 'run/phpmyadmin')
                and len(cfg['blowfish_secret']) == 32
                and not any(key in server for key in ['user', 'password', 'controluser', 'controlpass', 'pmadb']),
                'Generated configuration does not satisfy the private cookie-login contract.')
        fixture.passed('generated PHP configuration lints and targets private port 3307 with cookie authentication')
        # Only ownership is adapted: all extracted writes must remain in our fixture.
        chown_stub = '''chown() {
  local target
  shift
  for target in "$@"; do
    case "$target" in "$STATE/config"|"$STATE/config/"*) ;; *) return 96 ;; esac
  done
}
'''
        fixture.run(['/bin/bash', '-Eeu', '-o', 'pipefail', '-c', chown_stub + configuration + '\nwrite_configuration\n'],
                    env=dict(fixture.env, STATE=str(state), WEBROOT=str(web), DATA=str(state / 'data'), RUNTIME=str(runtime), HTTP_PORT='8080'))
        with socket.socket() as reserved:
            reserved.bind(('127.0.0.1', 0))
            port = reserved.getsockname()[1]
        require(port not in [80, 3306, 3307], 'Refusing an installed-service port.')
        httpd_config = state / 'config/httpd.conf'
        config = httpd_config.read_text()
        for original, replacement in [('Listen 8080\n', 'Listen 0.0.0.0:' + str(port) + '\n'),
                                      ('User _lightemhttp\n', 'User #' + str(os.getuid()) + '\n'),
                                      ('Group _lightemhttp\n', 'Group #' + str(os.getgid()) + '\n')]:
            require(config.count(original) == 1, 'Production Apache fixture substitution boundary changed.')
            config = config.replace(original, replacement)
        manager_path = '/lightem-db'
        if args.windows_routes:
            windows_source = (REPO / 'installer/windows/install-standalone.ps1').read_text()
            rules = re.findall(r'^(?:Alias /lightem-db .*|RedirectMatch 302 .*lightem-db.*)$', windows_source, re.MULTILINE)
            require(len(rules) == 3, 'Windows database-manager routing boundaries changed.')
            mac_rules = re.findall(r'^(?:Alias /lightem-db .*|RedirectMatch 302 .*lightem-db.*)$', config, re.MULTILINE)
            require(len(mac_rules) == 3, 'Mac database-manager routing boundaries changed.')
            actual_rules = '\n'.join(rules).replace('$state/phpmyadmin', str(pma)).replace('`$', '$')
            config = config.replace('\n'.join(mac_rules), actual_rules)
        httpd_config.write_text(config)
        fixture.run([runtime / 'bin/httpd', '-t', '-f', httpd_config])
        fixture.passed('actual generated Apache configuration parses with its phpMyAdmin authorization rules')
        with (state / 'logs/http/console.log').open('w') as output:
            apache = fixture.start([runtime / 'bin/httpd', '-f', httpd_config, '-DFOREGROUND'], output=output)
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                require(apache.poll() is None, 'Isolated Apache exited before becoming ready.')
                try:
                    with socket.create_connection(('127.0.0.1', port), timeout=0.25):
                        break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError('Isolated Apache did not become ready.')
            status, headers, _ = request(port, manager_path)
            require(status in [301, 302, 308] and urllib.parse.urlsplit(headers.get('Location', '')).path == manager_path + '/',
                    'phpMyAdmin directory URL does not redirect to the login page.')
            status, headers, body = request(port, manager_path + '/')
            require('path=' + manager_path + '/' in headers.get('Set-Cookie', '').lower(),
                    'Manager login cookie overlaps XAMPP phpMyAdmin.')
            fixture.passed('login cookies use /lightem-db/ and do not overlap XAMPP /phpmyadmin/')
            old_manager_path = '/phpmyadmin' if args.windows_routes else '/admin'
            for suffix in ['', '/', '/index.php?route=/database/sql']:
                redirect_status, redirect_headers, _ = request(port, old_manager_path + suffix)
                target = urllib.parse.urlsplit(redirect_headers.get('Location', ''))
                expected = urllib.parse.urlsplit(manager_path + suffix)
                require(redirect_status == 302 and (target.path, target.query) == (expected.path, expected.query),
                        'Existing standalone bookmark did not preserve its path and query when redirecting.')
            fixture.passed('older standalone database-browser bookmarks redirect with their path and query preserved')
            if not args.windows_routes:
                for old_path in ['/phpmyadmin', '/phpmyadmin/', '/phpmyadmin/index.php']:
                    require(request(port, old_path)[0] == 404,
                            'Mac standalone still serves the old XAMPP database-browser route.')
                fixture.passed('Mac standalone leaves the XAMPP /phpmyadmin/ route unserved')
            text = body.decode('utf-8')
            require(status == 200 and 'pma_username' in text and 'pma_password' in text and 'phpMyAdmin' in text,
                    'phpMyAdmin login did not render successfully (HTTP ' + str(status) + ').')
            require('httponly' in headers.get('Set-Cookie', '').lower(), 'Login session cookie is missing HttpOnly.')
            fixture.passed('loopback login renders its username/password form and HttpOnly session cookie')
            if (pma / 'INDEX.PHP').is_file():
                require((pma / 'INDEX.PHP').samefile(pma / 'index.php'), 'Uppercase index resolves to an unexpected file.')
                for path in ['INDEX.PHP', 'index.PHP', 'Index.Php']:
                    status, _, body = request(port, manager_path + '/' + path)
                    require(status == 200 and b'pma_username' in body and b'pma_password' in body
                            and b'<?php' not in body,
                            'Case-varied PHP index was not executed safely: ' + path + ' (HTTP ' + str(status) + ').')
                fixture.passed('case-varied INDEX.PHP names execute PHP and render the login instead of exposing source')
            else:
                print('SKIP: fixture volume is case-sensitive; uppercase index aliases do not resolve.', flush=True)
            assets = Assets()
            assets.feed(text)
            assets.urls = sorted(set(urllib.parse.urljoin(manager_path + '/', url) for url in assets.urls))
            require(any('/js/vendor/' in url for url in assets.urls), 'Login did not reference browser vendor assets.')
            require(any('.css' in url or 'css.php' in url for url in assets.urls), 'Login did not reference a stylesheet.')
            for asset in assets.urls:
                require(asset.startswith(manager_path + '/'), 'Login references an unexpected external asset.')
                status, headers, body = request(port, asset)
                require(status == 200 and len(body) > 0, 'Login asset failed: ' + asset + ' (HTTP ' + str(status) + ').')
                if urllib.parse.urlsplit(asset).path.endswith('.js'):
                    require('javascript' in headers.get('Content-Type', ''), 'JavaScript asset has the wrong content type.')
                if '.css' in asset or 'css.php' in asset:
                    require('text/css' in headers.get('Content-Type', ''), 'Stylesheet has the wrong content type.')
            fixture.passed(str(len(assets.urls)) + ' login JS/CSS assets load, including js/vendor resources')
            protected = ['config.inc.php', 'config.sample.inc.php', 'composer.json', 'composer.lock',
                         'phpmyadmin-manifest.json', 'libraries/config.default.php', 'vendor/autoload.php', 'sql/create_tables.sql']
            for directory in ['templates', 'doc', 'examples']:
                files = sorted(path for path in (pma / directory).rglob('*') if path.is_file())
                if files:
                    protected.append(str(files[0].relative_to(pma)))
            for path in protected:
                require((pma / path).is_file(), 'Sensitive fixture path was not present: ' + path)
                status, _, _ = request(port, manager_path + '/' + urllib.parse.quote(path))
                require(status == 403, 'Sensitive phpMyAdmin path was not denied: ' + path + ' (HTTP ' + str(status) + ').')
            require(not (pma / 'setup').exists(), 'Prepared phpMyAdmin still contains the setup wizard.')
            fixture.passed(str(len(protected)) + ' real sensitive code/configuration paths return HTTP 403; setup wizard is absent')
            uppercase_protected = ['CONFIG.INC.PHP', 'Config.Sample.Inc.Php', 'PHPMYADMIN-MANIFEST.JSON',
                                   'LIBRARIES/config.default.php', 'VENDOR/autoload.php', 'SQL/create_tables.sql']
            templates = sorted(path for path in (pma / 'templates').rglob('*') if path.is_file())
            if templates:
                uppercase_protected.append('TEMPLATES/' + str(templates[0].relative_to(pma / 'templates')))
            uppercase_checked = 0
            for path in uppercase_protected:
                if not (pma / path).is_file():
                    continue
                status, _, _ = request(port, manager_path + '/' + urllib.parse.quote(path))
                require(status == 403, 'Case-varied sensitive path was not denied: ' + path + ' (HTTP ' + str(status) + ').')
                uppercase_checked += 1
            if uppercase_checked:
                fixture.passed(str(uppercase_checked) + ' case-varied configuration/internal directory paths remain HTTP 403')
            else:
                print('SKIP: fixture volume is case-sensitive; uppercase sensitive aliases do not resolve.', flush=True)
            for host in ['malicious.example:' + str(port), 'localhost.malicious.example:' + str(port), '127.0.0.1.malicious.example']:
                require(request(port, manager_path + '/', host=host)[0] == 403, 'Nonlocal Host was not denied.')
            require(request(port, manager_path + '/', host='127.0.0.1:' + str(port))[0] == 200, 'Numeric loopback Host was rejected.')
            require(request(port, manager_path + '/', headers={'X-Forwarded-For': '192.168.1.100'})[0] == 200,
                    'Untrusted forwarding header unexpectedly changed local authorization.')
            fixture.passed('local hosts work; DNS-rebinding host names are denied; forwarded IP cannot override the peer')
            status, _, body = request(port, '/probe.php', host='backend.example.test')
            require(status == 200 and body.decode() == probe, 'The phpMyAdmin Host rule incorrectly restricts the backend.')
            fixture.passed('backend PHP remains available independently of the phpMyAdmin Host restriction')
            addresses = lan_addresses()
            if not addresses:
                print('SKIP: no RFC1918 interface address is available for a real LAN-source authorization check.', flush=True)
            for address in addresses:
                status, _, _ = request(port, manager_path + '/', address=address, source=(address, 0))
                require(status == 403, 'A LAN peer reached phpMyAdmin using a permitted localhost Host.')
                status, _, body = request(port, '/probe.php', address=address, source=(address, 0))
                require(status == 200 and body.decode() == probe, 'Backend access from an authorized LAN peer failed.')
                fixture.passed('actual LAN source ' + address + ' is denied phpMyAdmin while the backend remains available')
            require(not (state / 'logs/http/php-error.log').exists() or not (state / 'logs/http/php-error.log').read_text().strip(),
                    'PHP logged an error during the login/resource smoke; inspect fixture behavior before release.')
        print(str(fixture.checks) + ' HTTP/configuration checks passed; no database credentials or live data were used.', flush=True)
    finally:
        fixture.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('FAIL: ' + str(error), file=sys.stderr)
        sys.exit(1)
