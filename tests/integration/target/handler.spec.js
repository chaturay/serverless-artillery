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
    randomString, createEventId, handler, get,
  },
} = require('./handler')

describe('./tests/integration/target/handler.js', () => {
  describe('pure', () => {
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
    describe('#createEventId', () => {
      it('should use a timestamp and a random string', () =>
        assert.strictEqual(
          createEventId(stub().returns('foo'), stub().returns('bar')),
          'foo.bar'
        )
      )
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
    describe('#get', () => {
      it('should return defaults', () => {
        const eventId = 'foo'
        const expected = {
          statusCode: 200,
          body: JSON.stringify({
            message: 'success',
            eventId,
          }),
        }
        assert.deepStrictEqual(get(stub().returns(eventId))(), expected)
      })
      it('should override defaults', () => {
        const eventId = 'foo'
        const expected = {
          statusCode: 418,
          body: JSON.stringify({
            message: 'success',
            eventId,
          }),
        }
        const event = { statusCode: 418 }
        assert.deepStrictEqual(get(stub().returns(eventId))(event), expected)
      })
      it('should pass values through', () => {
        const eventId = 'foo'
        const expected = {
          statusCode: 418,
          body: 'bar',
          baz: 'biz',
        }
        const event = { statusCode: 418, body: 'bar', baz: 'biz' }
        assert.deepStrictEqual(get(stub().returns(eventId))(event), expected)
      })
    })
  })
})
