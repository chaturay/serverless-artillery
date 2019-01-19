const { join } = require('path')
const { safeLoad } = require('js-yaml')
const { readFileSync, readdirSync } = require('fs')

const {
  deployNewTestResources,
  cleanupDeployments,
} = require('./deployToTemp')
const { test } = require('./integration')

const scriptsPath = join(__dirname, 'scripts')
const pathParameter = '{id}'

const urlsForScript = ({ testUrl, listUrl, deleteUrl }) =>
  scriptName => ({
    testUrl: testUrl.replace(pathParameter, scriptName),
    listUrl: listUrl.replace(pathParameter, scriptName),
    deleteUrl: deleteUrl.replace(pathParameter, scriptName),
  })

// NOTE: this uses the 'sync' filesystem methods because mocha does not support
//  calling describe() or it() asynchronously.
describe('./tests/integration', () => {
  const deploying =
    deployNewTestResources()
    // mockDeployNewTestResources()
      .then(result => ({
        urlsForName: urlsForScript(result),
        tempFolder: result.tempFolder,
      }))

  it('should deploy temporary resources', () => deploying)

  readdirSync(scriptsPath)
    .map(name => ({
      name,
      script: safeLoad(readFileSync(join(scriptsPath, name))),
      resources: deploying
        .then(({ urlsForName, tempFolder }) => ({
          urls: urlsForName(name),
          tempFolder,
        })),
    }))
    .map(test)

  after(() => cleanupDeployments())
})
