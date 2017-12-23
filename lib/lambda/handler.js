/* eslint-disable no-underscore-dangle */

// TODO remove AWS specific code and dependencies.
// TODO i.e. move to plugable module (specifically the ntp-client and invokeSelf code)

const aws = require('aws-sdk') // eslint-disable-line import/no-extraneous-dependencies
const task = require('./task')

const lambda = new aws.Lambda({ maxRetries: 0 })
const constants = {
  /**
   * The hard coded maximum duration for an entire load test (as a set of jobs) in seconds.
   * (_split.maxScriptDurationInSeconds must be set in your script if you want to use values up to this duration)
   */
  MAX_SCRIPT_DURATION_IN_SECONDS: 518400, // 6 days
  /**
   * The default maximum duration for an entire load test (as a set of jobs) in seconds
   */
  DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS: 86400, // 1 day
  /**
   * The default maximum number of concurrent lambdas to invoke with the given script.
   * (_split.maxScriptRequestsPerSecond must be set in your script if you want to use values up to this rate)
   */
  MAX_SCRIPT_REQUESTS_PER_SECOND: 50000,
  /**
   * The default maximum number of concurrent lambdas to invoke with the given script
   */
  DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND: 5000,
  /**
   * The hard coded maximum duration for a single lambda to execute in seconds this should probably never change until
   * Lambda maximums are increased.
   * (_split.maxChunkDurationInSeconds must be set in your script if you want to use values up to this duration)
   */
  MAX_CHUNK_DURATION_IN_SECONDS: 285, // 4 minutes and 45 seconds (allow for 15 second alignment time)
  /**
   * The default maximum duration for a scenario in seconds (this is how much time a script is allowed to take before
   * it will be split across multiple function executions)
   */
  DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS: 240, // 4 minutes
  /**
   * The hard coded maximum number of requests per second that a single lambda should attempt.  This is more than a
   * fully powered Lambda can properly perform without impacting the measurements.
   * (_split.maxChunkRequestsPerSecond must be set in your script if you want to use values up to this rate)
   */
  MAX_CHUNK_REQUESTS_PER_SECOND: 500,
  /**
   * The default maximum number of requests per second that a single lambda should attempt
   */
  DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND: 25,
  /**
   * The hard coded maximum number of seconds to wait for your functions to start producing load.
   * (_split.timeBufferInMilliseconds must be set in your script if you want to use values up to this duration)
   */
  MAX_TIME_BUFFER_IN_MILLISECONDS: 30000,
  /**
   * The default amount of buffer time to provide between starting a "next job" (to avoid cold starts and the
   * like) in milliseconds
   */
  DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS: 15000,
}
const simulation = {
  context: {
    functionName: 'simulationFunctionName',
  },
}
const impl = {
  /**
   * Delay for the given number of milliseconds before resolving the returned promise.
   * @param ms The number of milliseconds to delay before resolving the returned promise.
   * @returns {Promise<any>}
   */
  delay: ms => (ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()),
  /**
   * Obtain settings, replacing any of the defaults with user supplied values.
   * @param script The script that split settings were supplied to.
   * @returns
   * {
   *   {
   *     maxScriptDurationInSeconds: number,
   *     maxScriptRequestsPerSecond: number,
   *     maxChunkDurationInSeconds: number,
   *     maxChunkRequestsPerSecond: number,
   *     timeBufferInMilliseconds: number,
   *   }
   * }
   * The settings for the given script which consists of defaults overwritten by any user supplied values.
   */
  getSettings: (script) => {
    const ret = {
      maxScriptDurationInSeconds: constants.DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS,
      maxScriptRequestsPerSecond: constants.DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND,
      maxChunkDurationInSeconds: constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
      maxChunkRequestsPerSecond: constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
      timeBufferInMilliseconds: constants.DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS,
    }
    if (script._split) {
      if ('maxScriptDurationInSeconds' in script._split) {
        ret.maxScriptDurationInSeconds = script._split.maxScriptDurationInSeconds
      }
      if ('maxChunkDurationInSeconds' in script._split) {
        ret.maxChunkDurationInSeconds = script._split.maxChunkDurationInSeconds
      }
      if ('maxScriptRequestsPerSecond' in script._split) {
        ret.maxScriptRequestsPerSecond = script._split.maxScriptRequestsPerSecond
      }
      if ('maxChunkRequestsPerSecond' in script._split) {
        ret.maxChunkRequestsPerSecond = script._split.maxChunkRequestsPerSecond
      }
      if ('timeBufferInMilliseconds' in script._split) {
        ret.timeBufferInMilliseconds = script._split.timeBufferInMilliseconds
      }
    }
    return ret
  },
  /**
   * Validate the given script
   * @param script The script given to the handler
   * @param context The handler's context
   * @param callback The callback to invoke with error or success
   * @returns {boolean} Whether the script was valid
   */
  validScript: (script, context, callback) => {
    let ret = false
    const settings = impl.getSettings(script)
    // Splitting Settings [Optional]
    if ('_split' in script && typeof script._split !== 'object') {
      callback('If specified, the "_split" attribute must contain an object')
    } else if (
      'maxChunkDurationInSeconds' in settings &&
      !(Number.isInteger(settings.maxChunkDurationInSeconds) &&
      settings.maxChunkDurationInSeconds > 0 &&
      settings.maxChunkDurationInSeconds <= constants.MAX_CHUNK_DURATION_IN_SECONDS)
    ) {
      callback('If specified the "_split.maxChunkDurationInSeconds" attribute must be an integer inclusively between ' +
        `1 and ${constants.MAX_CHUNK_DURATION_IN_SECONDS}.`)
    } else if (
      'maxScriptDurationInSeconds' in settings &&
      !(Number.isInteger(settings.maxScriptDurationInSeconds) &&
      settings.maxScriptDurationInSeconds > 0 &&
      settings.maxScriptDurationInSeconds <= constants.MAX_SCRIPT_DURATION_IN_SECONDS)
    ) {
      callback('If specified the "_split.maxScriptDurationInSeconds" attribute must be an integer inclusively between ' +
      `1 and ${constants.MAX_SCRIPT_DURATION_IN_SECONDS}.`)
    } else if (
      'maxChunkRequestsPerSecond' in settings &&
      !(Number.isInteger(settings.maxChunkRequestsPerSecond) &&
      settings.maxChunkRequestsPerSecond > 0 &&
      settings.maxChunkRequestsPerSecond <= constants.MAX_CHUNK_REQUESTS_PER_SECOND)
    ) {
      callback('If specified the "_split.maxChunkRequestsPerSecond" attribute must be an integer inclusively ' +
        `between 1 and ${constants.MAX_CHUNK_REQUESTS_PER_SECOND}.`)
    } else if (
      'maxScriptRequestsPerSecond' in settings &&
      !(Number.isInteger(settings.maxScriptRequestsPerSecond) &&
      settings.maxScriptRequestsPerSecond > 0 &&
      settings.maxScriptRequestsPerSecond <= constants.MAX_SCRIPT_REQUESTS_PER_SECOND)
    ) {
      callback('If specified the "_split.maxScriptRequestsPerSecond" attribute must be an integer inclusively ' +
        `between 1 and ${constants.MAX_SCRIPT_REQUESTS_PER_SECOND}.`)
    } else if (
      'timeBufferInMilliseconds' in settings &&
      !(Number.isInteger(settings.timeBufferInMilliseconds) &&
      settings.timeBufferInMilliseconds > 0 &&
      settings.timeBufferInMilliseconds <= constants.MAX_TIME_BUFFER_IN_MILLISECONDS)
    ) {
      callback('If specified the "_split.timeBufferInMilliseconds" attribute must be an integer inclusively ' +
        `between 1 and ${constants.MAX_TIME_BUFFER_IN_MILLISECONDS}.`)
    } else if (
      task.valid(settings, script, context, callback)
    ) {
      ret = true
    }
    return ret
  },
  /**
   * This documentation declares the details of the callback that lambda provides, as per:
   * http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#invoke-property
   *
   * @callback lambda.invoke-callback
   * @param {Error} err An error if one occured — the error object returned from the request. Set to null if the request is successful.
   * @param {Object} data The de-serialized data returned from the request. Set to null if a request error occurs.
   * @param {Integer} data.StatusCode The HTTP status code will be in the 200 range for successful request. For the RequestResponse
   *    invocation type this status code will be 200. For the Event invocation type this status code will be 202. For the DryRun
   *    invocation type the status code will be 204.
   * @param {String} data.FunctionError Indicates whether an error occurred while executing the Lambda function. If an error occurred
   *    this field will have one of two values; Handled or Unhandled. Handled errors are errors that are reported by the function while
   *    the Unhandled errors are those detected and reported by AWS Lambda. Unhandled errors include out of memory errors and function
   *    timeouts. For information about how to report an Handled error, see Programming Model.
   * @param {String} data.LogResult It is the base64-encoded logs for the Lambda function invocation. This is present only if the
   *    invocation type is RequestResponse and the logs were requested.
   * @param {Buffer|Typed Array|Blob|String} data.Payload — It is the JSON representation of the object returned by the Lambda function.
   *    This is present only if the invocation type is RequestResponse.  In the event of a function error this field contains a message
   *    describing the error. For the Handled errors the Lambda function will report this message. For Unhandled errors AWS Lambda
   *    reports the message.
   * @param {String} data.ExecutedVersion The function version that has been executed. This value is returned only if the invocation
   *    type is RequestResponse.
   */
  /**
   * After executing the first job of a long running load test, wait the requested time delay before simulating
   * execution (simulation mode) or sending the given event to a new Lambda for execution (standard mode)
   * @param timeDelay The amount of time to delay before sending the remaining jobs for execution
   * @param event The event containing the remaining jobs that is to be sent to the next Lambda
   * @param context The Lambda context for the job
   * @param {lambda.invoke-callback} callback The callback to notify errors and successful execution to
   * @param invocationType The lambda invocationType
   */
  invokeSelf(timeDelay, event, context, callback, invocationType) {
    const exec = () => {
      try {
        if (event._simulation) {
          console.log('SIMULATION: self invocation.')
          impl.runPerformance(Date.now(), event, simulation.context, callback)
        } else {
          const params = {
            FunctionName: context.functionName,
            InvocationType: invocationType || 'Event',
            Payload: JSON.stringify(event),
          }
          if (process.env.SERVERLESS_STAGE) {
            params.FunctionName += `:${process.env.SERVERLESS_STAGE}`
          }
          lambda.invoke(params, (err, data) => {
            if (err) {
              throw new Error(`ERROR invoking self: ${err}`)
            } else {
              callback(null, data)
            }
          })
        }
      } catch (ex) {
        const msg = `ERROR exception encountered while invoking self from ${event._genesis} ` +
          `in ${event._start}: ${ex.message}\n${ex.stack}`
        console.log(msg)
        callback(msg)
      }
    }
    if (timeDelay > 0) {
      setTimeout(exec, timeDelay)
      if (event._trace) {
        console.log( // eslint-disable-next-line comma-dangle
          `scheduling self invocation for ${event._genesis} in ${event._start} with a ${timeDelay} ms delay`
        )
      }
    } else {
      exec()
    }
  },
  /**
   * Run an Artillery script.  Detect if it needs to be split and do so if it does.  Execute scripts not requiring
   * splitting.
   *
   * Customizable script splitting settings can be provided in an optional "_split" attribute, an example of which
   * follows:
   *  {
   *      maxScriptDurationInSeconds: 86400,  // max value - see constants.DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS
   *      maxScriptRequestsPerSecond: 5000,   // max value - see constants.DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND
   *      maxChunkDurationInSeconds: 240,     // max value - see constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS
   *      maxChunkRequestsPerSecond: 25,      // max value - see constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND
   *      timeBufferInMilliseconds: 15000,    // default   - see constants.DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS
   *  }
   *
   * TODO What if there is not external reporting for a script that requires splitting?  Detect this and error out?
   *
   * @param timeNow The time at which the event was received for this execution
   * @param script The Artillery (http://artillery.io) script execute after optional splitting
   * @param context The Lambda provided execution context
   * @param callback The Lambda provided callback to report errors or success to
   */
  runPerformance: (timeNow, script, context, callback) => {
    const settings = impl.getSettings(script)
    const plans = task.plan(timeNow, script, settings)
    if (plans.length > 1) {
      let toComplete = plans.length
      if (script._trace) {
        console.log(`toComplete: ${toComplete} from ${script._genesis} in ${timeNow}`)
      }
      const complete = () => {
        toComplete -= 1
        if (toComplete > 0) { // do we have more outstanding asynchronous operations/callbacks to execute?
          if (script._trace) {
            console.log(`load test from ${script._genesis} executed by ${timeNow} partially complete @ ${Date.now()}`)
          }
        } else { // otherwise, time to complete the lambda
          callback(null, {
            message: `load test from ${script._genesis} successfully completed from ${timeNow} @ ${Date.now()}`,
          })
          if (script._trace) {
            console.log(`load test from ${script._genesis} in ${timeNow} completed @ ${Date.now()}`)
          }
        }
      }
      const invokeSelf = (scriptFragment) => {
        impl.invokeSelf(
          (scriptFragment._start - Date.now()) - settings.timeBufferInMilliseconds,
          scriptFragment,
          context,
          complete,
        )
      }
      plans.forEach(invokeSelf)
    } else if (plans.length === 1) {
      if (!script._start) {
        script._start = timeNow // eslint-disable-line no-param-reassign
      }
      const timeDelay = script._start - Date.now()
      impl.delay(timeDelay)
        .then(() => {
          if (script._trace) {
            console.log(`executing load script from ${script._genesis} in ${timeNow} @ ${Date.now()}`)
          }
          task.exec(timeNow, script, context, callback)
        })
        .catch((ex) => {
          console.log(`error executing load script from ${script._genesis} in ${timeNow} @ ${Date.now()}:`)
          console.log(ex.stack)
          callback(ex)
        })
    } else {
      const msg = `ERROR, no executable content in:\n${JSON.stringify(script)}!`
      console.log(msg)
      callback(msg)
    }
  },
  /**
   * Split the given script into an array of scripts, one for each flow in the given script, each specifying the
   * execution of the single contained flow exactly once.
   * @param script The script to split.  Note that the
   * @returns {Array} An array of scripts that each contain a single flow from the original script and specify its
   * execution exactly once.
   */
  splitScriptByFlow: (script) => {
    let i
    let last = 0
    const scripts = []
    let newScript
    const oldScript = JSON.parse(JSON.stringify(script))
    oldScript.mode = task.valid.modes.PERF
    oldScript.config.phases = [
      { duration: 1, arrivalRate: 1 }, // 1 arrival per second for 1 second => exactly once
    ]
    for (i = 0; i < oldScript.scenarios.length; i++) { // break each flow into a new script
      // there is a non-standard specification in artillery where you can specify a flow as a series of array entries
      // that will be composed for you.  Something like:
      //   [
      //     name: 'foo',
      //     weight: 1,
      //     flow: { ... },
      //     name: 'bar',
      //     weight: 2,
      //     flow: { ... }
      //   ]
      // is interpreted as:
      //   [
      //     { name: 'foo', weight: 1, flow: { ... } },
      //     { name: 'bar', weight: 2, flow: { ... } }
      //   ]
      // for completeness, this logic accounts for that valid (though inadvisable) script format
      if (oldScript.scenarios[i].flow) {
        newScript = JSON.parse(JSON.stringify(oldScript))
        newScript.scenarios = oldScript.scenarios.slice(last, i + 1)
        last = i + 1
        scripts.push(newScript)
      }
    }
    return scripts
  },
  /**
   * Analyze a set of reports, each of which is the result of an acceptance test's execution
   * @param reports The collection of reports to analyze
   */
  analyzeAcceptance: (reports) => {
    const report = {
      errors: 0,
      reports,
    }
    for (let i = 0; i < reports.length; i++) {
      if (Object.keys(reports[i].errors).length) {
        report.errors += 1
      }
    }
    if (report.errors === 1) {
      report.errorMessage = `${report.errors} acceptance test failure`
    } else if (report.errors) {
      report.errorMessage = `${report.errors} acceptance test failures`
    }
    return report
  },
  /**
   * Run a script in acceptance mode, executing each of the given script's flows exactly once and generating a report
   * of the success or failure of these acceptance tests.
   * @param timeNow The time at which the event was received for this execution
   * @param script The Artillery (http://artillery.io) script to split into acceptance tests
   * @param context The Lambda provided execution context
   * @param callback The Lambda provided callback to report errors or success to
   */
  runAcceptance: (timeNow, script, context, callback) => {
    const reports = []
    script._start = timeNow // eslint-disable-line no-param-reassign
    const scripts = impl.splitScriptByFlow(script)
    let toComplete = scripts.length
    const complete = (err, res) => {
      toComplete -= 1
      if (res.Payload) {
        try {
          const report = JSON.parse(res.Payload)
          reports.push(report)
        } catch (ex) {
          console.log(`Error parsing lambda execution payload: "${res.Payload}"`)
        }
      }
      if (toComplete > 0) { // do we have more outstanding asynchronous operations/callbacks to execute?
        if (script._trace) {
          console.log( // eslint-disable-next-line comma-dangle
            `acceptance test from ${script._genesis} executed by ${timeNow} partially complete @ ${Date.now()}`
          )
        }
      } else { // otherwise, time to complete the lambda
        const report = impl.analyzeAcceptance(reports)
        callback(null, report)
        if (script._trace) {
          console.log(`acceptance test from ${script._genesis} in ${timeNow} completed @ ${Date.now()}`)
        }
      }
    }
    // execute each of the scripts in a separate lambda
    for (let i = 0; i < scripts.length; i++) {
      impl.invokeSelf(0, scripts[i], context, complete, 'RequestResponse')
    }
  },
}
const api = {
  /**
   * This Lambda produces load according to the given specification.
   * If that load exceeds the limits that a Lambda can individually satisfy (duration in seconds or requests per second)
   * then the script will be split into chunks that can be executed by single lambdas and those will be executed.  If
   * the script can be run within a single Lambda then the results of that execution will be returned as the
   * result of the lambda invocation.
   * @param event The event specifying an Artillery load generation test to perform
   * @param context The Lambda context for the job
   * @param callback The Lambda callback to notify errors and results to
   */
  run: (script, context, callback) => {
    if (impl.validScript(script, context, callback)) {
      const now = Date.now()
      if (!script._genesis) {
        script._genesis = now // eslint-disable-line no-param-reassign
      }
      if (script.mode === task.valid.modes.ACC || script.mode === task.valid.modes.ACCEPTANCE) {
        impl.runAcceptance(now, script, context, callback)
      } else {
        impl.runPerformance(now, script, context, callback)
      }
    }
  },
}

module.exports = {
  handler: api.run,
}

/* test-code */
module.exports.constants = constants
module.exports.impl = impl
module.exports.api = api
/* end-test-code */
