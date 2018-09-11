const BbPromise = require('bluebird')
const idioms = require('../idioms')
const path = require('path')

const scriptPath = path.join(__dirname, '/load_script.yml')

const baseScript = idioms.parseInput(scriptPath)
const basic = idioms.phaseUpdate(baseScript, {})
const horizontalTest = idioms.phaseUpdate(baseScript, { duration: 15, arrivalRate: 1 })
const verticalTest = idioms.phaseUpdate(baseScript, { duration: 1, arrivalRate: 3 })
const horizontalAndVertical = idioms.phaseUpdate(baseScript, { duration: 15, arrivalRate: 3 })

module.exports = () =>
  idioms.runIn(__dirname, () =>
    ([
      { testType: basic, scenarioCount: 1 },
      { testType: horizontalTest, scenarioCount: 15 },
      { testType: verticalTest, scenarioCount: 3 },
      { testType: horizontalAndVertical, scenarioCount: 45 },
    ])
      .reduce(
        (promise, { testType, scenarioCount }) => promise
          .then(idioms.functionDoesNotExist())
          .then(() => BbPromise.resolve()
            .then(idioms.deploy())
            .then(idioms.functionExists())
            .then(idioms.invoke({ data: JSON.stringify(testType) }))
            .then(idioms.expect({ scenariosCreated: scenarioCount }))
            .then(idioms.remove(), idioms.remove())
            .then(idioms.functionDoesNotExist())),
        BbPromise.resolve())
  )
