const BbPromise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

BbPromise.longStackTraces()
chai.use(sinonChai)
chai.use(chaiAsPromised)

const { expect, assert } = chai

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', 'lib', 'lambda', 'func.js'))

describe('./lib/lambda/funcHandle.js', () => {
  describe(':impl', () => {
    describe('#createUnhandledRejectionHandler', () => {
      it('should print to the console', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.impl.createUnhandledRejectionHandler(callback, error)(new Error('tag'))
        expect(error).to.have.been.calledOnce
      })
      it('should call the callback', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.impl.createUnhandledRejectionHandler(callback, error)(new Error('tag'))
        expect(callback).to.have.been.calledOnce
      })
    })
    describe('#handleTimeout', () => {
      it('should print to the console', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.impl.handleTimeout(callback, error)
        expect(error).to.have.been.calledOnce
      })
      it('should call the callback', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.impl.handleTimeout(callback, error)
        expect(callback).to.have.been.calledOnce
      })
    })
    describe('#lambdaEntryPoint', () => {
      const { lambdaEntryPoint } = func.handle.impl
      it('should capture an unhandled rejection', () => {
        const handler = sinon.stub().returns(BbPromise.delay(20))
        const unhandledException = new Error('reasons')
        const context = { getRemainingTimeInMillis: () => 60000 }
        setTimeout(() => Promise.reject(unhandledException), 10)
        return new Promise((resolve, reject) => {
          const createUnhandledRejectionHandler = sinon.stub().callsFake(resolveTask =>
            (ex) => {
              try {
                assert.strictEqual(ex, unhandledException)
                resolveTask()
                resolve()
              } catch (err) {
                reject(err)
              }
            })
          const entry = lambdaEntryPoint({ createUnhandledRejectionHandler, handler })()
          entry({}, context, sinon.stub())
        })
      })
      it('should time out', () => {
        const createUnhandledRejectionHandler = func.handle.impl.createUnhandledRejectionHandler
        const handler = sinon.stub()
          .returns(new Promise(resolve => setTimeout(resolve, 20)))
        const handleTimeout = sinon.stub().callsFake(resolve =>
          resolve('reasons'))
        const context = { getRemainingTimeInMillis: () => 20 }
        return new Promise((resolve, reject) => {
          const entry = lambdaEntryPoint(
            { createUnhandledRejectionHandler, handleTimeout, handler },
            10
          )()
          const callback = (err, result) => { err ? reject(err) : resolve(result) }
          entry({}, context, callback)
        })
          .then(result => assert.strictEqual(result, 'reasons'))
      })
      it('should invoke the handler', () => {
        const { createUnhandledRejectionHandler, handleTimeout } = func.handle.impl
        const answer = {}
        const handler = sinon.stub().returns(Promise.resolve(answer))
        const context = { getRemainingTimeInMillis: () => 60000 }
        const taskHandler = () => {}
        const input = {}
        return new Promise((resolve, reject) => {
          const entry = lambdaEntryPoint(
            { createUnhandledRejectionHandler, handleTimeout, handler }
          )(taskHandler)
          const callback = (err, result) => { err ? reject(err) : resolve(result) }
          entry(input, context, callback)
        })
          .then((result) => {
            assert.strictEqual(result, answer)
            assert.isOk(handler.calledWithExactly(taskHandler, input))
          })
      })
      it('should return a message on handler error', () => {
        const { createUnhandledRejectionHandler, handleTimeout } = func.handle.impl
        const handler = sinon.stub()
          .returns(Promise.reject(new Error('reasons')))
        const context = { getRemainingTimeInMillis: () => 60000 }
        const input = {}
        return new Promise((resolve, reject) => {
          const entry = lambdaEntryPoint(
            { createUnhandledRejectionHandler, handleTimeout, handler }
          )()
          const callback = (err, result) => { err ? reject(err) : resolve(result) }
          entry(input, context, callback)
        })
          .then(result =>
            assert.strictEqual(result, 'Error executing handler: reasons'))
      })
    })
    describe('#mergeIf', () => {
      const mergeIf = func.handle.impl.mergeIf
      it('should read the designated merge file', () => {
        const readMergeFile = sinon.stub().returns(Promise.resolve({}))
        return mergeIf({ '>>': 'foo' }, readMergeFile)
          .then(() => assert.isOk(readMergeFile.calledWithExactly('foo')))
      })
      it('should merge objects with a root merge attribute', () => {
        const input = {
          '>>': './lib/lambda/foo',
          mode: 'mon',
          foo: {
            bar: '3',
          },
        }
        const readMergeFile = sinon.stub().returns(Promise.resolve({
          foo: {
            bar: '1',
            baz: '2',
          },
        }))
        const expected = {
          foo: {
            bar: '3',
            baz: '2',
          },
          mode: 'mon',
        }
        return mergeIf(input, readMergeFile)
          .then(event => assert.deepStrictEqual(event, expected))
      })
    })
    describe('#handler', () => {
      const handler = func.handle.impl.handler
      it('should call the given taskHandler with the given event', () => {
        const taskHandler = sinon.stub().returns(Promise.resolve())
        const event = {}
        const mergeIf = () => Promise.resolve(event)
        return handler(taskHandler, event, mergeIf)
          .then(() => assert.isOk(taskHandler.calledWithExactly(event)))
      })
      it('should handle exceptions from the task handler and reports an error', () => {
        const taskHandler = sinon.stub()
          .returns(Promise.reject(new Error('reasons')))
        const event = {}
        const mergeIf = () => Promise.resolve(event)
        const expected = 'Error executing task: reasons'
        return handler(taskHandler, event, mergeIf, sinon.stub())
          .then(result => assert.strictEqual(result, expected))
      })
      it('should handle merge exceptions and reports an error', () => {
        const taskHandler = sinon.stub().returns(Promise.resolve())
        const event = {}
        const mergeIf = () => Promise.reject(new Error('reasons'))
        const expected = 'Error validating event: reasons'
        return handler(taskHandler, event, mergeIf, sinon.stub())
          .then(result => assert.strictEqual(result, expected))
      })
    })
    describe('#getMergeFilePath', () => {
      const { getMergeFilePath } = func.handle.impl
      it('should fail for missing path', () =>
        assert.isRejected(
          getMergeFilePath(),
          "'undefined' is not a valid path."
        )
      )
      it('should fail for non-string path', () =>
        assert.isRejected(
          getMergeFilePath({ foo: 'bar' }),
          "'object' is not a valid path."
        )
      )
      it('should fail for non-local absolute path', () =>
        assert.isRejected(
          getMergeFilePath('/foo', undefined, '/bar'),
          'Merge file /foo is not a local file path.'
        )
      )
      it('should fail for non-local relative path', () =>
        assert.isRejected(
          getMergeFilePath('../foo', () => '/foo', '/bar'),
          'Merge file /foo is not a local file path.'
        )
      )
      it('should succeed for absolute local path', () =>
        assert.isFulfilled(
          getMergeFilePath('/foo/bar', undefined, '/foo'),
          '/foo/bar'
        )
      )
      it('should succeed for relative local path', () =>
        assert.isFulfilled(
          getMergeFilePath('bar', p => `/foo/${p}`, '/foo'),
          '/foo/bar'
        )
      )
    })
    describe('#readMergeFile', () => {
      const { readMergeFile } = func.handle.impl
      const getMergeFilePath = sinon.stub().callsFake(p => Promise.resolve(p))
      it('should get the merge file path before reading', () => {
        const readFile = sinon.stub().returns(Promise.resolve('bar'))
        return readMergeFile('foo', readFile, sinon.stub(), getMergeFilePath)
          .then(() => getMergeFilePath.calledWithExactly('foo'))
      })
      it('should log error with a bad merge file path', () => {
        const readFile = sinon.stub().returns(Promise.resolve('bar'))
        const log = sinon.stub()
        return readMergeFile('../foo', readFile, log)
          .catch(err => err)
          .then(err =>
            log.calledWithExactly(
              'Failed to read merge file.',
              '../foo',
              err.stack
            )
          )
      })
      it('should log error with a failed read', () => {
        const readFile = sinon.stub()
          .callsFake(() => Promise.reject(new Error('reasons')))
        const log = sinon.stub()
        return readMergeFile('../foo', readFile, log)
          .catch(err => err)
          .then(err =>
            log.calledWithExactly(
              'Failed to read merge file.',
              '../foo',
              err.stack
            )
          )
      })
      it('should parse yml', () => {
        const readFile = sinon.stub().returns(Promise.resolve('bar: baz'))
        const log = sinon.stub()
        return readMergeFile('foo', readFile, log, getMergeFilePath)
          .then(data => assert.deepStrictEqual(data, { bar: 'baz' }))
      })
      it('should parse json', () => {
        const readFile = sinon.stub().returns(Promise.resolve('{"bar": "baz"}'))
        const log = sinon.stub()
        return readMergeFile('foo', readFile, log, getMergeFilePath)
          .then(data => assert.deepStrictEqual(data, { bar: 'baz' }))
      })
    })
  })
})
