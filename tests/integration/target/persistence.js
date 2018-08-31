const AWS = require('aws-sdk')

const { memoize, pipe, flatten } = require('./fn')

const bucket = 'slsart-integration-target-requests'

const pure = {
  createParams: pipe(
    (options = {}) => Object.keys(options)
      .filter(key => options[key] !== undefined)
      .reduce((result, key) => {
        result[key] = options[key]
        return result
      }, {}),
    options =>
      Object.assign({}, options, { Bucket: bucket })
  ),

  s3: (
    s3 = new AWS.S3(),
    createParams = memoize(pure.createParams)
  ) => {
    const s3Impl = {
      writeFile: (key, data) =>
        s3.putObject(createParams({ Key: key, Body: data })).promise()
          .then(() => true),

      listFiles: (prefix, continuationToken) =>
        s3.listObjectsV2(createParams({
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })).promise()
          .then(({ Contents, IsTruncated, NextContinuationToken }) => ({
            keys: Contents.map(({ Key }) => Key),
            next: IsTruncated
              ? () => s3Impl.listFiles(prefix, NextContinuationToken)
              : undefined,
          })),

      readFile: key =>
        s3.getObject(createParams({ Key: key })).promise()
          .then(({ Body }) => Body.toString()),

      deleteFiles: (...keys) =>
        s3.deleteObjects(
          createParams(
            {
              Delete: {
                Quiet: true,
                Objects: flatten(keys).map(key => ({ Key: key })),
              },
            })
        ).promise()
          .then(({ Errors }) => ({
            ok: !Errors.length,
            errors: Errors.map(({ Key, Message }) =>
              ({ key: Key, error: Message })),
          })),
    }
    return s3Impl
  },

  readObject: readFile =>
    pipe(readFile, JSON.parse),

  writeObject: writeFile =>
    (key, object) =>
      writeFile(key, JSON.stringify(object)),

  deleteObjects: (deleteFiles, listFiles) =>
    (prefix) => {
      const deleteNext = (next, count) =>
        (next
          ? next()
            .then(({ keys, next }) =>
              deleteFiles(keys)
                .then(({ ok, errors }) => {
                  if (ok) return
                  throw new Error(`Failed to delete files: ${JSON.stringify(errors)}`)
                })
                .then(() => deleteNext(next, count + keys.length)))
          : count)
      deleteNext(() => listFiles(prefix), 0)
    },

  streamObjects: (listFiles, readObject) =>
    (prefix, callback, { maxConcurrentDownloads = 4 } = {}) => {
      const mutableState = {
        isCancelled: false,
        isComplete: false,
        objectsStreamed: 0,
        objectsQueued: 0,
        lastError: undefined,
      }
      const mutateState = newState =>
        Object.assign(mutableState, newState)
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
          .catch(lastError => mutateState({ lastError, isCancelled: true }))
          .then(() => mutableState.objectsStreamed += 1)
          .then(() => mutableState.objectsQueued -= 1)
      const readObjects = keys =>
        (!mutableState.isCancelled &&
          (mutableState.objectsQueued = keys.length) &&
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
      downloadAll(() => listFiles(prefix))
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
  createParams: pure.createParams(),
  s3,
  readObject,
  writeObject: pure.writeObject(s3.writeFile),
  streamObjects: pure.streamObjects(s3.listFiles, readObject),
  deleteObjects: pure.deleteObjects(s3.deleteFiles, s3.listFiles),
}
