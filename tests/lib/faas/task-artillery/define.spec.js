const chai = require('chai')
const path = require('path')

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const task = require(path.join('..', '..', '..', '..', 'lib', 'faas', 'task-artillery'))

let script
let expected

describe('./lib/faas/task-artillery/define.js', () => {
  describe(':constants', () => {
    // The rest of these cases are covered in other tests.  Adding this for completeness
    describe('#isPerformanceScript', () => {
      it('identifies a script with no mode as a performance script', () => {
        expect(task.define.isPerformanceScript({})).to.be.true
      })
      it(`identifies a script with mode ${task.define.modes.PERF} as a performance script`, () => {
        expect(task.define.isPerformanceScript({ mode: task.define.modes.PERF })).to.be.true
      })
      it(`identifies a script with mode ${task.define.modes.PERFORMANCE} as a performance script`, () => {
        expect(task.define.isPerformanceScript({ mode: task.define.modes.PERFORMANCE })).to.be.true
      })
    })
  })
  describe(':impl', () => {
    describe('#getSettings', () => {
      const makeSettings = defaults => ({ sampling: task.define.defaultsToSettings(defaults) })
      const samplingSettings = makeSettings(task.define.sampling)
      const acceptanceSettings = makeSettings(task.define.acceptance)
      const monitoringSettings = makeSettings(task.define.monitoring)
      it('returns default settings if not given a script', () => {
        expect(task.define.getSettings()).to.eql(samplingSettings)
      })
      it('returns default settings if no mode or settings are specified in the script', () => {
        script = {}
        expect(task.define.getSettings(script)).to.eql(samplingSettings)
      })
      it('returns default acceptance settings if mode is acceptance but no settings are specified in the script', () => {
        script = { mode: task.define.modes.ACC }
        expect(task.define.getSettings(script)).to.eql(acceptanceSettings)
      })
      it('returns default acceptance settings overridden by given settings if mode is acceptance', () => {
        script = {
          mode: task.define.modes.ACC,
          sampling: { averagePause: 3 },
        }
        expected = makeSettings(task.define.acceptance)
        expected.sampling.averagePause = 3
        expect(task.define.getSettings(script)).to.eql(expected)
      })
      it('returns default monitoring settings if mode is monitoring but no settings are specified in the script', () => {
        script = { mode: task.define.modes.MON }
        expect(task.define.getSettings(script)).to.eql(monitoringSettings)
      })
      it('returns default monitoring settings overridden by given settings if mode is monitoring', () => {
        script = {
          mode: task.define.modes.MON,
          sampling: { averagePause: 3 },
        }
        expected = makeSettings(task.define.monitoring)
        expected.sampling.averagePause = 3
        expect(task.define.getSettings(script)).to.eql(expected)
      })
      // Individual settings extraction
      it('extracts the size setting specification', () => {
        script = {
          sampling: { size: 3 },
        }
        expected = makeSettings(task.define.sampling)
        expected.sampling.size = 3
        expect(task.define.getSettings(script)).to.eql(expected)
      })
      it('extracts the averagePause setting specification', () => {
        script = {
          sampling: { averagePause: 3 },
        }
        expected = makeSettings(task.define.sampling)
        expected.sampling.averagePause = 3
        expect(task.define.getSettings(script)).to.eql(expected)
      })
      it('extracts the pauseVariance setting specification', () => {
        script = {
          sampling: { pauseVariance: 3 },
        }
        expected = makeSettings(task.define.sampling)
        expected.sampling.pauseVariance = 3
        expect(task.define.getSettings(script)).to.eql(expected)
      })
      it('extracts the errorBudget setting specification', () => {
        script = {
          sampling: { errorBudget: 3 },
        }
        expected = makeSettings(task.define.sampling)
        expected.sampling.errorBudget = 3
        expect(task.define.getSettings(script)).to.eql(expected)
      })
      it('extracts the warningThreshold setting specification', () => {
        script = {
          sampling: { warningThreshold: 3 },
        }
        expected = makeSettings(task.define.sampling)
        expected.sampling.warningThreshold = 3
        expect(task.define.getSettings(script)).to.eql(expected)
      })
    })
  })
})
