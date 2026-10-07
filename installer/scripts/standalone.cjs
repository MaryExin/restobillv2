#!/usr/bin/env node
// Separate command namespace and artifacts for the XAMPP-independent installer.
const path = require('node:path');
const COMMANDS = Object.freeze(['installer:win','installer:mac','installer:release','setup:win','setup:mac','installer:bundle','installer:all']);
async function standalone(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  if (!COMMANDS.includes(command)) throw new Error(`Use npm run standalone -- <command>. Commands: ${COMMANDS.join(', ')}`);
  if (command === 'installer:all' && process.platform !== 'darwin') throw new Error('Build both platforms on a Mac, or build each platform separately and combine their standalone artifacts.');
  if (['installer:win','installer:mac','installer:all'].includes(command)) {
    const builder = require('./build.cjs');
    const opts = builder.options(['--standalone', ...rest]);
    if (command === 'installer:all') {
      if (opts['prepare-only']) throw new Error('Use installer:win or installer:mac with --prepare-only; installer:all creates finished installers.');
      await builder.build({...opts,platform:'win32',arch:'x64'});
      await builder.build({...opts,platform:'darwin',arch:'universal'});
      require('./release.cjs').release([], true);
      await require('./launcher.cjs').buildLauncher('win32',!!opts.offline,true);
      await require('./launcher.cjs').buildLauncher('darwin',!!opts.offline,true);
      return require('./bundle.cjs').bundle(true);
    }
    return builder.build({...opts,platform:command === 'installer:win' ? 'win32' : 'darwin',arch:command === 'installer:win' ? 'x64' : opts.arch});
  }
  if (command === 'installer:release') return require('./release.cjs').release(rest.map(file => path.resolve(file)),true);
  if (command === 'installer:bundle') {
    if (rest.length) throw new Error('installer:bundle takes no options; use installer:all to rebuild the complete standalone bundle.');
    return require('./bundle.cjs').bundle(true);
  }
  if (rest.some(arg => arg !== '--offline')) throw new Error('Setup app commands accept only --offline.');
  return require('./launcher.cjs').buildLauncher(command === 'setup:win' ? 'win32' : 'darwin',rest.includes('--offline'),true);
}
if (require.main === module) standalone().catch(error => { console.error(error.message); process.exit(1); });
module.exports={standalone,COMMANDS};
