const chai = require('chai')
const path = require('path')

const expect = chai.expect

// eslint-disable-next-line import/no-dynamic-require
const handler = require(path.join('..', '..', '..', 'lib', 'lambda', 'handler.js'))
// eslint-disable-next-line import/no-dynamic-require
const taskPlan = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskPlan.js'))

let script
let phase
let result
let expected

describe('./lib/lambda/taskPlan.js', () => {
  describe(':impl', () => {
    describe('#phaseDurationInSeconds', () => {
      it('extracts the duration of a constant rate phase', () => {
        phase = {
          duration: 10,
          arrivalRate: 10,
        }
        expect(taskPlan.impl.phaseDurationInSeconds(phase)).to.eql(phase.duration)
      })
      it('extracts the duration of a ramp to phase', () => {
        phase = {
          duration: 10,
          arrivalRate: 10,
          rampTo: 20,
        }
        expect(taskPlan.impl.phaseDurationInSeconds(phase)).to.eql(phase.duration)
      })
      it('extracts the duration of a pause phase', () => {
        phase = {
          pause: 10,
        }
        expect(taskPlan.impl.phaseDurationInSeconds(phase)).to.eql(phase.pause)
      })
      it('extracts the duration of a non-phase', () => {
        phase = {}
        expect(taskPlan.impl.phaseDurationInSeconds(phase)).to.eql(-1)
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
        expect(taskPlan.impl.scriptDurationInSeconds(script)).to.eql(-0)
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
        expect(taskPlan.impl.scriptDurationInSeconds(script)).to.eql(-0)
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
        expect(taskPlan.impl.scriptDurationInSeconds(script)).to.eql(-1)
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
        expect(taskPlan.impl.scriptDurationInSeconds(script)).to.eql(-2)
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
        expect(taskPlan.impl.scriptDurationInSeconds(script)).to.eql(-2)
      })
      it('correctly calculates the duration of a single-phase script', () => {
        script = {
          config: {
            phases: [
              { duration: 10 },
            ],
          },
        }
        expect(taskPlan.impl.scriptDurationInSeconds(script)).to.eql(10)
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
        expect(taskPlan.impl.scriptDurationInSeconds(script)).to.eql(6) // 1 + 2 + 3 = 6
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
        result = taskPlan.impl.scriptDurationInSeconds(script)
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
        result = taskPlan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = taskPlan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = taskPlan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = taskPlan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = taskPlan.impl.splitPhaseByDurationInSeconds(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = taskPlan.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = taskPlan.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
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
        result = taskPlan.impl.splitScriptByDurationInSeconds(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS)
        expect(result).to.deep.equal(expected)
      })
    })

    describe('#phaseRequestsPerSecond', () => {
      it('calculates the arrivals per second specified in an ascending rampTo phase', () => {
        phase = { arrivalRate: 10, rampTo: 20 }
        expect(taskPlan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second specified in an descending rampTo phase', () => {
        phase = { arrivalRate: 20, rampTo: 10 }
        expect(taskPlan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a constant rate phase', () => {
        phase = { arrivalRate: 20 }
        expect(taskPlan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a constant count phase', () => {
        phase = { arrivalCount: 20, duration: 1 }
        expect(taskPlan.impl.phaseRequestsPerSecond(phase)).to.eql(20)
      })
      it('calculates the arrivals per second in a pause phase', () => {
        phase = { pause: 1 }
        expect(taskPlan.impl.phaseRequestsPerSecond(phase)).to.eql(0)
      })
      it('returns -1 to indicate an invalid phase', () => {
        phase = {}
        expect(taskPlan.impl.phaseRequestsPerSecond(phase)).to.eql(-1)
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
        expect(taskPlan.impl.scriptRequestsPerSecond(script)).to.eql(-0)
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
        expect(taskPlan.impl.scriptRequestsPerSecond(script)).to.eql(-0)
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
        expect(taskPlan.impl.scriptRequestsPerSecond(script)).to.eql(-1)
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
        expect(taskPlan.impl.scriptRequestsPerSecond(script)).to.eql(-2)
      })
      it('correctly calculates the arrivals per second of a single-phase script', () => {
        script = {
          config: {
            phases: [
              { arrivalRate: 1 },
            ],
          },
        }
        expect(taskPlan.impl.scriptRequestsPerSecond(script)).to.eql(1)
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
        expect(taskPlan.impl.scriptRequestsPerSecond(script)).to.eql(5)
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
        result = taskPlan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitPhaseByRequestsPerSecond(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitScriptByRequestsPerSecond(script, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
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
        result = taskPlan.impl.splitScriptByRequestsPerSecond(script, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND)
        expect(result).to.deep.equal(expected)
      })
    })

    describe('#planTask', () => {
      // /**
      //  * An expanded artillery script chunk (see https://artillery.io/docs/)
      //  * @typedef {Object} ScriptChunk
      //  * @property number _start The time at which the script is to be executed.
      //  */
      // /**
      //  * Plan the execution of the given script.
      //  * @param timeNow The time that the current execution started at, used as an identity for tracing and scheduling purposes.
      //  * @param event The event, containing an artillery script, to plan the execution of using the given settings.
      //  * @param settings The settings to use for planning the given task's execution.
      //  * @returns {ScriptChunk[]} An array of script chunks, each of which is a valid artillery script with a start time annotation.
      //  */
      // planTask: (timeNow, event, settings) => {
      //   ...
      // }
      it('', () => {
        // TODO implement tests
      })
    })
  })
})
