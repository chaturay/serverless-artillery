const chai = require('chai')
const path = require('path')

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', '..', 'lib', 'faas', 'aws-func'))
// eslint-disable-next-line import/no-dynamic-require
const task = require(path.join('..', '..', '..', '..', 'lib', 'faas', 'task-artillery'))

const getDefaultSettings = () => {
  const ret = func.define.getSettings()
  ret.alert = () => Promise.resolve()
  ret.task = {
    sampling: task.define.defaultsToSettings(task.define.sampling),
  }
  return ret
}
const defaultSettings = getDefaultSettings()

const tagScript = () => ({
  config: {
    phases: [
      { duration: 1, arrivalRate: 2 },
    ],
  },
})

let script

describe('./lib/faas/task-artillery/valid.js', () => {
  describe(':impl', () => {
    describe('#validate', () => {
      beforeEach(() => {
        script = tagScript()
      })
      describe('mode declaration', () => {
        Object.keys(task.define.modes).forEach((mode) => {
          it(`accepts valid mode declaration '${mode}'`, () => {
            script.mode = task.define.modes[mode]
            task.valid(defaultSettings, script)
          })
        })
        it('reject unknown modes', () => {
          script.mode = 'UNKNOWN_MODE'
          expect(() => task.valid(defaultSettings, script)).to.throw(task.define.TaskError)
        })
        it('reject unsupported mode capitalizations', () => {
          script.mode = 'aCc'
          expect(() => task.valid(defaultSettings, script)).to.throw(task.define.TaskError)
        })
      })
      describe('evaluates sampling configuration (in sampling mode)', () => {
        let settings
        beforeEach(() => {
          script.mode = task.define.modes.MON // could as well be ACC
          settings = getDefaultSettings()
        })
        describe(': known defaults', () => {
          it('accepts acceptance defaults', () => {
            settings.task.sampling = task.define.defaultsToSettings(task.define.acceptance)
            task.valid(settings, script)
          })
          it('accepts monitoring defaults', () => {
            settings.task.sampling = task.define.defaultsToSettings(task.define.monitoring)
            task.valid(settings, script)
          })
          it('accepts sampling defaults', () => {
            settings.task.sampling = task.define.defaultsToSettings(task.define.sampling)
            task.valid(settings, script)
          })
        })
        describe(': user supplied value constraints', () => {
          it('rejects non-number size values', () => {
            settings.task.sampling.size = '1'
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects size values of 0', () => {
            settings.task.sampling.size = 0
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects negative size values', () => {
            settings.task.sampling.size = -1
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects non-number averagePause values', () => {
            settings.task.sampling.averagePause = '1'
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects averagePause values of 0', () => {
            settings.task.sampling.averagePause = 0
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects negative averagePause values', () => {
            settings.task.sampling.averagePause = -1
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects non-number pauseVariance values', () => {
            settings.task.sampling.pauseVariance = '1'
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects negative pauseVariance values', () => {
            settings.task.sampling.pauseVariance = -1
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects non-number errorBudget values', () => {
            settings.task.sampling.errorBudget = '1'
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects negative errorBudget values', () => {
            settings.task.sampling.errorBudget = -1
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects non-number warningThreshold values', () => {
            settings.task.sampling.warningThreshold = '1'
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects warningThreshold values of 0', () => {
            settings.task.sampling.warningThreshold = 0
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects negative warningThreshold values', () => {
            settings.task.sampling.warningThreshold = -1
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('accepts warningThreshold values of 1', () => {
            settings.task.sampling.warningThreshold = 1
            task.valid(settings, script)
          })
          it('rejects warningThreshold values greater than 1', () => {
            settings.task.sampling.warningThreshold = 1.1
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
        })
        describe(': value relationship checking', () => {
          it('rejects errorBudgets equal to the size', () => {
            settings.task.sampling.size = 5
            settings.task.sampling.errorBudget = 5
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects errorBudgets greater than size', () => {
            settings.task.sampling.size = 4
            settings.task.sampling.errorBudget = 5
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('rejects pauseVariances greater than averagePause', () => {
            settings.task.sampling.averagePause = 4
            settings.task.sampling.pauseVariance = 5
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
        })
        describe(': funtion constraint compatibility checking', () => {
          it('rejects settings that could exceed the max duration', () => {
            settings.maxScriptDurationInSeconds = 9
            settings.task.sampling.size = 5
            settings.task.sampling.averagePause = 1
            settings.task.sampling.pauseVariance = 1
            expect(() => task.valid(settings, script)).to.throw(task.define.TaskError)
          })
          it('accepts but warns about settings that could exceed a threshold portion of max duration', () => {
            const { warn } = console
            let warned = false
            console.warn = () => { warned = true }
            settings.maxScriptDurationInSeconds = 5
            settings.task.sampling.size = 5
            settings.task.sampling.averagePause = 0.9
            settings.task.sampling.pauseVariance = 0.01
            settings.task.sampling.warningThreshold = 0.9
            try {
              task.valid(settings, script)
              expect(warned).to.be.true
            } finally {
              console.warn = warn
            }
          })
        })
      })
      describe('evaluates load configuration (unless in sampling mode)', () => {
        describe(': phase definition', () => {
          it('rejects an undefined config', () => {
            delete script.config
            expect(() => task.valid(defaultSettings, script)).to.throw(task.define.TaskError)
            script.mode = task.define.modes.ACCEPTANCE
            task.valid(defaultSettings, script)
          })
          it('rejects a non-array config.phases', () => {
            script.config.phases = ''
            expect(() => task.valid(defaultSettings, script)).to.throw(task.define.TaskError)
            script.mode = task.define.modes.ACCEPTANCE
            task.valid(defaultSettings, script)
          })
          it('rejects an empty-array config.phases', () => {
            script.config.phases = []
            expect(() => task.valid(defaultSettings, script)).to.throw(task.define.TaskError)
            script.mode = task.define.modes.ACCEPTANCE
            task.valid(defaultSettings, script)
          })
        })
        describe(': constraint checking', () => {
          it('rejects scripts with invalid phases', () => {
            script.config.phases = [{ arrivalRate: 10 }] // invalid duration
            expect(() => task.valid(defaultSettings, script)).to.throw(task.define.TaskError)
            script.mode = task.define.modes.ACCEPTANCE
            task.valid(defaultSettings, script)
            delete script.mode
            script.config.phases = [{ duration: 10 }] // invalid rate
            expect(() => task.valid(defaultSettings, script)).to.throw(task.define.TaskError)
            script.mode = task.define.modes.ACCEPTANCE
            task.valid(defaultSettings, script)
          })
          it('rejects scripts with excessive duration', () => {
            script.config.phases = [{
              duration: defaultSettings.maxScriptDurationInSeconds + 1,
              arrivalRate: 10,
            }]
            expect(() => task.valid(defaultSettings, script)).to.throw(task.define.TaskError)
            script.mode = task.define.modes.ACCEPTANCE
            task.valid(defaultSettings, script)
          })
          it('rejects scripts with excessive requests per second', () => {
            script.config.phases = [{
              duration: 10,
              arrivalRate: defaultSettings.maxScriptRequestsPerSecond + 1,
            }]
            expect(() => task.valid(defaultSettings, script)).to.throw(task.define.TaskError)
            script.mode = task.define.modes.ACCEPTANCE
            task.valid(defaultSettings, script)
          })
        })
      })
    })
  })
})
