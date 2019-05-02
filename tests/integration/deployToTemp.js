const { tmpdir } = require('os')
const { join } = require('path')
const childProcess = require('child_process')

const fs = require('./fs')

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
  const startIndex = lines.findIndex(line => /endpoints:/.test(line)) + 1
  const urls = lines.slice(startIndex, startIndex + 2)
    .map(line => line.split(' - '))
    .map(([, url]) => url.trim())
  return {
    testUrl: urls[0],
    listUrl: urls[1],
  }
}

const defaultLog = process.env.DEBUG
  ? console.log
  : () => {}

const defaultWarn = process.env.DEBUG
  ? console.warn
  : () => {}

const impl = {
  findTargetSourceFiles: (ls = fs.ls, sourcePath = defaultTargetSourcePath) =>
    () =>
      ls(sourcePath)
        .then(filterOutSpecFiles)
        .then(namesToFullPaths(sourcePath)),

  stageTarget: (
    findTargetSourceFiles = impl.findTargetSourceFiles(),
    copyAll = fs.copyAll
  ) => destination =>
    findTargetSourceFiles()
      .then(copyAll(destination)),

  findSlsartSourceFiles: (
    sourcePath = defaultSlsartSourcePath,
    ls = fs.ls
  ) =>
    () =>
      ls(sourcePath)
        .then(namesToFullPaths(sourcePath)),

  stageSlsart: (
    findSlsartSourceFiles = impl.findSlsartSourceFiles(),
    copyAll = fs.copyAll,
    exec = impl.execAsync()
  ) => destination =>
    findSlsartSourceFiles()
      .then(copyAll(destination))
      .then(() => exec('npm i', { cwd: destination })),

  execAsync: (exec = childProcess.exec,
    log = defaultLog,
    warn = defaultWarn) =>
    (command, options = {}) =>
      new Promise((resolve, reject) =>
        exec(command, options, (err, stdout, stderr) =>
          (err
            ? warn('execAsync ERROR: ', err, stderr, stdout) || reject(execError(err, stderr))
            : log('execAsync SUCCESS: ', stdout) || resolve(stdout)))),

  deploy: (exec = impl.execAsync()) =>
    directory =>
      (process.env.DEBUG ? exec('slsart deploy -v', { cwd: directory }) : exec('slsart deploy', { cwd: directory })),

  tempLocation: (random = () => `${Date.now()}`, root = defaultRoot) =>
    (instanceId = random()) =>
      ({ instanceId, destination: join(root, instanceId) }),

  deployNewTestResources: (
    tempLocation = impl.tempLocation(),
    mkdirp = fs.mkdirp,
    stageTarget = impl.stageTarget(),
    stageSlsart = impl.stageSlsart(),
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
      return mkdirp(slsartTempFolder)
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

  remove: (exec = impl.execAsync()) =>
    directory => exec('slsart remove', { cwd: directory }),

  removeTempDeployment: (
    log = defaultLog,
    remove = impl.remove(),
    warn = defaultWarn,
    rmrf = fs.rmrf
  ) =>
    (directory) => {
      const {
        targetTempFolder,
        slsartTempFolder,
      } = pathsFromTempDirectory(directory)
      log('  removing temp deployment', directory)
      log('    removing', targetTempFolder)
      return remove(targetTempFolder)
        .catch(err => warn('    failed to sls remove', targetTempFolder, err.message))
        .then(() => rmrf(targetTempFolder))
        // .then(() => log('    removing', slsartTempFolder))
        // .then(() => remove(slsartTempFolder))
        // .catch(err => warn('    failed to sls remove', slsartTempFolder, err.message))
        .then(() => rmrf(slsartTempFolder))
        .then(() => log('    deleting', directory))
        .then(() => rmrf(directory))
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
