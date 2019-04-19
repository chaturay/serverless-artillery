const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)
chai.use(chaiAsPromised)

const { assert } = chai
const { stub } = sinon

const handler = require('./handler').createHandler

describe('./tests/integration/target/handler.js', () => {
  describe('#handler', () => {
    const eventHandlerAsync = impl =>
      (event, context) =>
        new Promise((resolve, reject) =>
          handler({}).eventHandler(impl)(
            event,
            context,
            (err, result) => (err ? reject(err) : resolve(result))
          )
        )

    it('should callback with an error when impl throws', () => {
      const err = new Error()
      return assert.isRejected(eventHandlerAsync(() => { throw err })(), err)
    })

    it('should callback with an error when impl rejects', () => {
      const err = { statusCode: 500 }
      return assert.isRejected(eventHandlerAsync(() => Promise.reject(err))(), err)
    })

    it('should pass the event to the implementation', () => {
      const impl = stub()
      const event = {}
      return eventHandlerAsync(impl)(event)
        .then(() => assert.isOk(impl.calledOnce))
        .then(() => assert.isOk(impl.calledWithExactly(event)))
    })

    it('should return the result to lambda', () => {
      const expected = { statusCode: 200, body: '{}' }
      const impl = stub().returns({})
      return eventHandlerAsync(impl)()
        .then(result => assert.deepEqual(result, expected))
    })
  })

  describe('#handlerResponse', () => {
    it('should create a success message', () =>
      assert.deepStrictEqual(
        handler({}).handlerSuccess({ foo: 'bar' }),
        { statusCode: 200, body: '{"foo":"bar"}' }
      )
    )
  })

  describe('#handlerError', () => {
    it('should create and log a failure message', () =>
      assert.deepStrictEqual(
        handler({}).handlerError(new Error('this is an error')),
        { statusCode: 500 }
      )
    )
  })

  const testId = '/this/is/a/test'
  const err = new Error('reasons')

  describe('#test', () => {
    it('should return handler response on success', () =>
      handler({
        recordRequest: id => assert(id, testId, 'correct test id is recorded'),
      }).test({ pathParameters: { id: testId } }, {}, () => {})
    )

    it('should return handler error on fail', () =>
      handler({
        recordRequest: () => { throw err },
      }).test({ pathParameters: { id: testId } }, {}, actual => assert.equal(actual, 'Error: reasons'))
    )
  })

  describe('#list', () => {
    it('gets the results for the correct test id', () =>
      handler({
        getRequests: id => assert(id, testId, 'correct test id is requested'),
      }).list({ pathParameters: { id: testId } }, {}, () => {})
    )

    it('uses default start time', () =>
      handler({
        getRequests: (id, start) => assert(start, 0, 'correct default start time is provided'),
      }).list({ pathParameters: { id: testId } }, {}, () => {})
    )

    it('uses default start time', () =>
      handler({
        getRequests: (id, start, end) => assert(end, Number.MAX_SAFE_INTEGER, 'correct default end time is provided'),
      }).list({ pathParameters: { id: testId } }, {}, () => {})
    )

    it('uses start time from parameters, if provided', () =>
      handler({
        getRequests: (id, start) => assert(start, 1000, 'start time parameter is honored'),
      }).list({
        pathParameters: { id: testId },
        queryStringParameters: { start: 1000 },
      }, {}, () => {})
    )

    it('uses end time from parameters, if provided', () =>
      handler({
        getRequests: (id, start, end) => assert(end, 2000, 'end time parameter is honored'),
      }).list({
        pathParameters: { id: testId },
        queryStringParameters: { end: 2000 },
      }, {}, () => {})
    )

    it('uses both start and end time from parameters, if provided', () =>
      handler({
        getRequests: (id, start, end) => {
          assert(start, 1000, 'start time parameter is honored')
          assert(end, 2000, 'end time parameter is honored')
        },
      }).list({
        pathParameters: { id: testId },
        queryStringParameters: {
          start: 1000,
          end: 2000,
        },
      }, {}, () => {})
    )
  })
})
