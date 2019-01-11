const persistence = require('./persistence')

process.on(
  'unhandledPromiseRejection',
  err => console.log('UNHANDLED REJECTION', err.stack)
)

const pure = {
  // returns a random string of digits and lower-case characters
  randomString: (length, random = Math.random) => {
    // convert a random int between 0 and 35 to a string in radix 36
    // radix 16 (hex) includes digits 0-9 and a-f
    // radix 36 (below) includes digits 0-9 and a-z, covering the whole alphabet
    const randomChar = () => (Math.floor(random() * 36)).toString(36)
    // generate an array of [length]
    return [...Array(length)]
      // fill it with random chars
      .map(randomChar)
      // join them together into a string
      .join('')
  },

  // abstract implementation of the aws lambda handler logic
  handler: impl =>
    (event, context, callback) => {
      try {
        Promise.resolve(impl(event))
          .then(result => callback(undefined, result))
          .catch(callback)
      } catch (err) {
        callback(err)
      }
    },

  // package the data into a success response
  handlerResponse: data => ({
    statusCode: 200,
    body: data ? JSON.stringify(data) : '',
  }),

  // log an error and send a 400 response
  handlerError: (message = 'handler error:', log = console.log) =>
    err =>
      log(message, err.stack) || { statusCode: 400 },

  // the api test handler implementation
  test: (
    writeObject = persistence.writeObject,
    now = Date.now,
    randomString = pure.randomString,
    handlerResponse = pure.handlerResponse,
    handlerError = pure.handlerError()
  ) =>
    (event) => {
      const timestamp = now()
      const eventId =
        `tests/${event.pathParameters.id}/${timestamp}.${randomString(8)}`
      const data = { timestamp, eventId } // todo: add other payload data
      return writeObject(eventId, data)
        .then(() => data)
        .then(handlerResponse, handlerError)
    },

  // the api list handler implementation
  list: (
    streamObjects = persistence.streamObjects,
    handlerResponse = pure.handlerResponse,
    handlerError = pure.handlerError()
  ) =>
    event => new Promise((resolve) => {
      const objects = []
      const stream = streamObjects(`tests/${event.pathParameters.id}/`, o =>
        (o
          ? objects.push(o)
          : resolve({ objects, state: stream.getCurrentState() })))
    })
      .then(({ objects, state: { lastError } }) => (lastError
        ? Promise.reject(lastError)
        : objects))
      .then(objects => objects.sort((a, b) => a.timestamp - b.timestamp))
      .then(handlerResponse, handlerError),

  // the api delete list handler implementation
  deleteList: (
    deleteObjects = persistence.deleteObjects,
    handlerResponse = pure.handlerResponse,
    handlerError = pure.handlerError()
  ) =>
    event =>
      deleteObjects(`tests/${event.pathParameters.id}/`)
        .then(() => {})
        .then(handlerResponse, handlerError),
}

module.exports = {
  pure,
  test: pure.handler(pure.test()),
  list: pure.handler(pure.list()),
  deleteList: pure.handler(pure.deleteList()),
  randomString: pure.randomString,
}
