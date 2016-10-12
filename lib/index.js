'use strict';

const fs = require('fs'),
      path = require('path'),
      ncp = require('ncp').ncp,
      Serverless = require('./serverless-fx');

/**
 * Determines which test script (event.json) to provide as payload when invoking.
 * Possibilities, in order of priority:
 *      1) Path provided by user via command line options.
 *      2) Probe for event.json in working directory, use if found.
 *      3) Finally fall back to event.json in project.
 * @param {Object} options - options.script may contain path to test script
 */
function findEventToRun(options) {
    let localEventPath = './event.json';

    if (options.script) {
        // event was specified, use that one
        return options;
    } else if (fs.lstatSync(localEventPath).isFile()) {
        // found for event.json in working dir.
        options.script = localEventPath;
    } else {
        // use the default event.json in project
        options.event = 'event.json';
    }
}

/**
 * Checks working directory for service config, otherwise uses default.
 * @returns {string} - path to service config
 */
function findServicePath() {
    let localServerlessPath = path.join(process.cwd(), 'serverless.yml');

    if (fs.lstatSync(localServerlessPath).isFile()) {
        // probe working directory for serverless.
        return process.cwd();
    } else {
        // use the default serverless.yml in project
        return path.join(__dirname, 'lambda');
    }
}

/**
 * Adds the name of the function to deploy, invoke, etc... to the SLS CLI args.
 * @param {Object} options - options.name may contain name of Lambda
 */
function addFunctionNameArgs(options) {
    process.argv.push('-f');

    if (options.name) {
        process.argv.push(options.name);
    } else {
        // Use default function name
        // TODO: Maybe just read from our serverless.yml, which should only contain that one fn.
        process.argv.push('serverlessArtilleryLoadTester');
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
            console.log(result);
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
        process.argv = [null, null, 'deploy'];
        addFunctionNameArgs(options);
        serverlessRunner('Deploying Lambda to AWS...', 'Deploy complete.');
    },
    /**
     * Invoke testing lambda
     * @param {Object} options - CLI options
     */
    run: function(options) {
        options = findEventToRun(options || {});
        process.argv = [null, null, 'invoke', '-d', '-p', options.script];
        addFunctionNameArgs(options);
        serverlessRunner(`Invoking test Lambda with script ${options.script} ...`, 'Test Lambda complete.');
    },
    /**
     * Remove Lambda from AWS
     * @param {Object} options - CLI options
     */
    cleanup: function(options) {
        process.argv = [null, null, 'remove'];
        addFunctionNameArgs(options);
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
