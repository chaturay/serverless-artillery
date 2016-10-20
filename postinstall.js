// Spawn `npm -install` to populate our Lmabda's dependencies.
const cp = require('child_process');
const path = require('path');

cp.spawn('npm', ['i'], {
  env: process.env,
  cwd: path.join(__dirname, 'lib', 'lambda'),
  stdio: 'inherit',
});
