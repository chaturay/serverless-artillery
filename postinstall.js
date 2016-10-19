const join = require('path').join;

// Spawn `npm -install` to populate our Lmabda's dependencies.
require('child_process').spawn('npm', ['i'], { env: process.env, cwd: join(__dirname, 'lib', 'lambda'), stdio: 'inherit' });
