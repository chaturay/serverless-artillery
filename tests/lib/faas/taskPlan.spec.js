/* eslint-disable no-underscore-dangle */

const chai = require('chai')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', 'lib', 'faas', 'aws-func'))
// eslint-disable-next-line import/no-dynamic-require
const task = require(path.join('..', '..', '..', 'lib', 'faas', 'task.js'))

let script
let phase
let result
let expected
let defaultSettings

const runOnceSettings = func.define.getSettings()
runOnceSettings.task = { sampling: task.def.defaultsToSettings(task.def.acceptance) }

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

describe('./lib/faas/taskPlan.js', () => {
  beforeEach(() => {
    defaultSettings = func.define.getSettings({})
  })
  describe(':impl', () => {
    // ###############
    // ## DURATIONS ##
    // ###############
    describe('#phaseDurationInSeconds', () => {
      it('extracts the duration of a constant rate phase', () => {
        phase = {
          duration: 10,
          arrivalRate: 10,
        }
        expect(task.plan.impl.phaseDurationInSeconds(phase)).to.eql(phase.duration)
      })
      it('extracts the duration of a ramp to phase', () => {
        phase = {
          duration: 10,
          arrivalRate: 10,
          rampTo: 20,
        }
        expect(task.plan.impl.phaseDurationInSeconds(phase)).to.eql(phase.duration)
      })
      it('extracts the duration of a pause phase', () => {
        phase = {
          pause: 10,
        }
        expect(task.plan.impl.phaseDurationInSeconds(phase)).to.eql(phase.pause)
      })
      it('extracts the duration of a non-phase', () => {
        phase = {}
        expect(task.plan.impl.phaseDurationInSeconds(phase)).to.eql(-1)
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
        expect(task.plan.impl.scriptDurationInSeconds(script)).to.eql(-0)
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
        expect(task.plan.impl.scriptDurationInSeconds(script)).to.eql(-0)
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
        expect(task.plan.impl.scriptDurationInSeconds(script)).to.eql(-1)
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
        expect(task.plan.impl.scriptDurationInSeconds(script)).to.eql(-2)
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
        expect(task.plan.impl.scriptDurationInSeconds(script)).to.eql(-2)
      })
      it('correctly calculates the duration of a single-phase script', () => {
        script = {
          config: {
            phases: [
              { duration: 10 },
            ],
          },
        }
        expect(task.plan.impl.scriptDurationInSeconds(script)).to.eql(10)
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
        expect(task.plan.impl.scriptDurationInSeconds(script)).to.eql(6) // 1 + 2 + 3 = 6
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
        result = task.plan.impl.scriptDurationInSeconds(script)
        expect(result).to.equal(240)
      })
    })

    /**
     * SPLIT PHASE BY DurationInSeconds
     */
    describe('#splitPhaseByDurationInSeconds splits PHASES that are TOO LONG', () => {
      it('splitting a constant rate phase of three chunk\'s durationInSeconds into two parts.', () => {
        phase = {
          duration: 3 * defaultSettings.maxChunkDurationInSeconds,
          arrivalRate: 1,
        }
        expected = {
          chunk: {
            duration: defaultSettings.maxChunkDurationInSeconds,
            arrivalRate: 1,
          },
          remainder: {
            duration: 2 * defaultSettings.maxChunkDurationInSeconds,
            arrivalRate: 1,
          },
        }
        result = task.plan.impl.splitPhaseByDurationInSeconds(phase, defaultSettings.maxChunkDurationInSeconds)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a ramping phase of two chunk\'s duration into two parts.', () => {
        phase = {
          duration: 3 * defaultSettings.maxChunkDurationInSeconds,
          arrivalRate: 1,
          rampTo: 4,
        }
        expected = {
          chunk: {
            duration: defaultSettings.maxChunkDurationInSeconds,
            arrivalRate: 1,
            rampTo: 2,
          },
          remainder: {
            duration: 2 * defaultSettings.maxChunkDurationInSeconds,
            arrivalRate: 2,
            rampTo: 4,
          },
        }
        result = task.plan.impl.splitPhaseByDurationInSeconds(phase, defaultSettings.maxChunkDurationInSeconds)
        expect(result).to.deep.equal(expected)
      })
      it('splits ramp of two chunk\'s duration into two parts, rounding to the nearest integer rate per second.', () => {
        phase = {
          duration: 2 * defaultSettings.maxChunkDurationInSeconds,
          arrivalRate: 1,
          rampTo: 2,
        }
        expected = {
          chunk: {
            duration: defaultSettings.maxChunkDurationInSeconds,
            arrivalRate: 1,
            rampTo: 2,
          },
          remainder: {
            duration: defaultSettings.maxChunkDurationInSeconds,
            arrivalRate: 2,
            rampTo: 2,
          },
        }
        result = task.plan.impl.splitPhaseByDurationInSeconds(phase, defaultSettings.maxChunkDurationInSeconds)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an arrival count phase of two chunk\'s duration into two parts.', () => {
        phase = {
          duration: 2 * defaultSettings.maxChunkDurationInSeconds,
          arrivalCount: 2 * defaultSettings.maxChunkDurationInSeconds,
        }
        expected = {
          chunk: {
            duration: defaultSettings.maxChunkDurationInSeconds,
            arrivalCount: defaultSettings.maxChunkDurationInSeconds,
          },
          remainder: {
            duration: defaultSettings.maxChunkDurationInSeconds,
            arrivalCount: defaultSettings.maxChunkDurationInSeconds,
          },
        }
        result = task.plan.impl.splitPhaseByDurationInSeconds(phase, defaultSettings.maxChunkDurationInSeconds)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a pause phase of two chunk\'s duration into two parts.', () => {
        phase = {
          pause: 2 * defaultSettings.maxChunkDurationInSeconds,
        }
        expected = {
          chunk: {
            pause: defaultSettings.maxChunkDurationInSeconds,
          },
          remainder: {
            pause: defaultSettings.maxChunkDurationInSeconds,
          },
        }
        result = task.plan.impl.splitPhaseByDurationInSeconds(phase, defaultSettings.maxChunkDurationInSeconds)
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
                duration: defaultSettings.maxChunkDurationInSeconds,
                arrivalRate: 1,
              },
              {
                duration: defaultSettings.maxChunkDurationInSeconds,
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
                  duration: defaultSettings.maxChunkDurationInSeconds,
                  arrivalRate: 1,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: defaultSettings.maxChunkDurationInSeconds,
                  arrivalRate: 2,
                },
              ],
            },
          },
        }
        result = task.plan.impl.splitScriptByDurationInSeconds(script, defaultSettings.maxChunkDurationInSeconds)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a script where there is a natural phase split at MAX_CHUNK_DURATION between many phases.', () => {
        script = {
          config: {
            phases: [
              {
                duration: Math.floor(defaultSettings.maxChunkDurationInSeconds * 0.5),
                arrivalRate: 1,
              },
              {
                duration: Math.ceil(defaultSettings.maxChunkDurationInSeconds * 0.5),
                arrivalRate: 1,
              },
              {
                duration: Math.floor(defaultSettings.maxChunkDurationInSeconds * 0.5),
                arrivalRate: 1,
              },
              {
                duration: Math.ceil(defaultSettings.maxChunkDurationInSeconds * 0.5),
                arrivalRate: 1,
              },
              {
                duration: defaultSettings.maxChunkDurationInSeconds,
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
                  duration: Math.floor(defaultSettings.maxChunkDurationInSeconds * 0.5),
                  arrivalRate: 1,
                },
                {
                  duration: Math.ceil(defaultSettings.maxChunkDurationInSeconds * 0.5),
                  arrivalRate: 1,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: Math.floor(defaultSettings.maxChunkDurationInSeconds * 0.5),
                  arrivalRate: 1,
                },
                {
                  duration: Math.ceil(defaultSettings.maxChunkDurationInSeconds * 0.5),
                  arrivalRate: 1,
                },
                {
                  duration: defaultSettings.maxChunkDurationInSeconds,
                  arrivalRate: 2,
                },
              ],
            },
          },
        }
        result = task.plan.impl.splitScriptByDurationInSeconds(script, defaultSettings.maxChunkDurationInSeconds)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a script where a phase must be split at MAX_CHUNK_DURATION.', () => {
        script = {
          config: {
            phases: [
              {
                duration: Math.floor(defaultSettings.maxChunkDurationInSeconds * 0.75),
                arrivalRate: 1,
              },
              {
                duration: Math.ceil(defaultSettings.maxChunkDurationInSeconds * 0.75),
                arrivalRate: 1,
              },
              {
                duration: Math.floor(defaultSettings.maxChunkDurationInSeconds * 0.75),
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
                  duration: Math.floor(defaultSettings.maxChunkDurationInSeconds * 0.75),
                  arrivalRate: 1,
                },
                {
                  duration: Math.ceil(defaultSettings.maxChunkDurationInSeconds * 0.25),
                  arrivalRate: 1,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: Math.floor(defaultSettings.maxChunkDurationInSeconds * 0.5),
                  arrivalRate: 1,
                },
                {
                  duration: Math.ceil(defaultSettings.maxChunkDurationInSeconds * 0.75),
                  arrivalRate: 1,
                },
              ],
            },
          },
        }
        result = task.plan.impl.splitScriptByDurationInSeconds(script, defaultSettings.maxChunkDurationInSeconds)
        expect(result).to.deep.equal(expected)
      })
      it('removes the scheduled execution time for the remainder of a given script', () => {
        script = {
          _start: Date.now(),
          config: {
            phases: [
              {
                duration: defaultSettings.maxChunkDurationInSeconds * 5,
                arrivalRate: 1,
              },
            ],
          },
        }
        result = task.plan.impl.splitScriptByDurationInSeconds(script, defaultSettings.maxChunkDurationInSeconds)
        expect(result.remainder._start).to.be.undefined // eslint-disable-line no-underscore-dangle
      })
    })

    // ##############
    // ## REQUESTS ##
    // ##############
    describe('#phaseRequestsPerSecond', () => {
      it('calculates the arrivals per second specified in an ascending rampTo phase', () => {
        phase = { arrivalRate: 10, rampTo: 20 }
        expect(task.plan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second specified in an descending rampTo phase', () => {
        phase = { arrivalRate: 20, rampTo: 10 }
        expect(task.plan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a constant rate phase', () => {
        phase = { arrivalRate: 20 }
        expect(task.plan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a constant count phase', () => {
        phase = { arrivalCount: 20, duration: 1 }
        expect(task.plan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a pause phase', () => {
        phase = { pause: 1 }
        expect(task.plan.impl.phaseRequestsPerSecond(phase)).to.eql(0)
      })
      it('returns -1 to indicate an invalid phase', () => {
        phase = {}
        expect(task.plan.impl.phaseRequestsPerSecond(phase)).to.eql(-1)
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
        expect(task.plan.impl.scriptRequestsPerSecond(script)).to.eql(-0)
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
        expect(task.plan.impl.scriptRequestsPerSecond(script)).to.eql(-0)
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
        expect(task.plan.impl.scriptRequestsPerSecond(script)).to.eql(-1)
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
        expect(task.plan.impl.scriptRequestsPerSecond(script)).to.eql(-2)
      })
      it('correctly calculates the arrivals per second of a single-phase script', () => {
        script = {
          config: {
            phases: [
              { arrivalRate: 1 },
            ],
          },
        }
        expect(task.plan.impl.scriptRequestsPerSecond(script)).to.eql(1)
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
        expect(task.plan.impl.scriptRequestsPerSecond(script)).to.eql(5)
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
        expect(() => task.plan.impl.intersection(phase, 1))
          .to.throw(Error, 'Parallel lines never intersect, detect and avoid this case')
      })
    })

    /**
     * SPLIT PHASE BY RequestsPerSecond
     */
    describe('#splitPhaseByRequestsPerSecond The handler splits PHASES that are TOO WIDE (RPS > MAX_RPS)', () => {
      it('deletes unnecessary rampTo specifications (they are constant arrivalRate phases)', () => {
        phase = { arrivalRate: 2, rampTo: 2 }
        task.plan.impl.splitPhaseByRequestsPerSecond(phase, 1)
        expect(phase.rampTo).to.be.undefined
      })
      // min >= chunkSize
      it('splitting a ramp phase that at all times exceeds a rate of DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a' +
        ' constant rate and remainder ramp phases.', () => {
        phase = {
          arrivalRate: defaultSettings.maxChunkRequestsPerSecond * 2,
          rampTo: defaultSettings.maxChunkRequestsPerSecond * 3,
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
              duration: 1,
            },
          ],
          remainder: [
            {
              arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
              rampTo: defaultSettings.maxChunkRequestsPerSecond * 2,
              duration: 1,
            },
          ],
        }
        result = task.plan.impl.splitPhaseByRequestsPerSecond(phase, defaultSettings.maxChunkRequestsPerSecond)
        expect(result).to.deep.equal(expected)
      })
      // max <= chunkSize
      it('splitting ramp that at all times is less than DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of the ramp' +
        ' phase and a remainder of a pause phase.', () => {
        phase = {
          arrivalRate: Math.floor(defaultSettings.maxChunkRequestsPerSecond * 0.5),
          rampTo: Math.floor(defaultSettings.maxChunkRequestsPerSecond * 0.75),
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalRate: Math.floor(defaultSettings.maxChunkRequestsPerSecond * 0.5),
              rampTo: Math.floor(defaultSettings.maxChunkRequestsPerSecond * 0.75),
              duration: 1,
            },
          ],
          remainder: [
            {
              pause: 1,
            },
          ],
        }
        result = task.plan.impl.splitPhaseByRequestsPerSecond(phase, defaultSettings.maxChunkRequestsPerSecond)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an ascending ramp phase that starts lower than and ends higher than' +
        ' DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of a ramp phase followed by a constant rate phase and a' +
        ' remainder of a pause phase followed by a ramp phase.', () => {
        phase = {
          arrivalRate: defaultSettings.maxChunkRequestsPerSecond * 0.5,
          rampTo: defaultSettings.maxChunkRequestsPerSecond * 1.5,
          duration: 2,
        }
        expected = {
          chunk: [
            {
              arrivalRate: phase.arrivalRate,
              rampTo: defaultSettings.maxChunkRequestsPerSecond,
              duration: 1,
            },
            {
              arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
              duration: 1,
            },
          ],
          remainder: [
            {
              pause: 1,
            },
            {
              arrivalRate: 1,
              rampTo: (defaultSettings.maxChunkRequestsPerSecond * 1.5) - defaultSettings.maxChunkRequestsPerSecond, // eslint-disable-line max-len
              duration: 1,
            },
          ],
        }
        result = task.plan.impl.splitPhaseByRequestsPerSecond(phase, defaultSettings.maxChunkRequestsPerSecond)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a descending ramp phase that starts lower than and ends higher than' +
        ' DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of a constant rate phase followed by a ramp phase and a' +
        ' remainder of a ramp phase followed by a pause phase.', () => {
        phase = {
          arrivalRate: defaultSettings.maxChunkRequestsPerSecond * 1.5,
          rampTo: defaultSettings.maxChunkRequestsPerSecond * 0.5,
          duration: 2,
        }
        expected = {
          chunk: [
            {
              arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
              duration: 1,
            },
            {
              arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
              rampTo: phase.rampTo,
              duration: 1,
            },
          ],
          remainder: [
            {
              arrivalRate: phase.arrivalRate - defaultSettings.maxChunkRequestsPerSecond,
              rampTo: 1,
              duration: 1,
            },
            {
              pause: 1,
            },
          ],
        }
        result = task.plan.impl.splitPhaseByRequestsPerSecond(phase, defaultSettings.maxChunkRequestsPerSecond)
        expect(result).to.deep.equal(expected)
      })
      it('splits an arrivalRate of less than a chunk\'s requestsPerSecond into a chunk of that requestsPerSecond and remainder of pause', () => {
        phase = {
          arrivalRate: defaultSettings.maxChunkRequestsPerSecond * 0.75,
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
        result = task.plan.impl.splitPhaseByRequestsPerSecond(phase, defaultSettings.maxChunkRequestsPerSecond)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an arrivalRate phase of two chunk\'s requestsPerSecond into two parts.', () => {
        phase = {
          arrivalRate: defaultSettings.maxChunkRequestsPerSecond * 2,
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
              duration: 1,
            },
          ],
          remainder: [
            {
              arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
              duration: 1,
            },
          ],
        }
        result = task.plan.impl.splitPhaseByRequestsPerSecond(phase, defaultSettings.maxChunkRequestsPerSecond)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an arrivalCount phase of two chunk\'s requestsPerSecond into two parts.', () => {
        phase = {
          arrivalCount: defaultSettings.maxChunkRequestsPerSecond * 2,
          duration: 1,
        }
        expected = {
          chunk: [
            {
              arrivalCount: defaultSettings.maxChunkRequestsPerSecond,
              duration: 1,
            },
          ],
          remainder: [
            {
              arrivalCount: defaultSettings.maxChunkRequestsPerSecond,
              duration: 1,
            },
          ],
        }
        result = task.plan.impl.splitPhaseByRequestsPerSecond(phase, defaultSettings.maxChunkRequestsPerSecond)
        expect(result).to.deep.equal(expected)
      })
      it('splitting an arrivalCount phase of less than chunkSize\'s requestsPerSecond into an arrival count and pause phase.', () => {
        phase = {
          arrivalCount: defaultSettings.maxChunkRequestsPerSecond * 0.75,
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
        result = task.plan.impl.splitPhaseByRequestsPerSecond(phase, defaultSettings.maxChunkRequestsPerSecond)
        expect(result).to.deep.equal(expected)
      })
      it('splitting a pause phase into two pause phases.', () => {
        phase = {
          pause: defaultSettings.maxChunkDurationInSeconds,
        }
        expected = {
          chunk: [
            { pause: defaultSettings.maxChunkDurationInSeconds },
          ],
          remainder: [
            { pause: defaultSettings.maxChunkDurationInSeconds },
          ],
        }
        result = task.plan.impl.splitPhaseByRequestsPerSecond(phase, defaultSettings.maxChunkRequestsPerSecond)
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
                arrivalRate: defaultSettings.maxChunkRequestsPerSecond * 2,
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
                  arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: 1,
                  arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
                },
              ],
            },
          },
        }
        result = task.plan.impl.splitScriptByRequestsPerSecond(script, defaultSettings.maxChunkRequestsPerSecond)
        expect(result).to.deep.equal(expected)
      })
      it('splits a script of two phases that specify twice DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND load to split.', () => {
        script = {
          config: {
            phases: [
              {
                duration: 1,
                arrivalRate: defaultSettings.maxChunkRequestsPerSecond * 2,
              },
              {
                duration: 1,
                arrivalRate: defaultSettings.maxChunkRequestsPerSecond * 2,
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
                  arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
                },
                {
                  duration: 1,
                  arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
                },
              ],
            },
          },
          remainder: {
            config: {
              phases: [
                {
                  duration: 1,
                  arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
                },
                {
                  duration: 1,
                  arrivalRate: defaultSettings.maxChunkRequestsPerSecond,
                },
              ],
            },
          },
        }
        result = task.plan.impl.splitScriptByRequestsPerSecond(script, defaultSettings.maxChunkRequestsPerSecond)
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
        splitScriptByDurationInSecondsStub = sinon.stub(task.plan.impl, 'splitScriptByDurationInSeconds').returns({ chunk, remainder })
      })
      afterEach(() => {
        splitScriptByDurationInSecondsStub.restore()
      })
      it('maintains existing start times for a script chunk in any mode, including standard mode', () => {
        chunk._start = 1
        result = task.plan.impl.splitScriptByDurationInSecondsAndSchedule(2, script, defaultSettings)
        expect(result.chunk._start).to.equal(1)
      })
      it('always resets start times for a script reaminder in any mode, including trace mode', () => {
        chunk._start = 1
        remainder._start = 1
        script._trace = true
        result = task.plan.impl.splitScriptByDurationInSecondsAndSchedule(2, script, defaultSettings)
        expect(result.remainder._start).to.equal(1 + (defaultSettings.maxChunkDurationInSeconds * 1000))
      })
      it('sets start times for script chunks and reaminders if none is given', () => {
        result = task.plan.impl.splitScriptByDurationInSecondsAndSchedule(1, script, defaultSettings)
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
        splitScriptByRequestsPerSecondStub = sinon.stub(task.plan.impl, 'splitScriptByRequestsPerSecond').returns({ chunk, remainder })
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
        result = task.plan.impl.splitScriptByRequestsPerSecondAndSchedule(timeNow, script, defaultSettings)
      })
      it('maintains existing start times for a script chunk in any mode, including standard mode', () => {
        timeNow = 2
        script._start = 1
        chunk._start = 1
        remainder._start = 1
        result = task.plan.impl.splitScriptByRequestsPerSecondAndSchedule(timeNow, script, defaultSettings)
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
        result = task.plan.impl.splitScriptByRequestsPerSecondAndSchedule(timeNow, script, defaultSettings)
        expect(script._start).to.equal(timeNow + defaultSettings.timeBufferInMilliseconds)
        expect(result.length).to.equal(2)
        result.forEach((part) => {
          expect(part._start).to.equal(timeNow + defaultSettings.timeBufferInMilliseconds)
        })
      })
    })

    // ######################
    // ## SERVICE SAMPLING ##
    // ######################
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
        const scripts = task.plan.impl.splitScriptByFlow(newScript, runOnceSettings)
        expect(scripts).to.deep.equal([
          {
            mode: 'perf',
            config: {
              target: 'https://aws.amazon.com',
              phases: [
                { pause: scripts[0].config.phases[0].pause },
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
        const scripts = task.plan.impl.splitScriptByFlow(newScript, runOnceSettings)
        expect(scripts).to.deep.equal([
          {
            mode: 'perf',
            config: {
              target: 'https://aws.amazon.com',
              phases: [
                { pause: scripts[0].config.phases[0].pause },
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
                { pause: scripts[1].config.phases[0].pause },
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
      it('generates unique pause lengths for each flow script', () => {
        const newScript = {
          mode: 'acc',
          sampling: {
            size: 1,
          },
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
            {
              flow: [
                { get: { url: '/3' } },
              ],
            },
            {
              flow: [
                { get: { url: '/4' } },
              ],
            },
          ],
        }
        result = task.plan.impl.splitScriptByFlow(newScript, runOnceSettings)
        const pauses = result.map(scriptChunk => scriptChunk.config.phases[0].pause)
        let equalities = 0
        pauses.forEach((pause, index) => {
          pauses.slice(index + 1).forEach((value) => {
            if (pause === value) {
              equalities += 1
            }
          })
        })
        expect(equalities).to.be.below(2) // allow one because randomness, probability of two is miniscule
      })
    })

    describe('#generateSamplingPhases', () => {
      it('uses the given sampling configuration to generate phases', () => {
        const sampling = {
          size: 1000,
          averagePause: 5,
          pauseVariance: 1,
        }
        result = task.plan.impl.generateSamplingPhases({ task: { sampling } })
        expect(result.length).to.equal(sampling.size * 2)
        expect(result.filter(chunkPhase => // filter for any pauses with a pause value outside of [avgPause - pauseVar, avgPause + pauseVar]
          'pause' in chunkPhase &&
          (
            chunkPhase.pause < sampling.averagePause - sampling.pauseVariance ||
            chunkPhase.pause > sampling.averagePause + sampling.pauseVariance
          ) // eslint-disable-line comma-dangle
        ).length).to.equal(0)
        expect(result.filter( // filter for any sample phases specifying more than one arrival
          chunkPhase => (
            !('pause' in chunkPhase) &&
            (chunkPhase.duration !== 1 || chunkPhase.arrivalRate !== 1)) // eslint-disable-line comma-dangle
        ).length).to.equal(0)
      })
    })

    // ##############
    // ## PLANNING ##
    // ##############
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
        splitScriptByDurationInSecondsAndScheduleStub = sinon.stub(task.plan.impl, 'splitScriptByDurationInSecondsAndSchedule').returns({ chunk, remainder })
        splitScriptByRequestsPerSecondAndScheduleStub = sinon.stub(task.plan.impl, 'splitScriptByRequestsPerSecondAndSchedule').returns([chunk, remainder])
      })
      afterEach(() => {
        splitScriptByDurationInSecondsAndScheduleStub.restore()
        splitScriptByRequestsPerSecondAndScheduleStub.restore()
      })
      it('returns the given script in an array if that script is within limits', () => {
        result = task.plan.impl.planPerformance(1, script, defaultSettings)
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.not.have.been.called
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.not.have.been.called
        expect(result.length).to.equal(1)
        expect(result[0]).to.equal(script)
      })
      it('splits a script with a duration that is greater than the given limits', () => {
        script.config.phases[0].duration = defaultSettings.maxChunkDurationInSeconds + 1
        result = task.plan.impl.planPerformance(1, script, defaultSettings)
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.have.been.calledOnce
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.have.been.calledWithExactly(1, script, defaultSettings)
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.not.have.been.called
        expect(result.length).to.equal(2)
      })
      it('splits a script with a requests per second that are greater than the given limits', () => {
        script.config.phases[0].arrivalRate = defaultSettings.maxChunkRequestsPerSecond + 1
        result = task.plan.impl.planPerformance(1, script, defaultSettings)
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
        result = task.plan.impl.planPerformance(1, script, defaultSettings)
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.have.been.calledOnce
        expect(splitScriptByDurationInSecondsAndScheduleStub).to.have.been.calledWithExactly(1, script, defaultSettings)
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.have.been.calledOnce
        expect(splitScriptByRequestsPerSecondAndScheduleStub).to.have.been.calledWithExactly(1, chunk, defaultSettings)
        expect(result.length).to.equal(3)
      })
    })

    describe('#planSamples', () => {
      let splitScriptByFlowStub
      beforeEach(() => {
        splitScriptByFlowStub = sinon.stub(task.plan.impl, 'splitScriptByFlow').returns()
      })
      afterEach(() => {
        splitScriptByFlowStub.restore()
      })
      it('adds _start and _invokeType to the given event', () => {
        script = {}
        task.plan.impl.planSamples(1, script, runOnceSettings)
        expect(script._start).to.equal(1)
        expect(script._invokeType).to.eql('RequestResponse')
        expect(splitScriptByFlowStub).to.have.been.calledWithExactly(script, runOnceSettings)
      })
    })

    describe('#planTask', () => {
      let planSamplesStub
      let planPerformanceStub
      beforeEach(() => {
        planSamplesStub = sinon.stub(task.plan.impl, 'planSamples').returns()
        planPerformanceStub = sinon.stub(task.plan.impl, 'planPerformance').returns()
      })
      afterEach(() => {
        planSamplesStub.restore()
        planPerformanceStub.restore()
      })
      it('detects the lack of mode and calls planPerformance', () => {
        script = {}
        task.plan.impl.planTask(1, script, defaultSettings)
        expect(planSamplesStub).to.not.have.been.called
        expect(planPerformanceStub).to.have.been.calledOnce
      })
      it(`detects mode "${task.def.modes.PERF}" and calls planPerformance`, () => {
        script = { mode: task.def.modes.PERF }
        task.plan.impl.planTask(1, script, defaultSettings)
        expect(planSamplesStub).to.not.have.been.called
        expect(planPerformanceStub).to.have.been.calledOnce
      })
      it(`detects mode "${task.def.modes.PERFORMANCE}" and calls planPerformance`, () => {
        script = { mode: task.def.modes.PERFORMANCE }
        task.plan.impl.planTask(1, script, defaultSettings)
        expect(planSamplesStub).to.not.have.been.called
        expect(planPerformanceStub).to.have.been.calledOnce
      })
      it(`detects mode "${task.def.modes.ACC}" and calls planSamples with sampleWithAcceptanceDefaults`, () => {
        script = { mode: task.def.modes.ACC }
        task.plan.impl.planTask(1, script, defaultSettings)
        expect(planSamplesStub).to.have.been.calledOnce
        expect(planSamplesStub.args[0][2]).to.equal(defaultSettings)
        expect(planPerformanceStub).to.not.have.been.called
      })
      it(`detects mode "${task.def.modes.ACCEPTANCE}" and calls planSamples with sampleWithAcceptanceDefaults`, () => {
        script = { mode: task.def.modes.ACCEPTANCE }
        task.plan.impl.planTask(1, script, defaultSettings)
        expect(planSamplesStub).to.have.been.calledOnce
        expect(planSamplesStub.args[0][2]).to.equal(defaultSettings)
        expect(planPerformanceStub).to.not.have.been.called
      })
      it(`detects mode "${task.def.modes.MON}" and calls planSamples with sampleWithMonitoringDefaults`, () => {
        script = { mode: task.def.modes.MON }
        task.plan.impl.planTask(1, script, defaultSettings)
        expect(planSamplesStub).to.have.been.calledOnce
        expect(planSamplesStub.args[0][2]).to.equal(defaultSettings)
        expect(planPerformanceStub).to.not.have.been.called
      })
      it(`detects mode "${task.def.modes.MONITORING}" and calls planSamples with sampleWithMonitoringDefaults`, () => {
        script = { mode: task.def.modes.MONITORING }
        task.plan.impl.planTask(1, script, defaultSettings)
        expect(planSamplesStub).to.have.been.calledOnce
        expect(planSamplesStub.args[0][2]).to.equal(defaultSettings)
        expect(planPerformanceStub).to.not.have.been.called
      })
    })

    describe('#whole script planning tests', () => {
      it('correctly calculates a large ramp down', () => {
        script = { config: { phases: [{ duration: 900, arrivalRate: 200, rampTo: 1 }] } }
        expected = [
          { config: { phases: [{ duration: 780, arrivalRate: 173, rampTo: 1 }] }, _genesis: 0, _start: 135000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 15000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 15000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 15000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 15000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 15000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 15000 },
          { config: { phases: [{ duration: 111, arrivalRate: 25 }, { duration: 9, arrivalRate: 25, rampTo: 23 }] }, _genesis: 0, _start: 15000 },
          { config: { phases: [{ duration: 111, arrivalRate: 25, rampTo: 1 }, { pause: 9 }] }, _genesis: 0, _start: 15000 },
        ]
        // Split #1
        result = task.plan.impl.planTask(0, script, defaultSettings)
        expect(result).to.be.eql(expected)
        expected = [
          { config: { phases: [{ duration: 660, arrivalRate: 147, rampTo: 1 }] }, _genesis: 0, _start: 255000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 135000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 135000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 135000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 135000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 135000 },
          { config: { phases: [{ duration: 106, arrivalRate: 25 }, { duration: 14, arrivalRate: 25, rampTo: 22 }] }, _genesis: 0, _start: 135000 },
          { config: { phases: [{ duration: 106, arrivalRate: 23, rampTo: 1 }, { pause: 14 }] }, _genesis: 0, _start: 135000 },
        ]
        // Split #2
        result = task.plan.impl.planTask(result[1]._start, result[0], defaultSettings)
        expect(result).to.be.eql(expected)
        expected = [
          { config: { phases: [{ duration: 540, arrivalRate: 120, rampTo: 1 }] }, _genesis: 0, _start: 375000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 255000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 255000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 255000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 255000 },
          { config: { phases: [{ duration: 98, arrivalRate: 25 }, { duration: 22, arrivalRate: 25, rampTo: 20 }] }, _genesis: 0, _start: 255000 },
          { config: { phases: [{ duration: 98, arrivalRate: 22, rampTo: 1 }, { pause: 22 }] }, _genesis: 0, _start: 255000 },
        ]
        // Split #3
        result = task.plan.impl.planTask(result[1]._start, result[0], defaultSettings)
        expect(result).to.be.eql(expected)
        expected = [
          { config: { phases: [{ duration: 420, arrivalRate: 94, rampTo: 1 }] }, _genesis: 0, _start: 495000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 375000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 375000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 375000 },
          { config: { phases: [{ duration: 92, arrivalRate: 25 }, { duration: 28, arrivalRate: 25, rampTo: 19 }] }, _genesis: 0, _start: 375000 },
          { config: { phases: [{ duration: 92, arrivalRate: 20, rampTo: 1 }, { pause: 28 }] }, _genesis: 0, _start: 375000 },
        ]
        // Split #4
        result = task.plan.impl.planTask(result[1]._start, result[0], defaultSettings)
        expect(result).to.be.eql(expected)
        expected = [
          { config: { phases: [{ duration: 300, arrivalRate: 67, rampTo: 1 }] }, _genesis: 0, _start: 615000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 495000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 495000 },
          { config: { phases: [{ duration: 84, arrivalRate: 25 }, { duration: 36, arrivalRate: 25, rampTo: 17 }] }, _genesis: 0, _start: 495000 },
          { config: { phases: [{ duration: 84, arrivalRate: 19, rampTo: 1 }, { pause: 36 }] }, _genesis: 0, _start: 495000 },
        ]
        // Split #5
        result = task.plan.impl.planTask(result[1]._start, result[0], defaultSettings)
        expect(result).to.be.eql(expected)
        expected = [
          { config: { phases: [{ duration: 180, arrivalRate: 41, rampTo: 1 }] }, _genesis: 0, _start: 735000 },
          { config: { phases: [{ duration: 120, arrivalRate: 25 }] }, _genesis: 0, _start: 615000 },
          { config: { phases: [{ duration: 78, arrivalRate: 25 }, { duration: 42, arrivalRate: 25, rampTo: 16 }] }, _genesis: 0, _start: 615000 },
          { config: { phases: [{ duration: 78, arrivalRate: 17, rampTo: 1 }, { pause: 42 }] }, _genesis: 0, _start: 615000 },
        ]
        // Split #6
        result = task.plan.impl.planTask(result[1]._start, result[0], defaultSettings)
        expect(result).to.be.eql(expected)
        expected = [
          { config: { phases: [{ duration: 60, arrivalRate: 14, rampTo: 1 }] }, _genesis: 0, _start: 855000 },
          { config: { phases: [{ duration: 71, arrivalRate: 25 }, { duration: 49, arrivalRate: 25, rampTo: 14 }] }, _genesis: 0, _start: 735000 },
          { config: { phases: [{ duration: 71, arrivalRate: 16, rampTo: 1 }, { pause: 49 }] }, _genesis: 0, _start: 735000 },
        ]
        // Split #7
        result = task.plan.impl.planTask(result[1]._start, result[0], defaultSettings)
        expect(result).to.be.eql(expected)
        expected = [
          { config: { phases: [{ duration: 60, arrivalRate: 14, rampTo: 1 }] }, _genesis: 0, _start: 855000 },
        ]
        // Split #8
        result = task.plan.impl.planTask(result[1]._start, result[0], defaultSettings)
        expect(result).to.be.eql(expected)
      })
    })
  })
})
