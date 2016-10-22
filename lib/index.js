'use strict';

const BbPromise = require('bluebird');
const fs = require('fs');
const path = require('path');
const shortid = require('shortid');
const url = require('url');
const yaml = require('yaml');

const handler = require('./lambda/handler');
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
   * @param {string} - filePath - location to check if file exists
   * @returns {boolean} - true if file exists, false otherwise
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
   * @return {mixed} The object resulting from loading and appropriately parsing the given script
   */
  readScript: (scriptPath) => {
    const scriptPathLower = scriptPath.toLowerCase();
    const isYamlFile = scriptPathLower.endsWith('.yml') || scriptPathLower.endsWith('.yaml');
    const fileContents = fs.readFileSync(scriptPath, { encoding: 'utf8' });

    if (isYamlFile) {
      return yaml.eval(fileContents);
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
    return [`---
  # Thank you for trying serverless-artillery!
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
  serverlessRunner: () => {
    const serverless = new Serverless({
      interactive: false,
      servicePath: impl.findServicePath(),
    });

    return serverless.init()
      .then(() => serverless.run())
      .then((/* result */) => {
        // TODO: Why is result undefined? How to get results from SLS, otherwise?
        // If not, then we should remove this block.
      })
      .catch((ex) => {
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
  deploy: () => {
    process.argv = [null, null, 'deploy', '-f', constants.TestFunctionName];

    console.log('\n\tDeploying Lambda to AWS...\n');

    return impl.serverlessRunner().then(() => {
      console.log('\n\tDeploy complete.\n');
    });
  },
  /**
   * Send a script to the remote function.  Prefer a script identified by the `-s` or `--script` option over a
   * `script.yml` file in the current working directory over the global `script.yml`.
   * @param options The options given by the user.  See the ~/bin/serverless-artillery implementation for details.
   * @return {Promise.<TResult>} A promise that completes after the invocation of the function with the script given
   * by the user (or a fallback option).
   */
  run: (options) => {
    let completeMessage = '\n\tTest Lambda complete.\n';
    const scriptPath = impl.findScriptPath(options.script);
    if (!scriptPath) {
      return BbPromise.reject(new Error(`\n\tScript '${options.script}' could not be found.\n`));
    }
    // start with default SLS command
    process.argv = [null, null, 'invoke', '-d', '-f', constants.TestFunctionName, '-p', scriptPath];
    // load and analyze script
    const scriptData = impl.readScript(scriptPath);
    const scriptExtent = impl.scriptExtent(scriptData);
    const exceedsLimits = scriptExtent.width >= scriptExtent.maxWidth || scriptExtent.length >= scriptExtent.maxLength;
    if (exceedsLimits) { // exceeds limits?
      process.argv.push('-i');
      process.argv.push('Event');
      completeMessage = `\n\tTest Lambda started. Test will be complete after ${scriptExtent.width} seconds.\n`;
    }
    // run the given script on the deployed lambda
    console.log(`\n\tInvoking test Lambda with script '${scriptPath}'\n`);
    return impl.serverlessRunner().then(() => {
      console.log(completeMessage);
    });
  },
  /**
   * Remove the CloudFormation Stack (or equivalent) from the configured provider.
   * @return {Promise.<TResult>} A promise that completes after the removal of the stack and reporting of its
   * completion.
   */
  remove: () => {
    process.argv = [null, null, 'remove', '-f', constants.TestFunctionName];

    console.log('\n\tRemoving Lambda from AWS...\n');

    return impl.serverlessRunner().then(() => {
      console.log('\n\tRemoval complete.\n');
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
      reject(new Error(`\n\tConflict at path '${destPath}'. File exists.  No script generated.\n`));
    } else {
      const newScript = impl.generateScript(options);
      fs.writeFileSync(destPath, newScript);
      console.log([
        `\n\tYour script '${destPath}' is created.`,
        '\n\tWe\'re very glad that you see enough value to create a custom script!',
        '\n\tEdit your script and review the documentation for your endpoint pummeling options at:',
        '\n\thttps://artillery.io/docs\n',
      ].join(''));
      resolve();
    }
  }),
  /**
   * Generate the function deployment assets and place them into the current working directory so that the user can
   * create and deploy a custom function definition.
   */
  configure: () => new BbPromise((resolve, reject) => {
    const conflicts = [];
    // identify conflicts
    constants.ServerlessFiles.forEach((file) => {
      const destPath = path.join(process.cwd(), file);
      if (impl.fileExists(destPath)) {
        conflicts.push(destPath);
      }
    });
    if (conflicts.length) {
      // report any conflicts
      let msg = '\n\tConflict with existing files:';
      conflicts.forEach((file) => {
        msg += `\n\t\t${file}`;
      });
      msg += '\n\tNo files created.\n';
      reject(new Error(msg));
    } else {
      // create the configuration assets
      constants.ServerlessFiles.forEach((file) => {
        const sourcePath = path.join(__dirname, 'lambda', file);
        const destPath = path.join(process.cwd(), file);

        const content = fs.readFileSync(sourcePath, { encoding: 'utf8' });
        fs.writeFileSync(destPath, content.replace(
          'service: serverless-artillery',
          `service: serverless-artillery-${shortid.generate()}` // add a dash followed by a "unique" short ID
        ));
      });
      console.log([
        '\n\tYour function assets have been created.',
        '\n\tWe are glad that you see enough value in the project to do some customization!',
        '\n\tEdit serverless.yml to customize your load function but please note that you must re-deploy the' +
        '\n\t\tfunction after making any modifications.',
        '\n\tDocumentation available at https://docs.serverless.com\n',
      ].join(''));
      resolve();
      // TODO npm install or copy the existing node_modules?
    }
  }),
};
