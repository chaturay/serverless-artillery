'use strict';

const expect = require('chai').expect;
const path = require('path');

// eslint-disable-next-line import/no-dynamic-require
const handler = require(path.join('..', '..', '..', 'lib', 'lambda', 'handler.js'));

let script;
let phase;
let result;
let expected;

describe('serverless-artillery Handler Tests', () => {
  describe('#impl.getSettings', () => {
    it('extracts the given settings', () => {
      script = {
        _split: {
          maxScriptDurationInSeconds: 1,
          maxChunkDurationInSeconds: 1,
          maxScriptRequestsPerSecond: 1,
          maxChunkRequestsPerSecond: 1,
          timeBufferInMilliseconds: 1,
        },
      };
      expect(handler.impl.getSettings(script)).to.eql(script._split); // eslint-disable-line no-underscore-dangle
    });
  });
  describe('#impl.phaseLength', () => {
    // /**
    //  * Obtain the duration of a phase in seconds.
    //  * @param phase The phase to obtain duration from.
    //  * @returns {number} The duration of the given phase in seconds.  If a duration cannot be obtained -1 is
    //  * returned.
    //  */
    // phaseLength: (phase) => {
    //   if ('duration' in phase) {
    //     return phase.duration;
    //   } else if ('pause' in phase) {
    //     return phase.pause;
    //   } else {
    //     return -1;
    //   }
    // }
    it('extracts the length of a duration phase', () => {
      // TODO implement tests
    });
  });
  describe('#impl.scriptLength', () => {
    // /**
    //  * Calculate the total duration of the Artillery script in seconds.  If a phase does not have a valid duration,
    //  * the index of that phase, multiplied by -1, will be returned.  This way a result less than zero result can
    //  * easily be differentiated from a valid duration and the offending phase can be identified.
    //  * @param script The script to identify a total duration for.
    //  * @returns {number} The total duration for the given script.  If any phases do not contain a valid duration,
    //  * the index of the first phase without a valid duration will be returned, multiplied by -1.
    //  */
    // scriptLength: (script) => {
    //   let ret = 0;
    //   let i;
    //   let phaseLength;
    //   for (i = 0; i < script.config.phases.length; i++) {
    //     phaseLength = impl.phaseLength(script.config.phases[i]);
    //     if (phaseLength < 0) {
    //       ret = -1 * i;
    //       break;
    //     } else {
    //       ret += phaseLength;
    //     }
    //   }
    //   return ret;
    // },
    it('', () => {
      // TODO implement tests
    });
  });
  describe('#impl.phaseWidth', () => {
    // /**
    //  * Obtain the specified requests per second of a phase.
    //  * @param phase The phase to obtain specified requests per second from.
    //  * @returns The specified requests per second of a phase.  If a valid specification is not available, -1 is
    //  * returned.
    //  */
    // phaseWidth: (phase) => {
    //   if ('rampTo' in phase && 'arrivalRate' in phase) {
    //     return Math.max(phase.arrivalRate, phase.rampTo);
    //   } else if ('arrivalRate' in phase) {
    //     return phase.arrivalRate;
    //   } else if ('arrivalCount' in phase && 'duration' in phase) {
    //     return phase.arrivalCount / phase.duration;
    //   } else if ('pause' in phase) {
    //     return 0;
    //   } else {
    //     return -1;
    //   }
    // },
    it('', () => {
      // TODO implement tests
    });
  });
  describe('#impl.scriptWidth', () => {
    // /**
    //  * Calculate the maximum width of a script in RPS.  If a phase does not have a valid width, the index of that
    //  * phase, multiplied by -1, will be returned.  This way a result less than zero result can easily be
    //  * differentiated from a valid width and the offending phase can be identified.
    //  *
    //  * @param script The script to identify a maximum width for.
    //  * @returns {number} The width of the script in RPS (Requests Per Second) or -1 if an invalid phase is
    //  * encountered.
    //  */
    // scriptWidth: (script) => {
    //   /*
    //    * See https://artillery.io/docs/script_reference.html#phases for phase types.
    //    *
    //    * The following was obtained 07/26/2016:
    //    * arrivalRate - specify the arrival rate of virtual users for a duration of time. - A linear “ramp” in arrival
    //    *      can be also be created with the rampTo option.                          // max(arrivalRate, rampTo) RPS
    //    * arrivalCount - specify the number of users to create over a period of time.  // arrivalCount/duration RPS
    //    * pause - pause and do nothing for a duration of time.                         // zero RPS
    //    */
    //   let ret = 0;
    //   let i;
    //   let phaseWidth;
    //   for (i = 0; i < script.config.phases.length; i++) {
    //     phaseWidth = impl.phaseWidth(script.config.phases[i]);
    //     if (phaseWidth < 0) {
    //       ret = -1 * i;
    //       break;
    //     } else {
    //       ret = Math.max(ret, phaseWidth);
    //     }
    //   }
    //   return ret;
    // },
    it('', () => {
      // TODO implement tests
    });
  });
  describe('#impl.', () => {
    it('', () => {
      // /**
      //  * Validate the given script
      //  * @param script The script given to the handler
      //  * @param context The handler's context
      //  * @param callback The callback to invoke with error or success
      //  * @returns {boolean} Whether the script was valid
      //  */
      // validScript: (script, context, callback) => {
      //   let ret = false;
      //   let scriptLength;
      //   let scriptWidth;
      //   const settings = impl.getSettings(script);
      //   // Splitting Settings [Optional]
      //   if (script._split && typeof script._split !== 'object') {
      //     callback('If specified, the "_split" attribute must contain an object');
      //   } else if (
      //     settings.maxChunkDurationInSeconds &&
      //     !(Number.isInteger(settings.maxChunkDurationInSeconds) &&
      //     settings.maxChunkDurationInSeconds > 0 &&
      //     settings.maxChunkDurationInSeconds <= constants.MAX_CHUNK_DURATION_IN_SECONDS)
      //   ) {
      //     callback('If specified the "_split.maxChunkDuration" attribute must be an integer inclusively between ' +
      //       `1 and ${constants.MAX_CHUNK_DURATION_IN_SECONDS}.`);
      //   } else if (
      //     settings.maxScriptDurationInSeconds &&
      //     !(Number.isInteger(settings.maxScriptDurationInSeconds) &&
      //     settings.maxScriptDurationInSeconds > 0 &&
      //     settings.maxScriptDurationInSeconds <= constants.MAX_SCRIPT_DURATION_IN_SECONDS)
      //   ) {
      //     callback('If specified the "_split.maxScriptDuration" attribute must be an integer inclusively between ' +
      //       `1 and ${constants.MAX_SCRIPT_DURATION_IN_SECONDS}.`);
      //   } else if (
      //     settings.maxChunkRequestsPerSecond &&
      //     !(Number.isInteger(settings.maxChunkRequestsPerSecond) &&
      //     settings.maxChunkRequestsPerSecond > 0 &&
      //     settings.maxChunkRequestsPerSecond <= constants.MAX_CHUNK_REQUESTS_PER_SECOND)
      //   ) {
      //     callback('If specified the "_split.maxChunkRequestsPerSecond" attribute must be an integer inclusively ' +
      //       `between 1 and ${constants.MAX_CHUNK_REQUESTS_PER_SECOND}.`);
      //   } else if (
      //     settings.maxScriptRequestsPerSecond &&
      //     !(Number.isInteger(settings.maxScriptRequestsPerSecond) &&
      //     settings.maxScriptRequestsPerSecond > 0 &&
      //     settings.maxScriptRequestsPerSecond <= constants.MAX_SCRIPT_REQUESTS_PER_SECOND)
      //   ) {
      //     callback('If specified the "_split.maxScriptRequestsPerSecond" attribute must be an integer inclusively ' +
      //       `between 1 and ${constants.MAX_SCRIPT_REQUESTS_PER_SECOND}.`);
      //   } else if (
      //     settings.timeBufferInMilliseconds &&
      //     !(Number.isInteger(settings.timeBufferInMilliseconds) &&
      //     settings.timeBufferInMilliseconds > 0 &&
      //     settings.timeBufferInMilliseconds <= constants.MAX_TIME_BUFFER_IN_MILLISECONDS)
      //   ) {
      //     callback('If specified the "_split.timeBufferInMilliseconds" attribute must be an integer inclusively ' +
      //       `between 1 and ${constants.MAX_TIME_BUFFER_IN_MILLISECONDS}.`);
      //   } else if ( // Validate the Phases
      //   !(script.config && Array.isArray(script.config.phases) && script.config.phases.length > 0) &&
      //   !(script.mode === constants.modes.ACC || script.mode === constants.modes.ACCEPTANCE)
      //   ) {
      //     callback('An Artillery script must contain at least one phase under the $.config.phases attribute which ' +
      //       `itself must be an Array unless mode attribute is specified to be ${constants.modes.ACCEPTANCE} or
      //   ${constants.modes.ACC}`);
      //   } else if (
      //     'mode' in script &&
      //     (
      //       !Object.keys(constants.modes).includes(script.mode.toUpperCase()) ||
      //       constants.modes[script.mode.toUpperCase()] !== script.mode
      //     )
      //   ) {
      //     callback(`If specified, the mode attribute must be one of "${
      //       Object
      //         .keys(constants.modes)
      //         .map(key => constants.modes[key])
      //         .join('", "')
      //       }"`);
      //   } else if (!(script.mode === constants.modes.ACC || script.mode === constants.modes.ACCEPTANCE)) {
      //     scriptLength = impl.scriptLength(script); // determine length and width
      //     scriptWidth = impl.scriptWidth(script);
      //     if (scriptLength < 0) {
      //       callback(`Every phase must have a valid duration.  Observed: ${
      //         JSON.stringify(script.config.phases[scriptLength * -1])
      //         }`);
      //     } else if (scriptLength > settings.maxScriptDurationInSeconds) {
      //       callback(`The total duration of all script phases cannot exceed ${settings.maxScriptDurationInSeconds}`);
      //     } else if (scriptWidth < 0) {
      //       callback(`Every phase must have a valid means to determine requests per second.  Observed: ${
      //         JSON.stringify(script.config.phases[scriptWidth * -1])
      //         }`);
      //     } else if (scriptWidth > settings.maxScriptRequestsPerSecond) {
      //       callback(`The maximum requests per second of any script phase cannot exceed ${
      //         settings.maxScriptRequestsPerSecond
      //         }`);
      //     } else {
      //       ret = true;
      //     }
      //   } else {
      //     ret = true;
      //   }
      //   return ret;
      // },
      // TODO implement tests
    });
  });
  /**
   * SPLIT PHASE BY LENGTH
   */
  describe('#impl.splitPhaseByLength splits PHASES that are TOO LONG', () => {
    it('splitting a constant rate phase of three chunk\'s length into two parts.', () => {
      phase = {
        duration: 3 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        arrivalRate: 1,
      };
      expected = {
        chunk: {
          duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          arrivalRate: 1,
        },
        remainder: {
          duration: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          arrivalRate: 1,
        },
      };
      result = handler.impl.splitPhaseByLength(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS);
      expect(result).to.deep.equal(expected);
    });
    it('splitting a ramping phase of two chunk\'s length into two parts.', () => {
      phase = {
        duration: 3 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        arrivalRate: 1,
        rampTo: 4,
      };
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
      };
      result = handler.impl.splitPhaseByLength(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS);
      expect(result).to.deep.equal(expected);
    });
    it('splits ramp of two chunk\'s length into two parts, rounding to the nearest integer rate per second.', () => {
      phase = {
        duration: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        arrivalRate: 1,
        rampTo: 2,
      };
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
      };
      result = handler.impl.splitPhaseByLength(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS);
      expect(result).to.deep.equal(expected);
    });
    it('splitting an arrival count phase of two chunk\'s length into two parts.', () => {
      phase = {
        duration: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        arrivalCount: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
      };
      expected = {
        chunk: {
          duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        },
        remainder: {
          duration: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
          arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        },
      };
      result = handler.impl.splitPhaseByLength(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS);
      expect(result).to.deep.equal(expected);
    });
    it('splitting a pause phase of two chunk\'s length into two parts.', () => {
      phase = {
        pause: 2 * handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
      };
      expected = {
        chunk: {
          pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        },
        remainder: {
          pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        },
      };
      result = handler.impl.splitPhaseByLength(phase, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS);
      expect(result).to.deep.equal(expected);
    });
  });
  /**
   * SPLIT SCRIPT BY LENGTH
   */
  describe('#impl.splitScriptByLength The handler splits SCRIPTS that are TOO LONG', () => {
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
      };
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
      };
      result = handler.impl.splitScriptByLength(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS);
      expect(result).to.deep.equal(expected);
    });
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
      };
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
      };
      result = handler.impl.splitScriptByLength(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS);
      expect(result).to.deep.equal(expected);
    });
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
      };
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
      };
      result = handler.impl.splitScriptByLength(script, handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS);
      expect(result).to.deep.equal(expected);
    });
  });
  /**
   * SPLIT PHASE BY WIDTH
   */
  describe('#impl.splitPhaseByWidth The handler splits PHASES that are TOO WIDE (RPS > MAX_RPS)', () => {
    // min >= chunkSize
    it('splitting a ramp phase that at all times exceeds a rate of DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a' +
      ' constant rate and remainder ramp phases.', () => {
      phase = {
        arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
        rampTo: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 3,
        duration: 1,
      };
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
      };
      result = handler.impl.splitPhaseByWidth(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
    // max <= chunkSize
    it('splitting ramp that at all times is less than DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of the ramp' +
      ' phase and a remainder of a pause phase.', () => {
      phase = {
        arrivalRate: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.5),
        rampTo: Math.floor(handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.75),
        duration: 1,
      };
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
      };
      result = handler.impl.splitPhaseByWidth(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
    it('splitting an ascending ramp phase that starts lower than and ends higher than' +
      ' DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of a ramp phase followed by a constant rate phase and a' +
      ' remainder of a pause phase followed by a ramp phase.', () => {
      phase = {
        arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.5,
        rampTo: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 1.5,
        duration: 2,
      };
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
      };
      result = handler.impl.splitPhaseByWidth(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
    it('splitting a descending ramp phase that starts lower than and ends higher than' +
      ' DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of a constant rate phase followed by a ramp phase and a' +
      ' remainder of a ramp phase followed by a pause phase.', () => {
      phase = {
        arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 1.5,
        rampTo: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.5,
        duration: 2,
      };
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
      };
      result = handler.impl.splitPhaseByWidth(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
    it('splits an arrivalRate of less than a chunk\'s width into a chunk of that width and remainder of pause', () => {
      phase = {
        arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.75,
        duration: 1,
      };
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
      };
      result = handler.impl.splitPhaseByWidth(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
    it('splitting an arrivalRate phase of two chunk\'s width into two parts.', () => {
      phase = {
        arrivalRate: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
        duration: 1,
      };
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
      };
      result = handler.impl.splitPhaseByWidth(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
    it('splitting an arrivalCount phase of two chunk\'s width into two parts.', () => {
      phase = {
        arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 2,
        duration: 1,
      };
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
      };
      result = handler.impl.splitPhaseByWidth(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
    it('splitting an arrivalCount phase of less than chunkSize\'s width into an arrival count and pause phase.', () => {
      phase = {
        arrivalCount: handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND * 0.75,
        duration: 1,
      };
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
      };
      result = handler.impl.splitPhaseByWidth(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
    it('splitting a pause phase into two pause phases.', () => {
      phase = {
        pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
      };
      expected = {
        chunk: [
          { pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS },
        ],
        remainder: [
          { pause: handler.constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS },
        ],
      };
      result = handler.impl.splitPhaseByWidth(phase, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
  });
  /**
   * SPLIT SCRIPT BY WIDTH
   */
  describe('#impl.splitScriptByWidth the handler splits SCRIPTS that are TOO WIDE', () => {
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
      };
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
      };
      result = handler.impl.splitScriptByWidth(script, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
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
      };
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
      };
      result = handler.impl.splitScriptByWidth(script, handler.constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND);
      expect(result).to.deep.equal(expected);
    });
  });

  describe('#impl.loadProcessor', () => {
    it('loads custom processor code based on script configuration', () => {
      const newScript = {
        config: {
          processor: `${__dirname}/customprocessor.js`,
        },
      };
      handler.impl.loadProcessor(newScript);
      expect(newScript.config.processor.testMethod()).to.equal('testValue');
    });
    it('does not attempt to reload a previously loaded processor', () => {
      const newScript = {
        config: {
          processor: {
            f: () => 'testValue',
          },
        },
      };
      handler.impl.loadProcessor(newScript);
      expect(newScript.config.processor.f()).to.equal('testValue');
    });
  });
  describe('#readPayload', () => {
    it('reads a single payload file.', () => {
      const newScript = {
        config: {
          payload: {
            path: path.join(__dirname, 'example.0.csv'),
          },
        },
      };
      const payload = handler.impl.readPayload(newScript);
      expect(payload).to.deep.equal([
        ['123456', 'John Doe'],
        ['234567', 'Jane Doe'],
        ['345678', 'Baby Doe'],
      ]);
    });
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
      };
      const payload = handler.impl.readPayload(newScript);
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
      ]);
    });
  });
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
      };
      const scripts = handler.impl.splitScriptByFlow(newScript);
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
      ]);
    });
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
      };
      const scripts = handler.impl.splitScriptByFlow(newScript);
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
      ]);
    });
  });

  describe('#impl.invokeSelf', () => {
    // /**
    //  * After executing the first job of a long running load test, wait the requested time delay before sending the
    //  * remaining jobs to a new Lambda for execution
    //  * @param timeDelay The amount of time to delay before sending the remaining jobs for execution
    //  * @param event The event containing the remaining jobs that is to be sent to the next Lambda
    //  * @param context The Lambda context for the job
    //  * @param callback The callback to notify errors and successful execution to
    //  * @param invocationType The lambda invocationType
    //  */
    // invokeSelf(timeDelay, event, context, callback, invocationType) {
    //   const exec = () => {
    //     try {
    //       if (event._simulation) {
    //         console.log('SIMULATION: self invocation.');
    //         impl.runPerformance(Date.now(), event, simulation.context, callback);
    //       } else {
    //         const params = {
    //           FunctionName: context.functionName,
    //           InvocationType: invocationType || 'Event',
    //           Payload: JSON.stringify(event),
    //         };
    //         if (process.env.SERVERLESS_STAGE) {
    //           params.FunctionName += `:${process.env.SERVERLESS_STAGE}`;
    //         }
    //         lambda.invoke(params, (err, data) => {
    //           if (err) {
    //             throw new Error(`ERROR invoking self: ${err}`);
    //           } else {
    //             callback(null, data);
    //           }
    //         });
    //       }
    //     } catch (ex) {
    //       const msg = `ERROR exception encountered while invoking self from ${event._genesis} ` +
    //         `in ${event._start}: ${ex.message}\n${ex.stack}`;
    //       console.log(msg);
    //       callback(msg);
    //     }
    //   };
    //   if (timeDelay > 0) {
    //     setTimeout(exec, timeDelay);
    //     if (event._trace) {
    //       console.log(
    //         `scheduling self invocation for ${event._genesis} in ${event._start} with a ${timeDelay} ms delay`
    //       );
    //     }
    //   } else {
    //     exec();
    //   }
    // },
    it('', () => {
      // TODO implement tests
    });
  });

  describe('#impl.runLoad', () => {
    // // event is bare Artillery script
    // /**
    //  * Run a load test given an Artillery script and report the results
    //  * @param start The time that invocation began
    //  * @param script The artillery script
    //  * @param context The Lambda context for the job
    //  * @param callback The callback to report errors and load test results to
    //  */
    // runLoad: (start, script, context, callback) => {
    //   let runner;
    //   let payload;
    //   let msg;
    //   if (script._trace) {
    //     console.log(`runLoad started from ${script._genesis} @ ${start}`);
    //   }
    //   if (script._simulation) {
    //     console.log(`SIMULATION: runLoad called with ${JSON.stringify(script, null, 2)}`);
    //     callback(null, { Payload: '{ "errors": 0 }' });
    //   } else {
    //     try {
    //       impl.loadProcessor(script);
    //       payload = impl.readPayload(script);
    //       runner = artillery.runner(script, payload, {});
    //       runner.on('phaseStarted', (opts) => {
    //         console.log(
    //           `phase ${opts.index}${
    //             opts.name ? ` (${opts.name})` : ''
    //             } started, duration: ${
    //             opts.duration ? opts.duration : opts.pause
    //             }`
    //         );
    //       });
    //       runner.on('phaseCompleted', (opts) => {
    //         console.log('phase', opts.index, ':', opts.name ? opts.name : '', 'complete');
    //       });
    //       runner.on('done', (report) => {
    //         const latencies = report.latencies;
    //         report.latencies = undefined; // eslint-disable-line no-param-reassign
    //         console.log(JSON.stringify(report, null, 2));
    //         report.latencies = latencies; // eslint-disable-line no-param-reassign
    //         callback(null, report);
    //         if (script._trace) {
    //           console.log(`runLoad stopped from ${script._genesis} in ${start} @ ${Date.now()}`);
    //         }
    //       });
    //       runner.run();
    //     } catch (ex) {
    //       msg = `ERROR exception encountered while executing load from ${script._genesis} ` +
    //         `in ${start}: ${ex.message}\n${ex.stack}`;
    //       console.log(msg);
    //       callback(msg);
    //     }
    //   }
    // },
    it('', () => {
      // TODO implement tests
    });
  });

  describe('#impl.runPerformance', () => {
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
    });
  });

  /**
   * ANALYZE ACCEPTANCE TEST REPORTS
   */
  describe('#analyzeAcceptance', () => {
    it('handles a report set of zero reports', () => {
      const reports = [];
      expected = {
        errors: 0,
        reports,
      };
      result = handler.impl.analyzeAcceptance(reports);
      expect(result).to.eql(expected);
    });
    it('handles a report set with no errors', () => {
      const reports = [
        {
          errors: {},
        },
        {
          errors: {},
        },
      ];
      expected = {
        errors: 0,
        reports,
      };
      result = handler.impl.analyzeAcceptance(reports);
      expect(result).to.eql(expected);
    });
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
      ];
      expected = {
        errors: 1,
        errorMessage: '1 acceptance test failure',
        reports,
      };
      result = handler.impl.analyzeAcceptance(reports);
      expect(result).to.eql(expected);
    });
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
      ];
      expected = {
        errors: 2,
        errorMessage: '2 acceptance test failures',
        reports,
      };
      result = handler.impl.analyzeAcceptance(reports);
      expect(result).to.eql(expected);
    });
  });

  describe('#impl.runAcceptance', () => {
    // /**
    //  * Run a script in acceptance mode, executing each of the given script's flows exactly once and generating a
    //  * report
    //  * of the success or failure of these acceptance tests.
    //  * @param timeNow The time at which the event was received for this execution
    //  * @param script The Artillery (http://artillery.io) script to split into acceptance tests
    //  * @param context The Lambda provided execution context
    //  * @param callback The Lambda provided callback to report errors or success to
    //  */
    // runAcceptance: (timeNow, script, context, callback) => {
    //   ...
    // }
    it('', () => {
      // TODO implement tests
    });
  });

  describe('#api.run', () => {
    // /**
    //  * This Lambda produces load according to the given specification.
    //  * If that load exceeds the limits that a Lambda can individually satisfy (duration or requests per second) then
    //  * the script will be split into chunks that can be executed by single lambdas and those will be executed.  If
    //  * the script can be run within a single Lambda then the results of that execution will be returned as the
    //  * result of the lambda invocation.
    //  * @param event The event specifying an Artillery load generation test to perform
    //  * @param context The Lambda context for the job
    //  * @param callback The Lambda callback to notify errors and results to
    //  */
    // run: (script, context, callback) => {
    //   if (impl.validScript(script, context, callback)) {
    //     const now = Date.now();
    //     if (!script._genesis) {
    //       script._genesis = now; // eslint-disable-line no-param-reassign
    //     }
    //     if (script.mode === constants.modes.ACC || script.mode === constants.modes.ACCEPTANCE) {
    //       impl.runAcceptance(now, script, context, callback);
    //     } else {
    //       impl.runPerformance(now, script, context, callback);
    //     }
    //   }
    // },
    it('', () => {
      // TODO implement tests
    });
  });
});
