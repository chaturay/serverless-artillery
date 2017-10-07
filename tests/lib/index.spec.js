/* eslint-disable class-methods-use-this */

// The Ultimate Unit Testing Cheat-sheet
// https://gist.github.com/yoavniran/1e3b0162e1545055429e

'use strict';

const BbPromise = require('bluebird');
const expect = require('chai').expect;
const fs = BbPromise.promisifyAll(require('fs'));
const path = require('path');
const os = require('os');
const stdin = require('mock-stdin');
const yaml = require('js-yaml');

// eslint-disable-next-line import/no-dynamic-require
const packageJson = require(path.join(__dirname, '..', '..', 'package.json'));

const testJsonScriptPath = path.join(__dirname, 'script.json');
const testYmlScriptPath = path.join(__dirname, 'dir', 'script.yml');
const testBadYmlScriptPath = path.join(__dirname, 'bad-format-script.yml');

const testJsonScript = require(testJsonScriptPath); // eslint-disable-line import/no-dynamic-require

const testJsonScriptStringified = JSON.stringify(testJsonScript);
const testYmlScriptStringified = fs.readFileSync(testYmlScriptPath, 'utf8');
const testBadYmlScriptStringified = fs.readFileSync(testBadYmlScriptPath, 'utf8');

const testYmlScript = yaml.safeLoad(testYmlScriptStringified);

const sendEndRestore = (si) => {
  si.send(testJsonScriptStringified);
  si.end();
  si.restore();
};

const slsart = require('../../lib/index');

