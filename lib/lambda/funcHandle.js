const assert = require('assert')
const fs = require('fs')
const { safeLoad } = require('js-yaml')
const merge = require('lodash.merge')
const omit = require('lodash.omit')
const path = require('path')

const def = require('./funcDef')
const valid = require('./funcValid')

const impl = {
  handleUnhandledRejection: resolve => (ex, error = console.error) => {
    error = typeof error === 'function' ? error : console.error
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

  lambdaEntryPoint: taskHandler => (input, context, callback) => {
    let timeout
    new Promise(resolve => {
      process.on('unhandledRejection', impl.handleUnhandledRejection(resolve))
      timeout = setTimeout(
        () => impl.handleTimeout(resolve),
        context.getRemainingTimeInMillis() - def.MAX_TIMEOUT_BUFFER_IN_MILLISECONDS
      )
      impl.handler(taskHandler, input)
        .then(resolve, resolve)
    })
      .then(result => {
        clearTimeout(timeout)
        callback(undefined, result)
      })
  },
}

module.exports = impl.lambdaEntryPoint

/* test-code */
module.exports.impl = impl
/* end-test-code */
