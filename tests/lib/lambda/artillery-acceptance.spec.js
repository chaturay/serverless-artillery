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

const artilleryAcceptance = proxyquire(
  '../../../lib/lambda/artillery-acceptance.js', {
    './sampling.js': samplingMock,
    './planning.js': planningMock,
    './analysis.js': analysisMock,
  })

describe('Artillery Acceptance', () => {
  const testTimeNow = 111111111111111
  const testScript = { name: 'test-acceptance-script' }
  const testScriptSampling = { name: 'test-acceptance-script-sampling' }
  const testPlans = []
  const testSettings = { prop: 'value' }
  const testResults = { results: 'acceptance-results' }

  beforeEach(() => {
    sandbox.on(samplingMock, 'applyAcceptanceSamplingToScript', () => testScriptSampling)
    sandbox.on(planningMock, 'planSamples', () => testPlans)
    sandbox.on(analysisMock, 'analyzeAcceptance', () => {})
    sandbox.on(artilleryTaskMock, 'executeAll', () => Promise.resolve(testResults))
  })

  it('uses sampling for planning the load', () =>
    artilleryAcceptance(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(samplingMock.applyAcceptanceSamplingToScript).to.have.been.called.once
        expect(samplingMock.applyAcceptanceSamplingToScript).to.have.been.called.with.exactly(testScript, testSettings)
        expect(planningMock.planSamples).to.have.been.called.once
        expect(planningMock.planSamples).to.have.been.called.with.exactly(testTimeNow, testScriptSampling, testSettings)
      })
  )

  it('calls artillery task to execute the load', () =>
    artilleryAcceptance(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(artilleryTaskMock.executeAll).to.have.been.called.once
        expect(artilleryTaskMock.executeAll).to.have.been.called.with.exactly(testScriptSampling, testSettings, testPlans, testTimeNow)
      })
  )

  it('analyzes results using acceptance criteria', () =>
    artilleryAcceptance(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(analysisMock.analyzeAcceptance).to.have.been.called.once
        expect(analysisMock.analyzeAcceptance).to.have.been.called.with.exactly(testTimeNow, testScriptSampling, testSettings, testResults)
      })
  )

  afterEach(() => {
    sandbox.restore()
  })
})
