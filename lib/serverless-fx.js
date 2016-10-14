'use strict';

let slsFound = null;

try {
    slsFound = require('serverless');
} catch (ex) {
    const execSync = require('child_process').execSync,
          path = require('path'),
          npmGlobalRoot = execSync('npm -g root', { encoding: 'utf-8' }).trim();

    slsFound = require(path.join(npmGlobalRoot, 'serverless/lib/Serverless'));
}

module.exports = slsFound;
