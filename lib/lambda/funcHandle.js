const fs = require('fs')
const { safeLoad } = require('js-yaml')
const merge = require('lodash.merge')
const omit = require('lodash.omit')
const path = require('path')
const promisify = require('util-promisify')

const {
  MAX_TIMEOUT_BUFFER_IN_MILLISECONDS: maxTimeoutBuffer,
  MERGE_FIELD: scriptField,
} = require('./funcDef')
const valid = require('./funcValid')

const readFileAsync = promisify(fs.readFile)

const impl = {
  handleUnhandledRejection: (resolve, error = console.error) => (ex) => {
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
    try {
      const absolutePath = resolve(relativePath)
      if (!absolutePath.startsWith(dirname)) {
        const ex = new Error(`Input script ${absolutePath} is not a local file path.`)
        return Promise.reject(ex)
      }
      return Promise.resolve(absolutePath)
    } catch (ex) {
      return Promise.reject(ex)
    }
  },

  readScript: (
    scriptPath,
    readFile = readFileAsync,
    error = console.error,
    getScriptPath = impl.getScriptPath
  ) =>
    getScriptPath(scriptPath)
      .then(readFile)
      .then(safeLoad)
      .catch((ex) => {
        error('Failed to read script.', scriptPath, ex.stack)
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

  callbackOnce: (callback) => {
    let hasCalledBack
    return (result) => {
      if (hasCalledBack) {
        return
      }
      hasCalledBack = true
      callback(undefined, result)
    }
  },

  lambdaEntryPoint: (
    { handleUnhandledRejection, handleTimeout, handler } = impl,
    timeoutMs = maxTimeoutBuffer
  ) =>
    taskHandler =>
      (input, context, callback) => {
        const finished = impl.callbackOnce(callback)
        const unhandledRejectionListener = handleUnhandledRejection(finished)
        process.on('unhandledRejection', unhandledRejectionListener)
        const timeout = setTimeout(
          () => handleTimeout(finished),
          context.getRemainingTimeInMillis() - timeoutMs
        )
        handler(taskHandler, input)
          .catch(ex => `Error executing handler: ${ex.message}`)
          .then((result) => {
            process.removeListener(
              'unhandledRejection',
              unhandledRejectionListener
            )
            clearTimeout(timeout)
            finished(result)
          })
      },
}

module.exports = impl.lambdaEntryPoint()

/* test-code */
module.exports.impl = impl
/* end-test-code */
