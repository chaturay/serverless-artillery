const valid = require('./funcValid')

const impl = {
  handleUnhandledRejection: (ex) => {
    console.error('###############################################################')
    console.error('##             !! Unhandled promise rejection !!             ##')
    console.error('## This probably results from an unforseen circumstance in   ##')
    console.error('## a plugin.  Please report the following stack trace at:    ##')
    console.error('## https://github.com/Nordstrom/serverless-artillery/issues  ##')
    console.error('###############################################################')
    console.error(ex.stack)
    console.error('###############################################################')
    module.exports.callback(
      null,
      `##!! Unhandled promise rejection: ${
        ex.message
      }, please report to https://github.com/Nordstrom/serverless-artillery/issues !!##` // eslint-disable-line comma-dangle
    )
  },
  handler: taskHandler => (event, context, callback) => {
    try {
      valid(event)
      module.exports.context = context
      module.exports.callback = callback
      taskHandler(event)
        .then((result) => {
          callback(null, result)
        })
        .catch((ex) => {
          console.error(ex.stack)
          callback(null, `Error executing task: ${ex.message}`)
        })
    } catch (ex) {
      console.error(ex.stack)
      callback(null, `Error validating event: ${ex.message}`)
    }
  },
}

process.on('unhandledRejection', impl.handleUnhandledRejection)

module.exports = impl.handler

/* test-code */
module.exports.impl = impl
/* end-test-code */
