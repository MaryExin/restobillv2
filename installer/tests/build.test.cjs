const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const repo = path.resolve(__dirname, '../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function write(root, relative, value) {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value);
}
function fixture(t) {
  // Load the real builder from a tiny isolated repository; tests never stage
  // this developer's backend, vendor tree, configuration, or databases.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-build-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'installer/scripts/build.cjs', fs.readFileSync(path.join(repo, 'installer/scripts/build.cjs')));
  write(root, 'installer/scripts/offline.cjs', fs.readFileSync(path.join(repo, 'installer/scripts/offline.cjs')));
  write(root, 'electron/system-updater.cjs', fs.readFileSync(path.join(repo, 'electron/system-updater.cjs')));
  write(root, 'package.json', { version: '0.0.1', build: {} });
  const runtime = Buffer.from('fixture XAMPP installer bytes');
  write(root, 'installer/xampp.json', {
    version: '8.2.4-0', phpVersion: '8.2.4',
    win32: { file: 'xampp-fixture.exe', url: 'https://invalid.example.test/xampp-fixture.exe', sha256: hash(runtime) },
    darwin: { file: 'xampp-fixture.dmg', url: 'https://invalid.example.test/xampp-fixture.dmg', sha256: hash(runtime) },
  });
  write(root, 'installer/cache/xampp-fixture.exe', runtime);
  write(root, 'installer/cache/xampp-fixture.dmg', runtime);
  write(root, 'backend/api/health.php', '<?php echo "ok";');
  write(root, 'backend/api/.htaccess', 'Deny from all');
  write(root, 'backend/api/config.php', 'fixture database credentials');
  write(root, 'backend/api/.env', 'SECRET_KEY=fixture-secret');
  write(root, 'backend/api/.env.pos-developer', 'fixture developer secret');
  write(root, 'backend/api/.env.backup', 'fixture backup secret');
  write(root, 'backend/api/config.php.old', 'fixture old config');
  write(root, 'backend/api/debug_inputs.txt', 'fixture uploaded personal data');
  write(root, 'backend/api/error.log', 'fixture operational data');
  write(root, 'backend/src/Example.php', '<?php class Example {}');
  write(root, 'installer/schema/primary.sql', 'CREATE TABLE example (id INT);');
  write(root, 'installer/schema/report.sql', 'CREATE TABLE report_example (id INT);');
  write(root, 'installer/schema/schema-manifest.json', { schemaVersion: 1 });
  write(root, 'installer/schema/bootstrap-discounts.sql', 'INSERT INTO example VALUES (1);');
  write(root, 'installer/schema/bootstrap-permissions.sql', 'INSERT INTO example VALUES (2);');
  write(root, 'installer/common/provision.php', '<?php // provision fixture');
  write(root, 'installer/common/verify.php', '<?php // verify fixture');
  write(root, 'installer/common/shared.php', '<?php // required helper fixture');
  write(root, 'installer/windows/install.ps1', '# install fixture');
  write(root, 'vendor/composer/installed.json', { packages: [
    { name: 'vlucas/phpdotenv', version: 'v5.6.0' },
    { name: 'vendor/example', version: 'v1.0.0' },
  ] });
  write(root, 'vendor/autoload.php', '<?php // Composer autoload fixture');
  write(root, 'vendor/vlucas/phpdotenv/src/Dotenv.php', '<?php // Dotenv fixture');
  write(root, 'vendor/vendor/example/src/Example.php', '<?php // package fixture');
  write(root, 'vendor/api/config.php', 'stray live site credentials');
  write(root, 'vendor/src/private.php', 'stray live site source');
  write(root, 'vendor/.env', 'stray live environment');
  write(root, 'public/businessInfo.json', { companyName: 'fixture private company', tin: 'fixture private tax ID', terminalId: 'fixture private terminal', posProviderName: 'Lightem provider' });
  write(root, 'public/pos-config.json', { corpName: 'fixture private company', machineNumber: 'fixture private machine', terminalNumber: 'fixture private terminal' });
  write(root, 'public/ip.txt', 'LOCAL: http://fixture-private-server\nWEB: https://fixture.example.test\nTENANT: FIXTURE_STORE\n');
  write(root, 'public/printer.txt', 'LAN: fixture-private-printer');
  write(root, 'public/printer_categories.json', {newTransaction:{usb:{connection:'usb:auto',categories:['FIXTURE']},lan:{connection:'192.168.1.90',categories:[]}}});
  const builder = require(path.join(root, 'installer/scripts/build.cjs'));
  const args = [
    '--platform', 'win32', '--arch', 'x64', '--version', '1.2.3',
    '--build-id', '20260926120000', '--vendor', path.join(root, 'vendor'),
    '--offline', '--prepare-only',
  ];
  return { root, runtime, builder, opts: builder.options(args), args };
}

