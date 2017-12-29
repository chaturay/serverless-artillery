/* eslint-disable no-underscore-dangle */

const chai = require('chai')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)

const expect = chai.expect

// eslint-disable-next-line import/no-dynamic-require
const handler = require(path.join('..', '..', '..', 'lib', 'lambda', 'handler.js'))
// eslint-disable-next-line import/no-dynamic-require
const def = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskDef.js'))
// eslint-disable-next-line import/no-dynamic-require
const plan = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskPlan.js'))

let script
let phase
let result
let expected
let defaultSettings

const validScript = () => ({
  config: {
    phases: [
      {
        duration: 1,
        arrivalRate: 1,
      },
    ],
  },
})

describe('./lib/lambda/taskPlan.js', () => {
  beforeEach(() => {
    defaultSettings = handler.impl.getSettings({})
  })
  describe(':impl', () => {
    describe('#phaseDurationInSeconds', () => {
      it('extracts the duration of a constant rate phase', () => {
        phase = {
          duration: 10,
          arrivalRate: 10,
        }
        expect(plan.impl.phaseDurationInSeconds(phase)).to.eql(phase.duration)
      })
      it('extracts the duration of a ramp to phase', () => {
        phase = {
          duration: 10,
          arrivalRate: 10,
          rampTo: 20,
        }
        expect(plan.impl.phaseDurationInSeconds(phase)).to.eql(phase.duration)
      })
      it('extracts the duration of a pause phase', () => {
        phase = {
          pause: 10,
        }
        expect(plan.impl.phaseDurationInSeconds(phase)).to.eql(phase.pause)
      })
      it('extracts the duration of a non-phase', () => {
        phase = {}
        expect(plan.impl.phaseDurationInSeconds(phase)).to.eql(-1)
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
        expect(plan.impl.scriptDurationInSeconds(script)).to.eql(-0)
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
        expect(plan.impl.scriptDurationInSeconds(script)).to.eql(-0)
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
        expect(plan.impl.scriptDurationInSeconds(script)).to.eql(-1)
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
        expect(plan.impl.scriptDurationInSeconds(script)).to.eql(-2)
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
        expect(plan.impl.scriptDurationInSeconds(script)).to.eql(-2)
      })
      it('correctly calculates the duration of a single-phase script', () => {
        script = {
          config: {
            phases: [
              { duration: 10 },
            ],
          },
        }
        expect(plan.impl.scriptDurationInSeconds(script)).to.eql(10)
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
        expect(plan.impl.scriptDurationInSeconds(script)).to.eql(6) // 1 + 2 + 3 = 6
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
        result = plan.impl.scriptDurationInSeconds(script)
        expect(result).to.equal(240)
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
        result = plan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = plan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = plan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = plan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = plan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = plan.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = plan.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = plan.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
      it('removes the scheduled execution time for the remainder of a given script', () => {
        script = {
          _start: Date.now(),
          config: {
            phases: [
              {
                duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS * 5,
                arrivalRate: 1,
              },
            ],
          },
        }
        result = plan.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result.remainder._start).to.be.undefined // eslint-disable-line no-underscore-dangle
      })
    })

    describe('#phaseRequestsPerSecond', () => {
      it('calculates the arrivals per second specified in an ascending rampTo phase', () => {
        phase = { arrivalRate: 10, rampTo: 20 }
        expect(plan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second specified in an descending rampTo phase', () => {
        phase = { arrivalRate: 20, rampTo: 10 }
        expect(plan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a constant rate phase', () => {
        phase = { arrivalRate: 20 }
        expect(plan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a constant count phase', () => {
        phase = { arrivalCount: 20, duration: 1 }
        expect(plan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a pause phase', () => {
        phase = { pause: 1 }
        expect(plan.impl.phaseRequestsPerSecond(phase)).to.eql(0)
      })
      it('returns -1 to indicate an invalid phase', () => {
        phase = {}
        expect(plan.impl.phaseRequestsPerSecond(phase)).to.eql(-1)
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
        expect(plan.impl.scriptRequestsPerSecond(script)).to.eql(-0)
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
        expect(plan.impl.scriptRequestsPerSecond(script)).to.eql(-0)
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
        expect(plan.impl.scriptRequestsPerSecond(script)).to.eql(-1)
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
        expect(plan.impl.scriptRequestsPerSecond(script)).to.eql(-2)
      })
      it('correctly calculates the arrivals per second of a single-phase script', () => {
        script = {
          config: {
            phases: [
              { arrivalRate: 1 },
            ],
          },
        }
        expect(plan.impl.scriptRequestsPerSecond(script)).to.eql(1)
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
        expect(plan.impl.scriptRequestsPerSecond(script)).to.eql(5)
      })
    })

    /**
     * Intersection
     */
    describe('#intersection', () => {
      // the rest of the test cases are covered at a higher level, the following safety check is disallowed by
      // this code in splitPhaseByRequestsPerSecond and its clause:
      // if ('rampTo' in phase && 'arrivalRate' in phase && phase.rampTo === phase.arrivalRate)
      it('detects parallel lines and throws an exception', () => {
        phase = { arrivalRate: 2, rampTo: 2, duration: 1 }
        expect(() => plan.impl.intersection(phase, 1))
          .to.throw(Error, 'Parallel lines never intersect, detect and avoid this case')
      })
    })

    /**
     * SPLIT PHASE BY RequestsPerSecond
     */
    describe('#splitPhaseByRequestsPerSecond The handler splits PHASES that are TOO WIDE (RPS > MAX_RPS)', () => {
      it('deletes unnecessary rampTo specifications (they are constant arrivalRate phases)', () => {
        phase = { arrivalRate: 2, rampTo: 2 }
        plan.impl.splitPhaseByRequestsPerSecond(phase, 1)
        expect(phase.rampTo).to.be.undefined
      })
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
        result = plan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitScriptByRequestsPerSecond(script, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = plan.impl.splitScriptByRequestsPerSecond(script, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
    })

    describe('#splitScriptByDurationInSecondsAndSchedule', () => {
      let splitScriptByDurationInSecondsStub
      let chunk
      let remainder
      beforeEach(() => {
        script = validScript()
        script.config.phases[0].duration = defaultSettings.maxChunkDurationInSeconds + 1
        chunk = validScript()
        chunk.config.phases[0].duration = defaultSettings.maxChunkDurationInSeconds
        remainder = validScript()
        remainder.config.phases[0].duration = 1
        splitScriptByDurationInSecondsStub = sinon.stub(plan.impl, 'splitScriptByDurationInSeconds').returns({ chunk, remainder })
      })
      afterEach(() => {
        splitScriptByDurationInSecondsStub.restore()
      })
      it('maintains existing start times for a script chunk in any mode, including standard mode', () => {
        chunk._start = 1
        result = plan.impl.splitScriptByDurationInSecondsAndSchedule(2, script, defaultSettings)
        expect(result.chunk._start).to.equal(1)
      })
      it('always resets start times for a script reaminder in any mode, including trace mode', () => {
        chunk._start = 1
        remainder._start = 1
        script._trace = true
        result = plan.impl.splitScriptByDurationInSecondsAndSchedule(2, script, defaultSettings)
        expect(result.remainder._start).to.equal(1 + (defaultSettings.maxChunkDurationInSeconds * 1000))
      })
      it('sets start times for script chunks and reaminders if none is given', () => {
        result = plan.impl.splitScriptByDurationInSecondsAndSchedule(1, script, defaultSettings)
        expect(result.chunk._start).to.equal(1 + defaultSettings.timeBufferInMilliseconds)
        expect(result.remainder._start).to.equal(result.chunk._start + (defaultSettings.maxChunkDurationInSeconds * 1000))
      })
    })

    describe('#splitScriptByRequestsPerSecondAndSchedule', () => {
      // explicitly not stubbing scriptRequestsPerSecond
      let splitScriptByRequestsPerSecondStub
      let chunk
      let remainder
      let empty
      let timeNow
      beforeEach(() => {
        script = validScript()
        script.config.phases[0].arrivalRate = defaultSettings.maxChunkRequestsPerSecond + 1
        chunk = validScript()
        chunk.config.phases[0].arrivalRate = defaultSettings.maxChunkDurationInSeconds
        remainder = validScript()
        remainder.config.phases[0].arrivalRate = 1
        empty = validScript()
        empty.config.phases[0] = { pause: 1 }
        splitScriptByRequestsPerSecondStub = sinon.stub(plan.impl, 'splitScriptByRequestsPerSecond').returns({ chunk, remainder })
        splitScriptByRequestsPerSecondStub.onCall(0).returns({ chunk, remainder })
        splitScriptByRequestsPerSecondStub.onCall(1).returns({ chunk: remainder, remainder: empty })
      })
      afterEach(() => {
        splitScriptByRequestsPerSecondStub.restore()
      })
      it('runs in any mode, including trace ', () => {
        timeNow = 1
        script._trace = true
        empty._trace = true
        result = plan.impl.splitScriptByRequestsPerSecondAndSchedule(timeNow, script, defaultSettings)
      })
      it('maintains existing start times for a script chunk in any mode, including standard mode', () => {
        timeNow = 2
        script._start = 1
        chunk._start = 1
        remainder._start = 1
        result = plan.impl.splitScriptByRequestsPerSecondAndSchedule(timeNow, script, defaultSettings)
        expect(script._start).to.equal(1)
        expect(result.length).to.equal(2)
        result.forEach((part) => {
          expect(part._start).to.equal(1)
        })
      })
      it('sets start times for script chunks if none is given', () => {
        timeNow = 1
        chunk._start = timeNow + defaultSettings.timeBufferInMilliseconds
        remainder._start = timeNow + defaultSettings.timeBufferInMilliseconds
        result = plan.impl.splitScriptByRequestsPerSecondAndSchedule(timeNow, script, defaultSettings)
        expect(script._start).to.equal(timeNow + defaultSettings.timeBufferInMilliseconds)
        expect(result.length).to.equal(2)
        result.forEach((part) => {
          expect(part._start).to.equal(timeNow + defaultSettings.timeBufferInMilliseconds)
        })
      })
    })

    describe('#planPerformance', () => {
      // explicitly not stubbing scriptDurationInSeconds and scriptRequestsPerSecond
      let chunk
      let remainder
      let splitScriptByDurationInSecondsAndScheduleStub
      let splitScriptByRequestsPerSecondAndScheduleStub
      beforeEach(() => {
        script = validScript()
        chunk = validScript()
        remainder = validScript()
        splitScriptByDurationInSecondsAndScheduleStub = sinon.stub(plan.impl, 'splitScriptByDurationInSecondsAndSchedule').returns({ chunk, remainder })
        splitScriptByRequestsPerSecondAndScheduleStub = sinon.stub(plan.impl, 'splitScriptByRequestsPerSecondAndSchedule').returns([chunk, remainder])
      })
      afterEach(() => {
        splitScriptByDurationInSecondsAndScheduleStub.restore()
        splitScriptByRequestsPerSecondAndScheduleStub.restore()
      })
      it('returns the given script in an array if that script is within limits', () => {
        result = plan.impl.planPerformance(1, script, defaultSettings)
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.not.have.been.called
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.not.have.been.called
        expect(result.length).to.equal(1)
        expect(result[0]).to.equal(script)
      })
      it('splits a script with a duration that is greater than the given limits', () => {
        script.config.phases[0].duration = defaultSettings.maxChunkDurationInSeconds + 1
        result = plan.impl.planPerformance(1, script, defaultSettings)
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.have.been.calledOnce
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.have.been.calledWithExactly(script, defaultSettings)
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.not.have.been.called
        expect(result.length).to.equal(2)
      })
      it('splits a script with a requests per second that are greater than the given limits', () => {
        script.config.phases[0].arrivalRate = defaultSettings.maxChunkRequestsPerSecond + 1
        result = plan.impl.planPerformance(1, script, defaultSettings)
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.not.have.been.called
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.have.been.calledOnce
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.have.been.calledWithExactly(1, script, defaultSettings)
        expect(result.length).to.equal(2)
      })
      it('splits a script with a both duration and requests per second that are greater than the given limits, in trace mode', () => {
        script._trace = true
        script.config.phases[0].duration = defaultSettings.maxChunkDurationInSeconds + 1
        script.config.phases[0].arrivalRate = defaultSettings.maxChunkRequestsPerSecond + 1
        chunk.config.phases[0].duration = defaultSettings.maxChunkRequestsPerSecond
        chunk.config.phases[0].arrivalRate = defaultSettings.maxChunkRequestsPerSecond + 1
        remainder.config.phases[0].duration = 1
        remainder.config.phases[0].arrivalRate = defaultSettings.maxChunkRequestsPerSecond + 1
        result = plan.impl.planPerformance(1, script, defaultSettings)
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.have.been.calledOnce
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.have.been.calledWithExactly(script, defaultSettings)
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.have.been.calledOnce
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.have.been.calledWithExactly(1, chunk, defaultSettings)
        expect(result.length).to.equal(3)
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
        const scripts = plan.impl.splitScriptByFlow(newScript)
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
        const scripts = plan.impl.splitScriptByFlow(newScript)
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

    describe('#planAcceptance', () => {
      let splitScriptByFlowStub
      beforeEach(() => {
        splitScriptByFlowStub = sinon.stub(plan.impl, 'splitScriptByFlow').returns()
      })
      afterEach(() => {
        splitScriptByFlowStub.restore()
      })
      it('adds _start and _invokeType to the given event', () => {
        script = {}
        plan.impl.planAcceptance(1, script)
        expect(script._start).to.equal(1)
        expect(script._invokeType).to.eql('RequestResponse')
        expect(splitScriptByFlowStub).to.have.been.calledWithExactly(script)
      })
    })

    describe('#planTask', () => {
      let planAcceptanceStub
      let planPerformanceStub
      beforeEach(() => {
        planAcceptanceStub = sinon.stub(plan.impl, 'planAcceptance').returns()
        planPerformanceStub = sinon.stub(plan.impl, 'planPerformance').returns()
      })
      afterEach(() => {
        planAcceptanceStub.restore()
        planPerformanceStub.restore()
      })
      it('detects the lack of mode and calls planPerformance', () => {
        script = {}
        plan.impl.planTask(1, script, defaultSettings)
        expect(planAcceptanceStub).to.not.have.been.called
        expect(planPerformanceStub).to.have.been.calledOnce
      })
      it(`detects mode "${def.modes.PERF}" and calls planPerformance`, () => {
        script = { mode: def.modes.PERF }
        plan.impl.planTask(1, script, defaultSettings)
        expect(planAcceptanceStub).to.not.have.been.called
        expect(planPerformanceStub).to.have.been.calledOnce
      })
      it(`detects mode "${def.modes.PERFORMANCE}" and calls planPerformance`, () => {
        script = { mode: def.modes.PERFORMANCE }
        plan.impl.planTask(1, script, defaultSettings)
        expect(planAcceptanceStub).to.not.have.been.called
        expect(planPerformanceStub).to.have.been.calledOnce
      })
      it(`detects mode "${def.modes.ACC}" and calls planAcceptance`, () => {
        script = { mode: def.modes.ACC }
        plan.impl.planTask(1, script, defaultSettings)
        expect(planAcceptanceStub).to.have.been.calledOnce
        expect(planPerformanceStub).to.not.have.been.called
      })
      it(`detects mode "${def.modes.ACCEPTANCE}" and calls planAcceptance`, () => {
        script = { mode: def.modes.ACCEPTANCE }
        plan.impl.planTask(1, script, defaultSettings)
        expect(planAcceptanceStub).to.have.been.calledOnce
        expect(planPerformanceStub).to.not.have.been.called
      })
    })
  })
})