describe('serverless-artillery implementation', () => {
  describe('#impl.fileExists', () => {
    it('determines that a file exists', () => {
      expect(slsart.impl.fileExists(testJsonScriptPath)).to.equal(true);
    });
    it('determines that a file doesn\'t exist', () => {
      expect(slsart.impl.fileExists('NOT_A_FILE')).to.equal(false);
    });
  });

  describe('#impl.findScriptPath', () => {
    it('returns a given existing absolute path', () => {
      const expected = path.join(__dirname, 'script.json');
      expect(slsart.impl.findScriptPath(expected)).to.equal(expected);
    });
    it('returns an absolute path if a given existing relative path', () => {
      expect(slsart.impl.findScriptPath(path.join('tests', 'lib', 'script.json')))
        .to.eql(path.join(__dirname, 'script.json'));
    });
    it('returns null if the given path does not exist', () => {
      expect(slsart.impl.findScriptPath('NOT_A_FILE')).to.be.null;
    });
    it('returns an absoute path to the local script.yml if no path was given and one exists', () => {
      const cwd = process.cwd;
      process.cwd = () => path.join(__dirname, 'dir');
      expect(slsart.impl.findScriptPath()).to.eql(testYmlScriptPath);
      process.cwd = cwd;
    });
    it('returns an absoute path to the global script.yml if no path was given and a local one does not exist', () => {
      const expected = path.join(path.resolve(path.join(__dirname, '..', '..', 'lib', 'lambda')), 'script.yml');
      expect(slsart.impl.findScriptPath()).to.eql(expected);
    });
  });

  describe('#impl.getInput', () => {
    it('reads from stdIn via `-si` flag', () => {
      const si = stdin.stdin();
      process.nextTick(() => sendEndRestore(si));
      return slsart.impl.getInput({ si: true })
        .then((script) => { expect(script).to.eql(testJsonScriptStringified); })
        .catch(() => expect(false));
    });
    it('reads from stdIn via `--stdIn` flag', () => {
      const si = stdin.stdin();
      process.nextTick(() => sendEndRestore(si));
      return slsart.impl.getInput({ stdIn: true })
        .then((script) => { expect(script).to.eql(testJsonScriptStringified); })
        .catch(() => expect(false));
    });
    it(
      'reads from command line arguments via `-d` flag',
      () => slsart.impl.getInput({ d: testJsonScriptStringified })
        .then((script) => { expect(script).to.eql(testJsonScriptStringified); })
        .catch(() => expect(false)) // eslint-disable-line comma-dangle
    );
    it(
      'reads from command line arguments via `--data` flag',
      () => slsart.impl.getInput({ data: testJsonScriptStringified })
        .then((script) => { expect(script).to.eql(testJsonScriptStringified); })
        .catch(() => expect(false)) // eslint-disable-line comma-dangle
    );
    it(
      'reads from a file via `-p` flag',
      () => slsart.impl.getInput({ p: testJsonScriptPath })
        .then((script) => { expect(script).to.eql(`${JSON.stringify(testJsonScript, null, 2)}\n`); })
        .catch(() => expect(false)) // eslint-disable-line comma-dangle
    );
    it(
      'reads from a file via `--path` flag',
      () => slsart.impl.getInput({ path: testJsonScriptPath })
        .then((script) => { expect(script).to.eql(`${JSON.stringify(testJsonScript, null, 2)}\n`); })
        .catch(() => expect(false)) // eslint-disable-line comma-dangle
    );
    it(
      'fails when it cannot find the file given via `-p` flag',
      () => slsart.impl.getInput({ p: 'NOT_A_FILE' })
        .then(() => expect(false))
        .catch(() => expect(true)) // eslint-disable-line comma-dangle
    );
  });

  describe('#impl.parseInput', () => {
    it('parses valid JSON', () => {
      expect(slsart.impl.parseInput(testJsonScriptStringified)).to.eql(testJsonScript);
    });
    it('parses valid YML', () => {
      expect(slsart.impl.parseInput(testYmlScriptStringified)).to.eql(testYmlScript);
    });
    it('rejects non-JSON-or-YML', () => {
      expect(() => {
        slsart.impl.parseInput('NOT JSON OR YML');
      }).to.throw(Error);
    });
    it('rejects badly formatted YML', () => {
      expect(() => {
        slsart.impl.parseInput(testBadYmlScriptStringified);
      }).to.throw(yaml.YAMLException);
    });
  });

  describe('#impl.replaceArgv', () => {
    let argv;
    const tmpArgv = [null, null, 'invoke'];
    const expectedArgv = [
      null, null, 'invoke', '-f', slsart.constants.TestFunctionName, '-d', testJsonScriptStringified,
    ];
    beforeEach(() => {
      argv = process.argv.slice(0);
      process.argv = tmpArgv.slice(0);
    });
    afterEach(() => {
      process.argv = argv;
    });
    it('replaces the `-si` flag', () => {
      process.argv.push('-si');
      slsart.impl.replaceArgv(testJsonScript);
      expect(process.argv).to.eql(expectedArgv);
    });
    it('replaces the `--stdIn` flag', () => {
      process.argv.push('--stdIn');
      slsart.impl.replaceArgv(testJsonScript);
      expect(process.argv).to.eql(expectedArgv);
    });
    it('replaces the `-d` flag', () => {
      process.argv.push('-d');
      process.argv.push(testJsonScriptStringified);
      slsart.impl.replaceArgv(testJsonScript);
      expect(process.argv).to.eql(expectedArgv);
    });
    it('replaces the `--data` flag', () => {
      process.argv.push('--data');
      process.argv.push(testJsonScriptStringified);
      slsart.impl.replaceArgv(testJsonScript);
      expect(process.argv).to.eql(expectedArgv);
    });
    it('replaces the `-p` flag', () => {
      process.argv.push('-p');
      process.argv.push(testJsonScriptPath);
      slsart.impl.replaceArgv(testJsonScript);
      expect(process.argv).to.eql(expectedArgv);
    });
    it('replaces the `--path` flag', () => {
      process.argv.push('--path');
      process.argv.push(testJsonScriptPath);
      slsart.impl.replaceArgv(testJsonScript);
      expect(process.argv).to.eql(expectedArgv);
    });
  });

  describe('#impl.scriptExtent', () => {
    // TODO implement tests
  });

  describe('#impl.generateScript', () => {
    // TODO implement tests
  });

  describe('#impl.findServicePath', () => {
    // TODO implement tests
  });

  describe('#impl.serverlessRunner', () => {
    // TODO implement tests
  });
});

