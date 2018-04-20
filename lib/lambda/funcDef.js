/* eslint-disable no-underscore-dangle */

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
  /**
   * The default amount of buffer time to provide prior to function infrastructure timeout during which to allow
   * the function to report an invocation success that nonetheless comprises a task failure via timeout
   */
  MAX_TIMEOUT_BUFFER_IN_MILLISECONDS: 15000,
}

class FunctionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'FunctionError'
  }
}

const impl = {
  /**
   * Obtain settings, replacing any of the defaults with user supplied values.
   * @param event The script that split settings were supplied to.
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
  getSettings: (event) => {
    const ret = {
      maxScriptDurationInSeconds: constants.DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS,
      maxScriptRequestsPerSecond: constants.DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND,
      maxChunkDurationInSeconds: constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
      maxChunkRequestsPerSecond: constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
      timeBufferInMilliseconds: constants.DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS,
    }
    if (event && event._split) {
      if ('maxScriptDurationInSeconds' in event._split) {
        ret.maxScriptDurationInSeconds = event._split.maxScriptDurationInSeconds
      }
      if ('maxChunkDurationInSeconds' in event._split) {
        ret.maxChunkDurationInSeconds = event._split.maxChunkDurationInSeconds
      }
      if ('maxScriptRequestsPerSecond' in event._split) {
        ret.maxScriptRequestsPerSecond = event._split.maxScriptRequestsPerSecond
      }
      if ('maxChunkRequestsPerSecond' in event._split) {
        ret.maxChunkRequestsPerSecond = event._split.maxChunkRequestsPerSecond
      }
      if ('timeBufferInMilliseconds' in event._split) {
        ret.timeBufferInMilliseconds = event._split.timeBufferInMilliseconds
      }
    }
    return ret
  },
}

module.exports = constants
module.exports.FunctionError = FunctionError
module.exports.getSettings = impl.getSettings
