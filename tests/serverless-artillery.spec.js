'use strict';

const expect = require('chai').expect,
      mock = require('mock-require'),
      BbPromise = require('bluebird'),
      path = require('path');

let serverlessMock = {
    init() {
        return BbPromise.resolve();
    },
    run() {
        serverlessMock.argv = process.argv;
        return BbPromise.resolve();
    },
    _findParameterValue(param) {
        let result = null;

        if (serverlessMock.argv) {
            let paramIndex = serverlessMock.argv.indexOf('-' + param);
            if (paramIndex !== -1 && paramIndex < (serverlessMock.argv.length - 1)) {
                result = serverlessMock.argv[paramIndex + 1];
            }
        }

        return result;
    }
};

mock('../lib/serverless-fx', function(config) {
    serverlessMock.config = config;
    console.log('*** MOCKED SLS ***');
    return serverlessMock;
});

let slsart = require('../lib');

describe('serverless-artillery command line interactions', function() {
    const functionName = 'testFunctionName';

    describe('deploy actions', function() {
        // it('is not interactive', function() {
        //     slsart.deploy({ func: functionName });
        //     expect(serverlessMock.config.interactive).to.equal(false);
        // });

        // it('must use Serverless deploy command', () => {
        //     slsart.deploy({ func: functionName  });
        //     expect(serverlessMock.argv[2]).to.be.equal('deploy');
        // });
        //
        // it('must provide a function name argument (-f)', () => {
        //     slsart.deploy({ func: functionName  });
        //     expect(serverlessMock._findParameterValue('f')).to.not.be.null;
        // });
    });

    // describe('run actions', function() {
    //     require('child_process')
    //         .exec('node', [path.join(__dirname, '..', 'bin', 'serverless-artillery')], {
    //             env: process.env,
    //             cwd: require('path').join(__dirname, 'lib', 'lambda'),
    //             stdio: 'inherit'
    //         });
    //
    //     // it('must use Serverless invoke command', () => {
    //     //     slsart.run({ func: functionName  });
    //     //     expect(serverlessMock.argv[2]).to.be.equal('invoke');
    //     // });
    // });

    describe('cleanup actions', function() {
        // it('must use Serverless remove command', () => {
        //     slsart.cleanup({ func: functionName  });
        //     expect(serverlessMock.argv[2]).to.be.equal('remove');
        // });
    });

    describe('copy actions', function() {
    });
});

