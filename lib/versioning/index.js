/**
 * @module versioning
 */
const fsDefault = require('fs')
const pathDefault = require('path')
const yamlDefault = require('js-yaml')

const impl = (
  fs = fsDefault,
  path = pathDefault,
  yaml = yamlDefault
) => {
  const inst = {
    readAssetsVersionFromInfoFile: (slsArtInfoFilePath) => {
      const slsArtInfoYaml = fs.readFileSync(slsArtInfoFilePath)
      const slsArtInfo = yaml.safeLoad(slsArtInfoYaml)
      return slsArtInfo.version
    },

    readAssetsVersion: (localAssetsPath) => {
      const slsArtInfoFilePath = path.join(localAssetsPath, '.slsart')
      const infoFileExists = fs.existsSync(slsArtInfoFilePath)
      return infoFileExists
        ? inst.readAssetsVersionFromInfoFile(slsArtInfoFilePath)
        : '0.0.0'
    },

    functionAssetFiles: (version) => {
      switch (version) {
        case '0.0.0':
          return [
            'handler.js',
            'package.json',
            'serverless.yml',
          ]
      }
    },

    checkForAnyMissingServiceFiles: (listOfFiles, localAssetsPath) =>
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
        throw new Error(`Missing asset files: ${missingFileList}`)
      }
    },

    checkForServiceFiles: (localAssetsPath) => {
      const assetsVersion = inst.readAssetsVersion(localAssetsPath)
      const listOfFiles = inst.functionAssetFiles(assetsVersion)
      const missingFiles = inst.checkForAnyMissingServiceFiles(listOfFiles, localAssetsPath)
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

    checkAllDependencies: (necessaryDependencies, dependencies) =>
      Object.keys(necessaryDependencies).reduce((missingDependencies, packageName) => {
        inst.packageIsMissing(dependencies, packageName, missingDependencies)
        return missingDependencies
      }, []),

    checkAllVersions: (necessaryDependencies, dependencies) =>
      Object.keys(necessaryDependencies).reduce((mismatchedDependencies, packageName) => {
        inst.checkPackageVersion(dependencies, packageName, necessaryDependencies, mismatchedDependencies)
        return mismatchedDependencies
      }, []),

    throwIfAnyDependencyMissing: (missingDependency) => {
      const anyPackagesAreMissing = missingDependency.length > 0
      if (anyPackagesAreMissing) {
        const missingPackageList = missingDependency.join(', ')
        throw new Error(`Missing package.json dependency: ${missingPackageList}`)
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

        throw new Error(`Invalid package.json dependency package version found:\n${specificVersionErrors}`)
      }
    },

    loadProjectDependencies: (localAssetsPath) => {
      const packagePath = path.join(localAssetsPath, 'package.json')
      const packageJSON = fs.readFileSync(packagePath)
      const packageObj = JSON.parse(packageJSON)
      return packageObj.dependencies
    },

    necessaryProjectDependencies: (localAssetsPath) => {
      const assetsVersion = inst.readAssetsVersion(localAssetsPath)

      switch (assetsVersion) {
        case '0.0.0':
          return {
            'artillery-core': '^2.0.3-0',
            'csv-parse': '^1.1.7',
          }
      }
    },

    validateProjectDependencies: (localAssetsPath, necessaryDependencies) => {
      // Check the package.json dependencies for upgrade
      const dependencies = inst.loadProjectDependencies(localAssetsPath)

      const missingDependenciesList = inst.checkAllDependencies(necessaryDependencies, dependencies)
      inst.throwIfAnyDependencyMissing(missingDependenciesList)

      const versionMismatchDependenciesList = inst.checkAllVersions(necessaryDependencies, dependencies)
      inst.throwIfAnyDependencyVersionsMismatch(versionMismatchDependenciesList)
    },

    validateServiceDefinition: (localAssetsPath) => {
      // TODO: Check the serverless.yml for upgrade
    },

    validateServiceImplementation: (localAssetsPath) => {
      // TODO: Check the JavaScript source for upgrade
    },

    validateServiceForUpdate: (localAssetsPath) => {
      const necessaryDependencies = inst.necessaryProjectDependencies(localAssetsPath)
      inst.checkForServiceFiles(localAssetsPath)
      inst.validateProjectDependencies(localAssetsPath, necessaryDependencies)
      inst.validateServiceDefinition(localAssetsPath)
      inst.validateServiceImplementation(localAssetsPath)
    },
  }

  return inst
}

module.exports = impl
