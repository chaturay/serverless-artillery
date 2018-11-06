const chai = require('chai')
const path = require('path')

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const task = require(path.join('..', '..', '..', '..', 'lib', 'faas', 'task-artillery'))

let script
let expected

describe('./lib/faas/taskDef.js', () => {
  describe(':constants', () => {
    // The rest of these cases are covered in other tests.  Adding this for completeness
    describe('#isPerformanceScript', () => {
      it('identifies a script with no mode as a performance script', () => {
        expect(task.def.isPerformanceScript({})).to.be.true
      })
      it(`identifies a script with mode ${task.def.modes.PERF} as a performance script`, () => {
        expect(task.def.isPerformanceScript({ mode: task.def.modes.PERF })).to.be.true
      })
      it(`identifies a script with mode ${task.def.modes.PERFORMANCE} as a performance script`, () => {
        expect(task.def.isPerformanceScript({ mode: task.def.modes.PERFORMANCE })).to.be.true
      })
    })
  })
  describe(':impl', () => {
    describe('#getSettings', () => {
      const makeSettings = defaults => ({ sampling: task.def.defaultsToSettings(defaults) })
      const samplingSettings = makeSettings(task.def.sampling)
      const acceptanceSettings = makeSettings(task.def.acceptance)
      const monitoringSettings = makeSettings(task.def.monitoring)
      it('returns default settings if not given a script', () => {
        expect(task.def.getSettings()).to.eql(samplingSettings)
      })
      it('returns default settings if no mode or settings are specified in the script', () => {
        script = {}
        expect(task.def.getSettings(script)).to.eql(samplingSettings)
      })
      it('returns default acceptance settings if mode is acceptance but no settings are specified in the script', () => {
        script = { mode: task.def.modes.ACC }
        expect(task.def.getSettings(script)).to.eql(acceptanceSettings)
      })
      it('returns default acceptance settings overridden by given settings if mode is acceptance', () => {
        script = {
          mode: task.def.modes.ACC,
          sampling: { averagePause: 3 },
        }
        expected = makeSettings(task.def.acceptance)
        expected.sampling.averagePause = 3
        expect(task.def.getSettings(script)).to.eql(expected)
      })
      it('returns default monitoring settings if mode is monitoring but no settings are specified in the script', () => {
        script = { mode: task.def.modes.MON }
        expect(task.def.getSettings(script)).to.eql(monitoringSettings)
      })
      it('returns default monitoring settings overridden by given settings if mode is monitoring', () => {
        script = {
          mode: task.def.modes.MON,
          sampling: { averagePause: 3 },
        }
        expected = makeSettings(task.def.monitoring)
        expected.sampling.averagePause = 3
        expect(task.def.getSettings(script)).to.eql(expected)
      })
      // Individual settings extraction
      it('extracts the size setting specification', () => {
        script = {
          sampling: { size: 3 },
        }
        expected = makeSettings(task.def.sampling)
        expected.sampling.size = 3
        expect(task.def.getSettings(script)).to.eql(expected)
      })
      it('extracts the averagePause setting specification', () => {
        script = {
          sampling: { averagePause: 3 },
        }
        expected = makeSettings(task.def.sampling)
        expected.sampling.averagePause = 3
        expect(task.def.getSettings(script)).to.eql(expected)
      })
      it('extracts the pauseVariance setting specification', () => {
        script = {
          sampling: { pauseVariance: 3 },
        }
        expected = makeSettings(task.def.sampling)
        expected.sampling.pauseVariance = 3
        expect(task.def.getSettings(script)).to.eql(expected)
      })
      it('extracts the errorBudget setting specification', () => {
        script = {
          sampling: { errorBudget: 3 },
        }
        expected = makeSettings(task.def.sampling)
        expected.sampling.errorBudget = 3
        expect(task.def.getSettings(script)).to.eql(expected)
      })
      it('extracts the warningThreshold setting specification', () => {
        script = {
          sampling: { warningThreshold: 3 },
        }
        expected = makeSettings(task.def.sampling)
        expected.sampling.warningThreshold = 3
        expect(task.def.getSettings(script)).to.eql(expected)
      })
    })
  })
})
