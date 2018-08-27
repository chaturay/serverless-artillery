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
    const impl = {
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
              ? () => impl.listFiles(prefix, NextContinuationToken)
              : undefined,
          })),

      readFile: key =>
        s3.getObject(createParams({ Key: key })).promise()
          .then(({ Body }) => Body.toString()),
    }
    return Object.assign({
      readObject: pipe(impl.readFile, JSON.parse),

      writeObject: (key, object) =>
        impl.writeFile(key, JSON.stringify(object)),
    }, impl)
  },
}

module.exports = {
  pure,
  readFile: pure.readFile(),
  parseYaml: pure.parseYaml,
  readConfig: memoize(pure.readConfig()),
  createParams: pure.createParams(),
  s3: pure.s3(),
}
