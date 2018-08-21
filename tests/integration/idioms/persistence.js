const AWS = require('aws-sdk')
const yaml = require('js-yaml')
const fs = require('fs')

const { memoize } = require('./fn')

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
    (key, options) =>
      readConfig()
        .then(({ target: { bucket } }) =>
          Object.assign({}, options, { Bucket: bucket, Key: key })),

  s3: (
    s3 = new AWS.S3(),
    createParams = pure.createParams()
  ) => ({
    writeFile: (key, data) =>
      createParams(key, { Body: data })
        .then(params => s3.putObject(params).promise()),
    listFiles: () => {},
    readFile: () => {},
  }),
}

module.exports = {
  pure,
  readFile: pure.readFile(),
  parseYaml: pure.parseYaml,
  readConfig: memoize(pure.readConfig()),
  createParams: pure.createParams(),
  s3: pure.s3(),
}
