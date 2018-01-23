const chai = require('chai')
const path = require('path')

const expect = chai.expect

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', 'lib', 'lambda', 'func.js'))
// eslint-disable-next-line import/no-dynamic-require
const task = require(path.join('..', '..', '..', 'lib', 'lambda', 'task.js'))

const defaultSettings = func.def.getSettings()

const tagScript = () => ({
  config: {
    phases: [
      { duration: 1, arrivalRate: 2 },
    ],
  },
})

let script

describe('./lib/lambda/taskValid.js', () => {
  describe(':impl', () => {
    describe('#validate', () => {
      beforeEach(() => {
        script = tagScript()
      })
      describe('phase definition (unless in acceptance mode)', () => {
        it('rejects an undefined config', () => {
          delete script.config
          expect(() => task.valid(defaultSettings, script)).to.throw(task.def.TaskError)
          script.mode = task.def.modes.ACCEPTANCE
          task.valid(defaultSettings, script)
        })
        it('rejects a non-array config.phases', () => {
          script.config.phases = ''
          expect(() => task.valid(defaultSettings, script)).to.throw(task.def.TaskError)
          script.mode = task.def.modes.ACCEPTANCE
          task.valid(defaultSettings, script)
        })
        it('rejects an empty-array config.phases', () => {
          script.config.phases = []
          expect(() => task.valid(defaultSettings, script)).to.throw(task.def.TaskError)
          script.mode = task.def.modes.ACCEPTANCE
          task.valid(defaultSettings, script)
        })
      })
      describe('mode declaration', () => {
        Object.keys(task.def.modes).forEach((mode) => {
          it(`accepts valid mode declaration '${mode}'`, () => {
            script.mode = task.def.modes[mode]
            task.valid(defaultSettings, script)
          })
        })
        it('reject unknown modes', () => {
          script.mode = 'UNKNOWN_MODE'
          expect(() => task.valid(defaultSettings, script)).to.throw(task.def.TaskError)
        })
        it('reject unsupported mode capitalizations', () => {
          script.mode = 'aCc'
          expect(() => task.valid(defaultSettings, script)).to.throw(task.def.TaskError)
        })
      })
      describe('evaluates load constraints (unless in acceptance mode)', () => {
        it('rejects scripts with invalid phases', () => {
          script.config.phases = [{ arrivalRate: 10 }] // invalid duration
          expect(() => task.valid(defaultSettings, script)).to.throw(task.def.TaskError)
          script.mode = task.def.modes.ACCEPTANCE
          task.valid(defaultSettings, script)
          delete script.mode
          script.config.phases = [{ duration: 10 }] // invalid rate
          expect(() => task.valid(defaultSettings, script)).to.throw(task.def.TaskError)
          script.mode = task.def.modes.ACCEPTANCE
          task.valid(defaultSettings, script)
        })
        it('rejects scripts with excessive duration', () => {
          script.config.phases = [{
            duration: defaultSettings.maxScriptDurationInSeconds + 1,
            arrivalRate: 10,
          }]
          expect(() => task.valid(defaultSettings, script)).to.throw(task.def.TaskError)
          script.mode = task.def.modes.ACCEPTANCE
          task.valid(defaultSettings, script)
        })
        it('rejects scripts with excessive requests per second', () => {
          script.config.phases = [{
            duration: 10,
            arrivalRate: defaultSettings.maxScriptRequestsPerSecond + 1,
          }]
          expect(() => task.valid(defaultSettings, script)).to.throw(task.def.TaskError)
          script.mode = task.def.modes.ACCEPTANCE
          task.valid(defaultSettings, script)
        })
      })
    })
  })
})
