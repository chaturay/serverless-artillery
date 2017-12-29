const chai = require('chai')
const path = require('path')

const expect = chai.expect

// eslint-disable-next-line import/no-dynamic-require
const handler = require(path.join('..', '..', '..', 'lib', 'lambda', 'handler.js'))
// eslint-disable-next-line import/no-dynamic-require
const taskDef = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskDef.js'))
// eslint-disable-next-line import/no-dynamic-require
const taskValid = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskValid.js'))

const noop = () => {}

const defaultSettings = handler.impl.getSettings({})

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
    describe('#valid', () => {
      beforeEach(() => {
        script = tagScript()
      })
      describe('phase definition (unless in acceptance mode)', () => {
        it('rejects an undefined config', () => {
          delete script.config
          expect(taskValid(defaultSettings, script, null, noop)).to.be.false
          script.mode = taskDef.modes.ACCEPTANCE
          expect(taskValid(defaultSettings, script, null, noop)).to.be.true
        })
        it('rejects a non-array config.phases', () => {
          script.config.phases = ''
          expect(taskValid(defaultSettings, script, null, noop)).to.be.false
          script.mode = taskDef.modes.ACCEPTANCE
          expect(taskValid(defaultSettings, script, null, noop)).to.be.true
        })
        it('rejects an empty-array config.phases', () => {
          script.config.phases = []
          expect(taskValid(defaultSettings, script, null, noop)).to.be.false
          script.mode = taskDef.modes.ACCEPTANCE
          expect(taskValid(defaultSettings, script, null, noop)).to.be.true
        })
      })
      describe('mode declaration', () => {
        Object.keys(taskDef.modes).forEach((mode) => {
          it(`accepts valid mode declaration '${mode}'`, () => {
            script.mode = taskDef.modes[mode]
            expect(taskValid(defaultSettings, script, null, noop)).to.be.true
          })
        })
        it('reject unknown modes', () => {
          script.mode = 'UNKNOWN_MODE'
          expect(taskValid(defaultSettings, script, null, noop)).to.be.false
        })
        it('reject unsupported mode capitalizations', () => {
          script.mode = 'aCc'
          expect(taskValid(defaultSettings, script, null, noop)).to.be.false
        })
      })
      describe('evaluates load constraints (unless in acceptance mode)', () => {
        it('rejects scripts with invalid phases', () => {
          script.config.phases = [{ arrivalRate: 10 }] // invalid duration
          expect(taskValid(defaultSettings, script, null, noop)).to.be.false
          script.mode = taskDef.modes.ACCEPTANCE
          expect(taskValid(defaultSettings, script, null, noop)).to.be.true
          delete script.mode
          script.config.phases = [{ duration: 10 }] // invalid rate
          expect(taskValid(defaultSettings, script, null, noop)).to.be.false
          script.mode = taskDef.modes.ACCEPTANCE
          expect(taskValid(defaultSettings, script, null, noop)).to.be.true
        })
        it('rejects scripts with excessive duration', () => {
          script.config.phases = [{
            duration: defaultSettings.maxScriptDurationInSeconds + 1,
            arrivalRate: 10,
          }]
          expect(taskValid(defaultSettings, script, null, noop)).to.be.false
          script.mode = taskDef.modes.ACCEPTANCE
          expect(taskValid(defaultSettings, script, null, noop)).to.be.true
        })
        it('rejects scripts with excessive requests per second', () => {
          script.config.phases = [{
            duration: 10,
            arrivalRate: defaultSettings.maxScriptRequestsPerSecond + 1,
          }]
          expect(taskValid(defaultSettings, script, null, noop)).to.be.false
          script.mode = taskDef.modes.ACCEPTANCE
          expect(taskValid(defaultSettings, script, null, noop)).to.be.true
        })
      })
    })
  })
})
