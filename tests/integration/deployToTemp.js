const { tmpdir } = require('os')
const { join, sep, dirname } = require('path')
const childProcess = require('child_process')
const { safeLoad, safeDump } = require('js-yaml')

const { randomString } = require('./target/handler')
const fs = require('./fs')
const { s3 } = require('./target/persistence')

const defaultTargetSourcePath = join(__dirname, 'target')
const defaultSlsartSourcePath = join(__dirname, '../../lib/lambda')
const defaultRoot = join(tmpdir(), 'slsart-integration')

const execError = (err, stderr) =>
  new Error(`${err.message} ${stderr}`)

const namesToFullPaths = directory =>
  names =>
    names.map(name => join(directory, name))

const filterOutSpecFiles = names =>
  names.filter(name => !name.endsWith('.spec.js'))

const tap = fn => (value) => {
  fn(value)
  return value
}

const pathsFromTempDirectory = tempFolder => ({
  tempFolder,
  targetTempFolder: join(tempFolder, 'target'),
  slsartTempFolder: join(tempFolder, 'slsart'),
})

const instanceIdFromTempDirectory = tempFolder => {
  const parts = tempFolder.split(sep)
  return parts[parts.length - 1]
}

const urlsFromDeployTargetOutput = (output) => {
  const lines = output.split('\n')
  const startIndex = lines.indexOf('endpoints:') + 1
  const urls = lines.slice(startIndex, startIndex + 3)
    .map(line => line.split(' - '))
    .map(([, url]) => url.trim())
  return {
    testUrl: urls[0],
    listUrl: urls[1],
    deleteUrl: urls[2],
  }
}

const defaultLog = process.env.DEBUG
  ? console.log
  : () => {}

const defaultWarn = process.env.DEBUG
  ? console.warn
  : () => {}

const updateSlsartServerlessYml = yml =>
  Object.assign(
    {},
    yml,
    { service: 'slsart-integration-runner-${self:custom.instanceId}' },
    { custom: '${file(./config.yml)}' },
    { provider: Object.assign(
      {},
      yml.provider,
      {
        deploymentBucket: {
          name: 'slsart-integration-${self:custom.instanceId}-depl'
        }
      }),
    },
  )

