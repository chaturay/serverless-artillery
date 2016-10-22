'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');
const yaml = require('yaml');
const Serverless = require('./serverless-fx');

const constants = {
  TestFunctionName: 'loadGenerator',
};

const impl = {
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
  copyFile: (source, dest) => {
    fs.writeFileSync(dest, fs.readFileSync(source, { encoding: 'utf8' }));
  },
  readScript: (options) => {
    const scriptFilenameLower = options.script.toLowerCase();
    const isYamlFile = scriptFilenameLower.endsWith('.yml') || scriptFilenameLower.endsWith('.yaml');
    const fileContents = fs.readFileSync(path.join(__dirname, 'lambda', options.script), { encoding: 'utf8' });

    if (isYamlFile) {
      return yaml.eval(fileContents);
    } else {
      return JSON.parse(fileContents);
    }
  },
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
   * Copy the test script into the lambda directory.
   * @param {Object} options - options.script may contain path to test script
   */
  copyTestScript: (options) => {
    const isAbsolutePath = path.isAbsolute(options.script);
    const localScriptPath = path.join(process.cwd(), options.script);
    const scriptFilename = path.basename(localScriptPath);
    const projectServicePath = impl.findServicePath();

    if (isAbsolutePath && impl.fileExists(options.script)) {
      // script refers to absolute path.
      impl.copyFile(options.script, path.join(projectServicePath, scriptFilename));
    } else if (impl.fileExists(localScriptPath)) {
      // Copy the test script into the lambda directory to run, and set the script name
      impl.copyFile(localScriptPath, path.join(projectServicePath, scriptFilename));
    } else if (options.script === 'script.yml') {
      // Otherwise use the default script. Restore from backup, in case it's been overwritten by user.
      const servicePathBackup = path.join(projectServicePath, 'script.backup.yml');
      const servicePathScript = path.join(projectServicePath, 'script.yml');
      impl.copyFile(servicePathBackup, servicePathScript);
    } else {
      // User must have provided a non-default script,
      //  but was not found in either absolute or relative path.
      throw new Error(`Requested test script '${options.script}' was not found.`);
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

  /**
   * Read the length, width and other script properties.
   * @returns {{length: (*|number), width: (*|number), maxChunkRequestsPerSecond: number}}
   */
  testScriptExtent: (options) => {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const handler = require(path.join(__dirname, 'lambda', 'handler'));
    const script = impl.readScript(options);

    return {
      length: handler.impl.scriptLength(script),
      width: handler.impl.scriptWidth(script),
      maxChunkRequestsPerSecond: handler.impl.getSettings(script).maxChunkRequestsPerSecond,
    };
  },

  /**
   * Interrogates the test script in the light of the handler's settings to determine
   * if the test execution will be handled by a single Lambda.
   * @returns {boolean} true if only a single Lambda will be invoked.
   */
  isSingleLambdaExecution: (options) => {
    const scriptExtent = impl.testScriptExtent(options);

    return scriptExtent.length < 60 * 1.5 && scriptExtent.width < scriptExtent.maxChunkRequestsPerSecond;
  },

  /**
   * Reads the test script and returns the duration of the test in seconds.
   * @returns {number}
   */
  calculateTestScriptDuration: options => impl.testScriptExtent(options).width,
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
    const duration = opts.duration || 10;
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
};

module.exports = {
  /**
   * Upload lambda to AWS
   * @param {Object} options - CLI options
   */
  deploy: () => {
    process.argv = [null, null, 'deploy', '-f', constants.TestFunctionName];

    console.log('Deploying Lambda to AWS...');

    return impl.serverlessRunner().then(() => {
      console.log('Deploy complete.');
    });
  },
  /**
   * Invoke testing lambda
   * @param {Object} options - CLI options
   */
  invoke: (options) => {
    let completeMessage = 'Your function invocation has completed.';

    impl.copyTestScript(options);

    process.argv = [null, null, 'invoke', '-d', '-f', constants.TestFunctionName, '-p', options.script];

    if (!impl.isSingleLambdaExecution(options)) {
      const testDuration = impl.calculateTestScriptDuration(options);

      process.argv.push('-i');
      process.argv.push('Event');

      completeMessage = `Your function has been invoked. The load is scheduled to be completed in ${
        testDuration} seconds.`;
    }

    console.log(`Invoking test Lambda with script ${options.script} ...`);

    // On the one hand, we'd like a response from the HTTP request to show to the user.
    // But, there are known timing issues when invoking the auto-scaling lambda.
    return impl.serverlessRunner().then(() => {
      console.log(completeMessage);
    });
  },
  /**
   * Remove Lambda from AWS
   * @param {Object} options - CLI options
   */
  remove: () => {
    process.argv = [null, null, 'remove', '-f', constants.TestFunctionName];

    console.log('Removing Lambda from AWS...');

    return impl.serverlessRunner().then(() => {
      console.log('Removal complete.');
    });
  },
  /**
   * Copy example script.yml to current working directory.
   */
  script: (options) => {
    const newScript = impl.generateScript(options);
    if (options.o) { // write to output file
    } else { // write to the console
      console.log(newScript);
    }
  },
  /**
   * Copy files necessary to allow user to customize the testing Lambda.
   */
  configure: () => {
    const lambdaFilesToCopy = [
      { source: 'serverless.yml' },
      { source: 'handler.js' },
      { source: 'package.json' },
      { source: 'script.backup.yml', dest: 'script.yml' },
    ];

    lambdaFilesToCopy.forEach((fileInfo) => {
      const destPath = path.join(process.cwd(), fileInfo.dest || fileInfo.source);

      if (impl.fileExists(destPath)) {
        throw new Error(`Conflict copying file to ${destPath}. No files copied.`);
      }
    });

    lambdaFilesToCopy.forEach((fileInfo) => {
      const dest = fileInfo.dest || fileInfo.source;
      const sourcePath = path.join(__dirname, 'lambda', fileInfo.source);
      const destPath = path.join(process.cwd(), dest);

      if (!impl.fileExists(destPath)) {
        impl.copyFile(sourcePath, destPath);
      }
    });
  },
};
