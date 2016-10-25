'use strict';

const BbPromise = require('bluebird');
const fs = require('fs');
const os = require('os');
const path = require('path');
const semver = require('semver');
const shortid = require('shortid');
const url = require('url');
const yaml = require('js-yaml');

const handler = require('./lambda/handler');
const npm = require('./npm');
const Serverless = require('./serverless-fx');

const constants = {
  DefaultScriptName: 'script.yml',
  ServerlessFiles: ['serverless.yml', 'handler.js', 'package.json'],
  TestFunctionName: 'loadGenerator',
};

const impl = {
  // FILE UTILS
  /**
   * Helper function that, given a path, returns true if it's a file.
   * @param {string} filePath location to check if file exists
   * @returns {boolean} true if file exists, false otherwise
   */
  fileExists: (filePath) => {
    try {
      return fs.lstatSync(filePath).isFile();
    } catch (ex) {
      return false;
    }
  },
  // SCRIPT UTILS
  /**
   * Determine, given the user supplied script option, what script to use.  Use a given script if it exists but
   * otherwise fall back to a local script.yml if it exists and finally fall back to the global script.yml if it
   * does not.
   * @param scriptPath An optional path the script to find.  If supplied, it will be checked for existence.
   * @return A string indicating the path that was found.  If the user supplied a file path that could not be found
   * return `null` to indicate an error should be displayed.  Otherwise, return a local script.yml file or the global
   * script.yml file if the prior two conditions do not hold.
   */
  findScriptPath: (scriptPath) => {
    if (scriptPath) {
      if (impl.fileExists(scriptPath)) {
        if (path.isAbsolute(scriptPath)) {
          return scriptPath;
        } else {
          return path.join(process.cwd(), scriptPath);
        }
      } else {
        return null; // doesn't exist
      }
    } else {
      const localDefaultScript = path.join(process.cwd(), constants.DefaultScriptName);
      if (impl.fileExists(localDefaultScript)) {
        return localDefaultScript;
      } else {
        return path.join(__dirname, 'lambda', constants.DefaultScriptName);
      }
    }
  },
  /**
   * Read and parse a script file that can contain either YAML or JSON and parse it as the former if it has an
   * extension of `yml` or `yaml` (case insensitive).
   * @param scriptPath The path to the script to read.
   * @return {*} The object resulting from loading and appropriately parsing the given script
   */
  readScript: (scriptPath) => {
    const scriptPathLower = scriptPath.toLowerCase();
    const isYamlFile = scriptPathLower.endsWith('.yml') || scriptPathLower.endsWith('.yaml');
    const fileContents = fs.readFileSync(scriptPath, { encoding: 'utf8' });

    if (isYamlFile) {
      return yaml.safeLoad(fileContents);
    } else {
      return JSON.parse(fileContents);
    }
  },
  /**
   * Get the extent and limits of the given script
   * @param script The script to determine extent for
   * @return {{length: (*|number), width: (*|number), maxLength: *, maxWidth: *}}
   */
  scriptExtent(script) {
    const settings = handler.impl.getSettings(script);
    return {
      length: handler.impl.scriptLength(script),
      width: handler.impl.scriptWidth(script),
      maxLength: settings.maxChunkRequestsPerSecond,
      maxWidth: settings.maxScriptDurationInSeconds,
    };
  },
  /**
   * Generate a script with the given options hive.  Return the default script generated with those settings, filling
   * in default values as appropriate.
   * @param options The options hive to use in building the default script
   * @return {string} The string containing a JSON object that comprises the default script.
   */
  generateScript: (options) => {
    // fallback to defaults
    const opts = options || {};
    const endpoint = opts.endpoint || 'http://aws.amazon.com';
    const duration = opts.duration || 5;
    const rate = opts.rate || 2;
    const rampTo = opts.rampTo;
    // extract and combine options into generated script
    const target = url.resolve(endpoint, '');
    return [`# Thank you for trying serverless-artillery!
# This default script is intended to get you started quickly.
# There is a lot more that Artillery can do.
# You can find great documentation of the possibilities at:
# https://artillery.io/docs/
config:
  target: "${
    target.substr(0, target.length - 1) // remove trailing '/' from host (it would be duplicated in get.url below)
    }" # this hostname will be used for each part of the flow 
  phases:
    -
      duration: ${duration}
      arrivalRate: ${rate}`,
    rampTo ? `
      rampTo: ${rampTo}` : // note that this is a break in the template string (to avoid spurious newline)
      '', `
scenarios:
  -
    flow:
      -
        get:
          url: "${url.parse(endpoint).path}"
`,
    ].join('');
  },
  // SERVERLESS UTILS
  /**
   * Checks working directory for service config, otherwise uses default.
   * @returns {string} - path to service config
   */
  findServicePath: () => {
    const localServerlessPath = path.join(process.cwd(), 'serverless.yml');

    if (impl.fileExists(localServerlessPath)) {
      return process.cwd();
    } else {
      // use the default serverless.yml in project
      return path.join(__dirname, 'lambda');
    }
  },
  /**
   * Invokes the Serverless code to perform a give task. Expects process.argv to
   * contain CLI parameters to pass to SLS.
   */
  serverlessRunner: (options) => {
    const compatibleVersion = '^1.0.3';
    const serverless = new Serverless({
      interactive: false,
      servicePath: impl.findServicePath(),
    });
    if (options.verbose) {
      console.log(`Serverless version is ${serverless.version}, compatible version is '${compatibleVersion}'`);
    }
    if (!semver.satisfies(serverless.version, compatibleVersion)) {
      return BbPromise.reject(new Error(
        `Loaded Serverless version '${serverless.version}' but the compatible version is ${compatibleVersion}`
      ));
    }
    let SLS_DEBUG;
    if (options.debug) {
      console.log(`Running Serverless with argv: ${process.argv}`);
      SLS_DEBUG = process.env.SLS_DEBUG;
      process.env.SLS_DEBUG = '*';
    }
    return serverless.init()
      .then(() => serverless.run())
      .then((/* result */) => {
        process.env.SLS_DEBUG = SLS_DEBUG;
        // TODO: Why is result undefined? How to get results from SLS, otherwise?
      })
      .catch((ex) => {
        process.env.SLS_DEBUG = SLS_DEBUG;
        console.error(ex);
      });
  },
};

