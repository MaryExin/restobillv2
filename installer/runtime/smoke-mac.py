#!/usr/bin/env python3
"""Isolated proof of production configs; no service registration or live data.

Each child is sandboxed to deny XAMPP reads. Ports and OS identities are fixture
values; production installer ACLs/service registration need platform testing.
"""
import subprocess,pathlib,tempfile,socket,time,json,os,shutil,pwd,grp,secrets
repo=pathlib.Path(__file__).resolve().parents[2]
runtime=repo/'installer/cache/standalone-runtime/darwin'
base=pathlib.Path(tempfile.mkdtemp(prefix='lightem-prod-proof-',dir='/private/tmp'))
state=base/'State With Spaces';data=state/'data';web=state/'backend'
for rel in ['data','backend','config','logs/http','logs/database','run/http','run/database','run/database/tmp']:(state/rel).mkdir(parents=True,exist_ok=True)
policy=['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny file-read* (subpath "/Applications/XAMPP"))']
env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','PHP_INI_SCAN_DIR':''};children=[]
def run(args,**kw):
 r=subprocess.run(policy+[str(a) for a in args],env=env,capture_output=True,text=True,**kw)
 if r.returncode:raise RuntimeError(f'{args[0]} exit{r.returncode}: {r.stdout}\n{r.stderr}')
 return r.stdout
def port():
 s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p
try:
 source=(repo/'installer/mac-standalone/postinstall').read_text().split('# BEGIN STANDALONE CONFIGURATION\n')[1].split('# END STANDALONE CONFIGURATION')[0]
 # Evaluate the actual production writer; fixture permissions replace OS-only
 # chown/chmod, and only test ports/user/group differ in generated configs.
 script='chown(){ :; }; chmod(){ :; };\n'+source+'\nwrite_configuration\n'
 dbport=port();httpport=port();password=secrets.token_hex(24)
 (state/'run/database-init.sql').write_text(f"ALTER USER 'root'@'localhost' IDENTIFIED BY '{password}';\nALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '{password}';\n")
 e={**env,'STATE':str(state),'DATA':str(data),'WEBROOT':str(web),'RUNTIME':str(runtime)}
 r=subprocess.run(['/bin/bash','-eu','-c',script],env=e,text=True,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr)
 cfg=state/'config/database.cnf';cfg.write_text(cfg.read_text().replace('port=3307',f'port={dbport}'))
 cfg=state/'config/httpd.conf';cfg.write_text(cfg.read_text().replace('Listen 80',f'Listen 127.0.0.1:{httpport}').replace('User _lightemhttp','User '+pwd.getpwuid(os.getuid()).pw_name).replace('Group _lightemhttp','Group '+grp.getgrgid(os.getgid()).gr_name))
 run(['/bin/sh',runtime/'bin/mysql_install_db','--no-defaults',f'--basedir={runtime}',f'--datadir={data}','--auth-root-authentication-method=normal','--skip-test-db','--force'],timeout=60)
 p=subprocess.Popen(policy+[str(runtime/'bin/mysqld'),f'--defaults-file={state}/config/database.cnf'],env=env,start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);children.append(p)
 for _ in range(100):
  try:
   s=socket.create_connection(('127.0.0.1',dbport),timeout=.2);s.close();break
  except OSError:
   if p.poll() is not None:raise RuntimeError((state/'logs/database/error.log').read_text())
   time.sleep(.1)
 run([runtime/'bin/php','-n','-r',f'$p=new PDO("mysql:host=127.0.0.1;port={dbport}","root","{password}");echo $p->query("SELECT VERSION()")->fetchColumn();'],timeout=15)
 print('Production database.cnf, TCP loopback with password, XAMPP denied: PASS',flush=True)
 (web/'.htaccess').write_text('Options -Indexes\n')
 (web/'.env').write_text('PRIVATE_FIXTURE=1\n')
 (web/'config.php').write_text('<?php echo \"forbidden\";')
 (web/'import_db.php').write_text('<?php echo \"forbidden\";')
 (web/'uploads').mkdir();(web/'uploads/payload.PHP').write_text('<?php echo \"forbidden\";')
 (web/'images').mkdir();(web/'images/item.jpg').write_bytes(b'fixture-image')
 (web/'index.php').write_text('<?php header("Content-Type: application/json"); echo json_encode(["php"=>PHP_VERSION,"timezone"=>date_default_timezone_get(),"ini"=>php_ini_loaded_file()]);')
 run([runtime/'bin/httpd','-t','-f',state/'config/httpd.conf'],timeout=15)
 print('Production Apache configuration syntax: PASS',flush=True)
 http=subprocess.Popen(policy+[str(runtime/'bin/httpd'),'-DFOREGROUND','-f',str(state/'config/httpd.conf')],env=env,start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);children.append(http)
 import urllib.request
 for _ in range(100):
  try: response=urllib.request.urlopen(f'http://127.0.0.1:{httpport}/',timeout=1).read();break
  except Exception:
   if http.poll() is not None:raise RuntimeError((state/'logs/http/error.log').read_text())
   time.sleep(.1)
 result=json.loads(response);assert result['php']=='8.2.4' and result['timezone']=='Asia/Manila' and result['ini']==str(state/'config/php.ini'),result
 print('Production PHPIniDir and HTTP request with XAMPP denied: PASS',flush=True)
 for forbidden in ['.env','config.php','import_db.php','uploads/payload.PHP']:
  try:
   urllib.request.urlopen(f'http://127.0.0.1:{httpport}/{forbidden}',timeout=2)
   raise AssertionError(f'Private/unsafe file was served: {forbidden}')
  except urllib.error.HTTPError as e:assert e.code==403,(forbidden,e.code)
 with urllib.request.urlopen(f'http://127.0.0.1:{httpport}/images/item.jpg',timeout=2) as response:
  assert response.headers['Content-Type']=='image/jpeg'
  assert response.read()==b'fixture-image'
 print('htaccess Options compatibility, private/import/upload denial, image MIME: PASS',flush=True)
finally:
 for p in reversed(children):
  p.terminate()
  try:p.wait(timeout=20)
  except subprocess.TimeoutExpired:p.kill();p.wait()
 shutil.rmtree(base)
 print('All isolated test servers stopped and fixture removed.',flush=True)
