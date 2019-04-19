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
  const deploying = () => {
    console.log('Deploying test serverless project. This will take a few minutes...')
    return deployNewTestResources()
      .then((result) => {
        const deployInfo = {
          urlsForName: urlsForScript(result),
          tempFolder: result.tempFolder,
          slsartTempFolder: result.slsartTempFolder,
        }

        console.log('Deployment complete.')
        console.log(`Test URL: ${result.testUrl}`)
        console.log(`List URL: ${result.listUrl}`)

        return deployInfo
      })
      .catch(err => console.error(`Failed to deploy test stack: ${err.message}`))
  }

  const scriptsPath = join(__dirname, 'scripts')
  const testScripts = readdirSync(scriptsPath)
  const testParameters = {}

  before(() => deploying().then(({ urlsForName, tempFolder, slsartTempFolder }) => {
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

  describe('making test requests to target endpoint', () => {
    testScripts.forEach((testScript) => {
      it(`provides load defined in ${testScript}`, () => {
        const params = testParameters[testScript]
        return test(params)
      })
    })
  })

  describe('waits for CloudWatch', () => {
    it('waits for logs to propagate', () => new Promise(resolve => setTimeout(resolve, 120 * 1000)))
  })

  describe('check actual load provided', () => {
    testScripts.forEach((testScript) => {
      it(`validates load defined in ${testScript}`, () => {
        const params = testParameters[testScript]
        return verify(params)
      })
    })
  })

  after(() => {
    console.log('Removing test projects. This will take a few minutes...')
    return cleanupDeployments()
      .then(() => console.log('Removal complete.'))
  })
})
