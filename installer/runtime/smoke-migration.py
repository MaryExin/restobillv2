#!/usr/bin/env python3
"""Run mapped legacy migration against two disposable, XAMPP-denied databases."""
from pathlib import Path
import tempfile, subprocess, socket, time, shutil, os, json
repo=Path(__file__).resolve().parents[2]
runtime=repo/'installer/cache/standalone-runtime/darwin'
base=Path(tempfile.mkdtemp(prefix='lightem-standalone-maptest-',dir='/private/tmp'))
policy=['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny file-read* (subpath "/Applications/XAMPP"))']
php=runtime/'bin/php';processes=[];ports=[]
env={**os.environ,'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','PHP_INI_SCAN_DIR':''}
def run(args,**kwargs):
    return subprocess.run(policy+[str(a) for a in args],env=env,check=True,**kwargs)
try:
    for name in ['source','target']:
        data=base/(name+'-data');data.mkdir(mode=0o700)
        temp=base/(name+'-tmp');temp.mkdir(mode=0o700)
        with (base/(name+'-initialize.log')).open('wb') as log:
            run([runtime/'bin/mysql_install_db','--no-defaults',f'--basedir={runtime}',f'--datadir={data}',f'--tmpdir={temp}','--auth-root-authentication-method=normal','--skip-test-db'],stdout=log,stderr=subprocess.STDOUT,timeout=60)
        run([php,'-n',repo/'installer/common/database-admin.php','--prepare-init-file',base/(name+'-init.sql'),'--credentials',base/(name+'-root.txt'),'--data-dir',data],stdout=subprocess.DEVNULL)
        s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close();ports.append(port)
        log=(base/(name+'-service.log')).open('wb')
        args=[runtime/'bin/mysqld','--no-defaults',f'--basedir={runtime}',f'--datadir={data}',f'--socket={base}/{name}.sock',f'--pid-file={base}/{name}.pid',f'--tmpdir={temp}','--bind-address=127.0.0.1',f'--port={port}','--skip-name-resolve','--event-scheduler=OFF',f'--init-file={base}/{name}-init.sql','--innodb-buffer-pool-size=32M']
        proc=subprocess.Popen(policy+[str(a) for a in args],env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);processes.append(proc)
        for _ in range(150):
            if proc.poll() is not None:raise RuntimeError((base/(name+'-service.log')).read_text())
            try:
                with socket.create_connection(('127.0.0.1',port),timeout=.2):pass
                break
            except OSError:time.sleep(.1)
        else:raise RuntimeError(name+' private test server did not start')
    for name in ['source','target']:
        backend=base/(name+'-backend');backend.mkdir(mode=0o700)
        for sub in ['api','src']:
            destination=backend/sub;destination.mkdir()
            for file in (repo/'backend'/sub).glob('*.php'):
                if file.name!='config.php':shutil.copyfile(file,destination/file.name)
        shutil.copytree(repo/'installer/cache/build-vendor',backend/'vendor')
        for sub in ['uploads','item_pictures','api/images']:(backend/sub).mkdir(mode=0o700,parents=True,exist_ok=True)
    payload=base/'payload';payload.mkdir();shutil.copytree(repo/'installer/schema',payload/'database')
    manifest={'version':'0.0.1','buildId':'20260927000001','backendSha256':'a'*64,'runtimeKind':'standalone','runtimeVersion':'fixture','runtimeSha256':'b'*64}
    (payload/'manifest.json').write_text(json.dumps(manifest))
    print('Running isolated named-database migration; XAMPP reads denied.',flush=True)
    run([php,'-n',repo/'installer/tests/standalone-mapped-migration.test.php','--fixture',base,'--source-port',str(ports[0]),'--target-port',str(ports[1]),'--runtime',runtime],timeout=180)
finally:
    for proc in reversed(processes):
        if proc.poll() is None:
            proc.terminate()
            try:proc.wait(timeout=20)
            except subprocess.TimeoutExpired:proc.kill();proc.wait()
    shutil.rmtree(base)
    print('Stopped both fixture servers and removed all temporary database/configuration files.',flush=True)
