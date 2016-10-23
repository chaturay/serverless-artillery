// Spawn `npm -install` to populate our Lambda's dependencies.

'use strict';

const execSync = require('child_process').execSync;

module.exports = {
  /**
   * Execute an `npm install` using the given current working directory.
   * @param cwd The directory to execute the `npm install` within.
   */
  install: (cwd) => {
    const env = JSON.parse(JSON.stringify(process.env));
    if (env.npm_config_argv) {
      // copy and clear the "global" aspect of the process environment (so that this isn't seen as a global install)
      // (this way, pass proxy settings and whatnot if they exist)
      delete env.npm_config_argv;
      delete env.npm_config_global;
    }

    execSync('npm install', {
      env,
      cwd,
      stdio: 'inherit',
    });
  },
};
