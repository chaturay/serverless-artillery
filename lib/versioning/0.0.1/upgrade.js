const fsDefault = require('fs')
const { join } = require('path')

const pathToCurrentVersion = join(__dirname, '..', '..', '..', 'lib', 'lambda')

// Latest version 0.0.1
module.exports =
  ({
    readdirSync,
    readFileSync,
  } = fsDefault) => ({
    nextVersion: null,
    fileManifest: () => readdirSync(pathToCurrentVersion),
    fileContents: (assetFile) => {
      const filePath = join(pathToCurrentVersion, assetFile)
      return readFileSync(filePath, 'utf8')
    },
    projectDependencies: () => {
      const packagePath = join(pathToCurrentVersion, 'package.json')
      const packageJSON = readFileSync(packagePath)
      const packageObj = JSON.parse(packageJSON)
      return packageObj.dependencies
    },
    serviceDefinitionSchema: () => ({}),
    serviceDefinitionConflictSchema: () => {
      const schemaPath = join(__dirname, 'serverless.yml.conflicts.schema.json')
      const schemaJSON = readFileSync(schemaPath)
      const schema = JSON.parse(schemaJSON)
      return schema
    },
  })
