'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');
const yaml = require('yaml');
const Serverless = require('./serverless-fx');

/**
 * Helper function that, given a path, returns true if it's a file.
 * @param {string} - filePath - location to check if file exists
 * @returns {boolean} - true if file exists, false otherwise
 */
function fileExists(filePath) {
  try {
    return fs.lstatSync(filePath).isFile();
  } catch (ex) {
    return false;
  }
}

function copyFile(source, dest) {
  fs.writeFileSync(dest, fs.readFileSync(source, { encoding: 'utf8' }));
}

function readScript(options) {
  const scriptFilenameLower = options.script.toLowerCase();
  const isYamlFile = scriptFilenameLower.endsWith('.yml') || scriptFilenameLower.endsWith('.yaml');
  const fileContents = fs.readFileSync(path.join(__dirname, 'lambda', options.script), { encoding: 'utf8' });

  if (isYamlFile) {
    return yaml.eval(fileContents);
  } else {
    return JSON.parse(fileContents);
  }
}

/**
 * Checks working directory for service config, otherwise uses default.
 * @returns {string} - path to service config
 */
function findServicePath() {
  const localServerlessPath = path.join(process.cwd(), 'serverless.yml');

  if (fileExists(localServerlessPath)) {
    return process.cwd();
  } else {
    // use the default serverless.yml in project
    return path.join(__dirname, 'lambda');
  }
}

/**
 * Copy the test script into the lambda directory.
 * @param {Object} options - options.script may contain path to test script
 */
function copyTestScript(options) {
  const isAbsolutePath = path.isAbsolute(options.script);
  const localScriptPath = path.join(process.cwd(), options.script);
  const scriptFilename = path.basename(localScriptPath);
  const projectServicePath = findServicePath();

  if (isAbsolutePath && fileExists(options.script)) {
    // script refers to absolute path.
    copyFile(options.script, path.join(projectServicePath, scriptFilename));
  } else if (fileExists(localScriptPath)) {
    // Copy the test script into the lambda directory to run, and set the script name
    copyFile(localScriptPath, path.join(projectServicePath, scriptFilename));
  } else if (options.script === 'script.yml') {
    // Otherwise use the default script. Restore from backup, in case it's been overwritten by user.
    const servicePathBackup = path.join(projectServicePath, 'script.backup.yml');
    const servicePathScript = path.join(projectServicePath, 'script.yml');
    copyFile(servicePathBackup, servicePathScript);
  } else {
    // User must have provided a non-default script,
    //  but was not found in either absolute or relative path.
    throw new Error(`Requested test script '${options.script}' was not found.`);
  }
}

/**
 * Invokes the Serverless code to perform a give task. Expects process.argv to
 * contain CLI parameters to pass to SLS.
 */
function serverlessRunner() {
  const serverless = new Serverless({
    interactive: false,
    servicePath: findServicePath(),
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
}

/**
 * Read the length, width and other script properties.
 * @returns {{length: (*|number), width: (*|number), maxChunkRequestsPerSecond: number}}
 */
function testScriptExtent(options) {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const handler = require(path.join(__dirname, 'lambda', 'handler'));
  const script = readScript(options);

  return {
    length: handler.impl.scriptLength(script),
    width: handler.impl.scriptWidth(script),
    maxChunkRequestsPerSecond: handler.impl.getSettings(script).maxChunkRequestsPerSecond,
  };
}

/**
 * Interrogates the test script in the light of the handler's settings to determine
 * if the test execution will be handled by a single Lambda.
 * @returns {boolean} true if only a single Lambda will be invoked.
 */
function isSingleLambdaExecution(options) {
  const scriptExtent = testScriptExtent(options);

  return scriptExtent.length < 60 * 1.5 && scriptExtent.width < scriptExtent.maxChunkRequestsPerSecond;
}

/**
 * Reads the test script and returns the duration of the test in seconds.
 * @returns {number}
 */
function calculateTestScriptDuration(options) {
  return testScriptExtent(options).width;
}

module.exports = {
  /**
   * Upload lambda to AWS
   * @param {Object} options - CLI options
   */
  deploy: (options) => {
    process.argv = [null, null, 'deploy', '-f', options.func];

    console.log('Deploying Lambda to AWS...');

    return serverlessRunner().then(() => {
      console.log('Deploy complete.');
    });
  },
  /**
   * Invoke testing lambda
   * @param {Object} options - CLI options
   */
  run: (options) => {
    let completeMessage = 'Test Lambda complete.';

    copyTestScript(options);

    process.argv = [null, null, 'invoke', '-f', options.func, '-d', '-p', options.script];

    if (!isSingleLambdaExecution(options)) {
      const testDuration = calculateTestScriptDuration(options);

      process.argv.push('-i');
      process.argv.push('Event');

      completeMessage = `Test Lambda started. Test will be completed in ${testDuration} seconds.`;
    }

    console.log(`Invoking test Lambda with script ${options.script} ...`);

    // On the one hand, we'd like a response from the HTTP request to show to the user.
    // But, there are known timing issues when invoking the auto-scaling lambda.
    return serverlessRunner().then(() => {
      console.log(completeMessage);
    });
  },
  /**
   * Remove Lambda from AWS
   * @param {Object} options - CLI options
   */
  cleanup: (options) => {
    process.argv = [null, null, 'remove', '-f', options.func];

    console.log('Removing Lambda from AWS...');

    return serverlessRunner().then(() => {
      console.log('Removal complete.');
    });
  },
  /**
   * Copy example script.yml to current working directory.
   */
  script: (options) => {
    const rampToProperty = options.rampTo ? `rampTo: ${options.rampTo}` : '';
    const urlParts = url.parse(options.endpoint);
    const pathStart = options.endpoint.lastIndexOf(urlParts.path);
    const newScript = `---
  config:
    target: "${options.endpoint.substr(0, pathStart)}"
    phases:
      -
        duration: ${options.duration}
        arrivalRate: ${options.rate}
        ${rampToProperty}
  scenarios:
    -
      flow:
        -
          get:
            url: "${urlParts.path}"
        
        `;
    console.log(newScript);
  },
  /**
   * Copy files necessary to allow user to customize the testing Lambda.
   */
  customize: () => {
    const lambdaFilesToCopy = [
      { source: 'serverless.yml' },
      { source: 'handler.js' },
      { source: 'package.json' },
      { source: 'script.backup.yml', dest: 'script.yml' },
    ];

    lambdaFilesToCopy.forEach((fileInfo) => {
      const destPath = path.join(process.cwd(), fileInfo.dest || fileInfo.source);

      if (fileExists(destPath)) {
        throw new Error(`Conflict copying file to ${destPath}. No files copied.`);
      }
    });

    lambdaFilesToCopy.forEach((fileInfo) => {
      const dest = fileInfo.dest || fileInfo.source;
      const sourcePath = path.join(__dirname, 'lambda', fileInfo.source);
      const destPath = path.join(process.cwd(), dest);

      if (!fileExists(destPath)) {
        copyFile(sourcePath, destPath);
      }
    });
  },
};
