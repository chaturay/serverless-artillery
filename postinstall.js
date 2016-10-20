// Spawn `npm -install` to populate our Lambda's dependencies.

'use strict';

const execSync = require('child_process').execSync;
const join = require('path').join;

// eslint-disable-next-line import/no-dynamic-require
const dependencies = require(`${__dirname}/lib/lambda/package.json`).dependencies;

Object.keys(dependencies).forEach((dependency) => {
  const version = dependencies[dependency];
  console.log(`Installing Lambda dependency: ${dependency}@${version}`);
  execSync(`npm install ${dependency}@${version}`, {
    env: process.env,
    cwd: join(__dirname, 'lib', 'lambda'),
    stdio: 'inherit',
  });
});
