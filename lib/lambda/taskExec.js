/* eslint-disable no-underscore-dangle */

const artillery = require('artillery-core')
const csv = require('csv-parse/lib/sync')
const fs = require('fs')
const path = require('path')

const impl = {
  /**
   * Loads custom processor functions from artillery configuration
   * @param script The Artillery (http://artillery.io) script to be executed
   */
  loadProcessor: (script) => {
    const config = script.config
    if (config.processor && typeof config.processor === 'string') {
      const processorPath = path.resolve(process.cwd(), config.processor)
      config.processor = require(processorPath) // eslint-disable-line global-require,import/no-dynamic-require
    }
  },
  /**
   * Reads the playload data from the test script.
   * @param script - Script that defines the payload to be read.
   */
  readPayload(script) {
    let ret
    const determinePayloadPath = payloadFile => path.resolve(process.cwd(), payloadFile)
    const readSinglePayload = (payloadObject) => {
      const payloadPath = determinePayloadPath(payloadObject.path)
      const data = fs.readFileSync(payloadPath, 'utf-8')
      return csv(data)
    }
    if (script && script.config && script.config.payload) {
      // There's some kind of payload, so process it.
      if (Array.isArray(script.config.payload)) {
        ret = JSON.parse(JSON.stringify(script.config.payload))
        // Multiple payloads to load, loop through and load each.
        script.config.payload.forEach((payload, i) => {
          ret[i].data = readSinglePayload(payload)
        })
      } else if (typeof script.config.payload === 'object') {
        // Just load the one playload
        ret = readSinglePayload(script.config.payload)
      } else {
        console.log('WARNING: payload file not set, but payload is configured.\n')
      }
    }
    return ret
  },
  // event is bare Artillery script
  /**
   * Run a load test given an Artillery script and report the results
   * @param start The time that invocation began
   * @param script The artillery script
   * @param context The Lambda context for the job
   * @param callback The callback to report errors and load test results to
   */
  runLoad: (start, script, context, callback) => {
    let runner
    let payload
    let msg
    if (script._trace) {
      console.log(`runLoad started from ${script._genesis} @ ${start}`)
    }
    if (script._simulation) {
      console.log(`SIMULATION: runLoad called with ${JSON.stringify(script, null, 2)}`)
      callback(null, { Payload: '{ "errors": 0 }' })
    } else {
      try {
        impl.loadProcessor(script)
        payload = impl.readPayload(script)
        runner = artillery.runner(script, payload, {})
        runner.on('phaseStarted', (opts) => {
          console.log(
            `phase ${opts.index}${
              opts.name ? ` (${opts.name})` : ''
            } started, duration: ${
              opts.duration ? opts.duration : opts.pause
            }` // eslint-disable-line comma-dangle
          )
        })
        runner.on('phaseCompleted', (opts) => {
          console.log('phase', opts.index, ':', opts.name ? opts.name : '', 'complete')
        })
        runner.on('done', (report) => {
          const latencies = report.latencies
          report.latencies = undefined // eslint-disable-line no-param-reassign
          console.log(JSON.stringify(report, null, 2))
          report.latencies = latencies // eslint-disable-line no-param-reassign
          callback(null, report)
          if (script._trace) {
            console.log(`runLoad stopped from ${script._genesis} in ${start} @ ${Date.now()}`)
          }
        })
        runner.run()
      } catch (ex) {
        msg = `ERROR exception encountered while executing load from ${script._genesis} ` +
          `in ${start}: ${ex.message}\n${ex.stack}`
        console.log(msg)
        callback(msg)
      }
    }
  },
}

module.exports = impl.runLoad

/* test-code */
module.exports.impl = impl
/* end-test-code */
