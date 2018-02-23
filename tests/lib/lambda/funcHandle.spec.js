const chai = require('chai')
const path = require('path')

const expect = chai.expect

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', 'lib', 'lambda', 'func.js'))

describe('./lib/lambda/funcHandle.js', () => {
  afterEach(() => {
    delete func.handle.callback
    delete func.handle.context
  })
  describe(':impl', () => {
    describe('#handleUnhandledRejection', () => {
      it('prints to the console and calls the callback', () => {
        const consoleLog = console.log
        let logCalled = false
        console.log = () => { logCalled = true }
        let callbackCalled = false
        func.handle.callback = () => { callbackCalled = true }
        func.handle.impl.handleUnhandledRejection(new Error('tag'))
        expect(logCalled).to.be.true
        expect(callbackCalled).to.be.true
        console.log = consoleLog
      })
    })
    describe('#handler', () => {
      it('stores the given context and callback on the module exports', () => {
        const handler = func.handle(() => Promise.resolve())
        const context = {}
        const callback = () => {}
        handler({}, context, callback)
        expect(func.handle.context).to.equal(context)
        expect(func.handle.callback).to.equal(callback)
      })
      it('calls the given taskHandler with the given event', () => {
        const event = {}
        let observed
        const handler = func.handle((script) => {
          observed = script
          return Promise.resolve()
        })
        handler(event, {}, () => {})
        expect(observed).to.be.equal(event)
      })
      it('reports the resolved value', () => {
        const value = {}
        const handler = func.handle(() => Promise.resolve(value))
        const callback = (err, res) => { expect(res).to.equal(value) }
        handler({}, context, callback)
      })
      it('handles exceptions from the task handler and reports an error', () => {
        const handler = func.handle(() => Promise.resolve())
        const callback = (err, res) => {
          expect(res).to.have.string('Error validating event: ')
        }
        handler({ _split: { maxChunkDurationInSeconds: 'not a number' } }, null, callback)
      })
      it('handles exceptions thrown within the task handler promise chain, reporting an error', () => {
        const handler = func.handle(() => Promise.resolve().then(() => { throw new Error('rejected') }))
        const callback = (err, res) => { expect(res).to.have.string('Error executing task: ') }
        handler({}, null, callback)
      })
      it('handles promise rejections within the task handler promise chain, reporting an error', () => {
        const handler = func.handle(() => Promise.reject(new Error('rejected')))
        const callback = (err, res) => { expect(res).to.have.string('Error executing task: ') }
        handler({}, null, callback)
      })
    })
  })
})
