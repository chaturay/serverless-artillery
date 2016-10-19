'use strict';

const fs = require('fs'),
      path = require('path'),
      yaml = require('yaml'),
      Serverless = require('./serverless-fx');

/**
 * Helper function that, given a path, returns true if it's a file.
 * @param {string} - path - location to check if file exists
 * @returns {boolean} - true if file exists, false otherwise
 */
function fileExists(path) {
    try {
        return fs.lstatSync(path).isFile();
    } catch (ex) {
        return false;
    }
}

function copyFile(source, dest) {
    fs.writeFileSync(dest, fs.readFileSync(source, { encoding: 'utf8' }));
}

function readScript(options) {
    const scriptFilenameLower = options.script.toLowerCase(),
          isYamlFile = scriptFilenameLower.endsWith('.yml') || scriptFilenameLower.endsWith('.yaml'),
          fileContents = fs.readFileSync(path.join(__dirname, 'lambda', options.script), { encoding: 'utf8' });

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
    const isAbsolutePath = path.isAbsolute(options.script),
          localScriptPath = path.join(process.cwd(), options.script),
          scriptFilename = path.basename(localScriptPath),
          projectServicePath = findServicePath();

    if (isAbsolutePath && fileExists(options.script)) {
        // script refers to absolute path.
        copyFile(options.script, path.join(projectServicePath, scriptFilename));
    } else if (fileExists(localScriptPath)) {
        // Copy the test script into the lambda directory to run, and set the script name
        copyFile(localScriptPath, path.join(projectServicePath, scriptFilename));
    } else if (options.script === 'script.yml') {
        // Otherwise use the default script. Restore from backup, in case it's been overwritten by user.
        let servicePathBackup = path.join(projectServicePath, 'script.backup.yml');
        let servicePathScript = path.join(projectServicePath, 'script.yml');
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
 * @param startingMessage - Starting message specific to serverless-artillery's action
 * @param completeMessage - Completion message specific to serverless-artillery's action
 */
function serverlessRunner(startingMessage, completeMessage) {
    const serverless  = new Serverless({
        interactive: false,
        servicePath: findServicePath()
    });

    serverless.init()
        .then(() => {
            console.log(startingMessage);
            return serverless.run();
        })
        .then((result) => {
            // TODO: Why is result undefined? How to get results from SLS, otherwise?
            console.log(completeMessage);
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
    const handler = require(path.join(__dirname, 'lambda', 'handler')),
          script = readScript(options);

    return {
        length: handler.impl.scriptLength(script),
        width: handler.impl.scriptWidth(script),
        maxChunkRequestsPerSecond: handler.impl.getSettings(script).maxChunkRequestsPerSecond
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
    deploy: function(options) {
        process.argv = [null, null, 'deploy', '-f', options.func];
        serverlessRunner('Deploying Lambda to AWS...', 'Deploy complete.');
    },
    /**
     * Invoke testing lambda
     * @param {Object} options - CLI options
     */
    run: function(options) {
        let completeMessage = 'Test Lambda complete.';

        copyTestScript(options);

        process.argv = [null, null, 'invoke', '-f', options.func, '-d', '-p', options.script];

        if (!isSingleLambdaExecution(options)) {
            let testDuration = calculateTestScriptDuration(options);

            process.argv.push('-i');
            process.argv.push('Event');

            completeMessage = `Test Lambda started. Test will be completed in ${testDuration} seconds.`;
        }

        // On the one hand, we'd like a response from the HTTP request to show to the user.
        // But, there are known timing issues when invoking the auto-scaling lambda.
        serverlessRunner(`Invoking test Lambda with script ${options.script} ...`, completeMessage);
    },
    /**
     * Remove Lambda from AWS
     * @param {Object} options - CLI options
     */
    cleanup: function(options) {
        process.argv = [null, null, 'remove', '-f', options.func];
        serverlessRunner('Removing Lambda from AWS...', 'Removal complete.');
    },
    /**
     * Copy example script.yml to current working directory.
     */
    script: function(options) {
        const rampToProperty = options.rampTo ? `rampTo: ${options.rampTo}` : '',
              newScript = `---
  config:
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
            url: "${options.endpoint}"
        
        `;
        console.log(newScript);
    },
    /**
     * Copy files necessary to allow user to customize the testing Lambda.
     */
    customize: function() {
        const lambdaFilesToCopy = [
            { source: 'serverless.yml' },
            { source: 'handler.js' },
            { source: 'package.json' },
            { source: 'script.backup.yml', dest: 'script.yml' }
        ];

        lambdaFilesToCopy.forEach((fileInfo) => {
            let destPath = path.join(process.cwd(), fileInfo.dest || fileInfo.source);

            if (fileExists(destPath)) {
                throw new Error(`Conflict copying file to ${destPath}. No files copied.`);
            }
        });

        lambdaFilesToCopy.forEach((fileInfo) => {
            let dest = fileInfo.dest || fileInfo.source,
                sourcePath = path.join(__dirname, 'lambda', fileInfo.source),
                destPath = path.join(process.cwd(), dest);

            if (!fileExists(destPath)) {
                copyFile(sourcePath, destPath);
            }
        });
    }
};
