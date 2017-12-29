const aws = require('aws-sdk')
const chai = require('chai')
const quibble = require('quibble')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)

const expect = chai.expect
const noop = () => {}

const lambdaInvokeStub = sinon.stub(aws.Service.prototype, 'makeRequest')

// eslint-disable-next-line import/no-dynamic-require
const handler = require(path.join('..', '..', '..', 'lib', 'lambda', 'handler.js'))

let script
let expected

const tagContext = {
  functionName: 'name',
}

const tagScript = () => ({
  config: {
    phases: [
      { duration: 1, arrivalRate: 2 },
    ],
  },
})

describe('./lib/lambda/handler.js', () => {
  describe(':impl', () => {
    describe('#getSettings', () => {
      const defaultSettings = () => ({
        maxScriptDurationInSeconds: handler.constants.DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS,
        maxScriptRequestsPerSecond: handler.constants.DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND,
        maxChunkDurationInSeconds: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        maxChunkRequestsPerSecond: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
        timeBufferInMilliseconds: handler.constants.DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS,
      })
      it('returns default settings if no settings are specified in the script', () => {
        script = {}
        expect(handler.impl.getSettings(script)).to.eql(defaultSettings())
      })
      it('extracts the maxScriptDurationInSeconds setting specification', () => {
        script = {
          _split: {
            maxScriptDurationInSeconds: 1,
          },
        }
        expected = defaultSettings()
        expected.maxScriptDurationInSeconds = 1
        expect(handler.impl.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts the maxChunkDurationInSeconds setting specification', () => {
        script = {
          _split: {
            maxChunkDurationInSeconds: 1,
          },
        }
        expected = defaultSettings()
        expected.maxChunkDurationInSeconds = 1
        expect(handler.impl.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts the maxScriptRequestsPerSecond setting specification', () => {
        script = {
          _split: {
            maxScriptRequestsPerSecond: 1,
          },
        }
        expected = defaultSettings()
        expected.maxScriptRequestsPerSecond = 1
        expect(handler.impl.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts the maxChunkRequestsPerSecond setting specification', () => {
        script = {
          _split: {
            maxChunkRequestsPerSecond: 1,
          },
        }
        expected = defaultSettings()
        expected.maxChunkRequestsPerSecond = 1
        expect(handler.impl.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts the timeBufferInMilliseconds setting specification', () => {
        script = {
          _split: {
            timeBufferInMilliseconds: 1,
          },
        }
        expected = defaultSettings()
        expected.timeBufferInMilliseconds = 1
        expect(handler.impl.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts complete setting specifications', () => {
        script = {
          _split: {
            maxScriptDurationInSeconds: 1,
            maxChunkDurationInSeconds: 1,
            maxScriptRequestsPerSecond: 1,
            maxChunkRequestsPerSecond: 1,
            timeBufferInMilliseconds: 1,
          },
        }
        expect(handler.impl.getSettings(script)).to.eql(script._split) // eslint-disable-line no-underscore-dangle
      })
    })

    describe('#validScript', () => {
      /* eslint-disable no-underscore-dangle */
      beforeEach(() => {
        script = tagScript()
      })
      it('accepts the valid script', () => {
        expect(handler.impl.validScript(script, null, noop)).to.be.true
      })
      describe('_split usage', () => {
        const validSplitScript = () => {
          const ret = tagScript()
          ret._split = {}
          return ret
        }
        beforeEach(() => {
          script = validSplitScript()
        })
        it('accepts a valid _split', () => {
          expect(handler.impl.validScript(script, null, noop)).to.be.true
        })
        it('rejects a defined, non-object _split', () => {
          script._split = ''
          expect(handler.impl.validScript(script, null, noop)).to.be.false
        })
        const settings = [
          { name: 'maxChunkDurationInSeconds', max: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS },
          { name: 'maxScriptDurationInSeconds', max: handler.constants.MAX_SCRIPT_DURATION_IN_SECONDS },
          { name: 'maxChunkRequestsPerSecond', max: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND },
          { name: 'maxScriptRequestsPerSecond', max: handler.constants.MAX_SCRIPT_REQUESTS_PER_SECOND },
          { name: 'timeBufferInMilliseconds', max: handler.constants.MAX_TIME_BUFFER_IN_MILLISECONDS },
        ]
        settings.forEach((setting) => {
          describe(`validates _split.${setting.name}`, () => {
            it('rejects non integer values', () => {
              script._split[setting.name] = ''
              expect(handler.impl.validScript(script, null, noop)).to.be.false
            })
            it('rejects negative values', () => {
              script._split[setting.name] = -1
              expect(handler.impl.validScript(script, null, noop)).to.be.false
            })
            it(`rejects values greater than ${setting.max}`, () => {
              script._split[setting.name] = setting.max + 1
              expect(handler.impl.validScript(script, null, noop)).to.be.false
            })
          })
        })
      })
    })

    /**
     * This function is an odd one to test because it represents logic about using external integrations.  As a result,
     * the cases revolve around its use of those external resources and the test cases reflect this.
     */
    describe('#invokeSelf', () => {
      let runTaskStub
      let setTimeoutStub
      let callbackStub
      beforeEach(() => {
        runTaskStub = sinon.stub(handler.impl, 'handle').callsFake(
          (event, context, callback) => {
            callback(null, 'handle')
          } // eslint-disable-line comma-dangle
        )
        lambdaInvokeStub.withArgs('invoke', sinon.match.any, sinon.match.any).callsFake(
          (name, params, callback) => {
            callback(null, 'invoke')
          } // eslint-disable-line comma-dangle
        )
        setTimeoutStub = sinon.stub(global, 'setTimeout').callsFake(
          (callback, milliseconds, arg1, arg2, arg3) =>
            process.nextTick(() => callback(arg1, arg2, arg3)) // eslint-disable-line comma-dangle
        )
        callbackStub = sinon.stub().returns()
      })
      afterEach(() => {
        runTaskStub.restore()
        lambdaInvokeStub.reset()
        setTimeoutStub.restore()
        callbackStub.reset()
      })
      it('does not delay if the timeDelay is zero in standard mode', () => {
        handler.impl.invokeSelf(0, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runTaskStub).to.not.be.called
        expect(lambdaInvokeStub).to.be.calledOnce
        expect(callbackStub).to.be.calledWith(null, 'invoke')
      })
      it('does not delay if the timeDelay is negative in standard mode', () => {
        handler.impl.invokeSelf(-1, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runTaskStub).to.not.be.called
        expect(lambdaInvokeStub).to.be.calledOnce
        expect(callbackStub).to.be.calledWith(null, 'invoke')
      })
      it('delays using setTimeout if the timeDelay is positive in standard mode',
        () => new Promise((resolve) => {
          handler.impl.invokeSelf(1, {}, tagContext, (err, res) => {
            expect(err).to.be.null
            expect(res).to.eql('invoke')
            resolve()
          })
        }).then(() => {
          expect(setTimeoutStub).to.be.calledOnce
          expect(runTaskStub).to.not.be.called
          expect(lambdaInvokeStub).to.be.calledOnce
        }) // eslint-disable-line comma-dangle
      )
      it('delays using setTimeout if the timeDelay is positive in trace mode',
        () => new Promise((resolve) => {
          handler.impl.invokeSelf(1, { _trace: true }, tagContext, (err, res) => {
            expect(err).to.be.null
            expect(res).to.eql('invoke')
            resolve()
          })
        }).then(() => {
          expect(setTimeoutStub).to.be.calledOnce
          expect(runTaskStub).to.not.be.called
          expect(lambdaInvokeStub).to.be.calledOnce
        }) // eslint-disable-line comma-dangle
      )
      it('executes the given event via handle when in simulation mode', () => {
        handler.impl.invokeSelf(0, { _simulation: true }, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runTaskStub).to.be.calledOnce
        expect(lambdaInvokeStub).to.not.be.called
        expect(callbackStub).to.be.calledWith(null, 'handle')
      })
      it('executes the given event via lambda.invoke when in standard mode', () => {
        handler.impl.invokeSelf(0, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runTaskStub).to.not.be.called
        expect(lambdaInvokeStub).to.be.calledOnce
        expect(callbackStub).to.be.calledWith(null, 'invoke')
      })
      it('executes the given event via lambda.invoke when in standard mode', () => {
        handler.impl.invokeSelf(0, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runTaskStub).to.not.be.called
        expect(lambdaInvokeStub).to.be.calledOnce
        expect(lambdaInvokeStub.args[0][1]).to.eql({
          FunctionName: tagContext.functionName,
          InvocationType: 'Event',
          Payload: JSON.stringify({}),
        })
        expect(callbackStub).to.be.calledWith(null, 'invoke')
      })
      it('adds the SERVERLESS_STAGE environment variable to `FunctionName` if available', () => {
        const stage = 'STAGE'
        const serverlessStage = process.env.SERVERLESS_STAGE
        process.env.SERVERLESS_STAGE = stage
        try {
          handler.impl.invokeSelf(0, {}, tagContext, callbackStub)
          expect(setTimeoutStub).to.not.be.called
          expect(runTaskStub).to.not.be.called
          expect(lambdaInvokeStub).to.be.calledOnce
          expect(lambdaInvokeStub.args[0][1]).to.eql({
            FunctionName: `${tagContext.functionName}:${stage}`,
            InvocationType: 'Event',
            Payload: JSON.stringify({}),
          })
          expect(callbackStub).to.be.calledWith(null, 'invoke')
        } finally {
          process.env.SERVERLESS_STAGE = serverlessStage
        }
      })
      it('throws and catches the error returned by lambda.invoke, adding instructive messaging', () => {
        const err = 'invoke error'
        lambdaInvokeStub.withArgs('invoke', sinon.match.any, sinon.match.any).callsFake(
          (name, params, callback) => {
            callback(err)
          } // eslint-disable-line comma-dangle
        )
        handler.impl.invokeSelf(0, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runTaskStub).to.not.be.called
        expect(lambdaInvokeStub).to.be.calledOnce
        const msg = `ERROR exception encountered while invoking self from ${undefined} in ${undefined}: ERROR invoking self: ${err}\n`
        expect(callbackStub.args[0][0].substr(0, msg.length)).to.eql(msg)
      })
    })

    describe('#handle', () => {
      it('', () => {
        // TODO tests
      })
    })

    // describe('#api.run', () => {
    //   let validScriptStub
    //   let runAcceptanceStub
    //   let runPerformanceStub
    //   beforeEach(() => {
    //     validScriptStub = sinon.stub(handler.impl, 'validScript').returns(true)
    //     runAcceptanceStub = sinon.stub(handler.impl, 'runAcceptance').returns()
    //     runPerformanceStub = sinon.stub(handler.impl, 'runPerformance').returns()
    //   })
    //   afterEach(() => {
    //     validScriptStub.restore()
    //     runAcceptanceStub.restore()
    //     runPerformanceStub.restore()
    //   })
    //   it('ignores bad scripts', () => {
    //     script = {} // scripts must contain a config section
    //     validScriptStub.returns(false)
    //     handler.api.run(script, tagContext, noop)
    //     expect(validScriptStub).to.have.been.calledOnce
    //     expect(runAcceptanceStub).to.not.have.been.called
    //     expect(runPerformanceStub).to.not.have.been.called
    //   })
    //   it('adds _genesis if not present', () => {
    //     script = tagScript()
    //     expect(script._genesis).to.be.undefined
    //     handler.api.run(script, tagContext, noop)
    //     expect(script._genesis).to.be.a('number')
    //     expect(validScriptStub).to.have.been.calledOnce
    //     expect(runAcceptanceStub).to.not.have.been.called
    //     expect(runPerformanceStub).to.have.been.calledOnce
    //   })
    //   it('maintains a given _genesis', () => {
    //     const genesis = 12345
    //     script = tagScript()
    //     script._genesis = genesis
    //     expect(script._genesis).to.be.equal(genesis)
    //     handler.api.run(script, tagContext, noop)
    //     expect(script._genesis).to.be.equal(genesis)
    //     expect(validScriptStub).to.have.been.calledOnce
    //     expect(runAcceptanceStub).to.not.have.been.called
    //     expect(runPerformanceStub).to.have.been.calledOnce
    //   })
    //   it('detects acceptance mode declared as "acc"', () => {
    //     const mode = 'acc'
    //     script = tagScript()
    //     script.mode = mode
    //     handler.api.run(script, tagContext, noop)
    //     expect(validScriptStub).to.have.been.calledOnce
    //     expect(runAcceptanceStub).to.have.been.calledOnce
    //     expect(runPerformanceStub).to.not.have.been.called
    //   })
    //   it('detects acceptance mode declared as "acceptance"', () => {
    //     const mode = 'acceptance'
    //     script = tagScript()
    //     script.mode = mode
    //     handler.api.run(script, tagContext, noop)
    //     expect(validScriptStub).to.have.been.calledOnce
    //     expect(runAcceptanceStub).to.have.been.calledOnce
    //     expect(runPerformanceStub).to.not.have.been.called
    //   })
    //   it('calls performance mode if no mode is specified', () => {
    //     script = tagScript()
    //     handler.api.run(script, tagContext, noop)
    //     expect(validScriptStub).to.have.been.calledOnce
    //     expect(runAcceptanceStub).to.not.have.been.called
    //     expect(runPerformanceStub).to.have.been.calledOnce
    //   })
    //   it('detects performance mode declared as "perf"', () => {
    //     const mode = 'perf'
    //     script = tagScript()
    //     script.mode = mode
    //     handler.api.run(script, tagContext, noop)
    //     expect(validScriptStub).to.have.been.calledOnce
    //     expect(runAcceptanceStub).to.not.have.been.called
    //     expect(runPerformanceStub).to.have.been.calledOnce
    //   })
    //   it('detects performance mode declared as "performance"', () => {
    //     const mode = 'performance'
    //     script = tagScript()
    //     script.mode = mode
    //     handler.api.run(script, tagContext, noop)
    //     expect(validScriptStub).to.have.been.calledOnce
    //     expect(runAcceptanceStub).to.not.have.been.called
    //     expect(runPerformanceStub).to.have.been.calledOnce
    //   })
    // })
  })
})

quibble.reset()
