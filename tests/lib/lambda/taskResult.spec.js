const chai = require('chai')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)

const expect = chai.expect

// eslint-disable-next-line import/no-dynamic-require
const def = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskDef.js'))
// eslint-disable-next-line import/no-dynamic-require
const taskResult = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskResult.js'))

let expected
let result

describe('./lib/lambda/taskValid.js', () => {
  describe(':impl', () => {
    /**
     * ANALYZE ACCEPTANCE TEST REPORTS
     */
    describe('#analyzeAcceptance', () => {
      it('handles a report set of zero reports', () => {
        const reports = []
        expected = {
          errors: 0,
          reports,
        }
        result = taskResult.impl.analyzeAcceptance(reports)
        expect(result).to.eql(expected)
      })
      it('handles a report set with no errors', () => {
        const reports = [
          {
            errors: {},
          },
          {
            errors: {},
          },
        ]
        expected = {
          errors: 0,
          reports,
        }
        result = taskResult.impl.analyzeAcceptance(reports)
        expect(result).to.eql(expected)
      })
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
        ]
        expected = {
          errors: 1,
          errorMessage: '1 acceptance test failure',
          reports,
        }
        result = taskResult.impl.analyzeAcceptance(reports)
        expect(result).to.eql(expected)
      })
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
        ]
        expected = {
          errors: 2,
          errorMessage: '2 acceptance test failures',
          reports,
        }
        result = taskResult.impl.analyzeAcceptance(reports)
        expect(result).to.eql(expected)
      })
    })
    describe('#result', () => {
      const tagScript = {}
      const tagSettings = {}
      const analysis = {}
      let analyzeAcceptanceStub
      let script
      let payloads
      beforeEach(() => {
        analyzeAcceptanceStub = sinon.stub(taskResult.impl, 'analyzeAcceptance').returns(analysis)
      })
      afterEach(() => {
        analyzeAcceptanceStub.restore()
      })
      it('returns an object with a message if no mode is defined', () => {
        result = taskResult.impl.result(1, tagScript, tagSettings, [])
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(result).to.have.property('message')
        expect(result.message).to.be.a('string')
      })
      it(`returns an object with a message if mode is "${def.modes.PERF}"`, () => {
        script = { mode: def.modes.PERF }
        result = taskResult.impl.result(1, script, tagSettings, [])
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(result).to.have.property('message')
        expect(result.message).to.be.a('string')
      })
      it(`returns an object with a message if mode is "${def.modes.PERFORMANCE}"`, () => {
        script = { mode: def.modes.PERFORMANCE }
        result = taskResult.impl.result(1, script, tagSettings, [])
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(result).to.have.property('message')
        expect(result.message).to.be.a('string')
      })
      it(`returns the result of analyzeAcceptance if mode is "${def.modes.ACC}"`, () => {
        script = { mode: def.modes.ACC, _start: 1 }
        payloads = []
        result = taskResult.impl.result(1, script, tagSettings, payloads)
        expect(analyzeAcceptanceStub).to.have.been.calledOnce
        expect(analyzeAcceptanceStub).to.have.been.calledWithExactly(payloads)
        expect(result).to.equal(analysis)
      })
      it(`returns the result of analyzeAcceptance if mode is "${def.modes.ACCEPTANCE}"`, () => {
        script = { mode: def.modes.ACCEPTANCE, _start: 1 }
        payloads = []
        result = taskResult.impl.result(1, script, tagSettings, payloads)
        expect(analyzeAcceptanceStub).to.have.been.calledOnce
        expect(analyzeAcceptanceStub).to.have.been.calledWithExactly(payloads)
        expect(result).to.equal(analysis)
      })
    })
  })
})
