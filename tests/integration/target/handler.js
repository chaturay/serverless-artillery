const pure = {
  // returns a random string of digits and lower-case characters
  randomString: (length, random = Math.random) =>
    [...Array(length)].map(i => (~~(random() * 36)).toString(36)).join(''),

  // generates an event ID from a timestamp plus a random string
  createEventId: (now = Date.now, randomString = pure.randomString) =>
    `${now()}.${randomString()}`,

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

  // the api GET handler implementation
  get: (createEventId = pure.createEventId) =>
    event =>
      Object.assign(
        {
          statusCode: 200,
          body: JSON.stringify({
            message: 'success',
            eventId: createEventId(),
          }),
        },
        event),
}

module.exports = {
  pure,
  get: pure.handler(pure.get()),
}
