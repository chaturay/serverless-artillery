// The Ultimate Unit Testing Cheat-sheet
// https://gist.github.com/yoavniran/1e3b0162e1545055429e

const aws = require('aws-sdk')
const BbPromise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const fs = BbPromise.promisifyAll(require('fs'))
const quibble = require('quibble')
const os = require('os')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const yaml = require('js-yaml')

BbPromise.longStackTraces()
chai.use(chaiAsPromised)
chai.use(sinonChai)
chai.should()

const { expect } = chai

const testJsonScriptPath = path.join(__dirname, 'script.json')
const testYmlScriptPath = path.join(__dirname, 'dir', 'script.yml')
const testBadYmlScriptPath = path.join(__dirname, 'bad-format-script.yml')

const testJsonScript = require(testJsonScriptPath) // eslint-disable-line import/no-dynamic-require

const testJsonScriptStringified = JSON.stringify(testJsonScript)
const testYmlScriptStringified = fs.readFileSync(testYmlScriptPath, 'utf8')
const testBadYmlScriptStringified = fs.readFileSync(testBadYmlScriptPath, 'utf8')

const testYmlScript = yaml.safeLoad(testYmlScriptStringified)

const argv = process.argv.slice(0)

let npmInstallResult

// ## Serverless Fake BEGIN ##
let Payload = '{}'
class AwsInvoke {
  log() {} // eslint-disable-line class-methods-use-this
}
let slsFakeInit = () => Promise.resolve()
class ServerlessFake {
  constructor() {
    this.version = '1.0.3'
    this.pluginManager = {
      plugins: [new AwsInvoke()],
    }
    this.variables = {
      populateService: () => BbPromise.resolve(),
    }
    this.service = {
      setFunctionNames: () => {},
      mergeArrays: () => {},
      functions: { loadGenerator: { name: 'a-fake-name' } },
    }
    this.processedInput = {
      options: {},
    }
  }
  init() { return slsFakeInit(this) }
  run() { return Promise.resolve(this).then((that) => { that.pluginManager.plugins[0].log({ Payload }) }) }
}
ServerlessFake.dirname = require.resolve(path.join('..', '..', 'node_modules', 'serverless'))
// ## Serverless Fake END ##

let shortidResult = 'abcdefgh'

quibble(path.join('..', '..', 'lib', 'npm'), { install: () => npmInstallResult() })
quibble(path.join('..', '..', 'lib', 'serverless-fx'), ServerlessFake)
quibble('get-stdin', () => BbPromise.resolve(testJsonScriptStringified))
quibble('shortid', { generate: () => shortidResult })

const func = require(path.join('..', '..', 'lib', 'faas', 'aws-func')) // eslint-disable-line import/no-dynamic-require
const task = require(path.join('..', '..', 'lib', 'faas', 'task-artillery')) // eslint-disable-line import/no-dynamic-require
const slsart = require(path.join('..', '..', 'lib', 'index.js')) // eslint-disable-line import/no-dynamic-require