const impl = {
  findTargetSourceFiles: (ls = fs.ls, sourcePath = defaultTargetSourcePath) =>
    () =>
      ls(sourcePath)
        .then(filterOutSpecFiles)
        .then(namesToFullPaths(sourcePath)),

  writeConfig: (writeFile = fs.writeFile) =>
    (destination, instanceId) =>
      writeFile(join(destination, 'config.yml'))(`instanceId: ${instanceId}`),

  stageTarget: (
    findTargetSourceFiles = impl.findTargetSourceFiles(),
    copyAll = fs.copyAll,
    writeConfig = impl.writeConfig()
  ) =>
    (destination, instanceId) =>
      findTargetSourceFiles()
        .then(copyAll(destination))
        .then(writeConfig(destination, instanceId)),

  findSlsartSourceFiles: (
    sourcePath = defaultSlsartSourcePath,
    ls = fs.ls,
  ) =>
    () =>
      ls(sourcePath)
        .then(namesToFullPaths(sourcePath)),

  updateSlsartServerlessYmlFile: ({ readFile, writeFile } = fs) =>
    (destination, instanceId) => {
      const serverlessYmlPath = join(destination, 'serverless.yml')
      return readFile(serverlessYmlPath)
        .then(safeLoad)
        .then(updateSlsartServerlessYml)
        .then(safeDump)
        .then(writeFile(serverlessYmlPath))
    },

  stageSlsart: (
    findSlsartSourceFiles = impl.findSlsartSourceFiles(),
    copyAll = fs.copyAll,
    writeConfig = impl.writeConfig(),
    updateSlsartServerlessYmlFile = impl.updateSlsartServerlessYmlFile(),
    exec = impl.execAsync()
  ) =>
    (destination, instanceId) =>
      findSlsartSourceFiles()
        .then(copyAll(destination))
        .then(() => writeConfig(destination, instanceId))
        .then(() => updateSlsartServerlessYmlFile(destination, instanceId))
        .then(() => exec('npm i', { cwd: destination })),

  execAsync: (exec = childProcess.exec) =>
    (command, options = {}) =>
      new Promise((resolve, reject) =>
        exec(command, options, (err, stdout, stderr) =>
          (err
            ? reject(execError(err, stderr))
            : resolve(stdout)))),

  deploy: (exec = impl.execAsync()) =>
    directory =>
      exec('sls deploy', { cwd: directory }),

  tempLocation: (random = () => randomString(8), root = defaultRoot) =>
    (instanceId = random()) =>
      ({ instanceId, destination: join(root, instanceId) }),

  deployNewTestResources: (
    tempLocation = impl.tempLocation(),
    mkdirp = fs.mkdirp,
    stageTarget = impl.stageTarget(),
    stageSlsart = impl.stageSlsart(),
    { createBucket } = s3,
    deploy = impl.deploy(),
    log = defaultLog,
    warn = defaultWarn
  ) =>
    ({ instanceId, destination } = tempLocation()) => {
      const paths = pathsFromTempDirectory(destination)
      const {
        targetTempFolder,
        slsartTempFolder,
      } = paths
      const deploymentBucketName = `slsart-integration-${instanceId}-depl`
      return mkdirp(slsartTempFolder)
        .then(() => log('creating deployment bucket', deploymentBucketName))
        .then(() => createBucket(deploymentBucketName))
        .then(() => log('staging slsart', instanceId, 'to', slsartTempFolder))
        .then(() => stageSlsart(slsartTempFolder, instanceId))
        .then(() => log('deploying slsart', slsartTempFolder))
        .then(() => deploy(slsartTempFolder))
        .then(() => mkdirp(targetTempFolder))
        .then(() => log('staging target', instanceId, 'to', targetTempFolder))
        .then(() => stageTarget(targetTempFolder, instanceId))
        .then(() => log('deploying target', targetTempFolder))
        .then(() => deploy(targetTempFolder))
        .then(urlsFromDeployTargetOutput)
        .then(urls => Object.assign({}, urls, paths))
        .then(tap(log))
        .catch(err =>
          warn('failed to deploy a new target:', err.stack) || false)
    },

  deleteAllObjects: ({ listFiles, deleteFiles } = s3) =>
    (bucketName) => {
      process.env.SLSART_INTEGRATION_BUCKET = bucketName
      const deleteNext = listNext =>
        listNext && listNext()
          .then(({ keys, next }) => deleteFiles(keys).then(() => next))
          .then(deleteNext)
      return deleteNext(listFiles)
    },

  remove: (exec = impl.execAsync()) =>
    directory =>
      exec('sls remove', { cwd: directory }),

  removeTempDeployment: (
    log = defaultLog,
    deleteAllObjects = impl.deleteAllObjects(),
    remove = impl.remove(),
    { deleteBucket } = s3,
    warn = defaultWarn,
    rmrf = fs.rmrf
  ) =>
    (directory) => {
      const {
        targetTempFolder,
        slsartTempFolder,
      } = pathsFromTempDirectory(directory)
      const instanceId = instanceIdFromTempDirectory(directory)
      const requestBucketName = `slsart-integration-target-${instanceId}-reqs`
      const deploymentBucketName = `slsart-integration-${instanceId}-depl`
      log('  removing temp deployment', directory)
      log('    removing', targetTempFolder)
      return deleteAllObjects(requestBucketName)
        .then(() => remove(targetTempFolder))
        .catch(err => warn('    failed to sls remove', targetTempFolder, err.message))
        .then(() => log('    removing', slsartTempFolder))
        .then(() => remove(slsartTempFolder))
        .catch(err => warn('    failed to sls remove', slsartTempFolder, err.message))
        .catch(err => warn('    failed to delete deployment bucket', deploymentBucketName, err.message))
        .then(() => log('    deleting', directory))
        .then(() => rmrf(directory))
        .then(() => deleteAllObjects(deploymentBucketName))
        .catch(err => log('    failed to delete all objects from', deploymentBucketName, err.message))
        .then(() => deleteBucket(deploymentBucketName))
        .catch(err => log('    failed to delete bucket', deploymentBucketName, err.message))
        .then(() => log('  done'))
    },

  listTempDeployments: (ls = fs.ls) =>
    root =>
      ls(root)
        .then(directories =>
          directories.map(directory => join(root, directory))),

  cleanupDeployments: (
    list = impl.listTempDeployments(),
    remove = impl.removeTempDeployment(),
    log = defaultLog,
    root = defaultRoot
  ) =>
    () =>
      log('cleaning up deployments in', root) || list(root)
        .then(directories => directories.reduce(
          (awaiting, directory) => awaiting.then(() => remove(directory)),
          Promise.resolve()
        )),
}

module.exports = {
  impl,
  deployNewTestResources: impl.deployNewTestResources(),
  removeTempDeployment: impl.removeTempDeployment(),
  cleanupDeployments: impl.cleanupDeployments(),
  exec: impl.execAsync(),
}
