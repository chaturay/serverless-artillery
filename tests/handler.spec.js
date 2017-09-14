'use strict';

const expect = require('chai').expect;
const handler = require('../lib/lambda/handler.js');

let script;
let phase;
let result;
let expected;

describe('serverless-artillery Handler Tests', () => {
  /**
   * SPLIT PHASE BY LENGTH
   */
  describe('#splitPhaseByLength splits PHASES that are TOO LONG', () => {
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
  describe('#splitScriptByLength The handler splits SCRIPTS that are TOO LONG', () => {
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
  describe('#splitPhaseByWidth The handler splits PHASES that are TOO WIDE (RPS > MAX_RPS)', () => {
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
  describe('#splitScriptByWidth the handler splits SCRIPTS that are TOO WIDE', () => {
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
  describe('#loadProcessor', () => {
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
            path: `${__dirname}/example.0.csv`,
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
              path: `${__dirname}/example.0.csv`,
            },
            {
              path: `${__dirname}/example.1.csv`,
            },
          ],
        },
      };
      const payload = handler.impl.readPayload(newScript);
      expect(payload).to.deep.equal([
        {
          path: `${__dirname}/example.0.csv`,
          data: [
            ['123456', 'John Doe'],
            ['234567', 'Jane Doe'],
            ['345678', 'Baby Doe'],
          ],
        },
        {
          path: `${__dirname}/example.1.csv`,
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
});
