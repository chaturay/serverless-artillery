const sideEffects = require('./side-effects')
const {
  pipe, tap, map, freeze, tapif, pipeif, noop, all,
} = require('./fp')

const messages = freeze({
  complete: [
    '\tYour function assets have been created.',
    '\tWe are glad that you see enough value in the project to do some customization!',
    '\tEdit serverless.yml to customize your load function but please note that you must',
    '\t\tdeploy the function before invoking and also after making any modifications.',
    '\tDocumentation is available at https://docs.serverless.com.',
    '',
  ],
  npmInstall: 'Executing `npm install` to provide dependencies to the generated Serverless project.',
  npmInstallError: [
    '',
    'An error occurred executing \'npm install\'. Please note and resolve any errors',
    'and run \'npm install\' in the current working directory again.',
  ],
  identifying: 'Identifying any file conflicts...',
  conflict: 'Conflicts discovered, generating output message.',
  conflictList: files => [
    '\tConflict with existing files:',
    ...files.map(file => `\t\t${file}`),
    '\tNo files created.',
  ],
  noConflict: 'No conflicts found, creating a local copy of the Serverless files to deploy.',
})

const serverlessFiles = freeze([
  'serverless.yml',
  'handler.js',
  'package.json',
])

const serviceName = 'service: serverless-artillery'

const pure = freeze({
  fixServiceNameInData: (randomid, serviceName) => data =>
    data.replace(serviceName, `${serviceName}-${randomid()}`),

  tryWriteFile: writeFileIfNotExists => (name, data) =>
    writeFileIfNotExists(name, data)
      .then(succeeded => ({ name, conflict: !succeeded })),

  readLambdaFile: readLocalFile => name =>
    readLocalFile('lambda', name),

  stageLambdaFile:
    (readLambdaFile, tryWriteFile, fixServiceNameInData) => fileName =>
      readLambdaFile(fileName)
        .then(data => ({ name: fileName, data: fixServiceNameInData(data) }))
        .then(file => tryWriteFile(file.name, file.data)),

  stageAllServerlessFiles: stageLambdaFile => serverlessFiles =>
    pipe(serverlessFiles, [map(stageLambdaFile), all]),

  hasConflicts: writtenFiles => writtenFiles.some(file => file.conflict),

  getConflictNames: writtenFiles =>
    writtenFiles
      .filter(file => file.conflict)
      .map(conflict => conflict.name),

  createConflictMessage: (conflictList, getConflictNames) =>
    writtenFiles => conflictList(getConflictNames(writtenFiles)),

  removeUnconflictedFiles: deleteFile => writtenFiles =>
    writtenFiles
      .filter(file => !file.conflict)
      .map(file => file.name)
      .map(deleteFile),

  log: logger => message => tap(() => logger(message)),

  logConflicts: (logger, createConflictMessage) =>
    tap(writtenFiles => logger(createConflictMessage(writtenFiles))),

  installDependencies:
    (npmInstall, log, removeUnconflictedFiles) => writtenFiles =>
      npmInstall()
        .then(log(messages.complete))
        .catch(() => pipe(writtenFiles, [
          log(messages.complete),
          log(messages.npmInstallError),
          removeUnconflictedFiles,
        ])),

  configure: ({
    messages,
    debug,
    serverlessFiles,
    log,
    stageAllServerlessFiles,
    hasConflicts,
    logConflicts,
    removeUnconflictedFiles,
    installDependencies,
  }) => pipe(serverlessFiles, [
    debug(messages.identifying),
    stageAllServerlessFiles,
    pipeif(hasConflicts, [
      debug(messages.conflict),
      logConflicts,
      removeUnconflictedFiles,
    ], [
      debug(messages.noConflict),
      debug(messages.npmInstall),
      installDependencies,
    ]),
  ]),
})

const factory = ({
  logger = sideEffects.log,
  readLocalFile = sideEffects.readLocalFile,
  writeFileIfNotExists = sideEffects.writeFileIfNotExists,
  randomid = sideEffects.randomid,
  deleteFile = sideEffects.deleteFile,
  npmInstall = sideEffects.npmInstall,
} = {}) => {
  const log = pure.log(logger)
  const readLambdaFile = pure.readLambdaFile(readLocalFile)
  const tryWriteFile = pure.tryWriteFile(writeFileIfNotExists)
  const fixServiceNameInData = pure.fixServiceNameInData(randomid, serviceName)
  const stageLambdaFile =
    pure.stageLambdaFile(readLambdaFile, tryWriteFile, fixServiceNameInData)
  const removeUnconflictedFiles = pure.removeUnconflictedFiles(deleteFile)
  const installDependencies =
    pure.installDependencies(npmInstall, log, removeUnconflictedFiles)
  const createConflictMessage =
    pure.createConflictMessage(messages.conflictList, pure.getConflictNames)
  const options = {
    messages,
    serverlessFiles,
    log,
    stageAllServerlessFiles: pure.stageAllServerlessFiles(stageLambdaFile),
    hasConflicts: pure.hasConflicts,
    logConflicts: pure.logConflicts(logger, createConflictMessage),
    removeUnconflictedFiles,
    installDependencies,
  }
  return ({ debug = false } = {}) =>
    pure.configure(Object.assign({ debug: debug ? log : () => noop }, options))
}

factory.serviceName = serviceName
factory.messages = messages
factory.serverlessFiles = serverlessFiles
factory.pure = pure
module.exports = freeze(factory)
