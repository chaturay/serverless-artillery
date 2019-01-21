const tmp = require('tmp')
const fs = require('fs')
const path = require('path')
const diff = require('deep-diff')
const { upgrade } = require('../../../lib/index')

tmp.setGracefulCleanup()

const createUserProject = () => {
  /* create project dir */
  console.log('0. createUserProject')

  return Promise.resolve('path')
}

const configureUserProject = (version) =>
  () => {
    /* copies project files with specific version into project dir */
    console.log('1. configureUserProjet')
    Promise.resolve('yes')
  }

const modifyUserProjectFiles = (testName) =>
  () => {
    /* copies modified versions of project files, using test name for source dir */
    console.log('2. modifyUserProjectFiles')
  }

const upgradeUserProject = () => {
  /* run upgrade command in test project dir, return results */
  console.log('3. upgradeUserProject')
  return {}
}

const validateUpgradeResults = (results, expectations) => {
  /* compare test results to expectations */
  console.log('4. validateUpgradeResults')
}

const removeUserProject = () => {
  /* remove project dir */
  console.log('5. removeUserProject')
}

const upgradeTester = (testName, version, expectations) =>
  createUserProject()
    .then(configureUserProject(version))
    .then(modifyUserProjectFiles(testName))
    .then(upgradeUserProject)
    .then(results => validateUpgradeResults(results, expectations))
    .then(removeUserProject)

// upgradeTester('testName', '0.0.0', {})
//   .then(() => console.log('DONE.'))

const expandName = (name) => {
  console.log(' - ', name)
  return name
}

const notDirectory = name => fs.statSync(name).isFile()

const expandDirectory = dir =>
  dir
    .filter(notDirectory)
    .map(n => ({ [path.basename(n)]: fs.readFileSync(n, 'utf8') }))
    // .reduce((expansion, fileData) =>
    //   Object.assign(expansion, {
    //     [fileData.path]: fileData.contents,
    //   })
    // )

const latest = '0.0.1'
const assetPathFromVersion = version =>
  version === latest
    ? './lib/lambda'
    : `./lib/versioning/${version}/assets`

const assetPath = assetPathFromVersion('0.0.0')
const dir = fs.readdirSync(assetPath).map(name => path.join(assetPath, name))
console.log(JSON.stringify(expandDirectory(dir), null, 2))

const assetPath2 = assetPathFromVersion('0.0.1')
const dir2 = fs.readdirSync(assetPath2).map(name => path.join(assetPath2, name))
console.log(JSON.stringify(expandDirectory(dir2), null, 2))

console.log(JSON.stringify(diff(dir, dir2), null, 2))