test('offline preparation uses a verified runtime and emits compatible update metadata', async (t) => {
  const { builder, opts, runtime } = fixture(t);
  const { stage, payload, metadata } = await builder.prepare(opts);
  assert.deepEqual(metadata, {
    schemaVersion: 1, version: '1.2.3', buildId: '20260926120000', platform: 'win32', arch: 'x64',
    updateUrl: 'https://github.com/MaryExin/restobillv2/releases/latest/download/latest.json',
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stage, 'system-release.json'))), metadata);
  const manifest = JSON.parse(fs.readFileSync(path.join(payload, 'manifest.json')));
  assert.equal(manifest.xamppSha256, hash(runtime));
  assert.equal(manifest.phpMyAdminVersion, undefined);
  assert.equal(fs.existsSync(path.join(payload,'phpmyadmin')), false);
  assert.equal(manifest.backendSha256, builder.treeHash(path.join(payload, 'backend')));
  assert.deepEqual(fs.readFileSync(path.join(payload, 'xampp-installer.exe')), runtime);
  for (const relative of ['database/primary.sql', 'database/report.sql', 'database/schema-manifest.json', 'provision.php', 'verify.php', 'shared.php', 'install.ps1']) {
    assert.equal(fs.existsSync(path.join(payload, relative)), true, relative);
  }
});

test('payload contains Composer packages and source but excludes local credentials and stray vendor trees', async (t) => {
  const { builder, opts } = fixture(t);
  const { payload } = await builder.prepare(opts);
  for (const relative of ['backend/api/health.php', 'backend/api/.htaccess', 'backend/src/Example.php', 'backend/vendor/autoload.php', 'backend/vendor/composer/installed.json', 'backend/vendor/vlucas/phpdotenv/src/Dotenv.php', 'backend/vendor/vendor/example/src/Example.php']) {
    assert.equal(fs.existsSync(path.join(payload, relative)), true, relative);
  }
  for (const relative of ['backend/api/config.php', 'backend/api/config.php.old', 'backend/api/.env', 'backend/api/.env.pos-developer', 'backend/api/.env.backup', 'backend/api/debug_inputs.txt', 'backend/api/error.log', 'backend/vendor/api', 'backend/vendor/src', 'backend/vendor/.env']) {
    assert.equal(fs.existsSync(path.join(payload, relative)), false, relative);
  }
});

test('offline preparation fails before staging for missing or modified runtime cache', async (t) => {
  const { root, builder, opts } = fixture(t);
  const cached = path.join(root, 'installer/cache/xampp-fixture.exe');
  fs.unlinkSync(cached);
  await assert.rejects(builder.prepare(opts), /Offline cache is missing/);
  assert.equal(fs.existsSync(path.join(root, 'installer/stage')), false);
  fs.writeFileSync(cached, 'tampered installer');
  await assert.rejects(builder.prepare(opts), /checksum mismatch/);
  assert.equal(fs.existsSync(path.join(root, 'installer/stage')), false);
});

test('preparation validates required dependencies and rejects package traversal', async (t) => {
  const { root, builder, opts } = fixture(t);
  write(root, 'vendor/composer/installed.json', { packages: [] });
  await assert.rejects(builder.prepare(opts), /missing vlucas\/phpdotenv/);
  write(root, 'vendor/composer/installed.json', { packages: [
    { name: 'vlucas/phpdotenv', version: 'v5.6.0' }, { name: '../../private', version: 'v1.0.0' },
  ] });
  await assert.rejects(builder.prepare(opts), /Invalid Composer package path/);
});

