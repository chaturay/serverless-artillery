const path = require('path')

const idioms = require('../idioms')

const modifyScript = () => idioms.loadAndMerge(path.join(__dirname, 'script.yml'), {
  config: {
    target: '${cf:target-dev.target-dev-get-api}', // eslint-disable-line no-template-curly-in-string
  },
  scenarios: [
    {
      flow: [
        {
          get: {
            url: '/',
            match: {
              json: '$.message',
              value: 'success',
            },
          },
        },
      ],
    },
  ],
})
const modifyService = () => idioms.loadAndMerge(path.join(__dirname, 'serverless.yml'), {
  resources: {
    Resources: {
      monitoringAlerts: {
        Properties: {
          Subscription: `\${file(${path.resolve(__dirname, '..', 'config.yml')}):monitor.subscription`,
        },
      },
    },
  },
})

module.exports = () => idioms.runIn(__dirname, () => idioms.callAll(
  [
    idioms.functionDoesNotExist(),
    idioms.scriptDoesNotExist(),
    idioms.slsYmlDoesNotExist(),
  ])
  .then(idioms.monitor())
  .then(() => idioms.callAll([
    idioms.scriptExists(),
    idioms.slsYmlExists(),
  ]))
  .then(() => idioms.callAll([
    modifyScript,
    modifyService,
  ]))
  .then(idioms.deploy())
  .then(idioms.functionExists())
  // TODO check for monitoring activity
  // TODO validate behavior during failure state
  .then(idioms.remove())
  .then(idioms.functionDoesNotExist())
  .then(idioms.cleanupAll))
