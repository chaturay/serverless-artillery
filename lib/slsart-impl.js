'use strict';

const fs = require('fs'),
      Serverless = require('./serverless-global');

function serverlessRunner(startingMessage, completeMessage) {
    let serverless  = new Serverless({
        interactive: false,
        servicePath: __dirname + '/../lib'
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
    deploy: function() {
        process.argv = [null, null, 'deploy'];
        serverlessRunner('Deploying Lambda to AWS...', 'Deploy complete.');
    },
    run: function(options) {
        // TODO: Consider name collision with fn name, loadAndMonitor.

        if (options && options.script && fs.lstatSync(options.script).isFile()) {
            process.argv = [null, null, 'invoke', '-d', '-f', 'loadAndMonitor', '-p', options.script];
            serverlessRunner(`Invoking test Lambda with script ${options.script}...`, 'Test Lambda complete.');
        } else {
            throw new Error('Invalid test script.' + (options && options.script) ? ' ' + options.script : '');
        }
    },
    cleanup: function() {
        process.argv = [null, null, 'remove'];
        serverlessRunner('Removing Lambda from AWS...', 'Removal complete.');
    }
};
