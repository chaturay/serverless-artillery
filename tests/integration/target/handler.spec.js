const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)
chai.use(chaiAsPromised)

const { assert } = chai
const { stub } = sinon

const {
  pure: {
    randomString,
    handler,
    handlerResponse,
    handlerError,
    test,
    list,
    deleteList,
  },
} = require('./handler')

describe('./tests/integration/target/handler.js', () => {
  describe('#randomString', () => {
    it('should produce a string of digits and lower chars', () => {
      const random = [0.0, 0.2, 0.5, 0.8, 0.99999]
        .reduce(
          (randomStub, value, i) => randomStub.onCall(i).returns(value),
          stub()
        )
      assert.strictEqual(randomString(5, random), '07isz')
    })
  })
  describe('#handler', () => {
    const handlerAsync = (impl, createEventId) =>
      (event, context) =>
        new Promise((resolve, reject) =>
          handler(impl, createEventId)(
            event,
            context,
            (err, result) => (err ? reject(err) : resolve(result))
          )
        )
    it('should callback with an error when impl throws', () => {
      const err = new Error()
      return assert.isRejected(handlerAsync(() => { throw err })(), err)
    })
    it('should callback with an error when impl rejects', () => {
      const err = new Error()
      return assert.isRejected(handlerAsync(() => Promise.reject(err))(), err)
    })
    it('should pass the event to the implementation', () => {
      const impl = stub()
      const event = {}
      return handlerAsync(impl)(event)
        .then(() => assert.isOk(impl.calledOnce))
        .then(() => assert.isOk(impl.calledWithExactly(event)))
    })
    it('should return the result to lambda', () => {
      const expected = {}
      const impl = stub().returns(expected)
      return handlerAsync(impl)()
        .then(result => assert.strictEqual(result, expected))
    })
  })
  describe('#handlerResponse', () => {
    it('should create a success message', () =>
      assert.deepStrictEqual(
        handlerResponse({ foo: 'bar' }),
        { statusCode: 200, body: '{"foo":"bar"}' }
      ))
  })
  describe('#handlerError', () => {
    it('should create and log a failure message', () =>
      ((message, err) => assert.deepStrictEqual(
        handlerError(
          message,
          (...args) => assert.deepStrictEqual(args, [message, err.stack]))(err),
        { statusCode: 400 }
      ))('message', { stack: 'reasons' }))
  })
  const handlerResponseOk = data => ({ data })
  const handlerErrorOk = error => ({ error })
  const event = { pathParameters: { id: 101 } }
  const err = new Error('reasons')
  describe('#test', () => {
    const expectedEventId = 'tests/101/12345.abcde'
    const expectedData = { timestamp: 12345, eventId: expectedEventId }
    const writeObjectOk = (eventId, data) =>
      assert.strictEqual(eventId, expectedEventId) ||
      assert.deepStrictEqual(data, expectedData) ||
      Promise.resolve()
    const writeObjectFail = (eventId, data) => writeObjectOk(eventId, data)
      .then(() => Promise.reject(err))
    const args = [() => 12345, () => 'abcde', handlerResponseOk, handlerErrorOk]
    it('should return handler response on success', () =>
      test(writeObjectOk, ...args)(event)
        .then(data => assert.deepStrictEqual(data, { data: expectedData })))
    it('should return handler error on fail', () =>
      test(writeObjectFail, ...args)(event)
        .then(actual => assert.deepStrictEqual(actual, { error: err })))
  })
  describe('#list', () => {
    const objects = [{ timestamp: 2 }, { timestamp: 1 }]
    const streamObjectsOk = (prefix, callback) => {
      assert.strictEqual(prefix, 'tests/101/')
      process.nextTick(() => [...objects, undefined].map(callback))
      return { getCurrentState: () => ({}) }
    }
    const streamObjectsFail = (prefix, callback) => {
      assert.strictEqual(prefix, 'tests/101/')
      process.nextTick(callback)
      return {
        getCurrentState: () => ({
          lastError: err,
        }),
      }
    }
    it('should return handler response on success', () => {
      const expected = [...objects].reverse()
      return list(streamObjectsOk, handlerResponseOk, handlerErrorOk)(event)
        .then(actual => assert.deepStrictEqual(actual, { data: expected }))
    })
    it('should return handler error on fail', () =>
      list(streamObjectsFail, handlerResponseOk, handlerErrorOk)(event)
        .then(actual => assert.deepStrictEqual(actual, { error: err })))
  })
  describe('#deleteList', () => {
    const deleteObjectsOk = prefix =>
      assert.strictEqual(prefix, 'tests/101/') || Promise.resolve(true)
    const deleteObjectsFail = prefix =>
      assert.strictEqual(prefix, 'tests/101/') || Promise.reject(err)
    it('should return handler response on success', () =>
      deleteList(deleteObjectsOk, handlerResponseOk, handlerErrorOk)(event)
        .then(actual => assert.deepStrictEqual(actual, { data: undefined })))
    it('should return handler error on fail', () =>
      deleteList(deleteObjectsFail, handlerResponseOk, handlerErrorOk)(event)
        .then(actual => assert.deepStrictEqual(actual, { error: err })))
  })
})
