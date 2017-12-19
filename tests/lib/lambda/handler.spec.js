const artillery = require('artillery-core')
const aws = require('aws-sdk')
const chai = require('chai')
const EventEmitter = require('events')
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
let phase
let result
let expected

const tagContext = {
  functionName: 'name',
}

const validScript = () => ({
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

    describe('#phaseDurationInSeconds', () => {
      it('extracts the duration of a constant rate phase', () => {
        phase = {
          duration: 10,
          arrivalRate: 10,
        }
        expect(handler.impl.phaseDurationInSeconds(phase)).to.eql(phase.duration)
      })
      it('extracts the duration of a ramp to phase', () => {
        phase = {
          duration: 10,
          arrivalRate: 10,
          rampTo: 20,
        }
        expect(handler.impl.phaseDurationInSeconds(phase)).to.eql(phase.duration)
      })
      it('extracts the duration of a pause phase', () => {
        phase = {
          pause: 10,
        }
        expect(handler.impl.phaseDurationInSeconds(phase)).to.eql(phase.pause)
      })
      it('extracts the duration of a non-phase', () => {
        phase = {}
        expect(handler.impl.phaseDurationInSeconds(phase)).to.eql(-1)
      })
    })

    describe('#scriptDurationInSeconds', () => {
      it('detects and reports the index of invalid phases in a script', () => {
        script = {
          config: {
            phases: [
              {}, // not valid
            ],
          },
        }
        expect(handler.impl.scriptDurationInSeconds(script)).to.eql(-0)
      })
      it('detects and reports invalid first phase in a script', () => {
        script = {
          config: {
            phases: [
              {}, // not valid
              { duration: 10, arrivalRate: 10 },
              { duration: 10, arrivalRate: 10 },
            ],
          },
        }
        expect(handler.impl.scriptDurationInSeconds(script)).to.eql(-0)
      })
      it('detects and reports the index of invalid phases in a script', () => {
        script = {
          config: {
            phases: [
              { duration: 10, arrivalRate: 10 },
              {}, // not valid
              { duration: 10, arrivalRate: 10 },
            ],
          },
        }
        expect(handler.impl.scriptDurationInSeconds(script)).to.eql(-1)
      })
      it('detects and reports an invalid last phase in a script', () => {
        script = {
          config: {
            phases: [
              { duration: 10, arrivalRate: 10 },
              { duration: 10, arrivalRate: 10 },
              {}, // not valid
            ],
          },
        }
        expect(handler.impl.scriptDurationInSeconds(script)).to.eql(-2)
      })
      it('detects and reports the first index of invalid phases in a script', () => {
        script = {
          config: {
            phases: [
              { duration: 10, arrivalRate: 10 },
              { duration: 10, arrivalRate: 10 },
              {}, // not valid
              { duration: 10, arrivalRate: 10 },
              { duration: 10, arrivalRate: 10 },
              {}, // also not valid
            ],
          },
        }
        expect(handler.impl.scriptDurationInSeconds(script)).to.eql(-2)
      })
      it('correctly calculates the duration of a single-phase script', () => {
        script = {
          config: {
            phases: [
              { duration: 10 },
            ],
          },
        }
        expect(handler.impl.scriptDurationInSeconds(script)).to.eql(10)
      })
      it('correctly calculates the duration of a multi-phase script', () => {
        script = {
          config: {
            phases: [
              { duration: 1 },
              { duration: 2 },
              { duration: 3 },
            ],
          },
        }
        expect(handler.impl.scriptDurationInSeconds(script)).to.eql(6) // 1 + 2 + 3 = 6
      })
      it('correctly calculates the duration of this specific script', () => {
        script = {
          config: {
            phases: [
              {
                duration: 60,
                arrivalRate: 1,
                rampTo: 5,
                name: 'Ramp-Up',
              },
              {
                duration: 120,
                arrivalRate: 5,
                name: 'Full-Load',
              },
              {
                duration: 60,
                arrivalRate: 5,
                rampTo: 1,
                name: 'Ramp-Down',
              },
            ],
          },
        }
        result = handler.impl.scriptDurationInSeconds(script)
        expect(result).to.equal(240)
      })
    })

    describe('#phaseRequestsPerSecond', () => {
      it('calculates the arrivals per second specified in an ascending rampTo phase', () => {
        phase = { arrivalRate: 10, rampTo: 20 }
        expect(handler.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second specified in an descending rampTo phase', () => {
        phase = { arrivalRate: 20, rampTo: 10 }
        expect(handler.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a constant rate phase', () => {
        phase = { arrivalRate: 20 }
        expect(handler.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a constant count phase', () => {
        phase = { arrivalCount: 20, duration: 1 }
        expect(handler.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a pause phase', () => {
        phase = { pause: 1 }
        expect(handler.impl.phaseRequestsPerSecond(phase)).to.eql(0)
      })
      it('returns -1 to indicate an invalid phase', () => {
        phase = {}
        expect(handler.impl.phaseRequestsPerSecond(phase)).to.eql(-1)
      })
    })

    describe('#scriptRequestsPerSecond', () => {
      it('correctly identifies an invalid phase in a script', () => {
        script = {
          config: {
            phases: [
              {}, // not valid
            ],
          },
        }
        expect(handler.impl.scriptRequestsPerSecond(script)).to.eql(-0)
      })
      it('correctly calculates the index of an invalid phase in a script when it is the first phase', () => {
        script = {
          config: {
            phases: [
              {}, // not valid
              { arrivalRate: 1 },
              { arrivalRate: 2 },
            ],
          },
        }
        expect(handler.impl.scriptRequestsPerSecond(script)).to.eql(-0)
      })
      it('correctly calculates the index of an invalid phase in a script when it the phase is in the midst of the phases', () => {
        script = {
          config: {
            phases: [
              { arrivalRate: 1 },
              {}, // not valid
              { arrivalRate: 2 },
            ],
          },
        }
        expect(handler.impl.scriptRequestsPerSecond(script)).to.eql(-1)
      })
      it('correctly calculates the index of an invalid phase in a script when it is the last phase', () => {
        script = {
          config: {
            phases: [
              { arrivalRate: 1 },
              { arrivalRate: 2 },
              {}, // not valid
            ],
          },
        }
        expect(handler.impl.scriptRequestsPerSecond(script)).to.eql(-2)
      })
      it('correctly calculates the arrivals per second of a single-phase script', () => {
        script = {
          config: {
            phases: [
              { arrivalRate: 1 },
            ],
          },
        }
        expect(handler.impl.scriptRequestsPerSecond(script)).to.eql(1)
      })
      it('correctly calculates the arrivals per second of a multi-phase script', () => {
        script = {
          config: {
            phases: [
              { arrivalRate: 1 },
              { arrivalRate: 2 },
              { arrivalRate: 3 },
              { arrivalRate: 4 },
              { arrivalRate: 5 },
            ],
          },
        }
        expect(handler.impl.scriptRequestsPerSecond(script)).to.eql(5)
      })
    })
    describe('#validScript', () => {
      /* eslint-disable no-underscore-dangle */
      beforeEach(() => {
        script = validScript()
      })
      it('accepts the valid script', () => {
        expect(handler.impl.validScript(script, null, noop)).to.be.true
      })
      describe('_split usage', () => {
        const validSplitScript = () => {
          const ret = validScript()
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
      describe('phase definition (unless in acceptance mode)', () => {
        it('rejects an undefined config', () => {
          delete script.config
          expect(handler.impl.validScript(script, null, noop)).to.be.false
          script.mode = handler.constants.modes.ACCEPTANCE
          expect(handler.impl.validScript(script, null, noop)).to.be.true
        })
        it('rejects a non-array config.phases', () => {
          script.config.phases = ''
          expect(handler.impl.validScript(script, null, noop)).to.be.false
          script.mode = handler.constants.modes.ACCEPTANCE
          expect(handler.impl.validScript(script, null, noop)).to.be.true
        })
        it('rejects an empty-array config.phases', () => {
          script.config.phases = []
          expect(handler.impl.validScript(script, null, noop)).to.be.false
          script.mode = handler.constants.modes.ACCEPTANCE
          expect(handler.impl.validScript(script, null, noop)).to.be.true
        })
      })
      describe('mode declaration', () => {
        Object.keys(handler.constants.modes).forEach((mode) => {
          it(`accepts valid mode declaration '${mode}'`, () => {
            script.mode = handler.constants.modes[mode]
            expect(handler.impl.validScript(script, null, noop)).to.be.true
          })
        })
        it('reject unknown modes', () => {
          script.mode = 'UNKNOWN_MODE'
          expect(handler.impl.validScript(script, null, noop)).to.be.false
        })
        it('reject unsupported mode capitalizations', () => {
          script.mode = 'aCc'
          expect(handler.impl.validScript(script, null, noop)).to.be.false
        })
      })
      describe('evaluates load constraints (unless in acceptance mode)', () => {
        it('rejects scripts with invalid phases', () => {
          script.config.phases = [{ arrivalRate: 10 }] // invalid duration
          expect(handler.impl.validScript(script, null, noop)).to.be.false
          script.mode = handler.constants.modes.ACCEPTANCE
          expect(handler.impl.validScript(script, null, noop)).to.be.true
          delete script.mode
          script.config.phases = [{ duration: 10 }] // invalid rate
          expect(handler.impl.validScript(script, null, noop)).to.be.false
          script.mode = handler.constants.modes.ACCEPTANCE
          expect(handler.impl.validScript(script, null, noop)).to.be.true
        })
        it('rejects scripts with excessive duration', () => {
          script.config.phases = [{ duration: handler.constants.DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS + 1, arrivalRate: 10 }]
          expect(handler.impl.validScript(script, null, noop)).to.be.false
          script.mode = handler.constants.modes.ACCEPTANCE
          expect(handler.impl.validScript(script, null, noop)).to.be.true
        })
        it('rejects scripts with excessive requests per second', () => {
          script.config.phases = [{ duration: 10, arrivalRate: handler.constants.DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND + 1 }]
          expect(handler.impl.validScript(script, null, noop)).to.be.false
          script.mode = handler.constants.modes.ACCEPTANCE
          expect(handler.impl.validScript(script, null, noop)).to.be.true
        })
      })
    })
    /**
     * SPLIT PHASE BY DurationInSeconds
     */
    describe('#splitPhaseByDurationInSeconds splits PHASES that are TOO LONG', () => {
      it('splitting a constant rate phase of three chunk\'s durationInSeconds into two parts.', () => {
        phase = {
          duration: 3 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          arrivalRate: 1,
        }
        expected = {
          chunk: {
            duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
            arrivalRate: 1,
          },
          remainder: {
            duration: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
            arrivalRate: 1,
          },
        }
        result = handler.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a ramping phase of two chunk\'s duration into two parts.', () => {
        phase = {
          duration: 3 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          arrivalRate: 1,
          rampTo: 4,
        }
        expected = {
          chunk: {
            duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
            arrivalRate: 1,
            rampTo: 2,
          },
          remainder: {
            duration: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
            arrivalRate: 2,
            rampTo: 4,
          },
        }
        result = handler.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
      it('splits ramp of two chunk\'s duration into two parts, rounding to the nearest integer rate per second.', () => {
        phase = {
          duration: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          arrivalRate: 1,
          rampTo: 2,
        }
        expected = {
          chunk: {
            duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
            arrivalRate: 1,
            rampTo: 2,
          },
          remainder: {
            duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
            arrivalRate: 2,
            rampTo: 2,
          },
        }
        result = handler.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an arrival count phase of two chunk\'s duration into two parts.', () => {
        phase = {
          duration: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          arrivalCount: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        }
        expected = {
          chunk: {
            duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
            arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          },
          remainder: {
            duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
            arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          },
        }
        result = handler.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a pause phase of two chunk\'s duration into two parts.', () => {
        phase = {
          pause: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        }
        expected = {
          chunk: {
            pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          },
          remainder: {
            pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          },
        }
        result = handler.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
    })
    /**
     * SPLIT SCRIPT BY DURATION
     */
    describe('#splitScriptByDurationInSeconds The handler splits SCRIPTS that are TOO LONG', () => {
      it('splitting a script where there is a natural phase split at MAX_CHUNK_DURATION between two phases.', () => {
        script = {
          config: {
            phases: [
              {
                duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
                arrivalRate: 1,
              },
              {
                duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
                arrivalRate: 2,
              },
            ],
          },
        }
        expected = {
          chunk: {
            config: {
              phases: [
                {
                  duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
                  arrivalRate: 1,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
                  arrivalRate: 2,
                },
              ],
            },
          },
        }
        result = handler.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a script where there is a natural phase split at MAX_CHUNK_DURATION between many phases.', () => {
        script = {
          config: {
            phases: [
              {
                duration: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                arrivalRate: 1,
              },
              {
                duration: Math.ceil(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                arrivalRate: 1,
              },
              {
                duration: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                arrivalRate: 1,
              },
              {
                duration: Math.ceil(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                arrivalRate: 1,
              },
              {
                duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
                arrivalRate: 2,
              },
            ],
          },
        }
        expected = {
          chunk: {
            config: {
              phases: [
                {
                  duration: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                  arrivalRate: 1,
                },
                {
                  duration: Math.ceil(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                  arrivalRate: 1,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                  arrivalRate: 1,
                },
                {
                  duration: Math.ceil(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                  arrivalRate: 1,
                },
                {
                  duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
                  arrivalRate: 2,
                },
              ],
            },
          },
        }
        result = handler.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a script where a phase must be split at MAX_CHUNK_DURATION.', () => {
        script = {
          config: {
            phases: [
              {
                duration: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                arrivalRate: 1,
              },
              {
                duration: Math.ceil(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                arrivalRate: 1,
              },
              {
                duration: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                arrivalRate: 1,
              },
            ],
          },
        }
        expected = {
          chunk: {
            config: {
              phases: [
                {
                  duration: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                  arrivalRate: 1,
                },
                {
                  duration: Math.ceil(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.25),
                  arrivalRate: 1,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                  arrivalRate: 1,
                },
                {
                  duration: Math.ceil(handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                  arrivalRate: 1,
                },
              ],
            },
          },
        }
        result = handler.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
    })
    /**
     * SPLIT PHASE BY RequestsPerSecond
     */
    describe('#splitPhaseByRequestsPerSecond The handler splits PHASES that are TOO WIDE (RPS > MAX_RPS)', () => {
      // min >= chunkSize
      it('splitting a ramp phase that at all times exceeds a rate of DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a' +
        ' constant rate and remainder ramp phases.', () => {
        phase = {
          arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
          rampTo: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 3,
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              duration: 1,
            },
          ],
          remainder: [
            {
              arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              rampTo: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
              duration: 1,
            },
          ],
        }
        result = handler.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
      // max <= chunkSize
      it('splitting ramp that at all times is less than DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of the ramp' +
        ' phase and a remainder of a pause phase.', () => {
        phase = {
          arrivalRate: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.5),
          rampTo: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.75),
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalRate: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.5),
              rampTo: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.75),
              duration: 1,
            },
          ],
          remainder: [
            {
              pause: 1,
            },
          ],
        }
        result = handler.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an ascending ramp phase that starts lower than and ends higher than' +
        ' DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of a ramp phase followed by a constant rate phase and a' +
        ' remainder of a pause phase followed by a ramp phase.', () => {
        phase = {
          arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.5,
          rampTo: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 1.5,
          duration: 2,
        }
        expected = {
          chunk: [
            {
              arrivalRate: phase.arrivalRate,
              rampTo: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              duration: 1,
            },
            {
              arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              duration: 1,
            },
          ],
          remainder: [
            {
              pause: 1,
            },
            {
              arrivalRate: 1,
              rampTo: (handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 1.5) - handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND, // eslint-disable-line max-len
              duration: 1,
            },
          ],
        }
        result = handler.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a descending ramp phase that starts lower than and ends higher than' +
        ' DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of a constant rate phase followed by a ramp phase and a' +
        ' remainder of a ramp phase followed by a pause phase.', () => {
        phase = {
          arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 1.5,
          rampTo: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.5,
          duration: 2,
        }
        expected = {
          chunk: [
            {
              arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              duration: 1,
            },
            {
              arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              rampTo: phase.rampTo,
              duration: 1,
            },
          ],
          remainder: [
            {
              arrivalRate: phase.arrivalRate - handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              rampTo: 1,
              duration: 1,
            },
            {
              pause: 1,
            },
          ],
        }
        result = handler.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
      it('splits an arrivalRate of less than a chunk\'s requestsPerSecond into a chunk of that requestsPerSecond and remainder of pause', () => {
        phase = {
          arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.75,
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalRate: phase.arrivalRate,
              duration: 1,
            },
          ],
          remainder: [
            {
              pause: 1,
            },
          ],
        }
        result = handler.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an arrivalRate phase of two chunk\'s requestsPerSecond into two parts.', () => {
        phase = {
          arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              duration: 1,
            },
          ],
          remainder: [
            {
              arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              duration: 1,
            },
          ],
        }
        result = handler.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an arrivalCount phase of two chunk\'s requestsPerSecond into two parts.', () => {
        phase = {
          arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              duration: 1,
            },
          ],
          remainder: [
            {
              arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
              duration: 1,
            },
          ],
        }
        result = handler.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an arrivalCount phase of less than chunkSize\'s requestsPerSecond into an arrival count and pause phase.', () => {
        phase = {
          arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.75,
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalCount: phase.arrivalCount,
              duration: 1,
            },
          ],
          remainder: [
            {
              pause: 1,
            },
          ],
        }
        result = handler.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a pause phase into two pause phases.', () => {
        phase = {
          pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        }
        expected = {
          chunk: [
            { pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS },
          ],
          remainder: [
            { pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS },
          ],
        }
        result = handler.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
    })
    /**
     * SPLIT SCRIPT BY RequestsPerSecond
     */
    describe('#splitScriptByRequestsPerSecond the handler splits SCRIPTS that are TOO WIDE', () => {
      it('splits a script with a phase that specifies twice DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND load.', () => {
        script = {
          config: {
            phases: [
              {
                duration: 1,
                arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
              },
            ],
          },
        }
        expected = {
          chunk: {
            config: {
              phases: [
                {
                  duration: 1,
                  arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: 1,
                  arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
                },
              ],
            },
          },
        }
        result = handler.impl.splitScriptByRequestsPerSecond(script, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
      it('splits a script of two phases that specify twice DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND load to split.', () => {
        script = {
          config: {
            phases: [
              {
                duration: 1,
                arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
              },
              {
                duration: 1,
                arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
              },
            ],
          },
        }
        expected = {
          chunk: {
            config: {
              phases: [
                {
                  duration: 1,
                  arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
                },
                {
                  duration: 1,
                  arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: 1,
                  arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
                },
                {
                  duration: 1,
                  arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
                },
              ],
            },
          },
        }
        result = handler.impl.splitScriptByRequestsPerSecond(script, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
    })

    describe('#loadProcessor', () => {
      it('loads custom processor code based on script configuration', () => {
        const newScript = {
          config: {
            processor: `${__dirname}/customprocessor.js`,
          },
        }
        handler.impl.loadProcessor(newScript)
        expect(newScript.config.processor.testMethod()).to.equal('testValue')
      })
      it('does not attempt to reload a previously loaded processor', () => {
        const newScript = {
          config: {
            processor: {
              f: () => 'testValue',
            },
          },
        }
        handler.impl.loadProcessor(newScript)
        expect(newScript.config.processor.f()).to.equal('testValue')
      })
    })
    describe('#readPayload', () => {
      it('reads a single payload file.', () => {
        const newScript = {
          config: {
            payload: {
              path: path.join(__dirname, 'example.0.csv'),
            },
          },
        }
        const payload = handler.impl.readPayload(newScript)
        expect(payload).to.deep.equal([
          ['123456', 'John Doe'],
          ['234567', 'Jane Doe'],
          ['345678', 'Baby Doe'],
        ])
      })
      it('reads a set of payload files.', () => {
        const newScript = {
          config: {
            payload: [
              {
                path: path.join(__dirname, 'example.0.csv'),
              },
              {
                path: path.join(__dirname, 'example.1.csv'),
              },
            ],
          },
        }
        const payload = handler.impl.readPayload(newScript)
        expect(payload).to.deep.equal([
          {
            path: path.join(__dirname, 'example.0.csv'),
            data: [
              ['123456', 'John Doe'],
              ['234567', 'Jane Doe'],
              ['345678', 'Baby Doe'],
            ],
          },
          {
            path: path.join(__dirname, 'example.1.csv'),
            data: [
              ['123457', 'John Jones'],
              ['234568', 'Jane Jones'],
              ['345679', 'Baby Jones'],
            ],
          },
        ])
      })
    })
    /**
     * SPLIT SCRIPT BY FLOW
     */
    describe('#splitScriptByFlow', () => {
      it('splits a script with 1 flow correctly, changing duration and arrivalRate to 1', () => {
        const newScript = {
          mode: 'acc',
          config: {
            target: 'https://aws.amazon.com',
            phases: [
              { duration: 1000, arrivalRate: 1000, rampTo: 1000 },
            ],
          },
          scenarios: [
            {
              flow: [
                { get: { url: '/1' } },
              ],
            },
          ],
        }
        const scripts = handler.impl.splitScriptByFlow(newScript)
        expect(scripts).to.deep.equal([
          {
            mode: 'perf',
            config: {
              target: 'https://aws.amazon.com',
              phases: [
                { duration: 1, arrivalRate: 1 },
              ],
            },
            scenarios: [
              {
                flow: [
                  { get: { url: '/1' } },
                ],
              },
            ],
          },
        ])
      })
      it('split a script with 2 flows into two scripts with one flow, each with duration = 1 and arrivalRate = 1', () => {
        const newScript = {
          mode: 'acc',
          config: {
            target: 'https://aws.amazon.com',
            phases: [
              { duration: 1000, arrivalRate: 1000, rampTo: 1000 },
            ],
          },
          scenarios: [
            {
              flow: [
                { get: { url: '/1' } },
              ],
            },
            {
              flow: [
                { get: { url: '/2' } },
              ],
            },
          ],
        }
        const scripts = handler.impl.splitScriptByFlow(newScript)
        expect(scripts).to.deep.equal([
          {
            mode: 'perf',
            config: {
              target: 'https://aws.amazon.com',
              phases: [
                { duration: 1, arrivalRate: 1 },
              ],
            },
            scenarios: [
              {
                flow: [
                  { get: { url: '/1' } },
                ],
              },
            ],
          },
          {
            mode: 'perf',
            config: {
              target: 'https://aws.amazon.com',
              phases: [
                { duration: 1, arrivalRate: 1 },
              ],
            },
            scenarios: [
              {
                flow: [
                  { get: { url: '/2' } },
                ],
              },
            ],
          },
        ])
      })
    })

    /**
     * This function is an odd one to test because it represents logic about using external integrations.  As a result,
     * the cases revolve around its use of those external resources and the test cases reflect this.
     */
    describe('#invokeSelf', () => {
      let runPerformanceStub
      let setTimeoutStub
      let callbackStub
      beforeEach(() => {
        runPerformanceStub = sinon.stub(handler.impl, 'runPerformance').callsFake(
          (time, event, context, callback) => { callback(null, 'runPerformance') } // eslint-disable-line comma-dangle
        )
        lambdaInvokeStub.withArgs('invoke', sinon.match.any, sinon.match.any).callsFake(
          (name, params, callback) => { callback(null, 'invoke') } // eslint-disable-line comma-dangle
        )
        setTimeoutStub = sinon.stub(global, 'setTimeout').callsFake(
          (callback, milliseconds, arg1, arg2, arg3) =>
            process.nextTick(() => callback(arg1, arg2, arg3)) // eslint-disable-line comma-dangle
        )
        callbackStub = sinon.stub().returns()
      })
      afterEach(() => {
        runPerformanceStub.restore()
        lambdaInvokeStub.reset()
        setTimeoutStub.restore()
        callbackStub.reset()
      })
      it('does not delay if the timeDelay is zero in standard mode', () => {
        handler.impl.invokeSelf(0, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runPerformanceStub).to.not.be.called
        expect(lambdaInvokeStub).to.be.calledOnce
        expect(callbackStub).to.be.calledWith(null, 'invoke')
      })
      it('does not delay if the timeDelay is negative in standard mode', () => {
        handler.impl.invokeSelf(-1, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runPerformanceStub).to.not.be.called
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
          expect(runPerformanceStub).to.not.be.called
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
          expect(runPerformanceStub).to.not.be.called
          expect(lambdaInvokeStub).to.be.calledOnce
        }) // eslint-disable-line comma-dangle
      )
      it('executes the given event via runPerformance when in simulation mode', () => {
        handler.impl.invokeSelf(0, { _simulation: true }, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runPerformanceStub).to.be.calledOnce
        expect(lambdaInvokeStub).to.not.be.called
        expect(callbackStub).to.be.calledWith(null, 'runPerformance')
      })
      it('executes the given event via lambda.invoke when in standard mode', () => {
        handler.impl.invokeSelf(0, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runPerformanceStub).to.not.be.called
        expect(lambdaInvokeStub).to.be.calledOnce
        expect(callbackStub).to.be.calledWith(null, 'invoke')
      })
      it('executes the given event via lambda.invoke when in standard mode', () => {
        handler.impl.invokeSelf(0, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runPerformanceStub).to.not.be.called
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
          expect(runPerformanceStub).to.not.be.called
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
          (name, params, callback) => { callback(err) } // eslint-disable-line comma-dangle
        )
        handler.impl.invokeSelf(0, {}, tagContext, callbackStub)
        expect(setTimeoutStub).to.not.be.called
        expect(runPerformanceStub).to.not.be.called
        expect(lambdaInvokeStub).to.be.calledOnce
        const msg = `ERROR exception encountered while invoking self from ${undefined} in ${undefined}: ERROR invoking self: ${err}\n`
        expect(callbackStub.args[0][0].substr(0, msg.length)).to.eql(msg)
      })
    })

    describe('#runLoad', () => {
      let loadProcessorStub
      let readPayloadStub
      let runner
      let runnerStub
      beforeEach(() => {
        loadProcessorStub = sinon.stub(handler.impl, 'loadProcessor').returns()
        readPayloadStub = sinon.stub(handler.impl, 'readPayload').returns()
        runner = new EventEmitter()
        runner.run = noop
        runnerStub = sinon.stub(artillery, 'runner').returns(runner)
      })
      afterEach(() => {
        loadProcessorStub.restore()
        readPayloadStub.restore()
        runnerStub.restore()
      })
      it('does nothing in simulation mode',
        () => new Promise((resolve) => {
          script = { _trace: true, _simulation: true }
          handler.impl.runLoad(1, script, tagContext, (err, res) => {
            expect(err).to.be.null
            expect(res).to.eql({ Payload: '{ "errors": 0 }' })
            resolve()
          })
        }).then(() => {
          expect(loadProcessorStub).to.not.be.called
          expect(readPayloadStub).to.not.be.called
          expect(runnerStub).to.not.be.called
        }) // eslint-disable-line comma-dangle
      )
      it('"loads" a processor, "reads" a payload, and "executes" the script before the callback is executed in standard mode',
        () => new Promise((resolve) => {
          script = {}
          const opts = {}
          const report = {}
          handler.impl.runLoad(1, script, tagContext, (err, res) => {
            expect(err).to.be.null
            expect(res).to.equal(report)
            resolve()
          })
          runner.emit('phaseStarted', opts)
          runner.emit('phaseCompleted', opts)
          runner.emit('done', report)
        }).then(() => {
          expect(loadProcessorStub).to.be.calledOnce
          expect(loadProcessorStub).to.be.calledBefore(readPayloadStub)
          expect(readPayloadStub).to.be.calledAfter(loadProcessorStub)
          expect(readPayloadStub).to.be.calledOnce
          expect(readPayloadStub).to.be.calledBefore(runnerStub)
          expect(runnerStub).to.be.calledAfter(readPayloadStub)
          expect(runnerStub).to.be.calledOnce
        }) // eslint-disable-line comma-dangle
      )
      it('"loads" a processor, "reads" a payload, and "executes" the script before the callback is executed in trace mode',
        () => new Promise((resolve) => {
          script = { _trace: true }
          const opts = {}
          const report = {}
          handler.impl.runLoad(1, script, tagContext, (err, res) => {
            expect(err).to.be.null
            expect(res).to.equal(report)
            resolve()
          })
          runner.emit('phaseStarted', opts)
          runner.emit('phaseCompleted', opts)
          runner.emit('done', report)
        }).then(() => {
          expect(loadProcessorStub).to.be.calledOnce
          expect(loadProcessorStub).to.be.calledBefore(readPayloadStub)
          expect(readPayloadStub).to.be.calledAfter(loadProcessorStub)
          expect(readPayloadStub).to.be.calledOnce
          expect(readPayloadStub).to.be.calledBefore(runnerStub)
          expect(runnerStub).to.be.calledAfter(readPayloadStub)
          expect(runnerStub).to.be.calledOnce
        }) // eslint-disable-line comma-dangle
      )
      it('handled exepected errors in the artillery runner or runner event invocations',
        () => new Promise((resolve) => {
          script = {}
          runnerStub.throws()
          handler.impl.runLoad(1, script, tagContext, (err, res) => {
            expect(err).to.be.a('string')
            expect(res).to.be.undefined
            resolve()
          })
        }).then(() => {
          expect(loadProcessorStub).to.be.calledOnce
          expect(loadProcessorStub).to.be.calledBefore(readPayloadStub)
          expect(readPayloadStub).to.be.calledAfter(loadProcessorStub)
          expect(readPayloadStub).to.be.calledOnce
          expect(readPayloadStub).to.be.calledBefore(runnerStub)
          expect(runnerStub).to.be.calledAfter(readPayloadStub)
          expect(runnerStub).to.be.calledOnce
        }) // eslint-disable-line comma-dangle
      )
    })

    describe('#runPerformance', () => {
      // /**
      //  * Run an Artillery script.  Detect if it needs to be split and do so if it does.  Execute scripts not requiring
      //  * splitting.
      //  *
      //  * Customizable script splitting settings can be provided in an optional "_split" attribute, an example of which
      //  * follows:
      //  *  {
      //  *     maxScriptDurationInSeconds: 86400,  // max value - see constants.DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS
      //  *     maxScriptRequestsPerSecond: 5000,   // max value - see constants.DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND
      //  *     maxChunkDurationInSeconds: 240,     // max value - see constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS
      //  *     maxChunkRequestsPerSecond: 25,      // max value - see constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND
      //  *     timeBufferInMilliseconds: 15000,    // default   - see constants.DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS
      //  *  }
      //  *
      //  * TODO What if there is not external reporting for a script that requires splitting?  Detect this and error out?
      //  *
      //  * @param timeNow The time at which the event was received for this execution
      //  * @param script The Artillery (http://artillery.io) script execute after optional splitting
      //  * @param context The Lambda provided execution context
      //  * @param callback The Lambda provided callback to report errors or success to
      //  */
      // runPerformance: (timeNow, script, context, callback) => {
      //   ...
      // }
      it('', () => {
        // TODO implement tests
      })
    })

    /**
     * ANALYZE ACCEPTANCE TEST REPORTS
     */
    describe('#analyzeAcceptance', () => {
      it('handles a report set of zero reports', () => {
        const reports = []
        expected = {
          errors: 0,
          reports,
        }
        result = handler.impl.analyzeAcceptance(reports)
        expect(result).to.eql(expected)
      })
      it('handles a report set with no errors', () => {
        const reports = [
          {
            errors: {},
          },
          {
            errors: {},
          },
        ]
        expected = {
          errors: 0,
          reports,
        }
        result = handler.impl.analyzeAcceptance(reports)
        expect(result).to.eql(expected)
      })
      it('handles a report set with some errors', () => {
        const reports = [
          {
            errors: {
              foo: 'bar',
            },
          },
          {
            errors: {},
          },
        ]
        expected = {
          errors: 1,
          errorMessage: '1 acceptance test failure',
          reports,
        }
        result = handler.impl.analyzeAcceptance(reports)
        expect(result).to.eql(expected)
      })
      it('handles a report set with all errors', () => {
        const reports = [
          {
            errors: {
              foo: 'bar',
            },
          },
          {
            errors: {
              foo: 'baz',
            },
          },
        ]
        expected = {
          errors: 2,
          errorMessage: '2 acceptance test failures',
          reports,
        }
        result = handler.impl.analyzeAcceptance(reports)
        expect(result).to.eql(expected)
      })
    })

    describe('#runAcceptance', () => {
      let splitScriptByFlowStub
      let analyseAcceptanceStub
      let invokeSelfStub
      const callbackStub = sinon.stub().returns()
      beforeEach(() => {
        splitScriptByFlowStub = sinon.stub(handler.impl, 'splitScriptByFlow').returns([{}, {}, {}])
        analyseAcceptanceStub = sinon.stub(handler.impl, 'analyzeAcceptance').returns({})
        invokeSelfStub = sinon.stub(handler.impl, 'invokeSelf').callsFake(
          (timeDelay, event, context, callback) => callback(null, { Payload: '{}' }) // eslint-disable-line comma-dangle
        )
      })
      afterEach(() => {
        splitScriptByFlowStub.restore()
        analyseAcceptanceStub.restore()
        invokeSelfStub.restore()
        callbackStub.reset()
      })
      it('calls invokeSelf once per script given by splitScriptByFlow', () => {
        handler.impl.runAcceptance(1, {}, tagContext, callbackStub)
        expect(splitScriptByFlowStub).to.have.been.calledOnce
        expect(invokeSelfStub).to.have.callCount(3)
        expect(analyseAcceptanceStub).to.have.been.calledOnce
        expect(callbackStub).to.have.been.calledOnce
      })
      it('calls invokeSelf once per script given by splitScriptByFlow in trace mode', () => {
        const logSpy = sinon.spy(console, 'log')
        try {
          handler.impl.runAcceptance(1, { _trace: true }, tagContext, callbackStub)
          expect(splitScriptByFlowStub).to.have.been.calledOnce
          expect(invokeSelfStub).to.have.callCount(3)
          expect(analyseAcceptanceStub).to.have.been.calledOnce
          expect(callbackStub).to.have.been.calledOnce
          expect(logSpy).to.have.been.calledThrice
        } finally {
          logSpy.restore()
        }
      })
      it('gracefully handles results that do not contain a payload', () => {
        invokeSelfStub.callsFake((timeDelay, event, context, callback) => callback(null, {}))
        handler.impl.runAcceptance(1, {}, tagContext, callbackStub)
        expect(splitScriptByFlowStub).to.have.been.calledOnce
        expect(invokeSelfStub).to.have.callCount(3)
        expect(analyseAcceptanceStub).to.have.been.calledOnce
        expect(callbackStub).to.have.been.calledOnce
      })
      it('gracefully handles payloads that contain invalid JSON', () => {
        invokeSelfStub.callsFake((timeDelay, event, context, callback) => callback(null, { Payload: '{ NOT JSON' }))
        handler.impl.runAcceptance(1, {}, tagContext, callbackStub)
        expect(splitScriptByFlowStub).to.have.been.calledOnce
        expect(invokeSelfStub).to.have.callCount(3)
        expect(analyseAcceptanceStub).to.have.been.calledOnce
        expect(callbackStub).to.have.been.calledOnce
      })
      it('calls the given callback with the report resulting from analyzeAcceptance', () => {
        const report = {}
        analyseAcceptanceStub.returns(report)
        handler.impl.runAcceptance(1, {}, tagContext, callbackStub)
        expect(splitScriptByFlowStub).to.have.been.calledOnce
        expect(invokeSelfStub).to.have.callCount(3)
        expect(analyseAcceptanceStub).to.have.been.calledOnce
        expect(callbackStub).to.have.been.calledOnce
        expect(callbackStub.getCall(0).args[1]).to.equal(report)
      })
    })
  })

  describe('#api.run', () => {
    let validScriptStub
    let runAcceptanceStub
    let runPerformanceStub
    beforeEach(() => {
      validScriptStub = sinon.stub(handler.impl, 'validScript').returns(true)
      runAcceptanceStub = sinon.stub(handler.impl, 'runAcceptance').returns()
      runPerformanceStub = sinon.stub(handler.impl, 'runPerformance').returns()
    })
    afterEach(() => {
      validScriptStub.restore()
      runAcceptanceStub.restore()
      runPerformanceStub.restore()
    })
    it('ignores bad scripts', () => {
      script = {} // scripts must contain a config section
      validScriptStub.returns(false)
      handler.api.run(script, tagContext, noop)
      expect(validScriptStub).to.have.been.calledOnce
      expect(runAcceptanceStub).to.not.have.been.called
      expect(runPerformanceStub).to.not.have.been.called
    })
    it('adds _genesis if not present', () => {
      script = validScript()
      expect(script._genesis).to.be.undefined
      handler.api.run(script, tagContext, noop)
      expect(script._genesis).to.be.a('number')
      expect(validScriptStub).to.have.been.calledOnce
      expect(runAcceptanceStub).to.not.have.been.called
      expect(runPerformanceStub).to.have.been.calledOnce
    })
    it('maintains a given _genesis', () => {
      const genesis = 12345
      script = validScript()
      script._genesis = genesis
      expect(script._genesis).to.be.equal(genesis)
      handler.api.run(script, tagContext, noop)
      expect(script._genesis).to.be.equal(genesis)
      expect(validScriptStub).to.have.been.calledOnce
      expect(runAcceptanceStub).to.not.have.been.called
      expect(runPerformanceStub).to.have.been.calledOnce
    })
    it('detects acceptance mode declared as "acc"', () => {
      const mode = 'acc'
      script = validScript()
      script.mode = mode
      handler.api.run(script, tagContext, noop)
      expect(validScriptStub).to.have.been.calledOnce
      expect(runAcceptanceStub).to.have.been.calledOnce
      expect(runPerformanceStub).to.not.have.been.called
    })
    it('detects acceptance mode declared as "acceptance"', () => {
      const mode = 'acceptance'
      script = validScript()
      script.mode = mode
      handler.api.run(script, tagContext, noop)
      expect(validScriptStub).to.have.been.calledOnce
      expect(runAcceptanceStub).to.have.been.calledOnce
      expect(runPerformanceStub).to.not.have.been.called
    })
    it('calls performance mode if no mode is specified', () => {
      script = validScript()
      handler.api.run(script, tagContext, noop)
      expect(validScriptStub).to.have.been.calledOnce
      expect(runAcceptanceStub).to.not.have.been.called
      expect(runPerformanceStub).to.have.been.calledOnce
    })
    it('detects performance mode declared as "perf"', () => {
      const mode = 'perf'
      script = validScript()
      script.mode = mode
      handler.api.run(script, tagContext, noop)
      expect(validScriptStub).to.have.been.calledOnce
      expect(runAcceptanceStub).to.not.have.been.called
      expect(runPerformanceStub).to.have.been.calledOnce
    })
    it('detects performance mode declared as "performance"', () => {
      const mode = 'performance'
      script = validScript()
      script.mode = mode
      handler.api.run(script, tagContext, noop)
      expect(validScriptStub).to.have.been.calledOnce
      expect(runAcceptanceStub).to.not.have.been.called
      expect(runPerformanceStub).to.have.been.calledOnce
    })
  })
})

quibble.reset()
