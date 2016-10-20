// Spawn `npm -install` to populate our Lmabda's dependencies.
'use strict';
const cp = require('child_process');
const join = require('path').join;
const dependencies = require(__dirname + '/lib/lambda/dependencies.json').dependencies;

for (let name in dependencies) {
  let version = dependencies[name];
  console.log(`Installing Lambda dependency: ${name}@${version}`);
  cp.exec('npm', ['install', `${name}@${version}`], {
    env: process.env,
    cwd: join(__dirname, 'lib', 'lambda'),
    stdio: 'inherit'
  });
}
