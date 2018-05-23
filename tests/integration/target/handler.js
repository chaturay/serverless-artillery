module.exports.get = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: process.env.MESSAGE || 'success',
    }),
  }
  callback(null, response)
}
