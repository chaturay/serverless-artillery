/**
 * @module versioning
 */
const fsDefault = require('fs')
const pathDefault = require('path')
const yamlDefault = require('js-yaml')
const Ajv = require('ajv')
const ajv = new Ajv()

class UpdatePreconditionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UpdatePreconditionError'
  }
}

class UpdateConflictError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UpdateConflictError'
  }
}

const impl = (
  fs = fsDefault,
  path = pathDefault,
  yaml = yamlDefault,
  PreconditionError = UpdatePreconditionError,
  ConflictError = UpdateConflictError,
) => (localAssetsPath) => {
  const inst = {
    readAssetsVersionFromInfoFile: (slsArtInfoFilePath) => {
      const slsArtInfoYaml = fs.readFileSync(slsArtInfoFilePath)
      const slsArtInfo = yaml.safeLoad(slsArtInfoYaml)
      return slsArtInfo.version
    },

    readAssetsVersion: () => {
      const slsArtInfoFilePath = path.join(localAssetsPath, '.slsart')
      const infoFileExists = fs.existsSync(slsArtInfoFilePath)
      return infoFileExists
        ? inst.readAssetsVersionFromInfoFile(slsArtInfoFilePath)
        : '0.0.0'
    },

    determineFunctionAssetFiles: (version) => {
      // TODO: Use files in `versioning/X.X.X/*` as canonical list.
      switch (version) {
        case '0.0.0':
          return [
            'handler.js',
            'package.json',
            'serverless.yml',
          ]
      }
    },

    checkForAnyMissingServiceFiles: (listOfFiles) =>
      listOfFiles.reduce((missingFiles, assetFile) => {
        const assetFilePath = path.join(localAssetsPath, assetFile)
        const assetFileIsMissing = !fs.existsSync(assetFilePath)
        if (assetFileIsMissing) {
          missingFiles.push(assetFilePath)
        }
        return missingFiles
      }, []),

    throwForAnyMissingFiles: (missingFiles) => {
      const anyServiceFilesMissing = missingFiles.length > 0
      if (anyServiceFilesMissing) {
        const missingFileList = missingFiles.join(', ')
        throw new UpdatePreconditionError(`Missing asset files: ${missingFileList}`)
      }
    },

    checkForServiceFiles: () => {
      const assetsVersion = inst.readAssetsVersion()
      const listOfFiles = inst.determineFunctionAssetFiles(assetsVersion)
      const missingFiles = inst.checkForAnyMissingServiceFiles(listOfFiles)
      inst.throwForAnyMissingFiles(missingFiles)
    },

    packageIsMissing: (dependencies, packageName, missingDependency) => {
      const packageIsMissing = dependencies[packageName] === undefined
      if (packageIsMissing) {
        missingDependency.push(packageName)
      }
    },

    checkPackageVersion: (dependencies, packageName, necessaryDependencies, invalidDependencyVersion) => {
      const invalidPackageVersion = dependencies[packageName] !== necessaryDependencies[packageName]
      if (invalidPackageVersion) {
        invalidDependencyVersion.push({
          package: packageName,
          actual: dependencies[packageName],
          expected: necessaryDependencies[packageName],
        })
      }
    },

    checkAllProjectDependencies: (necessaryDependencies, dependencies) =>
      Object.keys(necessaryDependencies).reduce((missingDependencies, packageName) => {
        inst.packageIsMissing(dependencies, packageName, missingDependencies)
        return missingDependencies
      }, []),

    checkAllProjectDependencyVersions: (necessaryDependencies, dependencies) =>
      Object.keys(necessaryDependencies).reduce((mismatchedDependencies, packageName) => {
        inst.checkPackageVersion(dependencies, packageName, necessaryDependencies, mismatchedDependencies)
        return mismatchedDependencies
      }, []),

    throwIfAnyDependencyMissing: (missingDependency) => {
      const anyPackagesAreMissing = missingDependency.length > 0
      if (anyPackagesAreMissing) {
        const missingPackageList = missingDependency.join(', ')
        throw new UpdatePreconditionError(`Missing package.json dependency: ${missingPackageList}`)
      }
    },

    throwIfAnyDependencyVersionsMismatch: (invalidDependencyVersion) => {
      const anyPackagesAreIncorrectVersion = invalidDependencyVersion.length > 0

      if (anyPackagesAreIncorrectVersion) {
        const formatPackageVersionError = invalidPackageInfo =>
          `${invalidPackageInfo.package} expected ${invalidPackageInfo.expected} found ${invalidPackageInfo.actual}`

        const reducePackageVersionError = (errors, invalidVersionMessage) => `${errors}\t${invalidVersionMessage}\n`

        const specificVersionErrors =
          invalidDependencyVersion
            .map(formatPackageVersionError)
            .reduce(reducePackageVersionError, '')

        throw new UpdatePreconditionError(`Invalid package.json dependency package version found:\n${specificVersionErrors}`)
      }
    },

    loadProjectDependencies: () => {
      const packagePath = path.join(localAssetsPath, 'package.json')
      const packageJSON = fs.readFileSync(packagePath)
      const packageObj = JSON.parse(packageJSON)
      return packageObj.dependencies
    },

    necessaryProjectDependencies: () => {
      // TODO: Use files in `versioning/X.X.X/package.json` as canonical list.
      const assetsVersion = inst.readAssetsVersion()

      switch (assetsVersion) {
        case '0.0.0':
          return {
            'artillery-core': '^2.0.3-0',
            'csv-parse': '^1.1.7',
          }
      }
    },

    validateProjectDependencies: (necessaryDependencies) => {
      // Check the package.json dependencies for upgrade
      const dependencies = inst.loadProjectDependencies()

      const missingDependenciesList = inst.checkAllProjectDependencies(necessaryDependencies, dependencies)
      inst.throwIfAnyDependencyMissing(missingDependenciesList)

      const versionMismatchDependenciesList = inst.checkAllProjectDependencyVersions(necessaryDependencies, dependencies)
      inst.throwIfAnyDependencyVersionsMismatch(versionMismatchDependenciesList)
    },

    loadServiceDefinition: () => {
      const serverlessPath = path.join(localAssetsPath, 'serverless.yml')
      const serverlessYAML = fs.readFileSync(serverlessPath)
      const serverlessObj = yaml.safeLoad(serverlessYAML)
      return serverlessObj
    },

    validationSchemaPath: (version, file, validationType) =>
      path.join(__dirname, version, `${file}.${validationType}.schema.json`),

    validateStructuredFile: (version, file, validationType, config) => {
      const schemaPath = inst.validationSchemaPath(version, file, validationType)
      const schema = require(schemaPath)
      const valid = ajv.validate(schema, config)
      if (!valid) throw new Error(ajv.errorsText())
    },

    validateServiceConfigurationAgainstSchema: (config) => {
      const version = '0.0.0'
      // TODO: Consume version number properly.

      try {
        inst.validateStructuredFile(version, 'serverless.yml', 'preconditions', config)
      } catch(ex) {
        throw new UpdatePreconditionError(ex.message)
      }

      try {
        inst.validateStructuredFile(version, 'serverless.yml', 'conflicts', config)
      } catch(ex) {
        throw new UpdateConflictError(ex.message)
      }
    },

    validateServiceConfiguration: (config) => {
      inst.validateServiceConfigurationAgainstSchema(config)
    },

    validateServiceDefinition: () => {
      // Check the serverless.yml for upgrade
      const serviceConfig = inst.loadServiceDefinition()
      inst.validateServiceConfiguration(serviceConfig, {
        TestFunctionName: 'loadGenerator',
        ScheduleName: '${self:service}-${opt:stage, self:provider.stage}-monitoring', // eslint-disable-line no-template-curly-in-string
        AlertingName: 'monitoringAlerts',
      })
    },

    validateServiceImplementation: () => {
      // TODO: Check the JavaScript source for upgrade
    },

    validateServiceForUpgrade: () => {
      inst.checkForServiceFiles()
      const necessaryDependencies = inst.necessaryProjectDependencies()
      inst.validateProjectDependencies(necessaryDependencies)
      inst.validateServiceDefinition()
      inst.validateServiceImplementation()
    },

    backupDuplicateFiles: () => {
      // TODO: Move any conflicting files to *.bak. Throw if any *.bak files already exist.
    },

    upgradeProjectDependencies: () => {
      // TODO: Remove dependency packages, then add new ones in package.json.
    },

    upgradeServiceDefinition: () => {
      // TODO: Inject new resources into serverless.yml.
    },

    upgradeServiceImplementation: () => {
      // TODO: Copy new implementation files *.js into local assets directory.
    },

    upgradeService: () => {
      inst.validateServiceForUpgrade()
      inst.backupDuplicateFiles()
      inst.upgradeProjectDependencies()
      inst.upgradeServiceDefinition()
      inst.upgradeServiceImplementation()
    }
  }

  return inst
}

module.exports = impl
