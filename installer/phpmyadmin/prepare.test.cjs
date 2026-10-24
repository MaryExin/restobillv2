const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createManifest, validateDirectory, verifyArchive, ensurePhpMyAdmin, validateEntry } = require('./prepare.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-phpmyadmin-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const tree = path.join(root, 'code');
  for (const file of ['index.php', 'vendor/autoload.php', 'libraries/classes/Version.php', 'LICENSE']) {
    fs.mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
    fs.writeFileSync(path.join(tree, file), `synthetic ${file}`);
  }
  const lock = { version: '5.2.3', archive: { file: 'phpmyadmin-fixture.zip', directory: 'phpMyAdmin-fixture', sha256: 'a'.repeat(64), size: 0 }, exclude: ['setup'] };
  const manifest = createManifest(tree, lock);
  lock.preparedSha256 = manifest.sha256;
  fs.writeFileSync(path.join(tree, 'phpmyadmin-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { root, tree, lock, manifest };
}

test('pristine code is verified independently from server runtime and database credentials', t => {
  const { tree, lock, manifest } = fixture(t);
  assert.deepEqual(validateDirectory(tree, lock), manifest);
  assert.equal(manifest.version, '5.2.3');
  assert.equal(manifest.files['vendor/autoload.php'].size > 0, true);
  assert.equal(manifest.files['config.inc.php'], undefined);
});

test('offline missing archive stops clearly without attempting a download', async t => {
  const { root, lock } = fixture(t);
  await assert.rejects(ensurePhpMyAdmin({ offline: true, cache: path.join(root, 'missing'), lock }), /Offline cache is missing/);
});

test('archive checksum and size are enforced before extraction', t => {
  const { root, lock } = fixture(t);
  const file = path.join(root, lock.archive.file);
  fs.writeFileSync(file, 'modified archive');
  assert.throws(() => verifyArchive(file, lock), /checksum mismatch/);
});

test('changed cached code fails even when an attacker rewrites its adjacent manifest', t => {
  const { tree, lock } = fixture(t);
  fs.writeFileSync(path.join(tree, 'index.php'), 'changed code');
  fs.writeFileSync(path.join(tree, 'phpmyadmin-manifest.json'), JSON.stringify(createManifest(tree, lock)));
  assert.throws(() => validateDirectory(tree, lock), /checksum mismatch/);
});

for (const mutation of ['missing dependency', 'extra file', 'link', 'local config']) {
  test(`cache verification rejects ${mutation}`, t => {
    const { root, tree, lock } = fixture(t);
    if (mutation === 'missing dependency') fs.unlinkSync(path.join(tree, 'vendor/autoload.php'));
    if (mutation === 'extra file') fs.writeFileSync(path.join(tree, 'extra.php'), '<?php');
    if (mutation === 'link') fs.symlinkSync(path.join(root, 'code/index.php'), path.join(tree, 'linked.php'));
    if (mutation === 'local config') fs.writeFileSync(path.join(tree, 'config.inc.php'), 'synthetic private settings');
    assert.throws(() => validateDirectory(tree, lock), /Incomplete|checksum mismatch|link|local configuration/);
  });
}

test('ZIP entries reject links, traversal, platform path ambiguities and duplicate case-folded names', () => {
  const regular = name => ({ fileName: name, externalFileAttributes: 0o100644 << 16 });
  for (const name of ['outside/index.php', 'phpMyAdmin-fixture/../escape', 'phpMyAdmin-fixture/file:stream', 'phpMyAdmin-fixture\\escape', 'phpMyAdmin-fixture/a\nb']) {
    assert.throws(() => validateEntry(regular(name), 'phpMyAdmin-fixture', new Set()), /Unsafe/);
  }
  assert.throws(() => validateEntry({ ...regular('phpMyAdmin-fixture/link'), externalFileAttributes: 0o120777 << 16 }, 'phpMyAdmin-fixture', new Set()), /Unsafe/);
  const seen = new Set();
  validateEntry(regular('phpMyAdmin-fixture/File.php'), 'phpMyAdmin-fixture', seen);
  assert.throws(() => validateEntry(regular('phpMyAdmin-fixture/file.php'), 'phpMyAdmin-fixture', seen), /Duplicate/);
});

test('a pinned complete ZIP prepares offline, omits setup, and reuses its verified cache without the archive', async t => {
  const { root, tree, lock } = fixture(t);
  const cache = path.join(root, 'cache');
  fs.mkdirSync(cache);
  const archive = path.join(cache, lock.archive.file);
  const zip = new (require('jszip'))();
  for (const file of Object.keys(createManifest(tree, lock).files)) zip.file(`${lock.archive.directory}/${file}`, fs.readFileSync(path.join(tree, file)));
  zip.file(`${lock.archive.directory}/setup/index.php`, 'unneeded setup wizard');
  fs.writeFileSync(archive, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', platform: 'UNIX' }));
  const bytes = fs.readFileSync(archive);
  lock.archive.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  lock.archive.size = bytes.length;
  const prepared = await ensurePhpMyAdmin({ offline: true, cache, lock });
  assert.equal(prepared.manifest.sha256, lock.preparedSha256);
  assert.equal(fs.existsSync(path.join(prepared.directory, 'setup')), false);
  assert.equal(fs.existsSync(path.join(prepared.directory, 'vendor/autoload.php')), true);
  fs.unlinkSync(archive);
  assert.deepEqual(await ensurePhpMyAdmin({ offline: true, cache, lock }), prepared);
});

const php = path.resolve(__dirname, '../cache/standalone-runtime/darwin/bin/php');
test('installer PHP verifies the same inventory and rejects wrong versions, tampering and local configuration', { skip: !fs.existsSync(php) }, t => {
  const { tree, manifest } = fixture(t);
  const run = (version = '5.2.3') => spawnSync(php, ['-n', path.join(__dirname, 'verify.php'), '--root', tree, '--sha256', manifest.sha256, '--version', version], { encoding: 'utf8' });
  assert.equal(run().status, 0);
  assert.notEqual(run('5.2.2').status, 0);
  fs.writeFileSync(path.join(tree, 'config.inc.php'), 'synthetic local configuration');
  assert.match(run().stderr, /local configuration/);
  fs.unlinkSync(path.join(tree, 'config.inc.php'));
  fs.writeFileSync(path.join(tree, 'index.php'), 'tampered');
  assert.match(run().stderr, /checksum failed/);
});
