const AWS = require('aws-sdk')
const yaml = require('js-yaml')
const fs = require('fs')

const impl = module.exports = {}

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

  readConfig: ({ readFile, parseYaml } = impl) =>
    readFile('../../config.yml')
      .then(parseYaml),

  createParams: ({ config } = impl) =>
    (key, options) =>
      config
        .then(({ target: bucket }) =>
          Object.assign({}, options, { Bucket: bucket, Key: key })),

  s3: (
    s3 = new AWS.S3(),
    { createParams } = impl
  ) => ({
    writeFile: (key, data) =>
      createParams(key)
        .then(params => Object.assign({}, params, { Body: data }))
        .then(params => s3.putObject(params).promise()),
    listFiles: () => {},
    readFile: () => {},
  }),
}

impl.pure = pure
impl.readFile = pure.readFile()
impl.parseYaml = pure.parseYaml
impl.config = pure.readConfig()
impl.createParams = pure.createParams()
impl.s3 = pure.s3()
