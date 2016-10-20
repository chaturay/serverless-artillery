/* eslint-disable class-methods-use-this */

'use strict';

const BbPromise = require('bluebird');
const expect = require('chai').expect;
const fs = require('fs');
const mock = require('mock-require');
const path = require('path');

class serverlessMock {
  constructor(config) {
    serverlessMock.config = config; // this is fugly, transfering instance data into the static context
  }
  init() {
    return BbPromise.resolve();
  }
  run() {
    serverlessMock.argv = process.argv;
    return BbPromise.resolve();
  }
  _findParameterValue(param) {
    let result = null;

    if (serverlessMock.argv) {
      const paramIndex = serverlessMock.argv.indexOf(`-${param}`);
      if (paramIndex !== -1 && paramIndex < (serverlessMock.argv.length - 1)) {
        result = serverlessMock.argv[paramIndex + 1];
      }
    }

    return result;
  }
}

mock('../lib/serverless-fx', serverlessMock);

const slsart = require('../lib');

describe('serverless-artillery command line interactions', () => {
  const functionName = 'testFunctionName';

  describe('deploy actions', () => {
    it('is not interactive', () => {
      slsart.deploy({ func: functionName });
      expect(serverlessMock.config.interactive).to.equal(false);
    });

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

  describe('run actions', () => {
    // require('child_process')
    //   .exec('node', [path.join(__dirname, '..', 'bin', 'serverless-artillery')], {
    //     env: process.env,
    //     cwd: require('path').join(__dirname, 'lib', 'lambda'),
    //     stdio: 'inherit'
    //   });
    // it('must use Serverless invoke command', () => {
    //     slsart.run({ func: functionName  });
    //     expect(serverlessMock.argv[2]).to.be.equal('invoke');
    // });
  });

  describe('cleanup actions', () => {
    // it('must use Serverless remove command', () => {
    //     slsart.cleanup({ func: functionName  });
    //     expect(serverlessMock.argv[2]).to.be.equal('remove');
    // });
  });

  describe('copy actions', () => {
  });
});

describe('serverless-artillery install postinstall', () => {
  it('puts dependencies into ./lib/lambda', (done) => {
    // eslint-disable-next-line no-bitwise
    fs.access(path.join(__dirname, '..', 'lib', 'lambda'), fs.R_OK | fs.X_OK, (err) => {
      expect(err).to.be.null;
      done();
    });
  });
});

