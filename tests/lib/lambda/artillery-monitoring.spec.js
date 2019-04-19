const chai = require('chai')
const spies = require('chai-spies')
const proxyquire = require('proxyquire')

chai.use(spies)

const sandbox = chai.spy.sandbox()
const { expect } = chai

const samplingMock = {}
const planningMock = {}
const analysisMock = {}
const artilleryTaskMock = {}
const alertMock = {}

const artilleryMonitoring = proxyquire(
  '../../../lib/lambda/artillery-monitoring.js', {
    './alert.js': alertMock,
    './sampling.js': samplingMock,
    './planning.js': planningMock,
    './analysis.js': analysisMock,
  })

describe('Artillery Monitoring', () => {
  const testTimeNow = 111111111111111
  const testScript = { name: 'test-monitoring-script' }
  const testScriptSampling = { name: 'test-monitoring-script-sampling' }
  const testPlans = []
  const testSettings = { prop: 'value' }
  const testResults = { errors: 0 }

  beforeEach(() => {
    sandbox.on(samplingMock, 'applyMonitoringSamplingToScript', () => testScriptSampling)
    sandbox.on(planningMock, 'planSamples', () => testPlans)
    sandbox.on(analysisMock, 'analyzeMonitoring', () => testResults)
    sandbox.on(artilleryTaskMock, 'executeAll', () => Promise.resolve(testResults))
    sandbox.on(alertMock, 'send', () => Promise.resolve())
  })

  it('uses sampling for planning the load', () =>
    artilleryMonitoring(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(samplingMock.applyMonitoringSamplingToScript).to.have.been.called.once
        expect(samplingMock.applyMonitoringSamplingToScript).to.have.been.called.with.exactly(testScript, testSettings)
        expect(planningMock.planSamples).to.have.been.called.once
        expect(planningMock.planSamples).to.have.been.called.with.exactly(testTimeNow, testScriptSampling, testSettings)
      })
  )

  it('calls artillery task to execute the load', () =>
    artilleryMonitoring(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(artilleryTaskMock.executeAll).to.have.been.called.once
        expect(artilleryTaskMock.executeAll).to.have.been.called.with.exactly(testScriptSampling, testSettings, testPlans, testTimeNow)
      })
  )

  it('analyzes results using acceptance criteria', () =>
    artilleryMonitoring(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(analysisMock.analyzeMonitoring).to.have.been.called.once
        expect(analysisMock.analyzeMonitoring).to.have.been.called.with.exactly(testTimeNow, testScript, testSettings, testResults)
      })
  )

  it('alerts in the case of errors', () => {
    testResults.errorMessage = 'oh noes!'

    return artilleryMonitoring(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(alertMock.send).to.have.been.called.once
        expect(alertMock.send).to.have.been.called.with.exactly(testScript, testResults)
      })
  })

  afterEach(() => {
    sandbox.restore()
  })
})
