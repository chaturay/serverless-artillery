/* eslint-disable no-underscore-dangle */
const chai = require('chai')
// const chaiAsPromised = require('chai-as-promised')
const path = require('path')
// const sinon = require('sinon')
// const sinonChai = require('sinon-chai')

// chai.use(chaiAsPromised)
// chai.use(sinonChai)

const { expect } = chai

const handler = require(path.join('..', '..', '..', 'lib', 'lambda', 'handler.js')) // eslint-disable-line import/no-dynamic-require

describe('AWS lambda handler', () => {
  describe('global behavior', () => {
    it('listens for unhandled rejections', () => {
      const rejectionListeners = process.listeners('unhandledRejection')
      expect(rejectionListeners.length).to.equal(1)
    })
  })

  describe('handler factory', () => {
    it('provides handler function when provided a task and settings for the platform', () => {
      const aHandler = handler.lambdaHandler.createHandler({}, {})
      expect(aHandler).to.be.a('function')
    })
  })

  describe('event handler', () => {
    it('passes platform settings to the task', () => {
      const aHandler = handler.lambdaHandler.createHandler({
        executeTask: (script, settings) => {
          expect(settings.aProperty).to.equal('aValue')
          return Promise.resolve()
        },
      }, {
        getSettings: () => ({ aProperty: 'aValue' }),
      })

      aHandler({}, { functionName: '' }, () => {})
    })

    it('passes the script to the task', () => {
      const aHandler = handler.lambdaHandler.createHandler({
        executeTask: (script) => {
          expect(script.aProperty).to.equal('scriptValue')
          return Promise.resolve()
        },
      }, {
        getSettings: () => ({}),
      })

      aHandler({ aProperty: 'scriptValue' }, { functionName: '' }, () => {})
    })

    it('decorates the script with AWS function name', () => {
      const aHandler = handler.lambdaHandler.createHandler({
        executeTask: (script) => {
          expect(script._funcAws.functionName).to.equal('aws-func-name')
          return Promise.resolve()
        },
      }, {
        getSettings: () => ({}),
      })

      aHandler({}, { functionName: 'aws-func-name' }, () => {})
    })
  })
})

