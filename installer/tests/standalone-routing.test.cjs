const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { configuredOrigin, readStandaloneRoutingConfig, addConfiguredOriginToCsp } = require('../../electron/standalone-routing.cjs');
const frontend = import(pathToFileURL(path.resolve(__dirname, '../../src/utils/standaloneFetch.js')).href);

test('standalone routing requires packaged matching Windows or Mac release metadata', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-routing-'));
  try {
    const metadataPath = path.join(root, 'system-release.json');
    for (const platform of ['win32','darwin']) {
      fs.writeFileSync(metadataPath, JSON.stringify({ platform, runtimeKind:'standalone' }));
      const options = { isPackaged:true, platform, packageName:platform === 'win32' ? 'lightem_pos_standalone' : 'lightem_app', metadataPath, getLocalOrigin:()=> 'http://localhost:8080' };
      assert.deepEqual(readStandaloneRoutingConfig(options), {enabled:true,origin:'http://localhost:8080'});
      for (const override of [{isPackaged:false}, {platform:'linux'}]) {
        assert.deepEqual(readStandaloneRoutingConfig({...options,...override}), {enabled:false});
      }
      const wrongPlatform = readStandaloneRoutingConfig({...options,platform:platform === 'win32' ? 'darwin' : 'win32'});
      assert.equal(wrongPlatform.enabled,true);
      assert.equal(wrongPlatform.origin,'');
      assert.match(wrongPlatform.error,/different platform/);
      fs.writeFileSync(metadataPath, JSON.stringify({ platform, runtimeKind:'xampp' }));
      assert.deepEqual(readStandaloneRoutingConfig({...options,packageName:'lightem_app'}), {enabled:false});
      if(platform === 'win32') assert.equal(readStandaloneRoutingConfig(options).origin, '');
    }
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('standalone identity fails closed for missing, invalid, or wrong-platform metadata and LOCAL', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-routing-'));
  try {
    const metadataPath = path.join(root, 'system-release.json');
    const options = { isPackaged:true, platform:'win32', packageName:'lightem_pos_standalone', metadataPath, getLocalOrigin:()=> 'http://localhost:8080' };
    for (const content of [null, '{invalid', JSON.stringify({platform:'darwin',runtimeKind:'standalone'})]) {
      if(content !== null) fs.writeFileSync(metadataPath,content);
      const result = readStandaloneRoutingConfig(options);
      assert.equal(result.enabled,true);
      assert.equal(result.origin,'');
      assert.ok(result.error);
    }
    fs.writeFileSync(metadataPath, JSON.stringify({platform:'win32',runtimeKind:'standalone'}));
    for(const getLocalOrigin of [()=>'',()=> 'http://localhost:8080/api',()=>{throw Error('unreadable');}]) {
      assert.equal(readStandaloneRoutingConfig({...options,getLocalOrigin}).origin,'');
    }
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('configured origins accept intentional local or remote HTTP(S) servers but no credentials or extra URL components', () => {
  for(const value of ['http://localhost:8080','http://127.0.0.1','http://[::1]:8080','http://192.168.1.22:8080','https://example.test']) {
    assert.equal(configuredOrigin(value+'/'), value);
  }
  for(const value of ['',undefined,'file:///etc/passwd','http://user:pass@localhost:8080','http://localhost/api','http://localhost?x=1','http://localhost#token','http:\\localhost']) {
    assert.equal(configuredOrigin(value),'');
  }
});

test('response CSP adds the configured origin only for enabled standalone routing', () => {
  const csp="default-src 'self'; img-src 'self' data:; connect-src 'self' https:";
  assert.equal(addConfiguredOriginToCsp(csp,{enabled:false}),csp);
  assert.equal(addConfiguredOriginToCsp(csp,{enabled:true,origin:'invalid'}),csp);
  const next=addConfiguredOriginToCsp(csp,{enabled:true,origin:'http://localhost:8080'});
  assert.match(next,/img-src 'self' data: http:\/\/localhost:8080/);
  assert.match(next,/connect-src 'self' https: http:\/\/localhost:8080/);
  assert.doesNotMatch(next,/(?:^|\s)http:(?:\s|;|$)/);
  assert.equal(addConfiguredOriginToCsp(next,{enabled:true,origin:'http://localhost:8080'}),next);
});

test('pre-request routing preserves paths and queries for exact loopback default HTTP only', async () => {
  const {resolveStandaloneRequestUrl}=await frontend;
  for(const source of ['http://localhost','http://localhost:80','http://127.0.0.1','http://[::1]']) {
    assert.equal(resolveStandaloneRequestUrl(source+'/api/a.php?value=a%20b&x=%2F#part',{enabled:true,origin:'http://localhost:8080'}),
      'http://localhost:8080/api/a.php?value=a%20b&x=%2F#part');
  }
  assert.equal(resolveStandaloneRequestUrl('http://localhost/api/report.php',{enabled:true,origin:'https://store.example.test:8443'}),
    'https://store.example.test:8443/api/report.php');
});

test('external, LAN, HTTPS, explicit nondefault ports and misleading hostnames never get rerouted', async () => {
  const {createStandaloneFetch}=await frontend;
  const urls=['https://localhost/api','http://localhost:8080/api','http://127.0.0.1:3000/api','http://192.168.1.1/api',
    'http://example.test/api','http://localhost.example.test/api','http://localhost@evil.test/api','http://localhost\\@evil.test/api',
    'http://127.1/api','/api/login.php','file:///api/login.php'];
  let count=0;
  const routed=createStandaloneFetch({getConfig:()=>{throw Error('must not inspect unrelated requests');},fetchImpl:(input,options)=>{count++;return{input,options};}});
  for(const url of urls) {
    const options={headers:{Authorization:'Bearer fixture'}};
    const result=await routed(url,options);
    assert.equal(result.input,url);
    assert.equal(result.options,options);
  }
  assert.equal(count,urls.length);
});

test('disabled routing leaves legacy/XAMPP/browser fetch inputs and options untouched', async () => {
  const {createStandaloneFetch}=await frontend;
  const options={method:'POST',body:'fixture'};
  const routed=createStandaloneFetch({getConfig:()=>({enabled:false}),fetchImpl:(input,init)=>({input,init})});
  assert.deepEqual(await routed('http://localhost/api/test.php',options),{input:'http://localhost/api/test.php',init:options});
});

test('POST headers, body, credentials and abort signal reach fetch unchanged without an HTTP redirect', async () => {
  const {createStandaloneFetch}=await frontend;
  const controller=new AbortController();
  const options={method:'POST',headers:new Headers({Authorization:'Bearer fixture', 'Content-Type':'application/json'}),
    body:JSON.stringify({value:'original'}),signal:controller.signal,credentials:'include'};
  let calls=0;
  const routed=createStandaloneFetch({getConfig:()=>({enabled:true,origin:'http://localhost:8080'}),fetchImpl:(input,init)=>{
    calls++;assert.equal(input,'http://localhost:8080/api/pay.php?test=1');assert.equal(init,options);return 'response';
  }});
  assert.equal(await routed('http://localhost/api/pay.php?test=1',options),'response');
  assert.equal(calls,1);
});

test('URL and Request inputs preserve request method, headers and body', async () => {
  const {createStandaloneFetch}=await frontend;
  const inputs=[];
  const routed=createStandaloneFetch({getConfig:()=>({enabled:true,origin:'http://localhost:8080'}),fetchImpl:input=>{inputs.push(input);return input;}});
  await routed(new URL('http://localhost/api/get.php'));
  assert.equal(inputs[0],'http://localhost:8080/api/get.php');
  const original=new Request('http://localhost/api/post.php',{method:'POST',headers:{Authorization:'Bearer fixture'},body:'body fixture'});
  const result=await routed(original);
  assert.equal(result.url,'http://localhost:8080/api/post.php');
  assert.equal(result.method,'POST');
  assert.equal(result.headers.get('Authorization'),'Bearer fixture');
  assert.equal(await result.text(),'body fixture');
});

test('invalid enabled routing and IPC failures never fall through to XAMPP', async () => {
  const {createStandaloneFetch}=await frontend;
  let calls=0;
  for(const config of [null,{}, {enabled:true}, {enabled:true,origin:'file:///private'}, {enabled:true,origin:'http://localhost:8080/api'}]) {
    const routed=createStandaloneFetch({getConfig:()=>config,fetchImpl:()=>{calls++;}});
    await assert.rejects(()=>routed('http://localhost/api/pay.php',{method:'POST',body:'fixture'}));
  }
  const rejected=createStandaloneFetch({getConfig:()=>{throw Error('IPC unavailable');},fetchImpl:()=>{calls++;}});
  await assert.rejects(()=>rejected('http://localhost/api/report.php'),/IPC unavailable/);
  assert.equal(calls,0);
});

test('configuration is read per request so changing the installed LOCAL server does not retain a stale port', async () => {
  const {createStandaloneFetch}=await frontend;
  let origin='http://localhost:8080';
  const routed=createStandaloneFetch({getConfig:()=>({enabled:true,origin}),fetchImpl:input=>input});
  assert.equal(await routed('http://localhost/api/test.php'),'http://localhost:8080/api/test.php');
  origin='http://127.0.0.1';
  assert.equal(await routed('http://localhost/api/test.php'),'http://127.0.0.1/api/test.php');
});

test('Windows and Mac standalone HTML markers fail closed when preload or its IPC contract is missing', async () => {
  const {readStandaloneRoutingConfig:readConfig}=await frontend;
  for (const runtime of ['windows-standalone','macos-standalone']) {
    const documentRef={querySelector:()=>({getAttribute:()=>runtime})};
    for(const bridge of [undefined,{}, {getStandaloneBackend:()=>({enabled:false})}, {getStandaloneBackend:()=>null}]) {
      await assert.rejects(()=>readConfig({documentRef,bridge}));
    }
    assert.deepEqual(await readConfig({documentRef,bridge:{getStandaloneBackend:()=>({enabled:true,origin:'http://localhost:8080'})}}),
      {enabled:true,origin:'http://localhost:8080'});
  }
  assert.deepEqual(await readConfig({documentRef:{querySelector:()=>null},bridge:undefined}),{enabled:false});
});
