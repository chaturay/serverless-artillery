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

describe('./lib/lambda/taskResult.js', () => {
  describe(':impl', () => {
    describe('#getDisplayReadyMode', () => {
      it('returns the given mode if not among the defined', () => {
        const mode = 'not-really-a-mode'
        result = taskResult.impl.getDisplayReadyMode({ mode })
        expect(result).to.eql(mode)
      })
    })
    describe('#getErrorBudget', () => {
      it('uses the supplied error budget if specified', () => {
        result = taskResult.impl.getErrorBudget({ sampling: { errorBudget: 1 } }, 2)
        expect(result).to.equal(1)
      })
      it('ignores falsy error budgets even if specified', () => {
        result = taskResult.impl.getErrorBudget({ sampling: { errorBudget: 0 } }, 2)
        expect(result).to.equal(2)
      })
      it('uses the given default error budget if given script does not specify sampling configuration', () => {
        result = taskResult.impl.getErrorBudget({}, 2)
        expect(result).to.equal(2)
      })
      it('uses the given default error budget if given script does not specify one', () => {
        result = taskResult.impl.getErrorBudget({ sampling: {} }, 2)
        expect(result).to.equal(2)
      })
      it('uses the default error budget if given script does not specify one and no default is supplied', () => {
        result = taskResult.impl.getErrorBudget({ sampling: {} })
        expect(result).to.equal(def.sampling.DefaultErrorBudget)
      })
    })
    /**
     * ANALYZE SAMPLES TEST REPORTS
     */
    describe('#analyzeSamples', () => {
      it('handles a report set of zero reports', () => {
        const reports = []
        expected = {
          errors: 0,
          reports,
        }
        result = taskResult.impl.analyzeSamples({}, reports)
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
        result = taskResult.impl.analyzeSamples({}, reports)
        expect(result).to.eql(expected)
      })
      it('handles a report set with error counts under budget', () => {
        const reports = [
          {
            errors: {
              404: def.sampling.DefaultErrorBudget - 1,
            },
          },
          {
            errors: {},
          },
        ]
        expected = {
          errors: 0,
          reports,
        }
        result = taskResult.impl.analyzeSamples({}, reports)
        expect(result).to.eql(expected)
      })
      it('handles a report set with error counts at budget', () => {
        const reports = [
          {
            errors: {
              404: def.sampling.DefaultErrorBudget,
            },
          },
          {
            errors: {},
          },
        ]
        expected = {
          errors: 0,
          reports,
        }
        result = taskResult.impl.analyzeSamples({}, reports)
        expect(result).to.eql(expected)
      })
      it('handles a report set with error counts over budget', () => {
        const reports = [
          {
            errors: {
              404: def.sampling.DefaultErrorBudget + 1,
            },
          },
          {
            errors: {},
          },
        ]
        expected = {
          errors: 1,
          errorMessage: `sampling test failure: 1/2 exceeded budget of ${def.monitoring.DefaultErrorBudget} errors`,
          reports,
        }
        result = taskResult.impl.analyzeSamples({}, reports)
        expect(result).to.eql(expected)
      })
      it('handles a report set with all error counts over budget', () => {
        const reports = [
          {
            errors: {
              404: def.sampling.DefaultErrorBudget + 1,
            },
          },
          {
            errors: {
              404: def.sampling.DefaultErrorBudget + 1,
            },
          },
        ]
        expected = {
          errors: 2,
          errorMessage: `sampling test failures: 2/2 exceeded budget of ${def.monitoring.DefaultErrorBudget} errors`,
          reports,
        }
        result = taskResult.impl.analyzeSamples({}, reports)
        expect(result).to.eql(expected)
      })
    })
    describe('#analyzeAcceptance', () => {
      it('handles a report set with an report of error counts over budget', () => {
        const reports = [
          {
            errors: {
              404: def.sampling.DefaultErrorBudget + 1,
            },
          },
        ]
        expected = {
          errors: 1,
          errorMessage: `acceptance test failure: 1/1 exceeded budget of ${def.monitoring.DefaultErrorBudget} errors`,
          reports,
        }
        result = taskResult.impl.analyzeAcceptance({ mode: def.modes.ACC }, reports)
        expect(result).to.eql(expected)
      })
    })
    describe('#analyzeMonitoring', () => {
      it('handles a report set with no errors', () => {
        const reports = [{}]
        expected = {
          errors: 0,
          reports,
        }
        expect(taskResult.impl.analyzeMonitoring(
          { mode: def.modes.MON },
          { alert: { send: () => Promise.reject() } }, // shouldn't be called
          reports // eslint-disable-line comma-dangle
        )).to.eql(expected)
      })
      it('handles a report set with an report of error counts over budget', () => {
        const reports = [
          {
            errors: {
              404: def.monitoring.DefaultErrorBudget + 1,
            },
          },
        ]
        expected = {
          errors: 1,
          errorMessage: `monitoring test failure: 1/1 exceeded budget of ${def.monitoring.DefaultErrorBudget} errors`,
          reports,
        }
        return taskResult.impl.analyzeMonitoring(
          { mode: def.modes.MON },
          { alert: { send: () => Promise.resolve() } },
          reports // eslint-disable-line comma-dangle
        ).should.become(expected)
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
      let analyzeMonitoringStub
      let analyzePerformanceStub
      let script
      let payloads
      beforeEach(() => {
        analyzeAcceptanceStub = sinon.stub(taskResult.impl, 'analyzeAcceptance').returns(analysis)
        analyzeMonitoringStub = sinon.stub(taskResult.impl, 'analyzeMonitoring').returns(analysis)
        analyzePerformanceStub = sinon.stub(taskResult.impl, 'analyzePerformance').returns(analysis)
      })
      afterEach(() => {
        analyzeAcceptanceStub.restore()
        analyzeMonitoringStub.restore()
        analyzePerformanceStub.restore()
      })
      it('performs a performance analysis if no mode is defined', () => {
        result = taskResult.impl.result(1, tagScript, tagSettings, [])
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(analyzeMonitoringStub).to.not.have.been.called
        expect(analyzePerformanceStub).to.have.been.calledOnce
        expect(result).to.equal(analysis)
      })
      it(`performs a performance analysis if mode is "${def.modes.PERF}"`, () => {
        script = { mode: def.modes.PERF }
        result = taskResult.impl.result(1, script, tagSettings, [])
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(analyzeMonitoringStub).to.not.have.been.called
        expect(analyzePerformanceStub).to.have.been.calledOnce
        expect(result).to.equal(analysis)
      })
      it(`performs a performance analysis if mode is "${def.modes.PERFORMANCE}"`, () => {
        script = { mode: def.modes.PERFORMANCE }
        result = taskResult.impl.result(1, script, tagSettings, [])
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(analyzeMonitoringStub).to.not.have.been.called
        expect(analyzePerformanceStub).to.have.been.calledOnce
        expect(result).to.equal(analysis)
      })
      it(`returns the result of analyzeAcceptance if mode is "${def.modes.ACC}"`, () => {
        script = { mode: def.modes.ACC, _start: 1 }
        payloads = []
        result = taskResult.impl.result(1, script, tagSettings, payloads)
        expect(analyzeAcceptanceStub).to.have.been.calledOnce
        expect(analyzeAcceptanceStub).to.have.been.calledWithExactly(script, payloads)
        expect(result).to.equal(analysis)
        expect(analyzeMonitoringStub).to.not.have.been.called
        expect(analyzePerformanceStub).to.not.have.been.called
      })
      it(`returns the result of analyzeAcceptance if mode is "${def.modes.ACCEPTANCE}"`, () => {
        script = { mode: def.modes.ACCEPTANCE, _start: 1 }
        payloads = []
        result = taskResult.impl.result(1, script, tagSettings, payloads)
        expect(analyzeAcceptanceStub).to.have.been.calledOnce
        expect(analyzeAcceptanceStub).to.have.been.calledWithExactly(script, payloads)
        expect(result).to.equal(analysis)
        expect(analyzeMonitoringStub).to.not.have.been.called
        expect(analyzePerformanceStub).to.not.have.been.called
      })
      it(`returns the result of analyzeMonitoring if mode is "${def.modes.MON}"`, () => {
        script = { mode: def.modes.MON, _start: 1 }
        payloads = []
        result = taskResult.impl.result(1, script, tagSettings, payloads)
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(analyzeMonitoringStub).to.have.been.calledOnce
        expect(analyzeMonitoringStub).to.have.been.calledWithExactly(script, tagSettings, payloads)
        expect(result).to.equal(analysis)
        expect(analyzePerformanceStub).to.not.have.been.called
      })
      it(`returns the result of analyzeMonitoring if mode is "${def.modes.MONITORING}"`, () => {
        script = { mode: def.modes.MONITORING, _start: 1 }
        payloads = []
        result = taskResult.impl.result(1, script, tagSettings, payloads)
        expect(analyzeAcceptanceStub).to.not.have.been.called
        expect(analyzeMonitoringStub).to.have.been.calledOnce
        expect(analyzeMonitoringStub).to.have.been.calledWithExactly(script, tagSettings, payloads)
        expect(result).to.equal(analysis)
        expect(analyzePerformanceStub).to.not.have.been.called
      })
    })
  })
})
