const { promisify } = require('es6-promisify')
const chai = require('chai')
const diff = require('diff')
const fs = require('fs')
const ncp = promisify(require('ncp').ncp)
const path = require('path')
const recursive = require('recursive-readdir')
const tmp = require('tmp')

const { upgrade } = require('../../../lib/index')

const { expect } = chai

tmp.setGracefulCleanup() // Make sure that any temp directories are deleted after test exists.

// Loads a single file contents into memory to check.
const namesAndContents = file => ({
  name: file,
  content: fs.readFileSync(file, 'utf8'),
})

// Determine project-relative file path.
const replaceBasePath = basePath =>
  fileInfo =>
    Object.assign({}, fileInfo, {
      name: fileInfo.name.replace(`${basePath}/`, ''),
    })

// Reduce list of file names and contents to a single map object.
const toSingleMap = (theMap, nameAndContents) =>
  Object.assign(theMap, {
    [nameAndContents.name]: nameAndContents.content,
  })

// Load all project file contents into memory.
const loadFilesFromPaths = (basePath, paths) =>
  paths
    .map(namesAndContents)
    .map(replaceBasePath(basePath))
    .reduce(toSingleMap, {})

// Determines if a file should be ignored in a project for testing purposes.
const ignoredFile = (fullFilePath) => {
  const ignoredFileList = [
    'node_modules',
    'package-lock.json',
    // 'backup',
  ]
  const baseFilename = path.basename(fullFilePath)

  return ignoredFileList.indexOf(baseFilename) !== -1
}

// File names in the project file map.
const listOfFileNames = (loadedFiles) => {
  const filesInList = files => Object.getOwnPropertyNames(files)

  return filesInList(loadedFiles)
}

// Returns only unique file names.
const removeDuplicates = (names, otherNames) =>
  names.reduce((allNames, name) => {
    const nameNotFound = allNames.indexOf(name) === -1

    return nameNotFound ? allNames.concat(name) : allNames
  }, otherNames)

// De-duplicated list of files between the two projects.
const listOfUniqueFileNames = (loadedProjectFiles, loadedSolutionFiles) => {
  const sourceNames = listOfFileNames(loadedProjectFiles)
  const solutionNames = listOfFileNames(loadedSolutionFiles)

  return removeDuplicates(sourceNames, solutionNames)
}

// Describes the differences in a given file between two projects.
const createFileDiff = (loadedProjectFiles, loadedSolutionFiles) => (name) => {
  const fileDiff = diff.structuredPatch(
    name,
    name,
    loadedProjectFiles[name] || '',
    loadedSolutionFiles[name] || '',
    '',
    '',
    { context: 0 }
  )

  return {
    file: fileDiff.oldFileName,
    hunks: fileDiff.hunks,
  }
}

// Describes the differences for all files between two projects.
const diffProjects = (projectPath, solutionPath) =>
  Promise.all([
    recursive(projectPath, [ignoredFile]),
    recursive(solutionPath, [ignoredFile]),
  ])
    .then(([projectFiles, solutionFiles]) => {
      const loadedProjectFiles = loadFilesFromPaths(projectPath, projectFiles)
      const loadedSolutionFiles = loadFilesFromPaths(solutionPath, solutionFiles)
      const uniqueNames = listOfUniqueFileNames(loadedProjectFiles, loadedSolutionFiles)

      return uniqueNames.map(createFileDiff(loadedProjectFiles, loadedSolutionFiles))
    })


// Describe the differences between the files in two projects.
const diffTestProjectToSolution = (upgradePath, testName) => {
  const projectPath = path.join(__dirname, upgradePath, testName, 'configured')
  const solutionPath = path.join(__dirname, upgradePath, testName, 'upgraded')

  return diffProjects(projectPath, solutionPath)
}

// Run the `upgrade` command against a specific project.
const performUpgradeOnTestProject = (tempProjectPath) => {
  const currentWorkingDir = process.cwd()
  process.chdir(tempProjectPath)

  return upgrade()
    .then(() => process.chdir(currentWorkingDir))
}

// Copy test project files to temp directory for upgrading.
const setupTempProject = (upgradePath, testName) => {
  const tempPath = tmp.dirSync({ mode: 0o777, prefix: `${upgradePath}-${testName}` }).name
  const projectPath = path.join(__dirname, upgradePath, testName, 'configured')

  return ncp(projectPath, tempPath)
    .then(() => ({ projectPath, tempPath }))
}

// Starting with the expected differences, check the actual results once available.
const checkUpgradeResults = (projectPath, tempPath, expectedDiff) => (actualDiff) => {
  expectedDiff.forEach((expectedFileDiff) => {
    const fileDiff = actualDiff.find(actualFileDiff => actualFileDiff.file === expectedFileDiff.file)
    if (!fileDiff) throw new Error(`Missing file in upgraded project: ${expectedFileDiff.file}`)
    expect(fileDiff).to.eql(expectedFileDiff)
  })
}

// Runs the integration tests from one project version to to another.
// Test projects starting state can be found in the `X.X.X-to-Y.Y.Y/test-name/configured/*` directories.
// Expected upgrade results (solutions) are found in the `X.X.X-to-Y.Y.Y/test-name/upgraded/*` directories.
const upgradeTest = (upgradePath, testName) =>
  diffTestProjectToSolution(upgradePath, testName)
    .then(expectedDiff => setupTempProject(upgradePath, testName)
      .then(({ projectPath, tempPath }) =>
        performUpgradeOnTestProject(tempPath)
          .then(() => diffProjects(projectPath, tempPath))
          .then(checkUpgradeResults(projectPath, tempPath, expectedDiff))
      )
    )

describe('upgrade integration tests', () => {
  describe('from 0.0.0 to 0.0.1', () => {
    it('upgrades a default project', () =>
      upgradeTest('0.0.0-to-0.0.1', 'default')
    )

    it('preserves a package dependency', () =>
      upgradeTest('0.0.0-to-0.0.1', 'package-dependency')
    )

    it('preserves a plugin dependency', () =>
      upgradeTest('0.0.0-to-0.0.1', 'serverless-plugin-dependency')
    )
  })
})
