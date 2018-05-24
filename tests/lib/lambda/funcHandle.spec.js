const BbPromise = require('bluebird')
const chai = require('chai')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

BbPromise.longStackTraces()
chai.use(sinonChai)

const { expect, assert } = chai

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
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.callback = callback
        func.handle.impl.handleUnhandledRejection(new Error('tag'), error)
        expect(error).to.have.been.calledOnce
        expect(callback).to.have.been.calledOnce
      })
    })
    describe('#handleTimeout', () => {
      it('prints to the console and calls the callback', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.callback = callback
        func.handle.impl.handleTimeout(error)
        expect(error).to.have.been.calledOnce
        expect(callback).to.have.been.calledOnce
      })
      it('only calls the handler once despite repeated calls', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.callback = callback
        func.handle.impl.handleTimeout(error)
        func.handle.impl.handleTimeout(error)
        expect(callback).to.have.been.calledOnce
      })
    })
    describe('#handler', () => {
      it('stores the given context and callback on the module exports', () => {
        const handler = func.handle(() => BbPromise.resolve())
        return new Promise((resolve, reject) => {
          const callback = (err, result) =>
            (err ? reject(err) : resolve(result))
          handler({}, context, callback)
            .then(() => {
              expect(func.handle.context).to.equal(context)
              expect(func.handle.callback).to.equal(callback)
            })
        })
      })
      it('calls the given taskHandler with the given event', () => {
        const event = {}
        const handler = func.handle((script) => {
          expect(script).to.be.equal(event)
          return BbPromise.resolve()
        })
        return new Promise((resolve, reject) => {
          handler(event, context, (err, result) =>
            (err ? reject(err) : resolve(result)))
        })
      })
      it('reports the resolved value', () => {
        const value = {}
        const handler = func.handle(() => BbPromise.resolve(value))
        const callback = (err, res) =>
          expect(res).to.equal(value)
        return handler({}, context, callback)
      })
      it('handles exceptions from the task handler and reports an error', () => {
        const handler = func.handle(() => BbPromise.resolve())
        const callback = (err, res) =>
          expect(res).to.have.string('Error validating event: ')
        return handler(
          { _split: { maxChunkDurationInSeconds: 'not a number' } },
          context,
          callback,
          undefined,
          () => {})
      })
      it('handles exceptions thrown within the task handler promise chain, reporting an error', () => {
        const handler = func.handle(() => BbPromise.resolve().then(() => { throw new Error('rejected') }))
        const callback = (err, res) =>
          expect(res).to.have.string('Error executing task: ')
        return handler({}, context, callback, undefined, () => {})
      })
      it('handles promise rejections within the task handler promise chain, reporting an error', () => {
        const handler = func.handle(() => BbPromise.reject(new Error('rejected')))
        const callback = (err, res) =>
          expect(res).to.have.string('Error executing task: ')
        return handler({}, context, callback, undefined, () => {})
      })
      it('times out prior to given limits', () => {
        func.def.MAX_TIMEOUT_BUFFER_IN_MILLISECONDS = 1
        // DANGER: removing this line fails the test (side effects):
        timeoutInMs = 10
        const handler = func.handle(() =>
          new Promise(resolve => setTimeout(resolve, timeoutInMs * 2)))
        const handleTimeout = () => {
          handleTimeout.calls = (handleTimeout.calls || 0) + 1
        }
        const mergeIf = input => Promise.resolve(input)
        return new Promise((resolve, reject) => {
          const callback = (err, res) => (err ? reject(err) : resolve(res))
          handler({}, context, callback, mergeIf, undefined, handleTimeout)
        })
          .then(() => assert.strictEqual(handleTimeout.calls, 1))
      })
      it('merges objects with a root merge attribute', (done) => {
        const input = {
          '>>': './lib/lambda/foo',
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
        const readScript = () => Promise.resolve({
          foo: {
            bar: '1',
            baz: '2',
          },
        })
        const mergeIf = mergeInput =>
          func.handle.impl.mergeIf(mergeInput, readScript)
        handler(input, context, () => { done() }, mergeIf)
      })
      describe('getScriptPath', () => {
        const {
          getScriptPath,
          localPathError,
        } = func.handle.impl
        it('should fail for non-local absolute path', () =>
          assert.throws(
            () => getScriptPath('/foo', undefined, '/bar'),
            localPathError))
        it('should fail for non-local relative path', () =>
          assert.throws(
            () => getScriptPath('../foo', () => '/foo', '/bar'),
            localPathError))
        it('should succeed for absolute local path', () =>
          assert.strictEqual(
            getScriptPath('/foo/bar', undefined, '/foo'),
            '/foo/bar'))
        it('should succeed for relative local path', () =>
          assert.strictEqual(
            getScriptPath('bar', p => `/foo/${p}`, '/foo'),
            '/foo/bar'))
      })
      describe('readScript', () => {
        const {
          readScript,
          readScriptError,
        } = func.handle.impl
        const mockReadFile = (err, data) =>
          (...args) => args[args.length - 1](err, data)
        it('should get the script path before reading', () => {
          const getScriptPath = sinon.stub().callsFake(p => p)
          const readFile = mockReadFile(undefined, 'bar')
          return readScript('foo', readFile, sinon.stub(), getScriptPath)
            .then(() => getScriptPath.calledWithExactly('foo'))
        })
        it('should log error with a bad script path', () => {
          const readFile = mockReadFile(undefined, 'bar')
          const log = sinon.stub()
          return readScript('../foo', readFile, log)
            .catch(err => err)
            .then(err =>
              log.calledWithExactly(readScriptError, '../foo', err.stack))
        })
        it('should log error with a failed read', () => {
          const readFile = mockReadFile(new Error('bar'))
          const log = sinon.stub()
          return readScript('../foo', readFile, log)
            .catch(err => err)
            .then(err =>
              log.calledWithExactly(readScriptError, '../foo', err.stack))
        })
        it('should parse yml', () => {
          const readFile = mockReadFile(undefined, 'bar: baz')
          const log = sinon.stub()
          return readScript('foo', readFile, log, p => p)
            .then(data => assert.deepStrictEqual(data, { bar: 'baz' }))
        })
        it('should parse json', () => {
          const readFile = mockReadFile(undefined, '{"bar": "baz"}')
          const log = sinon.stub()
          return readScript('foo', readFile, log, p => p)
            .then(data => assert.deepStrictEqual(data, { bar: 'baz' }))
        })
      })
    })
  })
})
