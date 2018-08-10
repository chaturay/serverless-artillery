const AWS = require('aws-sdk')
const yaml = require('js-yaml')
const fs = require('fs')

// FIX: we'll be getting these asynchronously, so they can't be constants.
const defaultBucket = ''
const defaultKeyPrefix = ''

const pure = {
  readFile: (readFile = fs.readFile) =>
    (path, options) =>
      new Promise((resolve, reject) =>
        readFile(
          path,
          options,
          (err, data) => (err ? reject(err) : resolve(data.toString()))
        )
      ),

  parseYaml: yaml.safeLoad,

  s3: (
    s3 = new AWS.S3(),
    bucket = defaultBucket,
    keyPrefix = defaultKeyPrefix
  ) => ({
    writeFile: (bucket, key, data) =>
      s3.putObject(),
    listFiles: () => {},
    readFile: () => {},
  }),
}

module.exports = {
  pure,
  readFile: pure.readFile(),
  readYamlFile: pure.readYamlFile(),
  s3: pure.s3(),
}
