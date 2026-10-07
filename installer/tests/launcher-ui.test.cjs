const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const template = fs.readFileSync(path.join(__dirname, '../launcher.html'), 'utf8');
const release = {version:'0.0.1',buildId:'20260926162540',runtimeKind:'standalone',installers:{
  win32:{version:'0.0.1',buildId:'20260926162540',supportsXamppImport:true},
  darwin:{version:'0.0.1',buildId:'20260926142957',supportsXamppImport:true},
}};
async function render(platform, installed) {
  const elements = new Map();
  function element(key) {
    if (!elements.has(key)) elements.set(key,{textContent:'',attributes:{},handlers:{},checked:false,disabled:false,hidden:false,
      setAttribute(name,value){this.attributes[name]=value;},addEventListener(name,handler){this.handlers[name]=handler;}});
    return elements.get(key);
  }
  const buttons=['win32','darwin'].map(os=>Object.assign(element(os),{dataset:{os}}));
  const calls=[];
  const context=vm.createContext({navigator:{platform:platform==='darwin'?'MacIntel':'Win32'},document:{
    querySelector:element,querySelectorAll:()=>buttons,getElementById:element,
  },window:{lightemSetup:{status:async()=>({platform,installed}),
    install:async (os,options)=>{calls.push(['install',os,JSON.parse(JSON.stringify(options))]);return{started:true};},
    saveInstaller:async os=>{calls.push(['save',os]);return{saved:true};},checkForUpdates:async()=>({checked:true}),
  }}});
  const script=template.match(/<script>([\s\S]*?)<\/script>/)[1].replace('/* LIGHTEM_RELEASE */',JSON.stringify(release));
  vm.runInContext(script,context);
  await Promise.resolve();
  return {element,calls,select:os=>element(os).handlers.click(),setImport:value=>{element('copy-xampp').checked=value;element('copy-xampp').handlers.change();},click:()=>element('start').handlers.click({preventDefault(){}})};
}

test('the shared UI treats the unchanged installed Mac build as repair, not a Windows update',async()=>{
  const ui=await render('darwin',release.installers.darwin);
  assert.equal(ui.element('action-label').textContent,'Repair Lightem POS');
  assert.match(ui.element('version').textContent,/Mac.*20260926142957/);
  await ui.click();assert.deepEqual(ui.calls,[['install','darwin',{copyXampp:false}]]);
});
test('one UI exports the corrected Windows build from a Mac and keeps local Mac repair available',async()=>{
  const ui=await render('darwin',release.installers.darwin);
  ui.select('win32');
  assert.equal(ui.element('action-label').textContent,'Save Windows installer');
  assert.match(ui.element('version').textContent,/Windows.*20260926162540/);
  await ui.click();assert.deepEqual(ui.calls,[['save','win32']]);
  ui.select('darwin');assert.equal(ui.element('action-label').textContent,'Repair Lightem POS');
});
test('the shared Windows UI offers its own correction and can export the preserved Mac installer',async()=>{
  const ui=await render('win32',{version:'0.0.1',buildId:'20260926160539'});
  assert.equal(ui.element('action-label').textContent,'Update Lightem POS');
  await ui.click();
  ui.select('darwin');assert.equal(ui.element('action-label').textContent,'Save Mac installer');
  await ui.click();assert.deepEqual(ui.calls,[['install','win32',{copyXampp:false}],['save','darwin']]);
});
test('a Mac newer than the embedded Mac package is never offered a downgrade despite the newer Windows bundle',async()=>{
  const ui=await render('darwin',{version:'0.0.1',buildId:'20260926150000'});
  assert.equal(ui.element('action-label').textContent,'Newer build already installed');
  assert.equal(ui.element('start').attributes['aria-disabled'],'true');
  await ui.click();assert.deepEqual(ui.calls,[]);
  ui.select('win32');await ui.click();assert.deepEqual(ui.calls,[['save','win32']]);
});

test('Windows setup explains the store-copy choice and its own database-browser port',async()=>{
  const ui=await render('win32',null);
  assert.equal(ui.element('action-label').textContent,'Install Lightem POS');
  assert.match(ui.element('status').textContent,/empty standalone store on port 8080/);
  assert.match(ui.element('details p').textContent,/unless you select Copy data from XAMPP/);
  assert.match(ui.element('details p').textContent,/http:\/\/localhost:8080\/lightem-db\//);
  assert.match(ui.element('hint').textContent,/Close standalone POS apps/);
  ui.select('darwin');
  assert.match(ui.element('.intro').textContent,/XAMPP is optional/);
  assert.match(ui.element('details p').textContent,/http:\/\/localhost:8080\/lightem-db\//);
  assert.match(ui.element('details p').textContent,/Update tablet API addresses to include :8080/);
});

for(const platform of ['win32','darwin']) {
  test(`${platform} import checkbox is unchecked by default and requires explicit selection`,async()=>{
    const ui=await render(platform,null);
    assert.equal(ui.element('import-option').hidden,false);
    assert.equal(ui.element('copy-xampp').checked,false);
    assert.equal(ui.element('copy-xampp').disabled,false);
    assert.match(ui.element('import-help').textContent,/without checking or starting XAMPP/);
    await ui.click();
    ui.setImport(true);
    assert.match(ui.element('hint').textContent,/Keep XAMPP MySQL running/);
    assert.equal(ui.element('action-label').textContent,'Import XAMPP store');
    await ui.click();
    ui.setImport(false);await ui.click();
    assert.deepEqual(ui.calls,[['install',platform,{copyXampp:false}],['install',platform,{copyXampp:true}],['install',platform,{copyXampp:false}]]);
  });
  test(`${platform} owned store update keeps data and disables source import`,async()=>{
    const ui=await render(platform,{version:'0.0.1',buildId:'20260926000000'});
    assert.equal(ui.element('copy-xampp').disabled,true);
    ui.setImport(true);
    assert.equal(ui.element('copy-xampp').checked,false);
    assert.match(ui.element('import-help').textContent,/existing standalone data will be kept/);
    await ui.click();assert.deepEqual(ui.calls,[['install',platform,{copyXampp:false}]]);
  });
}
test('selecting another OS clears a local import choice and export never carries it implicitly',async()=>{
  const ui=await render('darwin',null);
  ui.setImport(true);ui.select('win32');
  assert.equal(ui.element('copy-xampp').checked,false);assert.equal(ui.element('copy-xampp').disabled,true);
  assert.match(ui.element('import-help').textContent,/open its setup app/);
  await ui.click();assert.deepEqual(ui.calls,[['save','win32']]);
  ui.select('darwin');assert.equal(ui.element('copy-xampp').checked,false);assert.equal(ui.element('copy-xampp').disabled,false);
});
test('the optional import control precedes operating-system choices and has an accessible label',()=>{
  assert(template.indexOf('id="import-option"') < template.indexOf('class="choices"'));
  assert.match(template,/<label for="copy-xampp"><input type="checkbox" id="copy-xampp" aria-describedby="import-help">/);
  assert.doesNotMatch(template,/<input[^>]*id="copy-xampp"[^>]*\schecked(?:[\s=>])/);
});
