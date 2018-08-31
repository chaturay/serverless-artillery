const persistence = require('./persistence')

process.on(
  'unhandledPromiseRejection',
  err => console.log('UNHANDLED REJECTION', err.stack)
)

const pure = {
  // returns a random string of digits and lower-case characters
  randomString: (length, random = Math.random) =>
    [...Array(length)].map(i => (~~(random() * 36)).toString(36)).join(''),

  // abstract implementation of the aws lambda handler logic
  handler: impl =>
    (event, context, callback) => {
      console.log('ENTERING HANDLER')
      try {
        Promise.resolve(impl(event))
          .then(result => console.log('HANDLER COMPLETE', result) || callback(undefined, result))
          .catch(err => console.log('ERROR:', err.stack) || callback(err))
      } catch (err) {
        console.log('ERROR:', err.stack)
        callback(err)
      }
    },

  // the api test handler implementation
  test: (
    writeObject = persistence.writeObject,
    now = Date.now,
    randomString = pure.randomString
  ) =>
    (event) => {
      const timestamp = now()
      const eventId =
        `tests/${event.pathParameters.id}/${timestamp}.${randomString(8)}`
      const data = { timestamp, eventId } // todo: add other payload data
      const response = Object.assign(
        {
          statusCode: 200,
          body: JSON.stringify(data),
        },
        event)
      return writeObject(eventId, data)
        .then(() => response)
    },

  list: (streamObjects = persistence.streamObjects) =>
    event => new Promise((resolve, reject) => {
      const objects = []
      streamObjects(`tests/${event.pathParameters.id}/`, o =>
        (o ? objects.push(o) : resolve(objects)))
    }),

  deleteList: (deleteObjects = persistence.deleteObjects) =>
    event => deleteObjects(`tests/${event.pathParameters.id}/`),
}

module.exports = {
  pure,
  test: pure.handler(pure.test()),
  list: pure.handler(pure.list()),
  deleteList: pure.handler(pure.deleteList()),
}
