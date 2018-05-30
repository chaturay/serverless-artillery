const assert = require('assert')
const fs = require('fs')
const { safeLoad } = require('js-yaml')
const merge = require('lodash.merge')
const omit = require('lodash.omit')
const path = require('path')

const {
  MAX_TIMEOUT_BUFFER_IN_MILLISECONDS: maxTimeoutBuffer,
  MONITORING_SCRIPT_FIELD: scriptField,
  MONITORING_SCRIPT_PATH_ERROR: localPathError,
  MONITORING_SCRIPT_READ_ERROR: readScriptError,
} = require('./funcDef')
const valid = require('./funcValid')

const impl = {
  handleUnhandledRejection: resolve => (ex, error = console.error) => {
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
    resolve(
      `##!! Unhandled promise rejection: ${
        ex.message
      }, please report to https://github.com/Nordstrom/serverless-artillery/issues !!##`)
  },

  handleTimeout: (resolve, error = console.error) => {
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
    resolve('Error: function timeout')
  },

  getScriptPath: (
    relativePath,
    resolve = path.resolve,
    dirname = __dirname
  ) => {
    const absolutePath = resolve(relativePath)
    assert(absolutePath.startsWith(dirname), localPathError)
    return absolutePath
  },

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
        log(readScriptError, scriptPath, ex.stack)
        throw ex
      }),

  mergeIf: (input, readScript = impl.readScript, field = scriptField) =>
    (field in input
      ? readScript(input[field])
        .then(inputData => merge({}, inputData, omit(input, [field])))
      : Promise.resolve(input)),

  handler: (
    taskHandler,
    input,
    mergeIf = impl.mergeIf,
    error = console.error
  ) =>
    mergeIf(input)
      .then((event) => {
        valid(event)
        return taskHandler(event)
          .catch((ex) => {
            error(ex.stack)
            return `Error executing task: ${ex.message}`
          })
      })
      .catch((ex) => {
        error(ex.stack)
        return `Error validating event: ${ex.message}`
      }),

  lambdaEntryPoint: (
    { handleUnhandledRejection, handleTimeout, handler } = impl,
    timeout = maxTimeoutBuffer
  ) =>
    taskHandler =>
      (input, context, callback) => {
        let timeout
        new Promise((resolve, reject) => {
          process.on('unhandledRejection', handleUnhandledRejection(resolve))
          timeout = setTimeout(
            () => handleTimeout(resolve),
            context.getRemainingTimeInMillis() - timeout
          )
          handler(taskHandler, input)
            .then(resolve, reject)
        })
          .catch(ex => `Error executing handler: ${ex.message}`)
          .then(result => {
            clearTimeout(timeout)
            callback(undefined, result)
          })
      },
}

module.exports = impl.lambdaEntryPoint()

/* test-code */
module.exports.impl = impl
/* end-test-code */