module.exports = {
  /**
   * Deploy the load generation function to the configured provider.  Prefer a local service over the global service
   * but better to have one service over having none.
   * @return {Promise.<TResult>} A promise that completes after the deployment of the function and reporting of that
   * deployment.
   */
  deploy: (options) => {
    process.argv = [null, null, 'deploy', '-f', constants.TestFunctionName];
    if (options.verbose) {
      process.argv.push('--verbose');
    }

    console.log(`${os.EOL}\tDeploying Lambda to AWS...${os.EOL}`);

    return impl.serverlessRunner(options).then(() => {
      console.log(`${os.EOL}\tDeploy complete.${os.EOL}`);
    });
  },
  /**
   * Send a script to the remote function.  Prefer a script identified by the `-s` or `--script` option over a
   * `script.yml` file in the current working directory over the global `script.yml`.
   * @param options The options given by the user.  See the ~/bin/serverless-artillery implementation for details.
   * @return {Promise.<TResult>} A promise that completes after the invocation of the function with the script given
   * by the user (or a fallback option).
   */
  invoke: (options) => {
    let completeMessage = `${os.EOL}\tYour function invocation has completed.${os.EOL}`;
    const scriptPath = impl.findScriptPath(options.script);
    if (!scriptPath) {
      return BbPromise.reject(new Error(`${os.EOL}\tScript '${options.script}' could not be found.${os.EOL}`));
    }
    // start with default SLS command
    process.argv = [null, null, 'invoke', '-d', '-f', constants.TestFunctionName, '-p', scriptPath];
    // load and analyze script
    const scriptData = impl.readScript(scriptPath);
    const scriptExtent = impl.scriptExtent(scriptData);
    const exceedsLimits = scriptExtent.width >= scriptExtent.maxWidth || scriptExtent.length >= scriptExtent.maxLength;
    if (exceedsLimits) { // exceeds limits?
      process.argv.push('-t');
      process.argv.push('Event');
      completeMessage = `${os.EOL}\tYour function has been invoked. The load is scheduled to be completed in ${
        scriptExtent.width} seconds.${os.EOL}`;
    }
    // run the given script on the deployed lambda
    console.log(`${os.EOL}\tInvoking test Lambda with script '${scriptPath}'${os.EOL}`);
    return impl.serverlessRunner(options).then(() => {
      console.log(completeMessage);
    });
  },
  /**
   * Remove the CloudFormation Stack (or equivalent) from the configured provider.
   * @return {Promise.<TResult>} A promise that completes after the removal of the stack and reporting of its
   * completion.
   */
  remove: (options) => {
    process.argv = [null, null, 'remove', '-f', constants.TestFunctionName];
    if (options.verbose) {
      process.argv.push('--verbose');
    }

    console.log(`${os.EOL}\tRemoving Lambda from AWS...${os.EOL}`);

    return impl.serverlessRunner(options).then(() => {
      console.log(`${os.EOL}\tRemoval complete.${os.EOL}`);
    });
  },
  /**
   * Generate a script using the user's given options.  Place it into the given out path or the default out path if
   * none was given.
   * @param options The user's supplied options.
   */
  script: options => new BbPromise((resolve, reject) => {
    const destPath = options.out || 'script.yml';
    if (impl.fileExists(destPath)) {
      reject(new Error(`${os.EOL}\tConflict at path '${destPath}'. File exists.  No script generated.${os.EOL}`));
    } else {
      if (options.debug) {
        console.log('Generating script...');
      }
      const newScript = impl.generateScript(options);
      if (options.debug) {
        console.log(`Writing script:${os.EOL}${newScript}${os.EOL}to path: '${destPath}'`);
      }
      fs.writeFileSync(destPath, newScript);
      console.log([
        `${os.EOL}\tYour script '${destPath}' is created.`,
        `${os.EOL}\tWe're very glad that you see enough value to create a custom script!`,
        `${os.EOL}\tEdit your script and review the documentation for your endpoint pummeling options at:`,
        `${os.EOL}\thttps://artillery.io/docs ${os.EOL}`,
      ].join(''));
      resolve();
    }
  }),
  /**
   * Generate the function deployment assets and place them into the current working directory so that the user can
   * create and deploy a custom function definition.
   */
  configure: options => new BbPromise((resolve, reject) => {
    const conflicts = [];
    const cwd = process.cwd();
    // identify conflicts
    if (options.debug) {
      console.log('Identifying any file conflicts...');
    }
    constants.ServerlessFiles.forEach((file) => {
      const destPath = path.join(cwd, file);
      if (impl.fileExists(destPath)) {
        conflicts.push(destPath);
      }
    });
    if (conflicts.length) {
      // report any conflicts
      if (options.debug) {
        console.log('Conflicts discovered, generating output message.');
      }
      let msg = `${os.EOL}\tConflict with existing files:`;
      conflicts.forEach((file) => {
        msg += `${os.EOL}\t\t${file}`;
      });
      msg += `${os.EOL}\tNo files created.${os.EOL}`;
      reject(new Error(msg));
    } else {
      // create the configuration assets
      if (options.debug) {
        console.log('No conflicts found, creating a local copy of the Serverless files to deploy.');
      }
      constants.ServerlessFiles.forEach((file) => {
        const sourcePath = path.join(__dirname, 'lambda', file);
        const destPath = path.join(cwd, file);

        const content = fs.readFileSync(sourcePath, { encoding: 'utf8' });
        fs.writeFileSync(destPath, content.replace(
          'service: serverless-artillery',
          `service: serverless-artillery-${shortid.generate()}` // add a dash followed by a "unique" short ID
        ));
      });
      const completeMessage = [
        `${os.EOL}\tYour function assets have been created.`,
        `${os.EOL}\tWe are glad that you see enough value in the project to do some customization!`,
        `${os.EOL}\tEdit serverless.yml to customize your load function but please note that you must`,
        `${os.EOL}\tdeploy the function before invoking and also after making any modifications.`,
        `${os.EOL}\tDocumentation available at https://docs.serverless.com ${os.EOL}`,
      ];
      try {
        if (options.debug) {
          console.log('Executing `npm install` to provide dependencies to the generated Serverless project.');
        }
        npm.install(cwd);
        resolve();
      } catch (ex) {
        completeMessage.push(
          `${os.EOL}`,
          `${os.EOL}An error occurred executing 'npm install'  please note and resolve any errors`,
          'and run \'npm install\' in the current working directory again.');
        reject(ex);
      }
      console.log(completeMessage.join(''));
    }
  }),
};
