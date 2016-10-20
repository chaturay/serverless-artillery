'use strict';

const expect = require('chai').expect;
const mock = require('mock-require');
const BbPromise = require('bluebird');

class serverlessMock {
  constructor(config) {
    serverlessMock.config = config; // this is fugly, transfering instance data into the static context
    this.config = config;
    this.config.interactive = false;
  }
  init() {
    if (!this.config) {
      throw new Error('must have config');
    } else {
      return BbPromise.resolve();
    }
  }
  run() {
    serverlessMock.argv = process.argv;
    if (!this.config) {
      throw new Error('must have config');
    } else {
      return BbPromise.resolve();
    }
  }
  _findParameterValue(param) {
    if (!this.config) {
      throw new Error('must have config');
    } else {
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

