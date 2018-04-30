const BbPromise = require('bluebird')
const chai = require('chai')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

BbPromise.longStackTraces()
chai.use(sinonChai)

const expect = chai.expect

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', 'lib', 'lambda', 'func.js'))

describe('./lib/lambda/funcHandle.js', () => {
  const maxTimeoutBufferInMs = func.def.MAX_TIMEOUT_BUFFER_IN_MILLISECONDS
  let timeoutInMs
  const context = {
    getRemainingTimeInMillis: () => timeoutInMs,
  }
  beforeEach(() => {
    timeoutInMs = 300 * 1000
    func.def.MAX_TIMEOUT_BUFFER_IN_MILLISECONDS = maxTimeoutBufferInMs
    func.handle.done = false
  })
  afterEach(() => {
    if ('callback' in func.handle) {
      delete func.handle.callback
    }
    if ('context' in func.handle) {
      delete func.handle.context
    }
    if ('done' in func.handle) {
      delete func.handle.done
    }
  })
  describe(':impl', () => {
    describe('#handleUnhandledRejection', () => {
      it('prints to the console and calls the callback', () => {
        const consoleLog = console.error
        let logCalled = false
        console.error = () => { logCalled = true }
        try {
          let callbackCalled = false
          func.handle.callback = () => { callbackCalled = true }
          func.handle.impl.handleUnhandledRejection(new Error('tag'))
          expect(logCalled).to.be.true
          expect(callbackCalled).to.be.true
        } finally {
          console.error = consoleLog
        }
      })
    })
    describe('#handleTimeout', () => {
      it('prints to the console and calls the callback', () => {
        const consoleLog = console.error
        let logCalled = false
        console.error = () => { logCalled = true }
        try {
          let callbackCalled = false
          func.handle.callback = () => { callbackCalled = true }
          func.handle.impl.handleTimeout()
          expect(logCalled).to.be.true
          expect(callbackCalled).to.be.true
        } finally {
          console.error = consoleLog
        }
      })
      it('only calls the handler once despite repeated calls', () => {
        const callback = sinon.stub()
        func.handle.callback = callback
        func.handle.impl.handleTimeout()
        func.handle.impl.handleTimeout()
        expect(callback).to.have.been.calledOnce
      })
    })
    describe('#handler', () => {
      it('stores the given context and callback on the module exports', (done) => {
        const handler = func.handle(() => BbPromise.resolve())
        const callback = () => { done() }
        handler({}, context, callback)
        expect(func.handle.context).to.equal(context)
        expect(func.handle.callback).to.equal(callback)
      })
      it('calls the given taskHandler with the given event', (done) => {
        const event = {}
        let observed
        const handler = func.handle((script) => {
          observed = script
          return BbPromise.resolve()
        })
        handler(event, context, () => { done() })
        expect(observed).to.be.equal(event)
      })
      it('reports the resolved value', (done) => {
        const value = {}
        const handler = func.handle(() => BbPromise.resolve(value))
        const callback = (err, res) => {
          expect(res).to.equal(value)
          done()
        }
        handler({}, context, callback)
      })
      it('handles exceptions from the task handler and reports an error', (done) => {
        const handler = func.handle(() => BbPromise.resolve())
        const callback = (err, res) => {
          expect(res).to.have.string('Error validating event: ')
          done()
        }
        handler({ _split: { maxChunkDurationInSeconds: 'not a number' } }, context, callback)
      })
      it('handles exceptions thrown within the task handler promise chain, reporting an error', (done) => {
        const handler = func.handle(() => BbPromise.resolve().then(() => { throw new Error('rejected') }))
        const callback = (err, res) => {
          expect(res).to.have.string('Error executing task: ')
          done()
        }
        handler({}, context, callback)
      })
      it('handles promise rejections within the task handler promise chain, reporting an error', (done) => {
        const handler = func.handle(() => BbPromise.reject(new Error('rejected')))
        const callback = (err, res) => {
          expect(res).to.have.string('Error executing task: ')
          done()
        }
        handler({}, context, callback)
      })
      it('times out prior to given limits', (done) => {
        func.def.MAX_TIMEOUT_BUFFER_IN_MILLISECONDS = 1
        timeoutInMs = 10
        let promise
        const handler = func.handle(() => {
          promise = new BbPromise(resolve => setTimeout(resolve, timeoutInMs * 2))
          return promise
        })
        const callback = (err, res) => {
          expect(res).to.have.string('Error: function timeout')
          promise.then(done)
        }
        handler({}, context, callback)
      })
      it('merges objects with a root merge attribute', (done) => {
        const input = {
          '>>': {
            foo: {
              bar: '1',
              baz: '2',
            },
          },
          mode: 'mon',
          foo: {
            bar: '3',
          },
        }
        const expected = {
          foo: {
            bar: '3',
            baz: '2',
          },
          mode: 'mon',
        }
        const handler = func.handle((event) => {
          expect(event).to.eql(expected)
          return BbPromise.resolve()
        })
        handler(input, context, () => { done() })
      })
    })
  })
})