describe('./lib/index.js', function slsArtTests() { // eslint-disable-line prefer-arrow-callback
  describe(':impl', () => {
    describe('#fileExists', () => {
      it('determines that a file exists', () => {
        expect(slsart.impl.fileExists(testJsonScriptPath)).to.equal(true)
      })
      it('determines that a file doesn\'t exist', () => {
        expect(slsart.impl.fileExists('NOT_A_FILE')).to.equal(false)
      })
    })

    describe('#findScriptPath', () => {
      it('returns a given existing absolute path', () => {
        const expected = path.join(__dirname, 'script.json')
        expect(slsart.impl.findScriptPath(expected)).to.equal(expected)
      })
      it('returns an absolute path if a given existing relative path', () => {
        expect(slsart.impl.findScriptPath(path.join('tests', 'lib', 'script.json')))
          .to.eql(path.join(__dirname, 'script.json'))
      })
      it('returns null if the given path does not exist', () => {
        expect(slsart.impl.findScriptPath('NOT_A_FILE')).to.be.null
      })
      it('returns an absoute path to the local script.yml if no path was given and one exists', () => {
        const { cwd } = process
        process.cwd = () => path.join(__dirname, 'dir')
        try {
          expect(slsart.impl.findScriptPath()).to.eql(testYmlScriptPath)
        } finally {
          process.cwd = cwd
        }
      })
      it('returns an absoute path to the global script.yml if no path was given and a local one does not exist', () => {
        const expected = path.join(path.resolve(path.join(__dirname, '..', '..', 'lib', 'faas', 'aws')), 'script.yml')
        expect(slsart.impl.findScriptPath()).to.eql(expected)
      })
    })

    describe('#getScriptText', () => {
      it('reads from stdIn via `-si` flag', () =>
        expect(slsart.impl.getScriptText({ si: true })).to.eventually.eql(testJsonScriptStringified) // eslint-disable-line comma-dangle
      )
      it('reads from stdIn via `--stdIn` flag', () =>
        expect(slsart.impl.getScriptText({ stdIn: true })).to.eventually.eql(testJsonScriptStringified) // eslint-disable-line comma-dangle
      )
      it(
        'reads from command line arguments via `-d` flag',
        () => expect(slsart.impl.getScriptText({ d: testJsonScriptStringified }))
          .to.eventually.eql(testJsonScriptStringified) // eslint-disable-line comma-dangle
      )
      it(
        'reads from command line arguments via `--data` flag',
        () => expect(slsart.impl.getScriptText({ data: testJsonScriptStringified }))
          .to.eventually.eql(testJsonScriptStringified) // eslint-disable-line comma-dangle
      )
      it(
        'reads from a file via `-p` flag',
        () => expect(slsart.impl.getScriptText({ p: testJsonScriptPath }))
          .to.eventually.eql(`${JSON.stringify(testJsonScript, null, 2)}\n`) // eslint-disable-line comma-dangle
      )
      it(
        'reads from a file via `--path` flag',
        () => expect(slsart.impl.getScriptText({ path: testJsonScriptPath }))
          .to.eventually.eql(`${JSON.stringify(testJsonScript, null, 2)}\n`) // eslint-disable-line comma-dangle
      )
      it(
        'fails when it cannot find the file given via `-p` flag',
        () => expect(slsart.impl.getScriptText({ p: 'NOT_A_FILE' }))
          .to.eventually.be.rejected // eslint-disable-line comma-dangle
      )
    })

    describe('#parseScript', () => {
      it('parses valid JSON', () => {
        expect(slsart.impl.parseScript(testJsonScriptStringified)).to.eql(testJsonScript)
      })
      it('parses valid YML', () => {
        expect(slsart.impl.parseScript(testYmlScriptStringified)).to.eql(testYmlScript)
      })
      it('rejects non-JSON-or-YML', () => {
        expect(() => slsart.impl.parseScript('NOT JSON OR YML')).to.throw(Error)
      })
      it('rejects badly formatted YML', () => {
        expect(() => slsart.impl.parseScript(testBadYmlScriptStringified)).to.throw(yaml.YAMLException)
      })
      it('rejects invalid but well formed scripts', () => {
        expect(() => slsart.impl.parseScript('{}')).to.throw(Error)
      })
    })

    describe('#replaceArgv', () => {
      const tmpArgv = [null, null, 'invoke']
      const expectedArgv = [
        null, null, 'invoke', '-f', slsart.constants.TestFunctionName, '-d', testJsonScriptStringified,
      ]
      beforeEach(() => {
        process.argv = tmpArgv.slice(0)
      })
      afterEach(() => {
        process.argv = argv
      })
      it('replaces the `-si` flag', () => {
        process.argv.push('-si')
        slsart.impl.replaceArgv(testJsonScript)
        expect(process.argv).to.eql(expectedArgv)
      })
      it('replaces the `--stdIn` flag', () => {
        process.argv.push('--stdIn')
        slsart.impl.replaceArgv(testJsonScript)
        expect(process.argv).to.eql(expectedArgv)
      })
      it('replaces the `-d` flag', () => {
        process.argv.push('-d')
        process.argv.push(testJsonScriptStringified)
        slsart.impl.replaceArgv(testJsonScript)
        expect(process.argv).to.eql(expectedArgv)
      })
      it('replaces the `--data` flag', () => {
        process.argv.push('--data')
        process.argv.push(testJsonScriptStringified)
        slsart.impl.replaceArgv(testJsonScript)
        expect(process.argv).to.eql(expectedArgv)
      })
      it('replaces the `-p` flag', () => {
        process.argv.push('-p')
        process.argv.push(testJsonScriptPath)
        slsart.impl.replaceArgv(testJsonScript)
        expect(process.argv).to.eql(expectedArgv)
      })
      it('replaces the `--path` flag', () => {
        process.argv.push('--path')
        process.argv.push(testJsonScriptPath)
        slsart.impl.replaceArgv(testJsonScript)
        expect(process.argv).to.eql(expectedArgv)
      })
    })

    describe('#scriptConstraints', () => {
      const replaceImpl = (timeout, testFunc) => (() => {
        const { config } = aws
        aws.config = { httpOptions: { timeout } }
        return testFunc().then(() => {
          aws.config = config
        })
      })
      let script
      beforeEach(() => {
        script = {
          config: {
            phases: [
              {
                duration: 10,
                arrivalRate: 5,
              },
            ],
          },
        }
      })
      it('returns the expected default values when not splitting', () => {
        const res = slsart.impl.scriptConstraints(script)
        expect(res.allowance).to.equal(118) // 120 - 2
        expect(res.required).to.equal(13) // 10 + 3
      })
      it('returns the expected default values when splitting by duration', () => {
        script.config.phases[0].duration = 250
        const res = slsart.impl.scriptConstraints(script)
        expect(res.allowance).to.equal(118) // 120 - 2
        expect(res.required).to.equal(268) // 250 + 3 + 15
      })
      it('returns the expected default values when splitting by RPS', () => {
        script.config.phases[0].arrivalRate = 26
        const res = slsart.impl.scriptConstraints(script)
        expect(res.allowance).to.equal(118) // 120 - 2
        expect(res.required).to.equal(28) // 10 + 3 + 15
      })
      it('handles this specific user script', () => {
        // This test was written to satisfy a specific user who was concerned about the correct treatment
        // of their script.  As assumptions change due to changes in requirements, please use configuration
        // to maintain the original intent of the test.
        script = {
          config: {
            phases: [
              {
                duration: 60,
                arrivalRate: 1,
                rampTo: 5,
              },
              {
                duration: 120,
                arrivalRate: 5,
              },
              {
                duration: 60,
                arrivalRate: 5,
                rampTo: 1,
              },
            ],
          },
          _split: {
            maxChunkDurationInSeconds: 240,
          },
        }
        const res = slsart.impl.scriptConstraints(script)
        expect(res.allowance).to.equal(118) // 120 - 2
        expect(res.required).to.equal(243) // 60 + 120 + 60 + 3
      })
      it('adjusts to an decreased http timeout',
        replaceImpl(
          10000, // 10 s
          () => BbPromise.resolve()
            .then(() => {
              const res = slsart.impl.scriptConstraints(script)
              expect(res.allowance).to.equal(8) // 10 - 2
              expect(res.required).to.equal(13) // 10 + 3
            }) // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      )
      it('adjusts to an increased http timeout that is not above the function chunk maximum',
        replaceImpl(
          100000, // 100 s
          () => BbPromise.resolve()
            .then(() => {
              const res = slsart.impl.scriptConstraints(script)
              expect(res.allowance).to.equal(98) // 100 - 2
              expect(res.required).to.equal(13) // 10 + 3
            }) // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      )
      it('uses the function maximum defaults if the timeout is sufficiently high',
        replaceImpl(
          Number.MAX_VALUE,
          () => BbPromise.resolve()
            .then(() => {
              const res = slsart.impl.scriptConstraints(script)
              expect(res.allowance).to.equal(118) // 120 - 2
              expect(res.required).to.equal(13) // 10 + 3
            }) // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      )
    })

    describe('#generateScriptDefaults', () => {
      it('provides defaults for empty options', () => {
        const res = slsart.impl.generateScriptDefaults()
        expect(res).to.be.an('object')
        expect(res.endpoint).to.eql('http://aws.amazon.com')
        expect(res.duration).to.eql(5)
        expect(res.rate).to.eql(2)
        expect(res.rampTo).to.eql(undefined)
        expect(res.urlParts.protocol).to.eql('http:')
        expect(res.urlParts.slashes).to.eql(true)
        expect(res.urlParts.auth).to.eql(null)
        expect(res.urlParts.host).to.eql('aws.amazon.com')
        expect(res.urlParts.port).to.eql(null)
        expect(res.urlParts.hostname).to.eql('aws.amazon.com')
        expect(res.urlParts.hash).to.eql(null)
        expect(res.urlParts.search).to.eql(null)
        expect(res.urlParts.query).to.eql(null)
        expect(res.urlParts.pathname).to.eql('/')
        expect(res.urlParts.path).to.eql('/')
        expect(res.urlParts.href).to.eql('http://aws.amazon.com/')
      })
      it('uses a given endpoint', () => {
        const endpoint = 'http://www.google.com'
        const res = slsart.impl.generateScriptDefaults({ endpoint })
        expect(res.endpoint).to.eql(endpoint)
      })
      it('uses a given duration', () => {
        const duration = 1
        const res = slsart.impl.generateScriptDefaults({ duration })
        expect(res.duration).to.eql(duration)
      })
      it('uses a given rate', () => {
        const rate = 2
        const res = slsart.impl.generateScriptDefaults({ rate })
        expect(res.rate).to.eql(rate)
      })
      it('uses a given rampTo', () => {
        const rampTo = 3
        const res = slsart.impl.generateScriptDefaults({ rampTo })
        expect(res.rampTo).to.equal(rampTo)
      })
    })

    describe('#generateScript', () => {
      const makeScript = (target, rampTo, hash) => `# Thank you for trying serverless-artillery!
# This default script is intended to get you started quickly.
# There is a lot more that Artillery can do.
# You can find great documentation of the possibilities at:
# https://artillery.io/docs/
config:
  # this hostname will be used as a prefix for each URI in the flow unless a complete URI is specified
  target: "${target || 'http://aws.amazon.com'}"
  phases:
    -
      duration: 5
      arrivalRate: 2${rampTo || ''}
scenarios:
  -
    flow:
      -
        get:
          url: "/${hash || ''}"
` // eslint-disable-line comma-dangle
      it('generates the default script without options', () => {
        const script = slsart.impl.generateScript()
        expect(script).to.eql(makeScript())
      })
      it('respects an auth declaration in the endpoint', () => {
        const endpoint = 'http://foo:bar@aws.amazon.com'
        const script = slsart.impl.generateScript({ endpoint })
        expect(script).to.eql(makeScript(endpoint))
      })
      it('respects the rampTo option', () => {
        const script = slsart.impl.generateScript({ rampTo: 10 })
        expect(script).to.eql(makeScript(null, '\n      rampTo: 10'))
      })
      it('respects a hash declaration in the endpoint', () => {
        const script = slsart.impl.generateScript({ endpoint: 'http://aws.amazon.com/#foo' })
        expect(script).to.eql(makeScript(null, null, '#foo'))
      })
    })

    const validService = () => ({
      provider: {
        iamRoleStatements: [],
      },
      functions: {
        [slsart.constants.TestFunctionName]: {},
      },
    })
    const validServiceWithAssets = () => {
      const service = validService()
      service.provider.iamRoleStatements.push({
        Effect: 'Allow',
        Action: ['sns:Publish'],
        Resource: {
          Ref: slsart.constants.AlertingName,
        },
      })
      const testFunction = service.functions[slsart.constants.TestFunctionName]
      testFunction.environment = {
        TOPIC_ARN: { Ref: slsart.constants.AlertingName },
        TOPIC_NAME: { 'Fn::GetAtt': [slsart.constants.AlertingName, 'TopicName'] },
      }
      testFunction.events = [
        {
          schedule: {
            name: '${self:service}-${opt:stage, self:provider.stage}-monitoring', // eslint-disable-line no-template-curly-in-string
            description: 'The scheduled event for running the function in monitoring mode',
            rate: 'rate(1 minute)',
            enabled: true,
            input: {
              '>>': 'script.yml',
              mode: task.define.modes.MONITORING,
            },
          },
        },
      ]
      service.resources = {
        Resources: {
          [slsart.constants.AlertingName]: {
            Type: 'AWS::SNS::Topic',
            Properties: {
              DisplayName: '${self:service} Monitoring Alerts', // eslint-disable-line no-template-curly-in-string
              Subscription: [{}],
            },
          },
        },
      }
      return service
    }

    describe('#validateServiceForDeployment', () => {
      let service
      it('ignores undefined services', () => {
        expect(() => slsart.impl.validateServiceForDeployment()).to.not.throw()
      })
      it('ignores services without functions', () => {
        expect(() => slsart.impl.validateServiceForDeployment({})).to.not.throw()
      })
      it('ignores services without the test function', () => {
        service = validService()
        service.functions = []
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.not.throw()
      })
      it('ignores services that have the test function without events', () => {
        service = validService()
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.not.throw()
      })
      it('ignores services with the test function and empty events', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName].events = []
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.not.throw()
      })
      it('ignores services with the test function and no monitoring event', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName].events = [{ http: 'GET hello' }]
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.not.throw()
      })
      it('throws an error if a monitoring service has a string TOPIC_ARN that is not an SNS ARN', () => {
        service = validServiceWithAssets()
        service.functions[slsart.constants.TestFunctionName].environment.TOPIC_ARN = 'not:sns'
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.throw()
      })
      it('throws an error if a monitoring service doesn\'t have TOPIC_ARN defined', () => {
        service = validServiceWithAssets()
        delete service.functions[slsart.constants.TestFunctionName].environment.TOPIC_ARN
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.throw()
      })
      it('throws an error if a monitoring service has a non-Ref object TOPIC_ARN defined', () => {
        service = validServiceWithAssets()
        service.functions[slsart.constants.TestFunctionName].environment.TOPIC_ARN = {}
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.throw()
      })
      it('throws an error if a monitoring service has a Ref TOPIC_ARN referencing a non SNS topic', () => {
        service = validServiceWithAssets()
        service.resources.Resources[slsart.constants.AlertingName].Type = 'NOT::SNS'
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.throw()
      })
      it('throws an error if a monitoring service has a TOPIC_ARN referencing an SNS topic with no Subscription', () => {
        service = validServiceWithAssets()
        delete service.resources.Resources[slsart.constants.AlertingName].Properties.Subscription
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.throw()
      })
      it('throws an error if a monitoring service has a TOPIC_ARN referencing an SNS topic with non-array Subscription', () => {
        service = validServiceWithAssets()
        service.resources.Resources[slsart.constants.AlertingName].Properties.Subscription = {}
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.throw()
      })
      it('throws an error if a monitoring service has a TOPIC_ARN referencing an SNS topic with an empty Subscription', () => {
        service = validServiceWithAssets()
        service.resources.Resources[slsart.constants.AlertingName].Properties.Subscription = []
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.throw()
      })
      it('succeeds with a minimally valid service', () => {
        service = validServiceWithAssets()
        expect(() => slsart.impl.validateServiceForDeployment(service)).to.not.throw()
      })
    })

    describe('#validateServiceForInvocation', () => {
      const defaultAssetsCwd = () => path.join(__dirname, 'func-assets-default')
      const v0_0_1_AssetsCwd = () => path.join(__dirname, 'func-assets-v0-0-1') // eslint-disable-line camelcase

      describe('default function asset versions', () => {
        it('rejects if invocation options include monitoring', () => {
          expect(() =>
            slsart.impl.validateServiceForInvocation({ monitoring: true }, {}, defaultAssetsCwd)
          ).to.throw(/does not support invocation with the monitoring flag/)
        })
        it('rejects if script mode is "mon"', () => {
          expect(() =>
            slsart.impl.validateServiceForInvocation({}, { mode: task.define.modes.MON }, defaultAssetsCwd)
          ).to.throw(/does not support invocation with the monitoring flag/)
        })
        it('rejects if script mode is "monitoring"', () => {
          expect(() =>
            slsart.impl.validateServiceForInvocation({}, { mode: task.define.modes.MONITORING }, defaultAssetsCwd)
          ).to.throw(/does not support invocation with the monitoring flag/)
        })
        it('does not reject default version otherwise', () => {
          expect(() =>
            slsart.impl.validateServiceForInvocation({}, {}, defaultAssetsCwd)
          ).not.to.throw()
        })
      })
      describe('v 0.0.1 function asset versions', () => {
        it('does not reject if invocation options include monitoring', () => {
          expect(() =>
            slsart.impl.validateServiceForInvocation({ monitoring: true }, {}, v0_0_1_AssetsCwd)
          ).not.to.throw(/does not support invocation with the monitoring flag/)
        })
        it('does not reject if script mode is "mon"', () => {
          expect(() =>
            slsart.impl.validateServiceForInvocation({}, { mode: task.define.modes.MON }, v0_0_1_AssetsCwd)
          ).not.to.throw(/does not support invocation with the monitoring flag/)
        })
        it('does not reject if script mode is "monitoring"', () => {
          expect(() =>
            slsart.impl.validateServiceForInvocation({}, { mode: task.define.modes.MONITORING }, v0_0_1_AssetsCwd)
          ).not.to.throw(/does not support invocation with the monitoring flag/)
        })
        it('does not reject default version otherwise', () => {
          expect(() =>
            slsart.impl.validateServiceForInvocation({}, {}, v0_0_1_AssetsCwd)
          ).not.to.throw()
        })
      })
    })

    describe('#findServicePath', () => {
      const faasPath = path.resolve('lib', 'faas', 'aws')
      const replaceImpl = (cwdResult, fileExistsResult, testFunc) => (() => {
        const { cwd } = process
        const { fileExists } = slsart.impl
        process.cwd = () => cwdResult
        slsart.impl.fileExists = () => fileExistsResult
        return testFunc().then(() => {
          slsart.impl.fileExists = fileExists
          process.cwd = cwd
        })
      })
      it(
        'detects service path is current working directory',
        replaceImpl(
          'foo',
          true,
          () => BbPromise.resolve()
            .then(() => {
              const res = slsart.impl.findServicePath()
              expect(res).to.eql('foo')
            }) // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      )
      it(
        'detects lack of serverless.yml in current working directory',
        replaceImpl(
          __dirname,
          false,
          () => BbPromise.resolve()
            .then(() => {
              const res = slsart.impl.findServicePath()
              expect(res).to.eql(faasPath)
            }) // eslint-disable-line comma-dangle
        ) // eslint-disable-line comma-dangle
      )
    })

    describe('#serverlessRunner', () => {
      let implFindServicePathStub
      beforeEach(() => {
        implFindServicePathStub = sinon.stub(slsart.impl, 'findServicePath').returns(__dirname)
      })
      afterEach(() => {
        implFindServicePathStub.restore()
      })
      it('checks for SLS version compatibility', () =>
        slsart.impl.serverlessRunner({ debug: true, verbose: true })
          .should.be.fulfilled // eslint-disable-line comma-dangle
      )
      it('rejects earlier SLS versions', () => {
        const slsVersion = slsart.constants.CompatibleServerlessSemver
        slsart.constants.CompatibleServerlessSemver = '^1.0.4'
        return expect(slsart.impl.serverlessRunner({})).to.eventually.be.rejected
          .then(() => { slsart.constants.CompatibleServerlessSemver = slsVersion })
      })
      it('rejects later SLS versions', () => {
        const slsVersion = slsart.constants.CompatibleServerlessSemver
        slsart.constants.CompatibleServerlessSemver = '^0.0.0'
        return expect(slsart.impl.serverlessRunner({})).to.eventually.be.rejected
          .then(() => { slsart.constants.CompatibleServerlessSemver = slsVersion })
      })
      it('handles empty function invocation payloads', () => {
        const payload = Payload
        Payload = 0
        return slsart.impl.serverlessRunner({ debug: true })
          .then(() => { Payload = payload })
          .should.be.fulfilled
      })
      it('handles unparsable function invocation payloads', () => {
        const payload = Payload
        Payload = '{'
        return slsart.impl.serverlessRunner({})
          .then(() => { Payload = payload })
          .should.be.fulfilled
      })
      it('handles rejections along the promise chain', () => {
        const fakeInit = slsFakeInit
        slsFakeInit = () => Promise.reject(new Error('rejected'))
        return slsart.impl.serverlessRunner({})
          .then(() => { slsFakeInit = fakeInit })
          .catch((ex) => { slsFakeInit = fakeInit; throw ex })
          .should.be.fulfilled
      })
    })
  })
  describe(':exports', function slsartCommands() { // eslint-disable-line prefer-arrow-callback
    const phaselessScriptPath = path.join(__dirname, 'phaseless-script.yml')

    describe('#deploy', () => {
      let validateServiceForDeploymentStub
      let slsRunnerStub
      beforeEach(() => {
        validateServiceForDeploymentStub = sinon.stub(slsart.impl, 'validateServiceForDeployment').returns()
        slsRunnerStub = sinon.stub(slsart.impl, 'serverlessRunner').returns(BbPromise.resolve({}))
      })
      afterEach(() => {
        process.argv = argv.slice(0)
        validateServiceForDeploymentStub.restore()
        slsRunnerStub.restore()
      })
      it('passes through argv to Serverless "as-is"',
        () => slsart.deploy({})
          .then(() => expect(argv).to.eql(process.argv))
          .should.be.fulfilled // eslint-disable-line comma-dangle
      )
      it('validates the available service prior to deployment',
        () => slsart.deploy({})
          .then(() => expect(validateServiceForDeploymentStub).to.be.calledBefore(slsRunnerStub))
          .should.be.fulfilled // eslint-disable-line comma-dangle
      )
    })

    describe('#invoke', () => {
      const completeMessage = `${os.EOL}\tYour function invocation has completed.${os.EOL}`
      const willCompleteMessage = durationInSeconds => `${os.EOL
      }\tYour function has been invoked. The load is scheduled to be completed in ${durationInSeconds} seconds.${os.EOL}`

      const replaceImpl = (scriptConstraintsResult, serverlessRunnerResult, testFunc) => (() => {
        const { scriptConstraints } = slsart.impl
        scriptConstraints.task = { sampling: task.define.getSettings() }
        const { serverlessRunner } = slsart.impl
        const replaceInput = slsart.impl.replaceArgv
        slsart.impl.scriptConstraints = () => scriptConstraintsResult
        slsart.impl.serverlessRunner = () => BbPromise.resolve(serverlessRunnerResult)
        slsart.impl.replaceArgv = () => {}
        return testFunc().then(() => {
          slsart.impl.scriptConstraints = scriptConstraints
          slsart.impl.serverlessRunner = serverlessRunner
          slsart.impl.replaceArgv = replaceInput
        })
      })

      let log
      let logs
      let validateServiceForInvocationStub
      beforeEach(() => {
        ({ log } = console)
        logs = []
        console.log = (...args) => {
          if (args.length === 1) {
            logs.push(args[0])
          } else {
            logs.push(args.join(' '))
          }
        }
        validateServiceForInvocationStub = sinon.stub(slsart.impl, 'validateServiceForInvocation').returns()
      })
      afterEach(() => {
        console.log = log
        process.argv = argv.slice(0)
        validateServiceForInvocationStub.restore()
      })
      describe('error handling', () => {
        let implParseInputStub
        beforeEach(() => {
          implParseInputStub = sinon.stub(slsart.impl, 'parseScript')
        })
        afterEach(() => {
          implParseInputStub.restore()
        })
        it('handles and reports validation errors from the function plugin, exiting the process', () => {
          implParseInputStub.throws(new func.define.FunctionError('func.error'))
          return slsart.invoke({ d: testJsonScriptStringified })
            .should.be.rejectedWith(func.define.FunctionError, 'func.error')
        })
        it('handles and reports validation errors from the task plugin, exiting the process', () => {
          implParseInputStub.throws(new task.define.TaskError('task.error'))
          return slsart.invoke({ d: testJsonScriptStringified })
            .should.be.rejectedWith(task.define.TaskError, 'task.error')
        })
        it('handles and reports assets version mismatch errors, exiting the process', () => {
          validateServiceForInvocationStub.throws(new Error('error'))
          return slsart.invoke({ d: testJsonScriptStringified })
            .should.be.rejectedWith(task.define.Error, 'error')
        })
        it('handles and reports unexpected errors, exiting the process', () => {
          implParseInputStub.throws(new Error('error'))
          return slsart.invoke({ d: testJsonScriptStringified })
            .should.be.rejectedWith(task.define.Error, 'error')
        })
      })
      describe('performance mode', () => {
        it('indicates function completeness and results (when the script can be excuted by one function)',
          replaceImpl(
            { allowance: 2, required: 1 },
            {},
            () => slsart.invoke({ d: testJsonScriptStringified })
              .then(() => expect(logs[1]).to.eql(completeMessage)) // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('reports future completion estimate (when script must be distributed across functions)',
          replaceImpl(
            { allowance: 2, required: 3 },
            {},
            () => slsart.invoke({ d: testJsonScriptStringified })
              .then(() => expect(logs[1]).to.eql(willCompleteMessage(3))) // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
      })
      describe('acceptance mode', () => {
        it('adds `mode: \'acc\'` to the script',
          replaceImpl(
            { allowance: 2, required: 3 },
            {},
            () => slsart.invoke({ acceptance: true, d: testJsonScriptStringified })
              .then(() => expect(logs[1]).to.eql(completeMessage)) // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('respects scripts declaring acceptance mode',
          replaceImpl(
            { allowance: 2, required: 3 },
            {},
            () => {
              const script = JSON.parse(testJsonScriptStringified)
              script.mode = 'acc'
              return slsart.invoke({ d: JSON.stringify(script) })
                .then(() => expect(logs[1]).to.eql(completeMessage))
            } // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('respects scripts declaring acceptance mode',
          replaceImpl(
            { allowance: 2, required: 3 },
            {},
            () => {
              const script = JSON.parse(testJsonScriptStringified)
              script.mode = 'acceptance'
              return slsart.invoke({ d: JSON.stringify(script) })
                .then(() => expect(logs[1]).to.eql(completeMessage))
            } // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('reports acceptance test results to the console',
          replaceImpl(
            { allowance: 2, required: 1 },
            { foo: 'bar' },
            () => {
              const script = JSON.parse(testJsonScriptStringified)
              script.mode = 'acc'
              return slsart.invoke({ acceptance: true, d: testJsonScriptStringified })
                .then(() => {
                  expect(logs[3]).to.eql(JSON.stringify({ foo: 'bar' }, null, 2))
                })
            } // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('exits the process with a non-zero exit code when an error occurs during the acceptance test',
          replaceImpl(
            { allowance: 2, required: 1 },
            { errors: 1, reports: [{ errors: 1 }] },
            () => {
              // save/replace process.exit
              const { exit } = process
              let exitCode
              process.exit = (code) => {
                exitCode = code
              }
              return slsart.invoke({
                script: phaselessScriptPath,
                acceptance: true,
              }).then(() => {
                expect(exitCode).to.equal(1)
              }).finally(() => {
                process.exit = exit
              })
            } // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        const result = { msg: 'a result' }
        it('writes only the JSON result of the invocation to the console.log stream',
          replaceImpl(
            { allowance: 2, required: 1 },
            result,
            () => slsart.invoke({ jo: true, acceptance: true, d: testJsonScriptStringified })
              .then(() => {
                expect(logs.length).to.be.equal(1)
                expect(logs[0]).to.equal(JSON.stringify(result, null, 2))
              }) // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('writes only the JSON result of the invocation to the console.log stream',
          replaceImpl(
            { allowance: 2, required: 1 },
            result,
            () => slsart.invoke({ jsonOnly: true, acceptance: true, d: testJsonScriptStringified })
              .then(() => {
                expect(logs.length).to.be.equal(1)
                expect(logs[0]).to.equal(JSON.stringify(result, null, 2))
              }) // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
      })
      describe('monitoring mode', () => {
        it('adds `mode: \'mon\'` to the script',
          replaceImpl(
            { allowance: 2, required: 3 },
            {},
            () => slsart.invoke({ monitoring: true, d: testJsonScriptStringified })
              .then(() => expect(logs[1]).to.eql(completeMessage)) // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('respects scripts declaring monitoring mode',
          replaceImpl(
            { allowance: 2, required: 3 },
            {},
            () => {
              const script = JSON.parse(testJsonScriptStringified)
              script.mode = task.define.modes.MON
              return slsart.invoke({ d: JSON.stringify(script) })
                .then(() => expect(logs[1]).to.eql(completeMessage))
            } // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('respects scripts declaring monitoring mode',
          replaceImpl(
            { allowance: 2, required: 3 },
            {},
            () => {
              const script = JSON.parse(testJsonScriptStringified)
              script.mode = task.define.modes.MONITORING
              return slsart.invoke({ d: JSON.stringify(script) })
                .then(() => expect(logs[1]).to.eql(completeMessage))
            } // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('reports monitoring test results to the console',
          replaceImpl(
            { allowance: 2, required: 1 },
            { foo: 'bar' },
            () => {
              const script = JSON.parse(testJsonScriptStringified)
              script.mode = 'mon'
              return slsart.invoke({ acceptance: true, d: testJsonScriptStringified })
                .then(() => {
                  expect(logs[3]).to.eql(JSON.stringify({ foo: 'bar' }, null, 2))
                })
            } // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('exits the process with a non-zero exit code when an error occurs during the monitoring test',
          replaceImpl(
            { allowance: 2, required: 1 },
            { errors: 5, reports: [{ errors: 5 }] },
            () => {
              // save/replace process.exit
              const { exit } = process
              let exitCode
              process.exit = (code) => {
                exitCode = code
              }
              return slsart.invoke({
                script: phaselessScriptPath,
                monitoring: true,
              }).then(() => {
                expect(exitCode).to.equal(5)
              }).finally(() => {
                process.exit = exit
              })
            } // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        const result = { msg: 'a result' }
        it('writes only the JSON result of the invocation to the console.log stream',
          replaceImpl(
            { allowance: 2, required: 1 },
            result,
            () => slsart.invoke({ jo: true, monitoring: true, d: testJsonScriptStringified })
              .then(() => {
                expect(logs.length).to.be.equal(1)
                expect(logs[0]).to.equal(JSON.stringify(result, null, 2))
              }) // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
        it('writes only the JSON result of the invocation to the console.log stream',
          replaceImpl(
            { allowance: 2, required: 1 },
            result,
            () => slsart.invoke({ jsonOnly: true, monitoring: true, d: testJsonScriptStringified })
              .then(() => {
                expect(logs.length).to.be.equal(1)
                expect(logs[0]).to.equal(JSON.stringify(result, null, 2))
              }) // eslint-disable-line comma-dangle
          ) // eslint-disable-line comma-dangle
        )
      })
    })

    describe('#kill', () => {
      let awsStub
      let removeStub
      beforeEach(() => {
        awsStub = sinon.stub(aws.Service.prototype, 'makeRequest')
        removeStub = sinon.stub(slsart, 'remove')
      })
      afterEach(() => {
        awsStub.restore()
        removeStub.restore()
        process.argv = argv.slice(0)
      })
      it('removes the function after concurrency is set to zero', () => {
        const afterStub = sinon.stub().returns(BbPromise.resolve())
        awsStub.returns({
          promise: () => BbPromise.delay(100).then(afterStub),
        })
        removeStub.returns(BbPromise.resolve())
        return slsart.kill({}).should.be.fulfilled
          .then(() => {
            afterStub.should.have.been.calledBefore(removeStub)
          })
      })

      it('fails when the function does not exist', () => {
        awsStub.returns({
          promise: () => BbPromise()
            .then(() => BbPromise.reject({
              code: 'ResourceNotFoundException',
            })),
        })
        return slsart.kill({}).should.be.rejected
      })
    })

    describe('#remove', () => {
      const slsRunner = slsart.impl.serverlessRunner
      beforeEach(() => {
        slsart.impl.serverlessRunner = () => BbPromise.resolve({})
      })
      afterEach(() => {
        process.argv = argv.slice(0)
        slsart.impl.serverlessRunner = slsRunner
      })
      it('passes through argv to Serverless "as-is"',
        () => slsart.remove({})
          .then(() => expect(argv).to.eql(process.argv))
          .should.be.fulfilled // eslint-disable-line comma-dangle
      )
    })

    describe('#script', () => {
      const { generateScript } = slsart.impl
      const notAFile = 'not.a.script.yml'
      it('refuses to overwrite an existing script',
        () => slsart.script({ out: 'README.md' }).should.be.rejected // eslint-disable-line comma-dangle
      )
      it('refuses to overwrite an existing script with debug',
        () => slsart.script({ out: 'README.md', debug: true }).should.be.rejected // eslint-disable-line comma-dangle
      )
      it('writes default values to the default file',
        () => BbPromise.resolve()
          .then(() => {
            slsart.impl.generateScript = () => ({ foo: 'bar' })
            return slsart.script({})
          })
          .finally(() => {
            slsart.impl.generateScript = generateScript
            fs.unlinkAsync('script.yml')
          }) // eslint-disable-line comma-dangle
      )
      it('write default values to a new file with debug and trace',
        () => BbPromise.resolve()
          .then(() => {
            slsart.impl.generateScript = () => ({ foo: 'bar' })
            return slsart.script({ out: notAFile, debug: true, trace: true })
          })
          .finally(() => {
            slsart.impl.generateScript = generateScript
            fs.unlinkAsync(notAFile)
          }) // eslint-disable-line comma-dangle
      )
    })

    describe('#configure', function exportsConfigure() { // eslint-disable-line prefer-arrow-callback
      const { cwd } = process
      const replaceCwd = (dirToReplace) => {
        process.cwd = () => dirToReplace
      }
      const restoreCwd = () => {
        process.cwd = cwd
      }
      const tmpdir = path.join(os.tmpdir(), path.join('serverlessArtilleryLibIndex'))
      const rmdir = (dir) => {
        fs.readdirSync(dir).forEach((file) => {
          const curPath = path.join(dir, file)
          if (fs.lstatSync(curPath).isDirectory()) { // recurse
            rmdir(curPath)
          } else { // delete file
            fs.unlinkSync(curPath)
          }
        })
        fs.rmdirSync(dir)
      }
      // ## !! NOTE !! ##
      // There is a known issue on Windows where files are not deleted according to expectation
      // It has been decided that this is not worth resolving, not that a contribution to resolve
      // the matter would be unwelcome.
      beforeEach(() => fs.mkdirAsync(tmpdir))
      afterEach(() => {
        restoreCwd()
        rmdir(tmpdir)
      })
      it.only(`refuses to overwrite existing ${slsart.constants.ServerlessFiles.join(', ')} files`, () => {
        replaceCwd(path.join(__dirname, '..', '..', 'lib', 'faas', 'aws'))
        return slsart.configure({}).should.be.rejected
      })
      it(`refuses to overwrite existing ${slsart.constants.ServerlessFiles.join(', ')} files with debug and tracing`, () => {
        replaceCwd(path.join(__dirname, '..', '..', 'lib', 'faas', 'aws'))
        return slsart.configure({ debug: true, trace: true }).should.be.rejected
      })
      it('creates unique project artifacts and resolves after mock dependency install', () => {
        replaceCwd(tmpdir)
        npmInstallResult = BbPromise.resolve
        return slsart.configure({ debug: true, trace: true })
          .then(() => BbPromise.all(slsart.constants.ServerlessFiles.map(
            file => expect(fs.accessAsync(path.join(tmpdir, file))).to.eventually.be.fulfilled // eslint-disable-line comma-dangle
          )))
          .should.be.fulfilled
      })
      it('ensures that the invalid character "_" is not part of the generated short id appended to the service name', () => {
        const shortidRes = shortidResult
        shortidResult = '_a_b_c_d_'
        replaceCwd(tmpdir)
        npmInstallResult = BbPromise.resolve
        return slsart.configure({})
          .then(() => { shortidResult = shortidRes })
          .then(() => BbPromise.resolve({ path: path.join(tmpdir, 'aws', 'serverless.yml') }))
          .then(slsart.impl.getScriptText)
          .then((yml) => {
            const sls = yaml.safeLoad(yml)
            expect(sls.service).to.not.have.string('_')
          })
          .should.be.fulfilled
      })
      it('rejects the promise if npm install fails',
        function createUniqueArtifacts() { // eslint-ignore-line prefer-arrow-callback
          this.timeout(60000) // hopefully entirely excessive
          replaceCwd(tmpdir)
          npmInstallResult = () => { throw new Error('npm failure') }
          return slsart.configure({}).should.be.rejected
        } // eslint-disable-line comma-dangle
      )
    })
  })
})

quibble.reset()
