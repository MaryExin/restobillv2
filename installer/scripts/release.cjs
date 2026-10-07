#!/usr/bin/env node
// Combine artifacts from Windows/macOS builds into one GitHub release feed.
const fs = require('node:fs');
const path = require('node:path');
function release(entries = [], standalone = false) {
const root = path.resolve(__dirname,'../../release',...(standalone ? ['standalone'] : []),'full-setup');
const files = entries.length ? entries : fs.readdirSync(root).map(p=>path.join(root,p,'release-entry.json')).filter(p=>fs.existsSync(p));
if (!files.length) throw new Error('Build an installer before preparing a release.');
const releases = files.map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
const {version}=releases[0];
if (releases.some(r=>r.version!==version || !/^[1-9]\d{0,19}$/.test(r.buildId))) throw new Error('Build every platform with the same --version and valid build IDs before publishing.');
if (!standalone && releases.some(r=>r.buildId!==releases[0].buildId)) throw new Error('Build every platform with the same --version and --build-id before publishing.');
const buildId=releases.reduce((latest,r)=>BigInt(r.buildId)>BigInt(latest)?r.buildId:latest,releases[0].buildId);
if (releases.some(r=>(r.runtimeKind === 'standalone') !== standalone)) throw new Error('Do not mix standalone and XAMPP releases in the same update feed.');
if (new Set(releases.map(r=>`${r.platform}/${r.arch}`)).size!==releases.length) throw new Error('Duplicate release platform/architecture.');
const output=path.join(root,standalone ? 'latest-standalone.json' : 'latest.json');
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,releases},null,2)+'\n');
console.log(`Ready: ${output}\nLatest release tag: ${standalone ? 'standalone-' : ''}v${version}-${buildId}\nPublish each installer at its recorded release URL and attach ${path.basename(output)} to the latest release. Unchanged platform releases retain their existing URLs and identities.`);
return output;
}
if(require.main===module) release(process.argv.slice(2));
module.exports={release};
