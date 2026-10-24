// Run with Electron (not node), for example on this Mac:
// env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/Electron.app/Contents/MacOS/Electron installer/tests/standalone-routing.smoke.cjs
// Add win32 or darwin to exercise a particular packaged platform on this host.
// Only disposable loopback servers and temporary files are used. No POS backend,
// installed runtime, credentials, services, or database is opened.
if (!process.versions.electron || process.env.ELECTRON_RUN_AS_NODE) {
  throw new Error('Run this smoke check with the Electron executable, with ELECTRON_RUN_AS_NODE unset.');
}
const { app, BrowserWindow, session, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { readStandaloneRoutingConfig, addConfiguredOriginToCsp } = require('../../electron/standalone-routing.cjs');
const { configureDesktopHtml } = require('../scripts/build.cjs');
const root = path.resolve(__dirname, '../..');
const targetPlatform = process.argv[2] || process.platform;
assert.ok(['win32','darwin'].includes(targetPlatform), 'routing smoke requires a supported target platform');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-routing-smoke-'));
app.setPath('userData', path.join(temporary, 'user-data'));
app.disableHardwareAcceleration();
let backend, unrelated, window;
const deadline = setTimeout(() => { console.error('FAIL: routing smoke timed out'); app.exit(1); }, 20000);

app.whenReady().then(async () => {
  let unrelatedHits = 0;
  backend = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ method:request.method, url:request.url, auth:request.headers.authorization || null,
        body:Buffer.concat(chunks).toString('utf8') }));
    });
  });
  unrelated = http.createServer((_request,response) => {
    unrelatedHits++;
    response.setHeader('Access-Control-Allow-Origin','*');
    response.end('This unconfigured origin must be blocked by CSP.');
  });
  await Promise.all([backend, unrelated].map(server => new Promise(resolve => server.listen(0,'127.0.0.1',resolve))));
  const origin = `http://127.0.0.1:${backend.address().port}`;
  const unrelatedOrigin = `http://127.0.0.1:${unrelated.address().port}`;
  const metadataPath = path.join(temporary,'system-release.json');
  fs.writeFileSync(metadataPath, JSON.stringify({platform:targetPlatform,runtimeKind:'standalone'}));
  // Exercise platform gating with fixture metadata; the host can differ.
  const getStandaloneRoutingConfig = () => readStandaloneRoutingConfig({isPackaged:true,platform:targetPlatform,
    packageName:targetPlatform === 'win32' ? 'lightem_pos_standalone' : require('../../package.json').name,
    metadataPath,getLocalOrigin:()=>origin});
  ipcMain.handle('get-standalone-backend',getStandaloneRoutingConfig);

  // Execute the actual production header listener without launching the POS or
  // registering its printer/database/update handlers.
  const main = fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
  const begin = 'session.defaultSession.webRequest.onHeadersReceived(';
  const start = main.indexOf(begin) + begin.length;
  assert.ok(start >= begin.length);
  const end = main.indexOf('\n  });',start);
  assert.ok(end > start);
  const listener = main.slice(start,end) + '\n  }';
  session.defaultSession.webRequest.onHeadersReceived(
    new Function('getStandaloneRoutingConfig','addConfiguredOriginToCsp',`return (${listener});`)(getStandaloneRoutingConfig,addConfiguredOriginToCsp));

  const html = path.join(temporary,'index.html');
  fs.writeFileSync(html, fs.readFileSync(path.join(root,'index.html'),'utf8')
    .replace(/<script type="module" src="\/src\/main\.jsx"><\/script>/, ''));
  configureDesktopHtml(html,{standalone:true,platform:targetPlatform});
  fs.copyFileSync(path.join(root,'src/utils/standaloneFetch.js'),path.join(temporary,'standaloneFetch.js'));
  window = new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'electron/preload.cjs'),
    contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await window.loadFile(html);
  const result = await window.webContents.executeJavaScript(`(async () => {
    const {standaloneFetch} = await import('./standaloneFetch.js');
    const json = async (url,options) => (await standaloneFetch(url,options)).json();
    const result = [
      await json('http://localhost/api/routing-smoke.php?q=a%20b'),
      await json('http://localhost/api/routing-smoke.php?method=post', {method:'POST',
        headers:{Authorization:'Bearer fixture-only','Content-Type':'application/json'},body:JSON.stringify({hello:'body retained'})}),
      await json(${JSON.stringify(origin+'/api/direct-smoke.php')},{method:'POST',headers:{Authorization:'Bearer direct-fixture'},body:'direct body'})
    ];
    try { await fetch(${JSON.stringify(unrelatedOrigin+'/blocked')}); result.push({blocked:false}); }
    catch { result.push({blocked:true}); }
    // Missing bridge in a standalone artifact must not fall back to
    // port 80, even if called before the normal preload finishes or after a
    // mismatched installation. Verify this through the production reader.
    const {readStandaloneRoutingConfig} = await import('./standaloneFetch.js');
    try { await readStandaloneRoutingConfig({bridge:{}}); result.push({missingBridgeBlocked:false}); }
    catch { result.push({missingBridgeBlocked:true}); }
    return result;
  })()`);
  assert.equal(result[0].method,'GET');
  assert.equal(result[0].url,'/api/routing-smoke.php?q=a%20b');
  assert.equal(result[1].method,'POST');
  assert.equal(result[1].auth,'Bearer fixture-only');
  assert.equal(result[1].body,JSON.stringify({hello:'body retained'}));
  assert.equal(result[2].auth,'Bearer direct-fixture');
  assert.equal(result[2].body,'direct body');
  assert.equal(result[3].blocked,true);
  assert.equal(unrelatedHits,0);
  assert.equal(result[4].missingBridgeBlocked,true);
  console.log(`PASS (${targetPlatform}): actual Electron GET/POST body and Authorization, production preload/IPC/header CSP, generated standalone meta policy, and missing-bridge protection.`);
  window.destroy();
  await Promise.all([backend, unrelated].map(server => new Promise(resolve=>server.close(resolve))));
  clearTimeout(deadline);
  app.exit(0);
}).catch(error => {
  console.error(error);
  clearTimeout(deadline);
  if (window && !window.isDestroyed()) window.destroy();
  backend?.close();
  unrelated?.close();
  app.exit(1);
});
