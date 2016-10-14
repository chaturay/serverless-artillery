'use strict';

const fs = require('fs'),
      path = require('path'),
      ncp = require('ncp').ncp,
      Serverless = require('./serverless-fx');

/**
 * Helper function that, given a path, returns true if it's a file.
 * @param {string} - path - location to check if file exists
 * @returns {boolean} - true if file exists, false otherwise
 */
function fileExists(path) {
    try {
        let lstat = fs.lstatSync(path);
        if (lstat.isFile()) {
            return true;
        } else {
            return false;
        }
    } catch (ex) {
        return false;
    }
}

/**
 * Determines which test script (event.json) to provide as payload when invoking.
 * Possibilities, in order of priority:
 *      1) Path provided by user via command line options.
 *      2) Probe for event.json in working directory, use if found.
 *      3) Finally fall back to event.json in project.
 * @param {Object} options - options.script may contain path to test script
 */
function findEventToRun(options) {
    let localEventPath = path.join(process.cwd(), 'event.json');

    if (!options.script) {
        if (fileExists(localEventPath)) {
            options.script = localEventPath;
        } else {
            options.script = 'event.json';
        }
    }

    return options;
}

/**
 * Checks working directory for service config, otherwise uses default.
 * @returns {string} - path to service config
 */
function findServicePath() {
    let localServerlessPath = path.join(process.cwd(), 'serverless.yml');

    if (fileExists(localServerlessPath)) {
        return process.cwd();
    } else {
        // use the default serverless.yml in project
        return path.join(__dirname, 'lambda');
    }
}

/**
 * Invokes the Serverless code to perform a give task. Expects process.argv to
 * contain CLI parameters to pass to SLS.
 * @param startingMessage - Starting message specific to serverless-artillery's action
 * @param completeMessage - Completion message specific to serverless-artillery's action
 */
function serverlessRunner(startingMessage, completeMessage) {
    let serverless  = new Serverless({
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
            process.exit(0);
        })
        .catch((ex) => {
            console.error('There was an error!');
            console.error(ex);
            process.exit(1);
        });
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
        options = findEventToRun(options);
        // TODO: What's the implications of not using the -i Event flag here?
        // On the one hand, we'd like a response from the HTTP request to show to the user.
        // But, there are known timing issues when invoking the auto-scaling lambda.
        process.argv = [null, null, 'invoke', '-f', options.func, '-d', '-p', options.script];
        serverlessRunner(`Invoking test Lambda with script ${options.script} ...`, 'Test Lambda complete.');
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
     * Copy contents of lib/lambda folder to current working directory
     * @param {Object} options - CLI options
     */
    copy: function() {
        // Copy contents of lambda directory to current dir.
        ncp(path.join(__dirname, 'lambda'), process.cwd(), (error) => {
            if (error) {
                throw new Error(error);
            }

            console.log('Serverless service files copied.');
            process.exit(0);
        });
    }
};
