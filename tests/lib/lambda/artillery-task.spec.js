const chai = require('chai')
const spies = require('chai-spies')
const proxyquire = require('proxyquire')

chai.use(spies)

const sandbox = chai.spy.sandbox()
const { expect } = chai

// ARTILLERY
const defaultArtilleryRun = (script, { output }) => {
  output({ aggregate: {} })
  process.exit(0)
}
const artilleryRun = {
  run: defaultArtilleryRun,
}
const artilleryMock = {
  run: (script, options) => artilleryRun.run(script, options),
}

// AWS
const awsLambdaMock = {
  invoke: () => ({
    promise: () => Promise.resolve({ Payload: '{}' }),
  }),
}
const awsMock = {
  // Declaring Lambda mock as a class
  Lambda: function () { // eslint-disable-line object-shorthand, func-names
    this.invoke = awsLambdaMock.invoke
  },
}

const acceptanceMock = {}
const monitoringMock = {}
const performanceMock = {}

const artilleryTask = proxyquire(
  '../../../lib/lambda/artillery-task.js', {
    artillery: artilleryMock,
    'aws-sdk': awsMock,
    './artillery-acceptance.js': () => acceptanceMock,
    './artillery-monitoring.js': () => monitoringMock,
    './artillery-performance.js': () => performanceMock,
  })

describe('Artillery Task', () => {
  it('uses performance strategy for scripts in performance mode', () => {
    performanceMock.execute = chai.spy()
    artilleryTask.executeTask({})
    expect(performanceMock.execute).to.have.been.called.once

    performanceMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'perf' })
    expect(performanceMock.execute).to.have.been.called.once

    performanceMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'performance' })
    expect(performanceMock.execute).to.have.been.called.once
  })

  it('uses acceptance strategy for scripts in acceptance mode', () => {
    acceptanceMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'acc' })
    expect(acceptanceMock.execute).to.have.been.called.once

    acceptanceMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'acceptance' })
    expect(acceptanceMock.execute).to.have.been.called.once
  })

  it('uses monitoring strategy for scripts in monitoring mode', () => {
    monitoringMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'mon' })
    expect(monitoringMock.execute).to.have.been.called.once

    monitoringMock.execute = chai.spy()
    artilleryTask.executeTask({ mode: 'monitoring' })
    expect(monitoringMock.execute).to.have.been.called.once
  })

  it('throws exception if an invalid mode is attempted', () => {
    expect(() => artilleryTask.executeTask({ mode: 'never-a-valid-mode' }))
      .to.throw('If specified, the mode attribute must be one of: "perf", "performance", "acc", "acceptance", "mon", "monitoring".')
  })

  it('executes a single plan', () => {
    sandbox.on(artilleryTask, 'execute')
    sandbox.on(artilleryRun, 'run', defaultArtilleryRun)

    return artilleryTask.executeAll({}, {}, [{}])
      .then(() => {
        expect(artilleryTask.execute).to.have.been.called.once
        expect(artilleryRun.run).to.have.been.called.once
      })
  })

  it('distributes and executed the load with multiple plans', () => {
    sandbox.on(artilleryTask, 'invoke', () => Promise.resolve({}))
    sandbox.on(artilleryTask, 'distribute')

    return artilleryTask.executeAll({}, {}, [{ _test: 'frist' }, { _test: 'second' }])
      .then(() => {
        expect(artilleryTask.distribute).to.have.been.called.once
        expect(artilleryTask.invoke).to.have.been.called.twice
        expect(artilleryTask.invoke).on.nth(1).be.called.with({ _test: 'frist' })
        expect(artilleryTask.invoke).on.nth(2).be.called.with({ _test: 'second' })
      })
  })

  it('uses aws lambda to distribute load', () => {
    sandbox.on(awsLambdaMock, 'invoke')

    const event = {
      _test: 'frist',
      _funcAws: {
        functionName: 'aws-function-name',
      },
    }

    return artilleryTask.invoke(event, 'invoke-type')
      .then(() => {
        expect(awsLambdaMock.invoke).to.have.been.called.once
        expect(awsLambdaMock.invoke).on.nth(1).be.called.with({
          FunctionName: event._funcAws.functionName, // eslint-disable-line no-underscore-dangle
          InvocationType: 'invoke-type',
          Payload: JSON.stringify(event),
        })
      })
  })

  afterEach(() => sandbox.restore())
})
