const { join } = require('path')
const { safeLoad } = require('js-yaml')
const { readFileSync, readdirSync } = require('fs')
const { test, verify } = require('./integration')
const {
  deployNewTestResources,
  cleanupDeployments,
} = require('./deployToTemp')

const pathParameter = '{id}'

const urlsForScript = ({ testUrl, listUrl }) =>
  scriptName => ({
    testUrl: testUrl.replace(pathParameter, scriptName),
    listUrl: listUrl.replace(pathParameter, scriptName),
  })

describe('./tests/integration', () => {
  // Uses Serverless to deploy both SA and test target stack
  const deploying =
    deployNewTestResources()
      .then(result => ({
        urlsForName: urlsForScript(result),
        tempFolder: result.tempFolder,
        slsartTempFolder: result.slsartTempFolder,
      }))
      .catch(err => console.error(`Failed to deploy test stack: ${err.message}`))

  const scriptsPath = join(__dirname, 'scripts')
  const testScripts = readdirSync(scriptsPath)
  const testParameters = {}

  before(() => deploying.then(({ urlsForName, tempFolder, slsartTempFolder }) => {
    readdirSync(scriptsPath)
      .forEach((scriptName) => {
        testParameters[scriptName] = {
          name: scriptName,
          script: safeLoad(readFileSync(join(scriptsPath, scriptName))),
          resources: {
            urls: urlsForName(scriptName),
            tempFolder,
            slsartTempFolder,
          },
        }
      })
  }))

  describe('run the tests', () => {
    testScripts.forEach((testScript) => {
      it(`provides load as defined in ${testScript}`, () => {
        const params = testParameters[testScript]
        return test(params)
      })
    })
  })

  describe('waits for cloud watch', () => {
    it('waits for logs to propagate', () => new Promise(resolve => setTimeout(resolve, 120 * 1000)))
  })

  describe('validate the results', () => {
    testScripts.forEach((testScript) => {
      it(`validates the load as defined in ${testScript}`, () => {
        const params = testParameters[testScript]
        return verify(params)
      })
    })
  })

  after(() => cleanupDeployments())
})
