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
    describe('#handleUnhandledRejection', () => {
      it('should print to the console', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.impl.handleUnhandledRejection(callback, error)(new Error('tag'))
        expect(error).to.have.been.calledOnce
      })
      it('should call the callback', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.impl.handleUnhandledRejection(callback, error)(new Error('tag'))
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
          const handleUnhandledRejection = sinon.stub().callsFake(resolveTask =>
            (ex) => {
              try {
                assert.strictEqual(ex, unhandledException)
                resolveTask()
                resolve()
              } catch (err) {
                reject(err)
              }
            })
          const entry = lambdaEntryPoint({ handleUnhandledRejection, handler })()
          entry({}, context, sinon.stub())
        })
      })
      it('should time out', () => {
        const handleUnhandledRejection = func.handle.impl.handleUnhandledRejection
        const handler = sinon.stub()
          .returns(new Promise(resolve => setTimeout(resolve, 20)))
        const handleTimeout = sinon.stub().callsFake(resolve =>
          resolve('reasons'))
        const context = { getRemainingTimeInMillis: () => 20 }
        return new Promise((resolve, reject) => {
          const entry = lambdaEntryPoint(
            { handleUnhandledRejection, handleTimeout, handler },
            10
          )()
          const callback = (err, result) => { err ? reject(err) : resolve(result) }
          entry({}, context, callback)
        })
          .then(result => assert.strictEqual(result, 'reasons'))
      })
      it('should invoke the handler', () => {
        const { handleUnhandledRejection, handleTimeout } = func.handle.impl
        const answer = {}
        const handler = sinon.stub().returns(Promise.resolve(answer))
        const context = { getRemainingTimeInMillis: () => 60000 }
        const taskHandler = () => {}
        const input = {}
        return new Promise((resolve, reject) => {
          const entry = lambdaEntryPoint(
            { handleUnhandledRejection, handleTimeout, handler }
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
        const { handleUnhandledRejection, handleTimeout } = func.handle.impl
        const handler = sinon.stub()
          .returns(Promise.reject(new Error('reasons')))
        const context = { getRemainingTimeInMillis: () => 60000 }
        const input = {}
        return new Promise((resolve, reject) => {
          const entry = lambdaEntryPoint(
            { handleUnhandledRejection, handleTimeout, handler }
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
      it('should read the designated script', () => {
        const readScript = sinon.stub().returns(Promise.resolve({}))
        return mergeIf({ '>>': 'foo' }, readScript)
          .then(() => assert.isOk(readScript.calledWithExactly('foo')))
      })
      it('should merge objects with a root merge attribute', () => {
        const input = {
          '>>': './lib/lambda/foo',
          mode: 'mon',
          foo: {
            bar: '3',
          },
        }
        const readScript = sinon.stub().returns(Promise.resolve({
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
        return mergeIf(input, readScript)
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
    describe('#getScriptPath', () => {
      const { getScriptPath } = func.handle.impl
      it('should fail for non-local absolute path', () =>
        assert.isRejected(
          getScriptPath('/foo', undefined, '/bar'),
          'Input script /foo is not a local file path.'
        )
      )
      it('should fail for non-local relative path', () =>
        assert.isRejected(
          getScriptPath('../foo', () => '/foo', '/bar'),
          'Input script /foo is not a local file path.'
        )
      )
      it('should succeed for absolute local path', () =>
        assert.isFulfilled(
          getScriptPath('/foo/bar', undefined, '/foo'),
          '/foo/bar'
        )
      )
      it('should succeed for relative local path', () =>
        assert.isFulfilled(
          getScriptPath('bar', p => `/foo/${p}`, '/foo'),
          '/foo/bar'
        )
      )
    })
    describe('#readScript', () => {
      const { readScript, readScriptError } = func.handle.impl
      const getScriptPath = sinon.stub().callsFake(p => Promise.resolve(p))
      it('should get the script path before reading', () => {
        const readFile = sinon.stub().returns(Promise.resolve('bar'))
        return readScript('foo', readFile, sinon.stub(), getScriptPath)
          .then(() => getScriptPath.calledWithExactly('foo'))
      })
      it('should log error with a bad script path', () => {
        const readFile = sinon.stub().returns(Promise.resolve('bar'))
        const log = sinon.stub()
        return readScript('../foo', readFile, log)
          .catch(err => err)
          .then(err =>
            log.calledWithExactly(readScriptError, '../foo', err.stack))
      })
      it('should log error with a failed read', () => {
        const readFile = sinon.stub()
          .callsFake(() => Promise.reject(new Error('reasons')))
        const log = sinon.stub()
        return readScript('../foo', readFile, log)
          .catch(err => err)
          .then(err =>
            log.calledWithExactly(readScriptError, '../foo', err.stack))
      })
      it('should parse yml', () => {
        const readFile = sinon.stub().returns(Promise.resolve('bar: baz'))
        const log = sinon.stub()
        return readScript('foo', readFile, log, getScriptPath)
          .then(data => assert.deepStrictEqual(data, { bar: 'baz' }))
      })
      it('should parse json', () => {
        const readFile = sinon.stub().returns(Promise.resolve('{"bar": "baz"}'))
        const log = sinon.stub()
        return readScript('foo', readFile, log, getScriptPath)
          .then(data => assert.deepStrictEqual(data, { bar: 'baz' }))
      })
    })
  })
})
