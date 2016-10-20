// Spawn `npm -install` to populate our Lambda's dependencies.

'use strict';

const execSync = require('child_process').execSync;
const join = require('path').join;

// copy and clear the "global" aspect of the process environment (this way, pass proxy settings and whatnot through)
const env = JSON.parse(JSON.stringify(process.env));
delete env.npm_config_argv;
delete env.npm_config_global;

execSync('npm install', {
  env,
  cwd: join(__dirname, 'lib', 'lambda'),
  stdio: 'inherit',
});
