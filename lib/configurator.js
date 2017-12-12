const sideEffects = require('./side-effects')
const {
  pipe, tap, map, freeze, tapif,
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

function configuratorFactory({
  log = sideEffects.log,
  randomid = sideEffects.randomid,
  writeFileIfNotExists = sideEffects.writeFileIfNotExists,
  readLambdaFile = name => sideEffects.readLocalFile('lambda', name),
  deleteFile = sideEffects.deleteFile,
  npmInstall = sideEffects.npmInstall,
} = {}) {
  const fixData = data =>
    data.replace(serviceName, `${serviceName}-${randomid()}`)

  const tryWriteFile = fileName => readLambdaFile(fileName)
    .then(data => ({ name: fileName, data: fixData(data) }))
    .then(file => writeFileIfNotExists(file.name, file.data)
      .then(succeeded => Object.assign({ conflict: !succeeded }, file)))

  const logConflictList = result =>
    log(messages.conflictList(result.conflicts.map(conflict => conflict.name)))

  const cleanUpFiles = result =>
    result.files
      .filter(file => !file.conflict)
      .map(file => file.name)
      .forEach(deleteFile)

  return ({ debug = false } = {}) =>
    pipe(serverlessFiles, [
      tapif(debug)(() => log(messages.identifying)),
      map(tryWriteFile),
      operations => Promise.all(operations),
      files => ({ conflicts: files.filter(file => file.conflict), files }),
      result => (result.conflicts.length
        ? pipe(result, [
          tapif(debug)(() => log(messages.conflict)),
          tap(logConflictList),
          cleanUpFiles,
        ])
        : pipe(result, [
          tapif(debug)(() => log(messages.noConflict)),
          tapif(debug)(() => log(messages.npmInstall)),
          () => npmInstall()
            .then(() =>
              log(messages.complete))
            .catch(() => pipe(result, [
              tap(() => log(messages.complete)),
              tap(() => log(messages.npmInstallError)),
              cleanUpFiles,
            ])),
        ])),
    ])
}

configuratorFactory.serviceName = serviceName
configuratorFactory.messages = messages
configuratorFactory.serverlessFiles = serverlessFiles
module.exports = freeze(configuratorFactory)
