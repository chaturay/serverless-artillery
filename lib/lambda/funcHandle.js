const def = require('./funcDef')
const valid = require('./funcValid')

const impl = {
  finish: (func) => {
    if (!module.exports.done) {
      module.exports.done = true
      if (module.exports.timeout) {
        clearTimeout(module.exports.timeout)
      }
      return func()
    }
  },
  handleUnhandledRejection: (ex) => {
    console.error([
      '###############################################################',
      '##             !! Unhandled promise rejection !!             ##',
      '## This probably results from an unforseen circumstance in   ##',
      '## a plugin.  Please report the following stack trace at:    ##',
      '## https://github.com/Nordstrom/serverless-artillery/issues  ##',
      '###############################################################',
      ex.stack.split('\n').map(line => `## ${line}`).join('\n'),
      '###############################################################',
    ].join('\n'))
    impl.finish(() =>
      module.exports.callback(
        null,
        `##!! Unhandled promise rejection: ${
          ex.message
        }, please report to https://github.com/Nordstrom/serverless-artillery/issues !!##`))
  },
  handleTimeout: () => {
    console.error([
      '################################################################',
      '##                   !! Function Timeout !!                   ##',
      '## This probably results from a dropped response or unforseen ##',
      '## overly long response time from the target and likely an    ##',
      '## error.  To handle the circumstance but avoid additional,   ##',
      '## redundant, executions of your script success was reported  ##',
      '## to the function as a service infrastructure.               ##',
      '################################################################',
    ].join('\n'))
    impl.finish(() =>
      module.exports.callback(null, 'Error: function timeout'))
  },
  handler: taskHandler => (event, context, callback) => {
    try {
      valid(event)
      module.exports.context = context
      module.exports.callback = callback
      module.exports.done = false
      taskHandler(event)
        .then((result) => {
          impl.finish(() => callback(null, result))
        })
        .catch((ex) => {
          impl.finish(() => {
            console.error(ex.stack)
            callback(null, `Error executing task: ${ex.message}`)
          })
        })
      module.exports.timeout = setTimeout(
        impl.handleTimeout,
        context.getRemainingTimeInMillis() - def.MAX_TIMEOUT_BUFFER_IN_MILLISECONDS)
    } catch (ex) {
      impl.finish(() => {
        console.error(ex.stack)
        callback(null, `Error validating event: ${ex.message}`)
      })
    }
  },
}

process.on('unhandledRejection', impl.handleUnhandledRejection)

module.exports = impl.handler

/* test-code */
module.exports.impl = impl
/* end-test-code */
