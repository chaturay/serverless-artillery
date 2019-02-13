/* eslint-disable no-return-assign, no-nested-ternary */

const AWS = require('aws-sdk')

const bucket = () => process.env.SLSART_INTEGRATION_BUCKET

const flatten = values =>
  values.reduce((flattened, value) =>
    (Array.isArray(value)
      ? flattened.concat(flatten(value))
      : flattened.concat([value])), [])

const withoutUndefinedValues = (object = {}) =>
  Object.keys(object).reduce(
    (newObject, key) => {
      const value = object[key]
      return value === undefined
        ? newObject
        : Object.assign(newObject, { [key]: value })
    },
    {}
  )

const pure = {
  createParams: options => Object.assign(
    {},
    withoutUndefinedValues(options), { Bucket: bucket() }
  ),

  s3: (
    s3 = new AWS.S3(),
    createParams = pure.createParams
  ) => {
    const s3Impl = {
      createBucket: name =>
        s3.createBucket({ Bucket: name }).promise()
          .then(() => true),

      deleteBucket: name =>
        s3.deleteBucket({ Bucket: name }).promise()
          .then(() => true),

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
          }))
      ,
    }
    return s3Impl
  },

  readObject: readFile => path => readFile(path)
    .then(JSON.parse),

  writeObject: writeFile =>
    (key, object) =>
      writeFile(key, JSON.stringify(object)),

  deleteObjects: (deleteFiles, listFiles) => {
    const deleteNextBatch = (deleteNext, count) =>
      ({ keys, next }) =>
        deleteFiles(keys)
          .then(({ ok, errors }) => {
            if (ok) return
            throw new Error(`Failed to delete files: ${JSON.stringify(errors)}`)
          })
          .then(() => deleteNext(next, count + keys.length))
    return (prefix) => {
      const deleteNext = (getNext, count) => (getNext
        ? getNext().then(deleteNextBatch(deleteNext, count))
        : count)
      deleteNext(() => listFiles(prefix), 0)
    }
  },

  streamObjects: (listFiles, readObject) =>
    (prefix, callback, { maxConcurrentDownloads = 4 } = {}) => {
      // Declarations to support the recursive download process:
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
      // Read an object, report it to the listener and mutate current state:
      const readAndReport = key =>
        readObject(key)
          .then(state.callback)
          .catch(lastError => mutateState({ lastError, isCancelled: true }))
          .then(() => mutableState.objectsStreamed += 1)
          .then(() => mutableState.objectsQueued -= 1)
      // Read groups of objects until all keys have been read and reported:
      const readObjects = keys =>
        (!mutableState.isCancelled && // eslint-disable-line no-cond-assign
          (mutableState.objectsQueued = keys.length) &&
          keys.length > state.maxConcurrentDownloads
          ? Promise.all(downloadIndexes.map(i => readAndReport(keys[i])))
            .then(() => readObjects(keys.slice(state.maxConcurrentDownloads)))
          : Promise.all(keys.map(readAndReport)))
      // List keys recursively and map them through the readObjects() function:
      const downloadAll = getNext =>
        getNext()
          .then(({ keys, next }) =>
            (mutableState.objectsQueued += keys.length) && readObjects(keys)
              .then(() => (next ? downloadAll(next) : undefined)))
          .then(() => ((mutableState.isComplete = true) && state.callback()))
      // Begin the download:
      downloadAll(() => listFiles(prefix))
      // Return the controller object:
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
  listFiles: s3.listFiles,
  deleteFiles: s3.deleteFiles,
}
/* eslint-enable no-return-assign, no-nested-ternary */
