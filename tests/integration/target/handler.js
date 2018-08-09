const pure = {
  randomString: (length, random = Math.random) =>
    [...Array(length)].map(i => (~~(random() * 36)).toString(36)).join(''),

  createEventId: (now = Date.now, randomString = pure.randomString) =>
    `${now()}.${randomString()}`,

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
