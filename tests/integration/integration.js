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

// return the expected duration of the script + 10% (in seconds)
const approximateScriptDuration = ({ script: { config: { phases } } }) =>
  phases.reduce((total, { duration }) => total + duration, 0) * 1.1

// return a promise that will resolve when the script has had time to finish
const awaitScriptDuration = script =>
  new Promise(resolve => setTimeout(resolve, approximateScriptDuration(script)))

// return an array of calls as { timestamp: 77777777, eventId: 123abc }
//  sorted by timestamp earliest -> latest
const fetchListOfCalls = ({ listUrl }) => {
  log('fetching list of calls from', listUrl)
  return fetch(listUrl)
    .then(response => Promise.resolve(response.json()))
    .then(listOfCalls => Promise.resolve(listOfCalls.sort((callA, callB) => callA.timestamp - callB.timestamp)))
    .catch(err => log('failed to fetch list of calls: ', err.stack))
}

// from a chronological list of calls, assert that the count of calls within the
//  given time range is within the given min and max
const assertExpectation = (listOfCalls, from, to, min, max) => {
  log('asserting that from', from, 'to', to, 'seconds saw', min, 'to', max, 'requests')
  const firstTimestamp = listOfCalls[0].timestamp
  const startTime = firstTimestamp + (from * 1000)
  const finishTime = firstTimestamp + (to * 1000)

  const relevantCalls = listOfCalls
    .filter(call => call.timestamp >= startTime && call.timestamp < finishTime)
    .length
  log(`saw ${relevantCalls} requests made`)
  ok(relevantCalls >= min && relevantCalls <= max)
}

// generate an it() call for the given expectation
const testExpectation = finishing =>
  ({
    from, to, min, max,
  }) =>
    it(
      `should send ${min} to ${max} requests between ${from} and ${to} seconds`,
      () => finishing
        .then(listOfCalls => assertExpectation(listOfCalls, from, to, min, max))
    )

// from a script, execute a test and assertions
const test = ({
  name,
  script,
  resources,
}) => {
  const executing = resources
    .then(({ urls, tempFolder, slsartTempFolder }) =>
      executeScript(tempFolder, slsartTempFolder, name, script, urls))

  const finishing = executing
    .then(() => awaitScriptDuration(script))
    .then(() => resources)
    .then(({ urls }) => fetchListOfCalls(urls))

  describe(name, () => {
    // todo: consider getting this text dynamically from the test script
    it('should execute the test', () => executing)

    script.expectations.map(testExpectation(finishing))
  })
}

module.exports = {
  test,
}
