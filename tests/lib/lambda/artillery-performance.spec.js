const chai = require('chai')
const spies = require('chai-spies')
const proxyquire = require('proxyquire')

chai.use(spies)

const sandbox = chai.spy.sandbox()
const { expect } = chai

const planningMock = {}
const analysisMock = {}
const artilleryTaskMock = {}

const artilleryPerformance = proxyquire(
  '../../../lib/lambda/artillery-performance.js', {
    './planning.js': planningMock,
    './analysis.js': analysisMock,
  })

describe('Artillery Performance', () => {
  const testTimeNow = 111111111111111
  const testScript = { name: 'test-performance-script' }
  const testPlans = []
  const testSettings = { prop: 'value' }
  const testResults = { results: 'performance-results' }

  beforeEach(() => {
    sandbox.on(planningMock, 'planPerformance', () => testPlans)
    sandbox.on(analysisMock, 'analyzePerformance', () => {})
    sandbox.on(artilleryTaskMock, 'executeAll', () => Promise.resolve(testResults))
  })

  it('plans the load', () =>
    artilleryPerformance(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(planningMock.planPerformance).to.have.been.called.once
        expect(planningMock.planPerformance).to.have.been.called.with.exactly(testTimeNow, testScript, testSettings)
      })
  )

  it('calls artillery task to execute the load', () =>
    artilleryPerformance(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(artilleryTaskMock.executeAll).to.have.been.called.once
        expect(artilleryTaskMock.executeAll).to.have.been.called.with.exactly(testScript, testSettings, testPlans, testTimeNow)
      })
  )

  it('analyzes results using acceptance criteria', () =>
    artilleryPerformance(artilleryTaskMock).execute(testTimeNow, testScript, testSettings)
      .then(() => {
        expect(analysisMock.analyzePerformance).to.have.been.called.once
        expect(analysisMock.analyzePerformance).to.have.been.called.with.exactly(testTimeNow, testScript, testSettings, testResults)
      })
  )

  afterEach(() => {
    sandbox.restore()
  })
})
