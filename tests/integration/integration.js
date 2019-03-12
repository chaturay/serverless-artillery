const fetch = require('node-fetch')
const { ok } = require('assert')
const { join } = require('path')
const { safeDump } = require('js-yaml')
const { writeFileSync } = require('fs')

const { exec } = require('./deployToTemp')

const log = process.env.DEBUG
  ? console.log
  : () => {}

// write the script.yml to disk and slsart invoke it
const executeScript = (tempFolder, slsartTempFolder, name, { script }, { testUrl }) => {
  const scriptFileName = join(tempFolder, name)
  const modifiedScript = Object.assign(
    {},
    script,
    { config: Object.assign({}, script.config, { target: testUrl }) }
  )
  writeFileSync(scriptFileName, safeDump(modifiedScript))
  return exec(`slsart invoke -p ${scriptFileName}`, { cwd: slsartTempFolder })
}

// return the expected duration of the script
const approximateScriptDuration = ({ script: { config: { phases } } }) =>
  phases.reduce((total, { duration }) => total + duration, 0)

// return a promise that will resolve when the script has had time to finish
const awaitScriptDuration = script =>
  new Promise(resolve => setTimeout(resolve, approximateScriptDuration(script)))

//  sorted by timestamp earliest -> latest
const fetchListOfCalls = ({ listUrl }) =>
  fetch(listUrl)
    .then(response => response.json())
    .then(json => JSON.parse(json))
    .catch(err => log('failed to fetch list of calls: ', err.stack))

// from a chronological list of calls, assert that the count of calls within the
//  given time range is within the given min and max
const assertExpectation = (listOfCalls, from, to, min, max) => {
  log('asserting that from', from, 'to', to, 'seconds saw', min, 'to', max, 'requests')

  ok(listOfCalls.length > 0, 'must be at least one request each phase')

  const firstTimestamp = parseInt(listOfCalls[0].timestamp, 10)
  const startTime = firstTimestamp + (from * 1000)
  const finishTime = firstTimestamp + (to * 1000)

  const relevantCalls = listOfCalls
    .filter(call => call.timestamp >= startTime && call.timestamp < finishTime)
    .length

  log(`saw ${relevantCalls} requests made`)

  ok(relevantCalls >= min, `${relevantCalls} is less than minimum of ${min}`)
  ok(relevantCalls <= max, `${relevantCalls} is more than maximum of ${max}`)
}

// from a script, execute a test and assertions
const test = ({
  name,
  script,
  resources,
}) => {
  const { urls, tempFolder, slsartTempFolder } = resources
  return executeScript(tempFolder, slsartTempFolder, name, script, urls)
    .then(() => awaitScriptDuration(script))
}

const verify = ({
  script,
  resources,
}) => {
  const { urls } = resources
  return fetchListOfCalls(urls)
    .then((listOfCalls) => {
      script.expectations
        .forEach(({ from, to, min, max }) => // eslint-disable-line object-curly-newline
          assertExpectation(listOfCalls, from, to, min, max))
    })
}

module.exports = {
  test,
  verify,
}
