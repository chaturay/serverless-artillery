const aws = require('aws-sdk')
const BbPromise = require('bluebird')
const fs = BbPromise.promisifyAll(require('fs'))
const merge = require('lodash.merge')
const path = require('path')
const yaml = require('js-yaml')

const lambda = new aws.Lambda()

const slsart = require(path.join('..', '..', 'lib', 'index.js')) // eslint-disable-line import/no-dynamic-require

const stdArgv = ['node', 'slsart']

const { cwd } = process

const util = {
  // UTILITIES
  getFunctionName: functionName => functionName || 'serverless-artillery-dev-loadGenerator',
  getFunctionConfiguration: functionName =>
    lambda.getFunctionConfiguration({
      FunctionName: util.getFunctionName(functionName),
    }).promise(),
  cmdLine: (args, func, options) => {
    const { argv } = process
    process.argv = args
    return func(options || {})
      .then((result) => {
        process.argv = argv
        return result
      })
  },
  hasAtLeast: (expectation, result, jsonPath, seen) => {
    Object.keys(expectation)
      .forEach((key) => {
        if (!(key in result)) {
          throw new Error(`expected key "${
            key
          }" from not found in result\nexpectation: ${
            JSON.stringify(expectation, null, 2)
          }\nresult: ${
            JSON.stringify(result, null, 2)
          }`)
        } else if (typeof result[key] === 'object') {
          if (!seen.has(result[key])) {
            seen.add(result[key])
            util.hasAtLeast(expectation[key], result[key], jsonPath.concat(key), seen)
          }
        } else if (expectation[key] !== result[key]) {
          throw new Error(`expected value at ${
            jsonPath.join('.')
          } to be "${
            expectation[key]
          }" but instead observed "${
            result[key]
          }"`)
        }
      })
  },
  replaceCwd: (dirToReplace) => {
    process.cwd = () => dirToReplace
  },
  restoreCwd: () => {
    process.cwd = cwd
  },
  fileExists: filePath =>
    fs.lstat(filePath, (stats) => {
      try {
        return stats.isFile()
      } catch (ex) {
        return false
      }
    }),
  scriptExists: script => util.fileExists(script || 'script.yml'),
  scriptDoesNotExist: script => util.scriptExists(script).then(exists => !exists),
  slsYmlExists: slsPath => util.fileExists(slsPath || 'serverless.yml'),
  slsYmlDoesNotExist: slsPath => util.slsYmlExists(slsPath).then(exists => !exists),
}

const impl = {
  runIn: (dir, action) => {
    util.replaceCwd(dir)
    action()
      .finally(util.restoreCwd)
  },
  loadAndMerge: (file, modifier) =>
    fs.readFileAsync(file)
      .then((content) => {
        const base = yaml.safeLoad(content)
        return merge(base, modifier)
      }),
  cleanupAll: () => BbPromise.all(impl.cleanupService().concat(impl.cleanupScript())),
  cleanupService: () => BbPromise.all(slsart.constants.ServerlessFiles.map(file => fs.unlinkAsync(file))),
  cleanupScript: () => fs.unlinkAsync(slsart.constants.DefaultScriptName),
  // TARGET SERVICE
  deployTarget: options => () => impl.runIn(path.join(__dirname, 'target'), impl.deploy(options)),
  removeTarget: options => () => impl.runIn(path.join(__dirname, 'target'), impl.remove(options)),
  // COMMANDS
  deploy: options => () => util.cmdLine(stdArgv.concat('deploy'), slsart.deploy, options),
  invoke: options => () => util.cmdLine(stdArgv.concat('invoke'), slsart.invoke, options),
  remove: options => () => util.cmdLine(stdArgv.concat('remove'), slsart.remove, options),
  // FACTS
  functionExists: functionName => () => util.getFunctionConfiguration(functionName),
  functionDoesNotExist: functionName => () => util.getFunctionConfiguration(functionName)
    .then(() => BbPromise.reject(new Error('expectation violated: function exists')))
    .catch((error) => {
      if (error.statusCode === 404) {
        return BbPromise.resolve()
      }
      throw error
    }),
  scriptExists: script => () => util.scriptExists(script),
  scriptDoesNotExist: script => () => util.scriptDoesNotExist(script),
  slsYmlExists: slsPath => () => util.slsYmlExists(slsPath),
  slsYmlDoesNotExist: slsPath => () => util.slsYmlDoesNotExist(slsPath),
  expect: expectation => result => util.hasAtLeast(expectation, result, [], new WeakSet()),
}

module.exports = impl
