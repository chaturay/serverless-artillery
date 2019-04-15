const persistence = require('./persistence')(process.env.TEST_LOG_GROUP)

process.on('unhandledPromiseRejection', err => console.error('UNHANDLED REJECTION', err.stack))

const inst = {
  // abstract implementation of the aws lambda handler logic
  eventHandler: task =>
    (event, context, callback) => {
      try {
        Promise.resolve(task(event))
          .then(inst.handlerSuccess)
          .then(result => callback(undefined, result))
          .catch(inst.handlerError)
          .then(callback)
      } catch (err) {
        callback(err)
      }
    },

  // package the data into a success response
  handlerSuccess: data => ({
    statusCode: 200,
    body: data !== undefined ? JSON.stringify(data) : '',
  }),

  // log an error and send a 500 response
  handlerError: err => console.error(err.stack) || { statusCode: 500 },

  // record the test request
  test: persist => event => persist.recordRequest(event.pathParameters.id),

  // the api list handler implementation
  list: persist => (event) => {
    const { id } = event.pathParameters
    return persist.getRequests(id)
  },
}

const handler = (persist = persistence) => ({
  test: inst.eventHandler(inst.test(persist)),
  list: inst.eventHandler(inst.list(persist)),
  eventHandler: inst.eventHandler,
  handlerSuccess: inst.handlerSuccess,
  handlerError: inst.handlerError,
})

module.exports = handler()
module.exports.createHandler = handler
