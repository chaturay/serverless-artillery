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
    describe('#analyzePerformance', () => {
      it('returns the report if only one is given', () => {
        const report = {}
        result = taskResult.impl.analyzePerformance(Date.now(), {}, [report])
        expect(result).to.equal(report)
      })
      it('returns an object containing a string message if zero reports are given', () => {
        result = taskResult.impl.analyzePerformance(Date.now(), {}, [])
        expect(result).to.have.property('message')
        expect(result.message).to.be.a('string')
      })
      it('returns an object containing a string message if more than one report is given', () => {
        result = taskResult.impl.analyzePerformance(Date.now(), {}, [{}, {}])
        expect(result).to.have.property('message')
        expect(result.message).to.be.a('string')
      })
    })
    describe('#result', () => {
      const tagScript = {}
      const tagSettings = {}
      const analysis = {}
      let analyzeAcceptanceStub
      let analyzePerformanceStub
      let script
      let payloads
      beforeEach(() => {
        analyzeAcceptanceStub = sinon.stub(taskResult.impl, 'analyzeAcceptance').returns(analysis)
        analyzePerformanceStub = sinon.stub(taskResult.impl, 'analyzePerformance').returns(analysis)
      })
      afterEach(() => {
        analyzeAcceptanceStub.restore()
        analyzePerformanceStub.restore()
      })
      it('performs a performance analysis if no mode is defined', () => {
        result = taskResult.impl.result(1, tagScript, tagSettings, [])
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(analyzePerformanceStub).to.have.been.calledOnce
        expect(result).to.equal(analysis)
      })
      it(`performs a performance analysis if mode is "${def.modes.PERF}"`, () => {
        script = { mode: def.modes.PERF }
        result = taskResult.impl.result(1, script, tagSettings, [])
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(analyzePerformanceStub).to.have.been.calledOnce
        expect(result).to.equal(analysis)
      })
      it(`performs a performance analysis if mode is "${def.modes.PERFORMANCE}"`, () => {
        script = { mode: def.modes.PERFORMANCE }
        result = taskResult.impl.result(1, script, tagSettings, [])
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(analyzePerformanceStub).to.have.been.calledOnce
        expect(result).to.equal(analysis)
      })
      it(`returns the result of analyzeAcceptance if mode is "${def.modes.ACC}"`, () => {
        script = { mode: def.modes.ACC, _start: 1 }
        payloads = []
        result = taskResult.impl.result(1, script, tagSettings, payloads)
        expect(analyzeAcceptanceStub).to.have.been.calledOnce
        expect(analyzeAcceptanceStub).to.have.been.calledWithExactly(payloads)
        expect(result).to.equal(analysis)
        expect(analyzePerformanceStub).to.not.have.been.called
      })
      it(`returns the result of analyzeAcceptance if mode is "${def.modes.ACCEPTANCE}"`, () => {
        script = { mode: def.modes.ACCEPTANCE, _start: 1 }
        payloads = []
        result = taskResult.impl.result(1, script, tagSettings, payloads)
        expect(analyzeAcceptanceStub).to.have.been.calledOnce
        expect(analyzeAcceptanceStub).to.have.been.calledWithExactly(payloads)
        expect(result).to.equal(analysis)
        expect(analyzePerformanceStub).to.not.have.been.called
      })
    })
  })
})