test('backend hash changes with content and refuses symlink payloads', (t) => {
  const { root, builder } = fixture(t);
  const source = path.join(root, 'backend');
  const initial = builder.treeHash(source);
  assert.equal(builder.treeHash(source), initial);
  write(root, 'backend/api/health.php', '<?php echo "new";');
  assert.notEqual(builder.treeHash(source), initial);
  fs.symlinkSync(path.join(root, 'package.json'), path.join(source, 'linked.json'));
  assert.throws(() => builder.treeHash(source), /symlink/);
});

test('Mac preparation embeds the offline disk image and universal release identity', async (t) => {
  const { builder, opts, runtime } = fixture(t);
  opts.platform = 'darwin';
  opts.arch = 'universal';
  const { payload, metadata } = await builder.prepare(opts);
  assert.equal(metadata.platform, 'darwin');
  assert.equal(metadata.arch, 'universal');
  assert.deepEqual(fs.readFileSync(path.join(payload, 'xampp-installer.dmg')), runtime);
  assert.equal(fs.existsSync(path.join(payload, 'install.ps1')), false);
});

test('builder rejects unsupported target, malformed IDs, insecure feed and incomplete options', (t) => {
  const { builder } = fixture(t);
  for (const args of [
    ['--platform', 'linux'], ['--platform', 'darwin', '--arch', 'ia32'],
    ['--platform', 'win32', '--build-id', '../42'], ['--platform', 'win32', '--version', 'latest'],
    ['--platform', 'win32', '--update-url', 'http://example.test/latest.json'],
    ['--platform', 'win32', '--update-url', 'https://user:secret@example.test/latest.json'],
    ['--platform', 'win32', '--update-url', 'https://example.test/latest.json#fragment'],
    ['--platform', 'win32', '--update-url', 'https://'],
    ['--platform'], ['--unknown'],
  ]) assert.throws(() => builder.options(args));
});

test('new-store defaults remove machine and store settings from every packaged public-copy location', (t) => {
  const { root, builder } = fixture(t);
  const defaults = builder.cleanConfiguration();
  assert.equal(defaults['businessInfo.json'].companyName, '');
  assert.equal(defaults['businessInfo.json'].tin, '');
  assert.equal(defaults['businessInfo.json'].terminalId, '');
  assert.equal(defaults['businessInfo.json'].posProviderName, 'Lightem provider');
  assert.equal(defaults['ip.txt'], 'LOCAL: http://localhost\nWEB: \nTENANT: \n');
  assert.equal(defaults['printer.txt'], '');
  assert.ok(Object.values(defaults['pos-config.json']).every(value => value === ''));
  for (const destination of ['dist', 'resources', 'resources/images']) {
    builder.writeConfiguration(path.join(root, destination), defaults);
    for (const filename of Object.keys(defaults)) {
      const contents = fs.readFileSync(path.join(root, destination, filename), 'utf8');
      assert.doesNotMatch(contents, /fixture.private/);
    }
  }
  assert.match(fs.readFileSync(path.join(root, 'public/businessInfo.json'), 'utf8'), /fixture private company/, 'source settings remain unchanged');
});

test('Windows standalone has a separate installer, executable, shortcut and desktop profile identity', (t) => {
  const { builder } = fixture(t);
  const legacy = {appId:'com.lenard.restobill', productName:'Lightem Pos'};
  const standalone = {...legacy, ...builder.desktopBuildIdentity({standalone:true,platform:'win32',version:'1.2.3'})};
  assert.equal(standalone.appId, 'com.lightem.standalone.pos');
  assert.notEqual(standalone.appId, legacy.appId, 'NSIS must not uninstall the XAMPP desktop');
  assert.equal(standalone.productName, 'Lightem Pos Standalone');
  assert.notEqual(standalone.productName, legacy.productName, 'executable/install-folder/shortcut names must differ');
  assert.deepEqual(standalone.extraMetadata, {version:'1.2.3',name:'lightem_pos_standalone',productName:'Lightem Pos Standalone'});
  for (const options of [{platform:'win32'}, {platform:'darwin'}, {platform:'darwin',standalone:true}]) {
    const actual = {...legacy, ...builder.desktopBuildIdentity({...options,version:'1.2.3'})};
    assert.deepEqual(actual, {...legacy,extraMetadata:{version:'1.2.3'}}, 'legacy Windows and both Mac identities remain unchanged');
  }
});