describe('serverless-artillery commands', function slsartCommands() { // eslint-disable-line prefer-arrow-callback
  const phaselessScriptPath = path.join(__dirname, 'phaseless-script.yml');

  describe('#exports.deploy', () => {
    const argv = process.argv.slice(0);
    const slsRunner = slsart.impl.serverlessRunner;
    it('passes through argv to Serverless "as-is"',
      () => BbPromise.resolve()
        .then(() => {
          slsart.impl.serverlessRunner = () => BbPromise.resolve({});
        })
        .then(() => slsart.deploy({}))
        .then(() => expect(argv).to.equal(process.argv))
        .catch(() => expect(false))
        .then(() => {
          process.argv = argv;
          slsart.impl.serverlessRunner = slsRunner;
        }) // eslint-disable-line comma-dangle
    );
  });

  describe('#exports.invoke', () => {
    const completeMessage = `${os.EOL}\tYour function invocation has completed.${os.EOL}`;
    const willCompleteMessage = length => `${os.EOL
    }\tYour function has been invoked. The load is scheduled to be completed in ${length} seconds.${os.EOL}`;

    const replaceImpl = (scriptExtentResult, serverlessRunnerResult, func) => (() => {
      const scriptExtent = slsart.impl.scriptExtent;
      const serverlessRunner = slsart.impl.serverlessRunner;
      const replaceInput = slsart.impl.replaceArgv;
      slsart.impl.scriptExtent = () => scriptExtentResult;
      slsart.impl.serverlessRunner = () => BbPromise.resolve(serverlessRunnerResult);
      slsart.impl.replaceArgv = () => {};
      return func().then(() => {
        slsart.impl.scriptExtent = scriptExtent;
        slsart.impl.serverlessRunner = serverlessRunner;
        slsart.impl.replaceArgv = replaceInput;
      });
    });

    let log;
    let logs;
    beforeEach(() => {
      log = console.log;
      logs = [];
      console.log = (...args) => {
        if (args.length === 1) {
          logs.push(args[0]);
        } else {
          logs.push(args.join(' '));
        }
      };
    });
    afterEach(() => {
      console.log = log;
    });

    describe('performance mode', () => {
      it('indicates function completeness and results (when the script can be excuted by one function)',
        replaceImpl(
          { width: 1, length: 1, maxLength: 2, maxWidth: 2 },
          {},
          () => slsart.invoke({ d: testJsonScriptStringified })
            .then(() => expect(logs[1]).to.eql(completeMessage)) // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      );
      it('reports future completion estimate (when script must be distributed across functions)',
        replaceImpl(
          { width: 1, length: 3, maxLength: 2, maxWidth: 2 },
          {},
          () => slsart.invoke({ d: testJsonScriptStringified })
            .then(() => expect(logs[1]).to.eql(willCompleteMessage(3))) // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      );
    });
    describe('acceptance mode', () => {
      it('adds `mode: \'acc\' to the script',
        replaceImpl(
          { width: 1, length: 3, maxLength: 2, maxWidth: 2 },
          {},
          () => slsart.invoke({ acceptance: true, d: testJsonScriptStringified })
            .then(() => expect(logs[1]).to.eql(completeMessage)) // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      );
      it('respects scripts declaring acceptance mode',
        replaceImpl(
          { width: 1, length: 3, maxLength: 2, maxWidth: 2 },
          {},
          () => {
            const script = JSON.parse(testJsonScriptStringified);
            script.mode = 'acc';
            return slsart.invoke({ d: JSON.stringify(script) })
              .then(() => expect(logs[1]).to.eql(completeMessage));
          } // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      );
      it('reports acceptance test results to the console',
        replaceImpl(
          { width: 1, length: 1, maxLength: 2, maxWidth: 2 },
          { foo: 'bar' },
          () => {
            const script = JSON.parse(testJsonScriptStringified);
            script.mode = 'acc';
            return slsart.invoke({ acceptance: true, d: testJsonScriptStringified })
              .then(() => {
                expect(logs[3]).to.eql(JSON.stringify({ foo: 'bar' }, null, 2));
              });
          } // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      );
      it('exits the process with a non-zero exit code when an error occurs during the acceptance test',
        replaceImpl(
          { width: 1, length: 1, maxLength: 2, maxWidth: 2 },
          { errors: 1, reports: [{ errors: 1 }] },
          () => {
            // save/replace process.exit
            const exit = process.exit;
            let exitCode;
            process.exit = (code) => {
              exitCode = code;
            };
            return slsart.invoke({
              script: phaselessScriptPath,
              acceptance: true,
            }).then(() => {
              expect(exitCode).to.equal(1);
            }).catch(() => {
              expect(false);
            }).then(() => {
              process.exit = exit;
            });
          } // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      );
    });
  });

  describe('#exports.remove', () => {
    const argv = process.argv.slice(0);
    const slsRunner = slsart.impl.serverlessRunner;
    it('passes through argv to Serverless "as-is"',
      () => BbPromise.resolve()
        .then(() => {
          slsart.impl.serverlessRunner = () => BbPromise.resolve({});
        })
        .then(() => slsart.remove({}))
        .then(() => expect(argv).to.equal(process.argv))
        .catch(() => expect(false))
        .then(() => {
          process.argv = argv;
          slsart.impl.serverlessRunner = slsRunner;
        }) // eslint-disable-line comma-dangle
    );
  });

  describe('#exports.script', () => {
    const generateScript = slsart.impl.generateScript;
    const notAFile = 'not.a.script.yml';
    it('refuses to overwrite an existing script',
      () => slsart.script({ out: 'README.md' })
        .then(() => expect(false))
        .catch(() => expect(true)) // eslint-disable-line comma-dangle
    );
    it('write default values to a new file',
      () => BbPromise.resolve()
        .then(() => {
          slsart.impl.generateScript = () => ({ foo: 'bar' });
        })
        .then(() => slsart.script({ out: notAFile, debug: true, trace: true }))
        .then(() => {
          slsart.impl.generateScript = generateScript;
          fs.unlink(notAFile);
        }) // eslint-disable-line comma-dangle
    );
  });

  describe('#exports.configure', function exportsConfigure() { // eslint-disable-line prefer-arrow-callback
    const cwd = process.cwd;
    const replaceCwd = (dirToReplace) => {
      process.cwd = () => dirToReplace;
    };
    const restoreCwd = () => {
      process.cwd = cwd;
    };
    const tmpdir = path.join(os.tmpdir(), 'serverlessArtillery');
    const rmdir = (dir) => {
      fs.readdirSync(dir).forEach((file) => {
        const curPath = path.join(dir, file);
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          rmdir(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(dir);
    };
    it(`refuses to overwrite existing ${slsart.constants.ServerlessFiles.join(', ')} files`,
      () => BbPromise.resolve()
        .then(() => replaceCwd(path.join(__dirname, '..', '..', 'lib', 'lambda')))
        .then(() => slsart.configure({ debug: true, trace: true }))
        .then(() => expect(false))
        .catch(() => expect(true))
        .then(() => restoreCwd()) // eslint-disable-line comma-dangle
    );
    it('creates unique project artifacts and installs it\'s dependencies',
      function createUniqueArtifacts() { // eslint-ignore-line prefer-arrow-callback
        return BbPromise.resolve()
          .then(() => { this.timeout(60000); }) // hopefully entirely excessive
          .then(() => replaceCwd(tmpdir))
          .then(() => fs.mkdirAsync(tmpdir))
          .then(() => slsart.configure({ debug: true, trace: true }))
          .all(() => []
            .concat(
              slsart.constants.ServerlessFiles.map(
                file => fs.accessAsync(path.join(tmpdir, file))
                  .then(() => expect(true))
                  .catch(() => expect(false)) // eslint-disable-line comma-dangle
              ) // eslint-disable-line comma-dangle
            )
            // For the record, not mocking the npm install and validating here is a little inappropriate.
            // The reason for doing it here is that it doesn't appropriate fit a test of ~/lib/npm.js since
            // this code combines that code with the project artifacts.
            // Further, given that this test does the set up, it is more efficient to test our expectations around
            // project dependency installation (especially since everything installed will be deployed to the lambda).
            .concat(
              Object.keys(packageJson.dependencies).map(
                dependency => fs.accessAsync(path.join(tmpdir, 'node_modules', dependency))
                  .then(() => expect(true))
                  .catch(() => expect(false)) // eslint-disable-line comma-dangle
              ) // eslint-disable-line comma-dangle
            )
            .concat(
              Object.keys(packageJson.devDependencies).map(
                devDependency => fs.accessAsync(path.join(tmpdir, 'node_modules', devDependency))
                  .then(() => expect(false))
                  .catch(() => expect(true)) // eslint-disable-line comma-dangle
              ) // eslint-disable-line comma-dangle
            ) // eslint-disable-line comma-dangle
          )
          .catch(() => expect(false))
          .then(() => restoreCwd())
          .then(() => rmdir(tmpdir));
      } // eslint-disable-line comma-dangle
    );
    it('rejects the promise if npm install fails', () => {
      // TOOD implement test
    });
  });
});