// describe('./lib/lambda/handler.js', () => {
//   describe(':impl', () => {
//     describe('#delay', () => {
//       let setTimeoutStub
//       beforeEach(() => {
//         setTimeoutStub = sinon.stub(global, 'setTimeout').callsFake(
//           (callback, milliseconds, arg1, arg2, arg3) => process.nextTick(() => callback(arg1, arg2, arg3)) // eslint-disable-line comma-dangle
//         )
//       })
//       afterEach(() => {
//         setTimeoutStub.restore()
//       })
//       it('resolves immediately for zero ms delay amounts', () =>
//         expect(handler.impl.delay(0)).to.eventually.be.fulfilled
//           .then(() => expect(setTimeoutStub).to.not.be.called) // eslint-disable-line comma-dangle
//       )
//       it('resolves immediately for negative ms delay amounts', () =>
//         expect(handler.impl.delay(-1)).to.eventually.be.fulfilled
//           .then(() => expect(setTimeoutStub).to.not.be.called) // eslint-disable-line comma-dangle
//       )
//       it('uses setTimeout with the given ms delay for positive amounts', () =>
//         expect(handler.impl.delay(1)).to.eventually.be.fulfilled
//           .then(() => expect(setTimeoutStub).to.have.been.calledWithExactly(sinon.match.func, 1)) // eslint-disable-line comma-dangle
//       )
//     })
//     describe('#invokeSelf', () => {
//       let implDelayStub
//       let implHandleStub
//       const implHandleResult = {}
//       let funcExecStub
//       const funcExecResult = {}
//       beforeEach(() => {
//         implDelayStub = sinon.stub(handler.impl, 'delay').returns(Promise.resolve())
//         implHandleStub = sinon.stub(handler.impl, 'handle').returns(Promise.resolve(implHandleResult))
//         funcExecStub = sinon.stub(func, 'exec').returns(Promise.resolve(funcExecResult))
//       })
//       afterEach(() => {
//         implDelayStub.restore()
//         implHandleStub.restore()
//         funcExecStub.restore()
//       })
//       it('executes the given event via impl.handle when in simulation mode', () =>
//         handler.impl.invokeSelf(0, { _simulation: true })
//           .then((result) => {
//             expect(result).to.equal(implHandleResult)
//             expect(implHandleStub).to.be.calledOnce
//             expect(funcExecStub).to.not.be.called
//           }) // eslint-disable-line comma-dangle
//       )
//       it('executes the given event via func.exec when in standard mode', () =>
//         handler.impl.invokeSelf(0, {})
//           .then((result) => {
//             expect(result).to.equal(funcExecResult)
//             expect(implHandleStub).to.not.be.called
//             expect(funcExecStub).to.be.calledOnce
//           }) // eslint-disable-line comma-dangle
//       )
//       it('executes the given event via func.exec when in standard and trace modes', () =>
//         handler.impl.invokeSelf(0, { _trace: true })
//           .then((result) => {
//             expect(result).to.equal(funcExecResult)
//             expect(implHandleStub).to.not.be.called
//             expect(funcExecStub).to.be.calledOnce
//           }) // eslint-disable-line comma-dangle
//       )
//     })
//
//     describe('#distribute', () => {
//       let implInvokeSelfStub
//       const implInvokeSelfResult = {}
//       let taskResultStub
//       const taskResultResult = {}
//       beforeEach(() => {
//         implInvokeSelfStub = sinon.stub(handler.impl, 'invokeSelf').returns(Promise.resolve(implInvokeSelfResult))
//         taskResultStub = sinon.stub(task, 'result').returns(Promise.resolve(taskResultResult))
//       })
//       afterEach(() => {
//         implInvokeSelfStub.restore()
//         taskResultStub.restore()
//       })
//       it('invokes itself once for each given plan, returning the consequence of task.result', () => {
//         const plans = [{}, {}, {}]
//         return expect(
//           handler.impl.distribute(1, {}, defaultSettings, plans)
//             .then((result) => {
//               expect(implInvokeSelfStub).to.have.callCount(plans.length)
//               expect(result).to.equal(taskResultResult)
//             }) // eslint-disable-line comma-dangle
//         ).to.eventually.be.fulfilled
//       })
//       it('invokes itself once for each given plan, returning the consequence of task.result, even in trace mode', () => {
//         const plans = [{}, {}, {}]
//         return expect(
//           handler.impl.distribute(1, { _trace: true }, defaultSettings, plans)
//             .then((result) => {
//               expect(implInvokeSelfStub).to.have.callCount(plans.length)
//               expect(result).to.equal(taskResultResult)
//             }) // eslint-disable-line comma-dangle
//         ).to.eventually.be.fulfilled
//       })
//       it('calls task.result for every invocation result', () => {
//         const plans = [{}, {}, {}, {}, {}]
//         return expect(handler.impl.distribute(1, {}, defaultSettings, plans))
//           .to.eventually.eql(taskResultResult)
//           .then(() => {
//             const resultArg = taskResultStub.getCall(0).args[3]
//             expect(resultArg.length).to.equal(plans.length)
//             resultArg.forEach(result => expect(result).to.equal(implInvokeSelfResult))
//           }) // eslint-disable-line comma-dangle
//       })
//       it('returns the consequence of task.result in trace mode', () =>
//         expect(handler.impl.distribute(1, { trace: true }, defaultSettings, [{}]))
//           .to.eventually.eql(taskResultResult) // eslint-disable-line comma-dangle
//       )
//     })
//
//     describe('#execute', () => {
//       let implDelayStub
//       let taskExecStub
//       const taskExecResult = {}
//       let taskResultStub
//       const taskResultResult = {}
//       beforeEach(() => {
//         implDelayStub = sinon.stub(handler.impl, 'delay').returns(Promise.resolve())
//         taskExecStub = sinon.stub(task, 'exec').returns(Promise.resolve(taskExecResult))
//         taskResultStub = sinon.stub(task, 'result').returns(Promise.resolve(taskResultResult))
//       })
//       afterEach(() => {
//         implDelayStub.restore()
//         taskExecStub.restore()
//         taskResultStub.restore()
//       })
//       it('sets the start time of the given script to the given timeNow if none exists', () => {
//         const timeNow = 'not really a time'
//         const script = {}
//         return handler.impl.execute(timeNow, script, defaultSettings, script)
//           .then(() => expect(script._start).to.equal(timeNow)) // eslint-disable-line no-underscore-dangle
//       })
//       it('does not change the start time if a script comes with one', () => {
//         const timeNow = 'not really a time'
//         const script = { _start: timeNow }
//         return handler.impl.execute('also not a time', script, defaultSettings, script)
//           .then(() => expect(script._start).to.equal(timeNow)) // eslint-disable-line no-underscore-dangle
//       })
//       it('also does not change the start time in trace mode', () => {
//         const timeNow = 'not really a time'
//         const script = { _start: timeNow, _trace: true }
//         return handler.impl.execute('also not a time', script, defaultSettings, script)
//           .then(() => expect(script._start).to.equal(timeNow)) // eslint-disable-line no-underscore-dangle
//       })
//       it('passes the sourceEvent to task.result (rather than the event to execute)', () => {
//         const sourceEvent = { _start: 1 }
//         const event = { _start: 2 }
//         return handler.impl.execute(1, sourceEvent, defaultSettings, event)
//           .then(() => expect(taskResultStub.args[0][1]).to.equal(sourceEvent))
//       })
//       describe('error logging', () => {
//         let consoleErrorStub
//         beforeEach(() => {
//           consoleErrorStub = sinon.stub(console, 'error').returns()
//         })
//         afterEach(() => {
//           consoleErrorStub.restore()
//         })
//         it('logs and throws errors that are throw up the promise chain by impl.deploy', () => {
//           implDelayStub.throws(new Error('impl.deploy'))
//           return expect(() => handler.impl.execute(Date.now(), {}, defaultSettings, {})).to.throw()
//         })
//         it('logs and throws errors resulting from a rejection by impl.deploy', () => {
//           implDelayStub.returns(Promise.reject(new Error('impl.deploy')))
//           return expect(handler.impl.execute(Date.now(), {}, defaultSettings, {}))
//             .to.eventually.be.rejected
//             .then(() => expect(consoleErrorStub).to.have.been.called)
//         })
//         it('logs and throws errors that are throw up the promise chain by task.exec', () => {
//           taskExecStub.throws(new Error('task.exec'))
//           return expect(handler.impl.execute(Date.now(), {}, defaultSettings, {}))
//             .to.eventually.be.rejected
//             .then(() => expect(consoleErrorStub).to.have.been.called)
//         })
//         it('logs and throws errors resulting from a rejection by task.exec', () => {
//           taskExecStub.returns(Promise.reject(new Error('task.exec')))
//           return expect(handler.impl.execute(Date.now(), {}, defaultSettings, {}))
//             .to.eventually.be.rejected
//             .then(() => expect(consoleErrorStub).to.have.been.called)
//         })
//         it('logs and throws errors that are throw up the promise chain by task.result', () => {
//           taskResultStub.throws(new Error('task.result'))
//           return expect(handler.impl.execute(Date.now(), {}, defaultSettings, {}))
//             .to.eventually.be.rejected
//             .then(() => expect(consoleErrorStub).to.have.been.called)
//         })
//         it('logs and throws errors resulting from a rejection by task.result', () => {
//           taskResultStub.returns(Promise.reject(new Error('task.result')))
//           return expect(handler.impl.execute(Date.now(), {}, defaultSettings, {}))
//             .to.eventually.be.rejected
//             .then(() => expect(consoleErrorStub).to.have.been.called)
//         })
//       })
//     })
//
//     describe('#handle', () => {
//       let taskValidStub
//       let taskPlanStub
//       let implDistributeStub
//       let implExecuteStub
//       beforeEach(() => {
//         taskValidStub = sinon.stub(task, 'valid').returns()
//         taskPlanStub = sinon.stub(task, 'plan').returns([])
//         implDistributeStub = sinon.stub(handler.impl, 'distribute').returns(Promise.resolve())
//         implExecuteStub = sinon.stub(handler.impl, 'execute').returns(Promise.resolve())
//       })
//       afterEach(() => {
//         taskValidStub.restore()
//         taskPlanStub.restore()
//         implDistributeStub.restore()
//         implExecuteStub.restore()
//       })
//       it('throws if task.valid throws', () => {
//         taskValidStub.throws(new Error('task.valid'))
//         expect(() => handler.impl.handle({})).to.throw(Error)
//           .that.satisfies(() => {
//             expect(taskValidStub).to.have.been.calledOnce
//             expect(taskPlanStub).to.not.have.been.called
//             expect(implDistributeStub).to.not.have.been.called
//             expect(implExecuteStub).to.not.have.been.called
//             return true
//           })
//       })
//       it('distributes multiple plans', () => {
//         taskPlanStub.returns([{}, {}])
//         expect(handler.impl.handle({}))
//           .to.eventually.be.fulfilled
//           .then(() => {
//             expect(taskValidStub).to.have.been.calledOnce
//             expect(taskPlanStub).to.have.been.calledOnce
//             expect(implDistributeStub).to.have.been.calledOnce
//             expect(implExecuteStub).to.not.have.been.called
//           })
//       })
//       it('executes singular plans', () => {
//         taskPlanStub.returns([{}])
//         expect(handler.impl.handle({}))
//           .to.eventually.be.fulfilled
//           .then(() => {
//             expect(taskValidStub).to.have.been.calledOnce
//             expect(taskPlanStub).to.have.been.calledOnce
//             expect(implDistributeStub).to.not.have.been.called
//             expect(implExecuteStub).to.have.been.calledOnce
//           })
//       })
//       it('rejects a lack of plans', () => {
//         taskPlanStub.returns([])
//         expect(handler.impl.handle({}))
//           .to.eventually.be.rejected
//           .then(() => {
//             expect(taskValidStub).to.have.been.calledOnce
//             expect(taskPlanStub).to.have.been.calledOnce
//             expect(implDistributeStub).to.not.have.been.called
//             expect(implExecuteStub).to.not.have.been.called
//           })
//       })
//     })
//   })
// })
