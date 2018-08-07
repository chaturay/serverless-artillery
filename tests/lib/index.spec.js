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

const func = require(path.join('..', '..', 'lib', 'lambda', 'func.js')) // eslint-disable-line import/no-dynamic-require
const task = require(path.join('..', '..', 'lib', 'lambda', 'task.js')) // eslint-disable-line import/no-dynamic-require
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
        const expected = path.join(path.resolve(path.join(__dirname, '..', '..', 'lib', 'lambda')), 'script.yml')
        expect(slsart.impl.findScriptPath()).to.eql(expected)
      })
    })

    describe('#getInput', () => {
      it('reads from stdIn via `-si` flag', () =>
        expect(slsart.impl.getInput({ si: true })).to.eventually.eql(testJsonScriptStringified) // eslint-disable-line comma-dangle
      )
      it('reads from stdIn via `--stdIn` flag', () =>
        expect(slsart.impl.getInput({ stdIn: true })).to.eventually.eql(testJsonScriptStringified) // eslint-disable-line comma-dangle
      )
      it(
        'reads from command line arguments via `-d` flag',
        () => expect(slsart.impl.getInput({ d: testJsonScriptStringified }))
          .to.eventually.eql(testJsonScriptStringified) // eslint-disable-line comma-dangle
      )
      it(
        'reads from command line arguments via `--data` flag',
        () => expect(slsart.impl.getInput({ data: testJsonScriptStringified }))
          .to.eventually.eql(testJsonScriptStringified) // eslint-disable-line comma-dangle
      )
      it(
        'reads from a file via `-p` flag',
        () => expect(slsart.impl.getInput({ p: testJsonScriptPath }))
          .to.eventually.eql(`${JSON.stringify(testJsonScript, null, 2)}\n`) // eslint-disable-line comma-dangle
      )
      it(
        'reads from a file via `--path` flag',
        () => expect(slsart.impl.getInput({ path: testJsonScriptPath }))
          .to.eventually.eql(`${JSON.stringify(testJsonScript, null, 2)}\n`) // eslint-disable-line comma-dangle
      )
      it(
        'fails when it cannot find the file given via `-p` flag',
        () => expect(slsart.impl.getInput({ p: 'NOT_A_FILE' }))
          .to.eventually.be.rejected // eslint-disable-line comma-dangle
      )
    })

    describe('#parseInput', () => {
      it('parses valid JSON', () => {
        expect(slsart.impl.parseInput(testJsonScriptStringified)).to.eql(testJsonScript)
      })
      it('parses valid YML', () => {
        expect(slsart.impl.parseInput(testYmlScriptStringified)).to.eql(testYmlScript)
      })
      it('rejects non-JSON-or-YML', () => {
        expect(() => slsart.impl.parseInput('NOT JSON OR YML')).to.throw(Error)
      })
      it('rejects badly formatted YML', () => {
        expect(() => slsart.impl.parseInput(testBadYmlScriptStringified)).to.throw(yaml.YAMLException)
      })
      it('rejects invalid but well formed scripts', () => {
        expect(() => slsart.impl.parseInput('{}')).to.throw(Error)
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
      it('adjusts to an increased http timeout that is not above the lambda chunk maximum',
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
      it('uses the lambda maximum defaults if the timeout is sufficiently high',
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

    describe('#validateService', () => {
      const aString = 'some value'
      let service
      // service config
      it('rejects falsy service configurations', () => {
        service = undefined
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      it('rejects non-object service configurations', () => {
        service = aString
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      // provider.iamRoleStatements
      it('rejects falsy provider', () => {
        service = validService()
        service.provider = false
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      it('rejects falsy provider.iamRoleStatements', () => {
        service = validService()
        service.provider.iamRoleStatements = false
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      it('rejects non-array provider.iamRoleStatements', () => {
        service = validService()
        service.provider.iamRoleStatements = aString
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      // functions[constants.TestFunctionName]
      it('rejects falsy functions', () => {
        service = validService()
        service.functions = false
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      it('rejects falsy functions[constants.TestFunctionName]', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName] = false
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      it('rejects non-object functions[constants.TestFunctionName]', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName] = aString
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      // functions[constants.TestFunctionName].environment['TOPIC_ARN' || 'TOPIC_NAME']
      it('accepts undefined functions[constants.TestFunctionName].environment', () => {
        service = validService()
        delete service.functions[slsart.constants.TestFunctionName].environment
        expect(() => slsart.impl.validateService(service)).to.not.throw()
      })
      it('accepts functions[constants.TestFunctionName].environment without TOPIC_ARN or TOPIC_NAME', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName].environment = { NOT_TOPIC_ARN_OR_TOPIC_NAME: aString }
        expect(() => slsart.impl.validateService(service)).to.not.throw()
      })
      it('rejects functions[constants.TestFunctionName].environment with TOPIC_ARN', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName].environment = { TOPIC_ARN: aString }
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      it('rejects functions[constants.TestFunctionName].environment with TOPIC_NAME', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName].environment = { TOPIC_NAME: aString }
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      // functions[constants.TestFunctionName].events
      it('accepts an undefined functions[constants.TestFunctionName].events', () => {
        service = validService()
        delete service.functions[slsart.constants.TestFunctionName].events
        expect(() => slsart.impl.validateService(service)).to.not.throw()
      })
      it('rejects non-array functions[constants.TestFunctionName].events', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName].events = aString
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      it('rejects functions[constants.TestFunctionName].events with a schedule event named constants.ScheduleName', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName].events = [{ schedule: { name: slsart.constants.ScheduleName } }]
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
      // resources.Resources[constants.AlertingName]
      it('accepts an undefined resources.Resources[constants.AlertingName]', () => {
        service = validService()
        delete service.resources
        expect(() => slsart.impl.validateService(service)).to.not.throw()
      })
      it('accepts an undefined resources.Resources[constants.AlertingName]', () => {
        service = validService()
        if (service.resources) {
          delete service.resources.Resources
        }
        expect(() => slsart.impl.validateService(service)).to.not.throw()
      })
      it('accepts an undefined resources.Resources[constants.AlertingName]', () => {
        service = validService()
        if (service.resources && service.resources.Resources) {
          delete service.resources.Resources[slsart.constants.AlertingName]
        }
        expect(() => slsart.impl.validateService(service)).to.not.throw()
      })
      it('reject a defined resources.Resources[constants.AlertingName]', () => {
        service = validService()
        service.resources = {
          Resources: {
            [slsart.constants.AlertingName]: aString,
          },
        }
        expect(() => slsart.impl.validateService(service)).to.throw()
      })
    })

    describe('#addAssets', () => {
      let service
      it('adds the expected assets to the given service', () => {
        service = validService()
        slsart.impl.addAssets(service, { threshold: 1, p: 'foo.yml' })
        expect(service.provider.iamRoleStatements.length).to.equal(1)
        expect(service.functions[slsart.constants.TestFunctionName].environment.TOPIC_ARN)
          .to.eql({ Ref: slsart.constants.AlertingName })
        expect(service.functions[slsart.constants.TestFunctionName].environment.TOPIC_NAME)
          .to.eql({ 'Fn::GetAtt': [slsart.constants.AlertingName, 'TopicName'] })
        expect(service.functions[slsart.constants.TestFunctionName].events[0].schedule).to.be.a('object')
        expect(service.functions[slsart.constants.TestFunctionName].events[0].schedule.name).to.have.string(slsart.constants.ScheduleName)
        expect(service.resources.Resources[`${slsart.constants.AlertingName}${slsart.constants.yamlComments.doNotEditKey}`]).to.be.an('object')
      })
      it('retains existing environment variables', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName].environment = { VAR: 'VAL' }
        expect(slsart.impl.addAssets(service, {}).functions[slsart.constants.TestFunctionName].environment.VAR).to.equal('VAL')
      })
      it('retains existing events', () => {
        service = validService()
        service.functions[slsart.constants.TestFunctionName].events = ['foo']
        expect(service.functions[slsart.constants.TestFunctionName].events[0]).to.equal('foo')
      })
      it('retains existing resources', () => {
        service = validService()
        service.resources = { foo: 'bar' }
        expect(service.resources).to.have.property('foo', 'bar')
      })
      it('retains existing resources.Resources', () => {
        service = validService()
        service.resources = { Resources: { foo: 'bar' } }
        expect(service.resources.Resources).to.have.property('foo', 'bar')
      })
    })

    describe('#splitIgnore', () => {
      let str
      it('splits strings by newlines', () => {
        str = 'a\nb\nc'
        expect(slsart.impl.splitIgnore(str)).to.eql(['a', 'b', 'c'])
      })
      it('converts `-\n  -` to `-  -` and splits', () => {
        str = 'a\n-\n  -\n    b'
        expect(slsart.impl.splitIgnore(str)).to.eql(['a', '- -', '    b'])
      })
      it('removes leading and trailing whitespace', () => {
        str = ' \ta\t \n \tb \t'
        expect(slsart.impl.splitIgnore(str)).to.eql(['a\t ', ' \tb'])
      })
      it('removes single and double quotes', () => {
        str = '\'a\'\n"b"\nc'
        expect(slsart.impl.splitIgnore(str)).to.eql(['a', 'b', 'c'])
      })
    })

    describe('#splitExcept', () => {
      let str
      it('splits strings by newlines', () => {
        str = 'a\nb\nc'
        expect(slsart.impl.splitExcept(str)).to.eql(['a', 'b', 'c'])
      })
      it('ignores newlines within array equivalencies', () => {
        str = 'a\n-\n  - b\nc'
        expect(slsart.impl.splitExcept(str)).to.eql(['a', '-\n  - b', 'c'])
      })
      it('ignores newlines within larger array equivalencies', () => {
        str = 'a\n  -\n    - b\nc'
        expect(slsart.impl.splitExcept(str)).to.eql(['a', '  -\n    - b', 'c'])
      })
      it('ignores many newlines within array equivalencies', () => {
        str = 'a\n-\n\n\n\n\n\n\n\n\n\n\n\n\n  - b\nc'
        expect(slsart.impl.splitExcept(str)).to.eql(['a', '-\n\n\n\n\n\n\n\n\n\n\n\n\n  - b', 'c'])
      })
    })

    describe('#compareRestore', () => {
      let existing
      let augmented
      let expected
      it('leaves unchanged strings alone', () => {
        existing = 'a string'
        augmented = existing
        expected = existing
        expect(slsart.impl.compareRestore(existing, augmented)).to.equal(existing)
      })
      it('leaves additive only augmentations alone', () => {
        existing = 'a string\n'
        augmented = `${existing}\nanother string\n`
        expected = augmented
        expect(slsart.impl.compareRestore(existing, augmented)).to.equal(expected)
      })
      it('restores removed comments', () => {
        existing = 'foo: # an object\n  bar: "biz"\n'
        augmented = 'foo:\n  bar: "biz"\n  gar: "giz"\n'
        expected = 'foo: # an object\n  bar: "biz"\n  gar: "giz"\n'
        expect(slsart.impl.compareRestore(existing, augmented)).to.equal(expected)
      })
      // TODO too few cases?
    })

    describe('#replaceCommentKeys', () => {
      let input
      let result
      it('replaces the known keys', () => {
        input = `${
          slsart.constants.yamlComments.doNotEditKey}\n${
          slsart.constants.yamlComments.mustMatchKey}\n${
          slsart.constants.yamlComments.snsSubscriptionsKey}\nEffect: Allow`
        result = slsart.impl.replaceCommentKeys(input)
        expect(result).to.not.have.string(slsart.constants.yamlComments.doNotEditKey)
        expect(result).to.not.have.string(slsart.constants.yamlComments.mustMatchKey)
        expect(result).to.not.have.string(slsart.constants.yamlComments.snsSubscriptionsKey)
        expect(result).to.not.have.string('Effect: Allow')
      })
    })

    describe('#writeBackup', () => {
      const err = { code: 'EEXIST' }
      const content = 'content'
      let fsWriteFileAsyncStub
      beforeEach(() => {
        fsWriteFileAsyncStub = sinon.stub(fs, 'writeFileAsync')
      })
      afterEach(() => {
        fsWriteFileAsyncStub.restore()
      })
      it('writes content to serverless.yml.bak', () => {
        fsWriteFileAsyncStub.returns(BbPromise.resolve())
        return slsart.impl.writeBackup(content).should.be.fulfilled
          .then(() => {
            fsWriteFileAsyncStub.should.have.been.calledOnce
            expect(fsWriteFileAsyncStub.args[0][0]).to.eql(`${slsart.constants.ServerlessFile}.bak`)
          })
      })
      it('tries writing to subsequent serverless.yml.N.bak files until succeeding', () => {
        fsWriteFileAsyncStub.onCall(0).rejects(err)
        fsWriteFileAsyncStub.onCall(1).rejects(err)
        fsWriteFileAsyncStub.onCall(2).rejects(err)
        fsWriteFileAsyncStub.onCall(3).rejects(err)
        fsWriteFileAsyncStub.onCall(4).resolves()
        return slsart.impl.writeBackup(content).should.be.fulfilled
          .then(() => {
            fsWriteFileAsyncStub.should.have.callCount(5)
            expect(fsWriteFileAsyncStub.args[0][0]).to.eql(`${slsart.constants.ServerlessFile}.bak`)
            expect(fsWriteFileAsyncStub.args[1][0]).to.eql(`${slsart.constants.ServerlessFile}.1.bak`)
            expect(fsWriteFileAsyncStub.args[2][0]).to.eql(`${slsart.constants.ServerlessFile}.2.bak`)
            expect(fsWriteFileAsyncStub.args[3][0]).to.eql(`${slsart.constants.ServerlessFile}.3.bak`)
            expect(fsWriteFileAsyncStub.args[4][0]).to.eql(`${slsart.constants.ServerlessFile}.4.bak`)
          })
      })
      it('gives up writing after 100 attempts', () => {
        fsWriteFileAsyncStub.returns(BbPromise.reject(err))
        return slsart.impl.writeBackup(content).should.be.rejected
          .then(() => {
            fsWriteFileAsyncStub.should.have.callCount(slsart.constants.backupAttempts)
          })
      })
      it('throws errors without `code = \'EEXIST\'`', () => {
        const anotherErr = new Error('not eexist')
        anotherErr.code = 'NOT_EEXIST'
        fsWriteFileAsyncStub.returns(BbPromise.reject(anotherErr))
        return slsart.impl.writeBackup(content).should.be.rejectedWith(anotherErr)
          .then(() => {
            fsWriteFileAsyncStub.should.have.callCount(1)
          })
      })
    })

    describe('#findServicePath', () => {
      const lambdaPath = path.resolve('lib', 'lambda')
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
              expect(res).to.eql(lambdaPath)
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
      const slsRunner = slsart.impl.serverlessRunner
      beforeEach(() => {
        slsart.impl.serverlessRunner = () => BbPromise.resolve({})
      })
      afterEach(() => {
        process.argv = argv.slice(0)
        slsart.impl.serverlessRunner = slsRunner
      })
      it('passes through argv to Serverless "as-is"',
        () => slsart.deploy({})
          .then(() => expect(argv).to.eql(process.argv))
          .should.be.fulfilled // eslint-disable-line comma-dangle
      )
    })

    describe('#invoke', () => {
      const completeMessage = `${os.EOL}\tYour function invocation has completed.${os.EOL}`
      const willCompleteMessage = durationInSeconds => `${os.EOL
      }\tYour function has been invoked. The load is scheduled to be completed in ${durationInSeconds} seconds.${os.EOL}`

      const replaceImpl = (scriptConstraintsResult, serverlessRunnerResult, testFunc) => (() => {
        const { scriptConstraints } = slsart.impl
        scriptConstraints.task = { sampling: task.def.getSettings() }
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
      })
      afterEach(() => {
        console.log = log
        process.argv = argv.slice(0)
      })
      describe('error handling', () => {
        let implParseInputStub
        beforeEach(() => {
          implParseInputStub = sinon.stub(slsart.impl, 'parseInput')
        })
        afterEach(() => {
          implParseInputStub.restore()
        })
        it('handles and reports validation errors from the function plugin, exiting the process', () => {
          implParseInputStub.throws(new func.def.FunctionError('func.error'))
          return slsart.invoke({ d: testJsonScriptStringified })
            .should.be.rejectedWith(func.def.FunctionError, 'func.error')
        })
        it('handles and reports validation errors from the task plugin, exiting the process', () => {
          implParseInputStub.throws(new task.def.TaskError('task.error'))
          return slsart.invoke({ d: testJsonScriptStringified })
            .should.be.rejectedWith(task.def.TaskError, 'task.error')
        })
        it('handles and reports unexpected errors, exiting the process', () => {
          implParseInputStub.throws(new Error('error'))
          return slsart.invoke({ d: testJsonScriptStringified })
            .should.be.rejectedWith(task.def.Error, 'error')
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
              script.mode = task.def.modes.MON
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
              script.mode = task.def.modes.MONITORING
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
            fs.unlink('script.yml')
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
            fs.unlink(notAFile)
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
      it(`refuses to overwrite existing ${slsart.constants.ServerlessFiles.join(', ')} files`, () => {
        replaceCwd(path.join(__dirname, '..', '..', 'lib', 'lambda'))
        return slsart.configure({}).should.be.rejected
      })
      it(`refuses to overwrite existing ${slsart.constants.ServerlessFiles.join(', ')} files with debug and tracing`, () => {
        replaceCwd(path.join(__dirname, '..', '..', 'lib', 'lambda'))
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
          .then(() => BbPromise.resolve({ path: path.join(tmpdir, 'serverless.yml') }))
          .then(slsart.impl.getInput)
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

    describe('#monitor', () => {
      let scriptStub
      let configureStub
      let fileExistsStub
      let writeBackupStub
      let fsReadFileAsyncStub
      let fsWriteFileAsyncStub
      beforeEach(() => {
        scriptStub = sinon.stub(slsart, 'script').resolves()
        configureStub = sinon.stub(slsart, 'configure').resolves()
        fileExistsStub = sinon.stub(slsart.impl, 'fileExists').returns(true)
        writeBackupStub = sinon.stub(slsart.impl, 'writeBackup').resolves()
        fsReadFileAsyncStub = sinon.stub(fs, 'readFileAsync').resolves(JSON.stringify({
          provider: {
            iamRoleStatements: [],
          },
          functions: {
            [slsart.constants.TestFunctionName]: {},
          },
        }))
        fsWriteFileAsyncStub = sinon.stub(fs, 'writeFileAsync').resolves()
      })
      afterEach(() => {
        scriptStub.restore()
        configureStub.restore()
        fileExistsStub.restore()
        writeBackupStub.restore()
        fsReadFileAsyncStub.restore()
        fsWriteFileAsyncStub.restore()
      })
      it('modifies and writes the service', () => slsart.monitor({}).should.be.fulfilled
        .then(() => fsWriteFileAsyncStub.should.have.been.called))
      it('writes a backup if serverless.yml is present', () => slsart.monitor({}).should.be.fulfilled
        .then(() => {
          scriptStub.should.not.have.been.called
          configureStub.should.not.have.been.called
          writeBackupStub.should.have.been.calledOnce
        }))
      it('generates script, configures, and does not write a backup if no script.yml or serverless.yml', () => {
        fileExistsStub.returns(false)
        return slsart.monitor({}).should.be.fulfilled
          .then(() => {
            scriptStub.should.have.been.calledOnce
            configureStub.should.have.been.calledOnce
            writeBackupStub.should.not.have.been.called
          })
      })
      it('rejects the monitor command if running script fails', () => {
        fileExistsStub.returns(false)
        scriptStub.returns(BbPromise.reject(new Error('reasons')))
        return slsart.monitor({}).should.be.rejected
      })
      it('rejects the monitor command if running configure fails', () => {
        fileExistsStub.returns(false)
        configureStub.returns(BbPromise.reject(new Error('reasons')))
        return slsart.monitor({}).should.be.rejected
      })
      it('rejects the monitor command if reading serverless.yml fails', () => {
        fsReadFileAsyncStub.returns(BbPromise.reject(new Error('reasons')))
        return slsart.monitor({}).should.be.rejected
      })
    })
  })
})

quibble.reset()
