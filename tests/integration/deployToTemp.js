const { tmpdir } = require('os')
const { join } = require('path')
const childProcess = require('child_process')

const { randomString } = require('./target/handler')
const fs = require('./fs')
const persistence = require('./target/persistence')

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

const impl = {
  findTargetSourceFiles: (ls = fs.ls, sourcePath = defaultTargetSourcePath) =>
    () =>
      ls(sourcePath)
        .then(filterOutSpecFiles)
        .then(namesToFullPaths(sourcePath)),

  writeConfig: (writeFile = fs.writeFile) =>
    (destination, instanceId) =>
      writeFile(join(destination, 'config.yml'), `instanceId: ${instanceId}`),

  stageTarget: (
    findTargetSourceFiles = impl.findTargetSourceFiles(),
    copyAll = fs.copyAll,
    writeConfig = impl.writeConfig()
  ) =>
    (destination, instanceId) =>
      findTargetSourceFiles()
        .then(copyAll(destination))
        .then(writeConfig(destination, instanceId)),

  stageSlsart: (
    sourcePath = defaultSlsartSourcePath,
    listAbsolutePathsRecursively = fs.listAbsolutePathsRecursively,
    copyAll = fs.copyAll
  ) =>
    destination =>
      listAbsolutePathsRecursively(sourcePath)
        .then(copyAll(destination)),

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
    deploy = impl.deploy(),
    log = console.log,
    warn = console.error
  ) =>
    ({ instanceId, destination } = tempLocation()) => {
      const paths = pathsFromTempDirectory(destination)
      const {
        targetTempFolder,
        slsartTempFolder,
      } = paths
      return mkdirp(slsartTempFolder)
        .then(() => log('staging slsart', instanceId, 'to', slsartTempFolder))
        .then(() => stageSlsart(slsartTempFolder))
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

  deleteAllObjects: ({ listFiles, deleteFiles } = persistence) =>
    (instanceId) => {
      process.env.SLSART_INTEGRATION_BUCKET =
        `slsart-integration-target-${instanceId}-reqs`
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
    log = console.log,
    deleteAllObjects = impl.deleteAllObjects(),
    remove = impl.remove(),
    warn = console.error,
    rmrf = fs.rmrf
  ) =>
    directory =>{
      const {
        targetTempFolder,
        slsartTempFolder,
      } = pathsFromTempDirectory(directory)
      log('  removing temp deployment', directory)
      log('    removing', targetTempFolder)
      return deleteAllObjects()
        .then(() => remove(targetTempFolder))
        .catch(() => warn('    failed to sls remove', targetTempFolder))
        .then(() => remove(slsartTempFolder))
        .catch(() => warn('    failed to sls remove', slsartTempFolder))
        .then(() => log('    deleting', directory) || rmrf(directory))
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
    log = console.log,
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
}
