const assert = require('assert')
const fs = require('fs')
const { safeLoad } = require('js-yaml')
const merge = require('lodash.merge')
const omit = require('lodash.omit')
const path = require('path')

const def = require('./funcDef')
const valid = require('./funcValid')

const tried = (func) => {
  try {
    return func()
  } catch (ex) {
    return Promise.reject(ex)
  }
}

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

  handleUnhandledRejection: (ex, error = console.error) => {
    error([
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
        }, please report to https://github.com/Nordstrom/serverless-artillery/issues !!##`))
  },

  handleTimeout: (error = console.error) => {
    impl.finish(() => {
      error([
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

  localPathError: 'Input script must be a local file path.',

  getScriptPath: (
    relativePath,
    resolve = path.resolve,
    dirname = __dirname
  ) => {
    const absolutePath = resolve(relativePath)
    assert(absolutePath.startsWith(dirname), impl.localPathError)
    return absolutePath
  },

  readScriptError: 'Failed to read script',

  readScript: (
    scriptPath,
    readFile = fs.readFile,
    log = console.log,
    getScriptPath = impl.getScriptPath
  ) =>
    new Promise((resolve, reject) =>
      readFile(getScriptPath(scriptPath), (ex, data) =>
        (ex ? reject(ex) : resolve(data.toString()))))
      .then(safeLoad)
      .catch((ex) => {
        log(impl.readScriptError, scriptPath, ex.stack)
        throw ex
      }),

  scriptField: '>>',

  mergeIf: (input, readScript = impl.readScript, field = impl.scriptField) =>
    tried(() =>
      (field in input
        ? readScript(input[field])
          .then(inputData => merge({}, inputData, omit(input, [field])))
        : Promise.resolve(input))
    ),

  handler: taskHandler => (
    input,
    context,
    callback,
    mergeIf = impl.mergeIf,
    error = console.error,
    handleTimeout = impl.handleTimeout,
    finish = impl.finish
  ) =>
    mergeIf(input)
      .then((event) => {
        valid(event)
        module.exports.context = context
        module.exports.callback = callback
        module.exports.done = false
        taskHandler(event)
          .then((result) => {
            finish(() => callback(null, result))
          })
          .catch((ex) => {
            finish(() => {
              error(ex.stack)
              callback(null, `Error executing task: ${ex.message}`)
            })
          })
        module.exports.timeout = setTimeout(
          handleTimeout,
          context.getRemainingTimeInMillis() - def.MAX_TIMEOUT_BUFFER_IN_MILLISECONDS)
      })
      .catch((ex) => {
        finish(() => {
          error(ex.stack)
          callback(null, `Error validating event: ${ex.message}`)
        })
      })
  ,
}

process.on('unhandledRejection', impl.handleUnhandledRejection)

module.exports = impl.handler

/* test-code */
module.exports.impl = impl
/* end-test-code */
