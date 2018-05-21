const merge = require('lodash.merge')
const omit = require('lodash.omit')

const def = require('./funcDef')
const valid = require('./funcValid')
const { safeLoad } = require('js-yaml')
const assert = require('assert')
const { readFileSync } = require('fs')
const { extname } = require('path')

const impl = {
  finish: (func) => { // eslint-disable-line consistent-return
    if ('done' in module.exports && !module.exports.done) {
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
    impl.finish(() => module.exports.callback &&
      module.exports.callback(
        null,
        `##!! Unhandled promise rejection: ${
          ex.message
        }, please report to https://github.com/Nordstrom/serverless-artillery/issues !!##`,
      ))
  },
  handleTimeout: () => {
    impl.finish(() => {
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
      module.exports.callback(null, 'Error: function timeout')
    })
  },
  readScript: (scriptPath) => {
    const localPathError =
      'Input script must be a local file path such as "./script.yml".'
    const extError =
      'Input script must be a yml or json file (".yml", ".yaml" or ".json").'
    const ext = extname(scriptPath).toLowerCase()
    return assert(scriptPath.startsWith('./'), localPathError)
    || assert(ext === '.yml' || ext === '.yaml' || ext === '.json', extError)
    || ext === '.json'
      ? require(scriptPath)
      : safeLoad(readFileSync(scriptPath))
  },
  mergeIf: (input) => {
    if ('>>' in input) {
      const getScript = () => {
        const scriptPath = input['>>']
        try {
          return impl.readScript(scriptPath)
        } catch (err) {
          console.log('Failed to read script', scriptPath, err.stack)
          throw err
        }
      }
      return merge({}, getScript(), omit(input, ['>>']))
    }
    return input
  },
  handler: taskHandler => (input, context, callback) => {
    try {
      const event = impl.mergeIf(input)
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
