'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const CACHE = path.join(ROOT, 'installer/cache');
const LOCK = require('./source.lock.json');
const MANIFEST = 'phpmyadmin-manifest.json';
const REQUIRED = ['index.php', 'vendor/autoload.php', 'libraries/classes/Version.php', 'LICENSE'];
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const treeDigest = files => crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');

function inventory(root) {
  if (fs.lstatSync(root).isSymbolicLink() || !fs.statSync(root).isDirectory()) throw new Error('phpMyAdmin directory must be a real directory.');
  const files = {};
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name);
      const stat = fs.lstatSync(file);
      const relative = path.relative(root, file).split(path.sep).join('/');
      if (stat.isSymbolicLink()) throw new Error('phpMyAdmin contains an unexpected link.');
      if (stat.isDirectory()) walk(file);
      else if (!stat.isFile()) throw new Error('phpMyAdmin contains an unsupported file type.');
      else if (relative !== MANIFEST) files[relative] = { sha256: sha256(file), size: stat.size };
    }
  }
  walk(root);
  return files;
}

function createManifest(root, lock = LOCK) {
  for (const file of REQUIRED) if (!fs.existsSync(path.join(root, file))) throw new Error(`Incomplete phpMyAdmin distribution: ${file}.`);
  if (fs.existsSync(path.join(root, 'config.inc.php'))) throw new Error('phpMyAdmin build input must not contain local configuration.');
  const files = inventory(root);
  return { schemaVersion: 1, id: `phpmyadmin-${lock.version}`, version: lock.version,
    sourceArchiveSha256: lock.archive.sha256, sha256: treeDigest(files), files };
}

function validateDirectory(root, lock = LOCK) {
  const file = path.join(root, MANIFEST);
  if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) throw new Error('phpMyAdmin manifest is missing or linked.');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const actual = createManifest(root, lock);
  if (!/^[a-f0-9]{64}$/.test(lock.preparedSha256) || actual.sha256 !== lock.preparedSha256
    || JSON.stringify(manifest) !== JSON.stringify(actual)) throw new Error('phpMyAdmin inventory checksum mismatch. Restore the pinned offline cache.');
  return manifest;
}

function verifyArchive(archive, lock = LOCK) {
  const stat = fs.lstatSync(archive);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== lock.archive.size || sha256(archive) !== lock.archive.sha256) {
    throw new Error('phpMyAdmin archive checksum mismatch. Remove the cache file and fetch the official pinned archive again.');
  }
}

function validateEntry(entry, prefix, seen) {
  const name = entry.fileName;
  const kind = (entry.externalFileAttributes >>> 16) & 0o170000;
  if (!name.startsWith(`${prefix}/`) || /[\\:\x00-\x1f]/.test(name)
    || name.split('/').some(part => part === '..' || part === '.')
    || ![0, 0o100000, 0o040000].includes(kind)) throw new Error('Unsafe phpMyAdmin archive entry.');
  const key = name.replace(/\/$/, '').toLowerCase();
  if (seen.has(key)) throw new Error('Duplicate phpMyAdmin archive entry.');
  seen.add(key);
}

async function extractArchive(archive, target, lock = LOCK) {
  verifyArchive(archive, lock);
  const parent = fs.mkdtempSync(path.join(path.dirname(target), '.phpmyadmin-extract-'));
  try {
    const seen = new Set();
    await require('extract-zip')(archive, { dir: parent, onEntry: entry => validateEntry(entry, lock.archive.directory, seen) });
    const source = path.join(parent, lock.archive.directory);
    for (const excluded of lock.exclude) {
      if (!/^[A-Za-z0-9_-]+$/.test(excluded)) throw new Error('Invalid phpMyAdmin exclusion.');
      fs.rmSync(path.join(source, excluded), { recursive: true, force: true });
    }
    const manifest = createManifest(source, lock);
    if (manifest.sha256 !== lock.preparedSha256) throw new Error('Prepared phpMyAdmin does not match its pinned inventory.');
    fs.writeFileSync(path.join(source, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
    if (fs.existsSync(target)) throw new Error('phpMyAdmin cache destination already exists.');
    fs.renameSync(source, target);
    return manifest;
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
}

async function ensurePhpMyAdmin({ offline = false, cache = CACHE, lock = LOCK } = {}) {
  fs.mkdirSync(cache, { recursive: true });
  const archive = path.join(cache, lock.archive.file);
  const target = path.join(cache, `phpmyadmin-${lock.version}`);
  if (fs.existsSync(target)) return { directory: target, manifest: validateDirectory(target, lock) };
  if (!fs.existsSync(archive)) {
    if (offline) throw new Error(`Offline cache is missing ${lock.archive.file}. Run node installer/phpmyadmin/fetch.cjs once online.`);
    const partial = `${archive}.${process.pid}.partial`;
    try {
      const result = spawnSync('curl', ['--fail', '--location', '--proto', '=https', '--proto-redir', '=https',
        '--connect-timeout', '20', '--max-time', '300', lock.archive.url, '--output', partial], { stdio: 'inherit' });
      if (result.error || result.status !== 0) throw new Error('Cannot download the pinned phpMyAdmin archive.');
      verifyArchive(partial, lock);
      fs.renameSync(partial, archive);
    } finally { fs.rmSync(partial, { force: true }); }
  }
  const manifest = await extractArchive(archive, target, lock);
  return { directory: target, manifest };
}

async function preparePhpMyAdmin({ payload, stage, offline = false }) {
  const { directory, manifest } = await ensurePhpMyAdmin({ offline });
  const root = payload || path.join(stage, 'setup');
  const target = path.join(root, 'phpmyadmin');
  if (fs.existsSync(target)) throw new Error('phpMyAdmin payload destination already exists.');
  fs.cpSync(directory, target, { recursive: true, dereference: false });
  validateDirectory(target);
  fs.copyFileSync(path.join(target, MANIFEST), path.join(root, MANIFEST));
  return { phpMyAdminVersion: manifest.version, phpMyAdminSha256: manifest.sha256 };
}

module.exports = { preparePhpMyAdmin, ensurePhpMyAdmin, validateDirectory, createManifest, verifyArchive, inventory, treeDigest, validateEntry, extractArchive };
