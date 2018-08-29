const AWS = require('aws-sdk')
const yaml = require('js-yaml')
const fs = require('fs')

const { memoize, pipe } = require('./fn')

const configPath = '../../config.yml'

const pure = {
  readFile: ({ readFile } = fs) =>
    (path, options) =>
      new Promise((resolve, reject) =>
        readFile(
          path,
          options,
          (err, data) => (err ? reject(err) : resolve(data.toString()))
        )
      ),

  parseYaml: yaml.safeLoad,

  configPath,

  readConfig: (readFile = pure.readFile(), parseYaml = pure.parseYaml) =>
    () => readFile(configPath)
      .then(parseYaml),

  createParams: (readConfig = memoize(pure.readConfig())) =>
    pipe(
      (options = {}) => Object.keys(options)
        .filter(key => options[key] !== undefined)
        .reduce((result, key) => {
          result[key] = options[key]
          return result
        }, {}),
      options =>
        readConfig().then(config => ({ config, options })),
      ({ config: { target: { bucket } }, options }) =>
        Object.assign({}, options, { Bucket: bucket })
    ),

  s3: (
    s3 = new AWS.S3(),
    createParams = memoize(pure.createParams())
  ) => {
    const s3Impl = {
      writeFile: (key, data) =>
        createParams({ Key: key, Body: data })
          .then(params => s3.putObject(params).promise())
          .then(() => true),

      listFiles: (prefix, continuationToken) =>
        createParams({ Prefix: prefix, ContinuationToken: continuationToken })
          .then(params => s3.listObjectsV2(params).promise())
          .then(({ Contents, IsTruncated, NextContinuationToken }) => ({
            keys: Contents.map(({ Key }) => Key),
            next: IsTruncated
              ? () => s3Impl.listFiles(prefix, NextContinuationToken)
              : undefined,
          })),

      readFile: key =>
        s3.getObject(createParams({ Key: key })).promise()
          .then(({ Body }) => Body.toString()),
    }
    return s3Impl
  },

  readObject: readFile =>
    pipe(readFile, JSON.parse),

  writeObject: writeFile =>
    (key, object) =>
      writeFile(key, JSON.stringify(object)),

  streamObjects: (listFiles, readObject) =>
    (prefix, callback, { maxConcurrentDownloads = 4 } = {}) => {
      const mutableState = {
        isCancelled: false,
        isComplete: false,
        objectsStreamed: 0,
        objectsQueued: 0,
      }
      const state = {
        maxConcurrentDownloads: maxConcurrentDownloads > 16
          ? 16
          : maxConcurrentDownloads < 1 ? 1 : maxConcurrentDownloads,
        callback,
      }
      const downloadIndexes = [...Array(state.maxConcurrentDownloads)]
        .map((v, i) => i)
      const readAndReport = key =>
        readObject(key)
          .then(state.callback)
          .then(() => mutableState.objectsStreamed += 1)
          .then(() => mutableState.objectsQueued -= 1)
      const readObjects = keys =>
        ((mutableState.objectsQueued = keys.length) &&
          keys.length > state.maxConcurrentDownloads
          ? Promise.all(downloadIndexes.map(i => readAndReport(keys[i])))
            .then(() => readObjects(keys.slice(state.maxConcurrentDownloads)))
          : Promise.all(keys.map(readAndReport)))
      const downloadAll = next =>
        next()
          .then(({ keys, next }) =>
            (mutableState.objectsQueued += keys.length) && readObjects(keys)
              .then(() => (next ? downloadAll(next) : undefined)))
          .then(() => ((mutableState.isComplete = true) && state.callback()))
      downloadAll(listFiles(prefix))
      return {
        cancel: () => mutableState.isCancelled = true,
        getCurrentState: () => Object.assign({}, mutableState, state),
      }
    },
}

const s3 = pure.s3()
const readObject = pure.readObject(s3.readFile)

module.exports = {
  pure,
  readFile: pure.readFile(),
  parseYaml: pure.parseYaml,
  readConfig: memoize(pure.readConfig()),
  createParams: pure.createParams(),
  s3,
  readObject,
  writeObject: pure.writeObject(s3.writeFile),
  streamObjects: pure.streamObjects(s3.listObjects, readObject),
}
