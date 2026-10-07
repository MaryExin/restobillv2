#!/usr/bin/env node
'use strict';
const { ensurePhpMyAdmin } = require('./prepare.cjs');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--offline')) throw new Error('Use node installer/phpmyadmin/fetch.cjs [--offline].');
ensurePhpMyAdmin({ offline: args.includes('--offline') }).then(({ manifest }) => {
  console.log(`Prepared phpMyAdmin ${manifest.version}: ${Object.keys(manifest.files).length} files; ${manifest.sha256}`);
}).catch(error => { console.error(error.message); process.exitCode = 1; });