test('Windows and Mac standalone package the source desktop profile with their own LOCAL port in every copy', (t) => {
  const { root, builder } = fixture(t);
  const originalIp = fs.readFileSync(path.join(root,'public/ip.txt'),'utf8');
  for (const platform of ['win32','darwin']) {
    const defaults = builder.cleanConfiguration({standalone:true,platform});
    for (const destination of ['dist','resources','resources/images']) {
      builder.writeConfiguration(path.join(root,destination), defaults);
      assert.equal(fs.readFileSync(path.join(root,destination,'ip.txt'),'utf8'), 'LOCAL: http://localhost:8080\nWEB: https://fixture.example.test\nTENANT: FIXTURE_STORE\n');
      assert.equal(fs.readFileSync(path.join(root,destination,'printer.txt'),'utf8'),fs.readFileSync(path.join(root,'public/printer.txt'),'utf8'));
      for (const name of ['businessInfo.json','pos-config.json','printer_categories.json']) {
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,destination,name))),JSON.parse(fs.readFileSync(path.join(root,'public',name))));
      }
    }
  }
  for (const options of [{platform:'win32'}, {platform:'darwin'}]) {
    assert.equal(builder.cleanConfiguration(options)['ip.txt'], 'LOCAL: http://localhost\nWEB: \nTENANT: \n');
  }
  assert.equal(fs.readFileSync(path.join(root,'public/ip.txt'),'utf8'),originalIp, 'source configuration is preserved');
});

test('standalone refuses a missing tenant or ambiguous IP profile instead of silently shipping broken sync', t => {
  const {root,builder}=fixture(t);
  for (const value of ['LOCAL: http://localhost\nTENANT: \n','LOCAL: http://localhost\n',
    'TENANT: FIRST\nTENANT: SECOND\n','TENANT: FIRST\nLOCAL: a\nlocal: b\n']) {
    write(root,'public/ip.txt',value);
    assert.throws(()=>builder.cleanConfiguration({standalone:true}),/TENANT|multiple LOCAL/);
  }
  write(root,'public/ip.txt','tenant: FIXTURE_STORE\r\nWEB: https://\r\n');
  assert.equal(builder.cleanConfiguration({standalone:true})['ip.txt'],'LOCAL: http://localhost:8080\nTENANT: FIXTURE_STORE\nWEB: https://\n');
});

test('Windows and Mac standalone allow their private API and images through the packaged HTML CSP', (t) => {
  const { root, builder } = fixture(t);
  const source = fs.readFileSync(path.join(repo,'index.html'),'utf8');
  const target = path.join(root,'dist/index.html');
  for (const options of [{platform:'win32'}, {platform:'darwin'}]) {
    write(root,'dist/index.html',source);
    builder.configureDesktopHtml(target,options);
    assert.equal(fs.readFileSync(target,'utf8'), source, 'XAMPP HTML is unchanged');
  }
  for (const [platform,marker] of [['win32','windows-standalone'],['darwin','macos-standalone']]) {
    write(root,'dist/index.html',source);
    builder.configureDesktopHtml(target,{platform,standalone:true});
    const updated = fs.readFileSync(target,'utf8');
    assert.equal(updated.split(`<meta name="lightem-runtime" content="${marker}">`).length,2, 'desktop marker makes missing preload routing fail closed');
    for (const name of ['connect-src','img-src']) {
      const values = updated.match(new RegExp(name+'\\s+([^;]+);'))[1].trim().split(/\s+/);
      for (const origin of ['http://localhost','http:']) assert.ok(values.includes(origin), name+' permits configurable local API ports and LAN origins');
      assert.ok(!values.includes('*'), 'no global network wildcard introduced');
    }
    assert.equal(updated.match(/script-src[^;]+;/)[0], source.match(/script-src[^;]+;/)[0]);
    builder.configureDesktopHtml(target,{platform,standalone:true});
    assert.equal(fs.readFileSync(target,'utf8'), updated, 'repeated processing does not duplicate sources');
    write(root,'dist/index.html','<html></html>');
    assert.throws(() => builder.configureDesktopHtml(target,{platform,standalone:true}),/CSP/);
  }
});

