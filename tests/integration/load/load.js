const BbPromise = require('bluebird')
const path = require('path')

const idioms = require(path.join('..', 'idioms.js')) // eslint-disable-line import/no-dynamic-require
const scriptPath = path.join(__dirname, 'load_script.yml')

const baseScript = idioms.parseYaml(scriptPath)
const basic = idioms.overwritePhases(baseScript, [])
// const horizontalTest = idioms.overwritePhases(baseScript, [{ duration: 16, arrivalRate: 1 }])
// const verticalTest = idioms.overwritePhases(baseScript, [{ duration: 1, arrivalRate: 2 }])
// const horizontalAndVertical = idioms.overwritePhases(baseScript, [{ duration: 16, arrivalRate: 2 }])

module.exports = () =>
  idioms.runIn(__dirname, () =>
    ([
      { test: basic, expectedCount: 1 },
      // { test: basic, expectedCount: 1 },
      // { test: horizontalTest, expectedCount: 16 },
      // { test: verticalTest, expectedCount: 2 },
      // { test: horizontalAndVertical, expectedCount: 32 },
    ])
      .reduce(
        (promise, { test, expectedCount }) => promise
          .then(idioms.functionDoesNotExist())
          .then(() => BbPromise.resolve()
            .then(idioms.deploy())
            .then(idioms.functionExists())
            .then(idioms.invoke({ data: JSON.stringify(test) }))
            .then(idioms.expect({ scenariosCreated: expectedCount }))
            .finally(idioms.remove())
            .then(idioms.functionDoesNotExist())),
        BbPromise.resolve())
  )
