const execSync = require('child_process').execSync,
      path = require('path'),
      npmGlobalRoot = execSync('npm -g root', { encoding: 'utf-8' }).trim();

module.exports = require(path.join(npmGlobalRoot, 'serverless/lib/Serverless'));