test('standalone preparation uses separate stages, runtime payload and update feed without a XAMPP installer cache', async (t) => {
  const { root, builder, args } = fixture(t);
  fs.rmSync(path.join(root, 'installer/cache'), { recursive: true });
  write(root, 'installer/windows/install-standalone.ps1', '# standalone service installation');
  write(root, 'installer/runtime/verify.php', '<?php // strict runtime inventory verifier');
  write(root, 'installer/phpmyadmin/verify.php', '<?php // strict phpMyAdmin inventory verifier');
  write(root, 'installer/phpmyadmin/prepare.cjs', `
    const fs=require('node:fs'), path=require('node:path');
    exports.preparePhpMyAdmin=async ({payload,offline}) => {
      if(!offline)throw new Error('Expected offline phpMyAdmin preparation');
      fs.mkdirSync(path.join(payload,'phpmyadmin','vendor'),{recursive:true});
      fs.writeFileSync(path.join(payload,'phpmyadmin','index.php'),'official phpMyAdmin fixture');
      fs.writeFileSync(path.join(payload,'phpmyadmin','vendor','autoload.php'),'complete vendor fixture');
      return {phpMyAdminVersion:'5.2.3',phpMyAdminSha256:'b'.repeat(64)};
    };
  `);
  write(root, 'installer/runtime/prepare.cjs', `
    const fs=require('node:fs'), path=require('node:path');
    exports.prepareRuntime=async ({platform,payload,offline}) => {
      if(!offline)throw new Error('Expected offline runtime preparation');
      fs.mkdirSync(path.join(payload,'runtime'),{recursive:true});
      fs.writeFileSync(path.join(payload,'runtime','php'),'private runtime '+platform);
      return {runtimeVersion:'fixture-1',runtimeSha256:'a'.repeat(64),phpVersion:'8.2.4',arch:'x64',directory:'/private/build-machine/path'};
    };
  `);
  write(root, 'installer/stage/win32-x64/previous.txt', 'keep legacy build');
  const opts = builder.options(['--standalone', ...args]);
  const { stage, payload, metadata } = await builder.prepare(opts);
  assert.equal(stage, path.join(fs.realpathSync(root),'installer/stage/standalone/win32-x64'));
  assert.equal(metadata.runtimeKind, 'standalone');
  assert.match(metadata.updateUrl, /\/latest-standalone\.json$/);
  const manifest = JSON.parse(fs.readFileSync(path.join(payload,'manifest.json')));
  assert.equal(manifest.runtimeSha256, 'a'.repeat(64));
  assert.equal(manifest.runtimeVersion, 'fixture-1');
  assert.equal(manifest.runtimeArch, 'x64');
  assert.equal(manifest.phpMyAdminVersion, '5.2.3');
  assert.equal(manifest.phpMyAdminSha256, 'b'.repeat(64));
  assert.equal(fs.existsSync(path.join(payload,'phpmyadmin/vendor/autoload.php')), true);
  assert.equal(fs.existsSync(path.join(payload,'verify-phpmyadmin.php')), true);
  assert.equal(fs.existsSync(path.join(payload,'runtime/phpmyadmin')), false);
  assert.equal(manifest.directory, undefined);
  assert.equal(manifest.xamppSha256, undefined);
  assert.equal(fs.existsSync(path.join(payload,'xampp-installer.exe')), false);
  assert.equal(fs.readFileSync(path.join(payload,'install.ps1'),'utf8'), '# standalone service installation');
  assert.equal(fs.existsSync(path.join(payload,'verify-runtime.php')), true);
  assert.equal(fs.readFileSync(path.join(root,'installer/stage/win32-x64/previous.txt'),'utf8'), 'keep legacy build');
  assert.equal(fs.existsSync(path.join(payload,'backend/api/config.php')), false);
  const mac = await builder.prepare({...opts,platform:'darwin',arch:'universal'});
  const macManifest = JSON.parse(fs.readFileSync(path.join(mac.payload,'manifest.json')));
  assert.equal(macManifest.arch,'universal');
  assert.equal(macManifest.runtimeArch,'x64');
  assert.equal(macManifest.phpMyAdminVersion,'5.2.3');
  assert.equal(macManifest.phpMyAdminSha256,'b'.repeat(64));
});
