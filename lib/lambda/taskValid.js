const plan = require('./taskPlan')

const impl = {
  /**
   * The mode the script is to be run in. ACC and ACCEPTANCE run the script as an acceptance test,
   * testing each flow as it's own script with a duration and arrivalRate of 1
   */
  modes: {
    PERF: 'perf',
    PERFORMANCE: 'performance',
    ACC: 'acc',
    ACCEPTANCE: 'acceptance',
  },
  valid: (settings, script, context, callback) => {
    let ret = false
    if ( // Validate the Phases
      !(script.config && Array.isArray(script.config.phases) && script.config.phases.length > 0) && // must have phase
      !(script.mode === impl.modes.ACC || script.mode === impl.modes.ACCEPTANCE) // unless in acceptance mode
    ) {
      callback('An Artillery script must contain at least one phase under the $.config.phases attribute which ' +
        `itself must be an Array unless mode attribute is specified to be ${impl.modes.ACCEPTANCE} or ${impl.modes.ACC}`)
    } else if (
      'mode' in script &&
      (
        !Object.keys(impl.modes).includes(script.mode.toUpperCase()) ||
        impl.modes[script.mode.toUpperCase()] !== script.mode
      )
    ) {
      callback(`If specified, the mode attribute must be one of "${
        Object
          .keys(impl.modes)
          .map(key => impl.modes[key])
          .join('", "')
      }"`)
    } else if (!(script.mode === impl.modes.ACC || script.mode === impl.modes.ACCEPTANCE)) {
      const scriptDurationInSeconds = plan.impl.scriptDurationInSeconds(script)
      const scriptRequestsPerSecond = plan.impl.scriptRequestsPerSecond(script)
      if (scriptDurationInSeconds <= 0) {
        callback(`Every phase must have a valid duration in seconds.  Observed: ${
          JSON.stringify(script.config.phases[scriptDurationInSeconds * -1])
        }`)
      } else if (scriptDurationInSeconds > settings.maxScriptDurationInSeconds) {
        callback(`The total duration in seconds of all script phases cannot exceed ${settings.maxScriptDurationInSeconds}`)
      } else if (scriptRequestsPerSecond <= 0) {
        callback(`Every phase must have a valid means to determine requests per second.  Observed: ${
          JSON.stringify(script.config.phases[scriptRequestsPerSecond * -1])
        }`)
      } else if (scriptRequestsPerSecond > settings.maxScriptRequestsPerSecond) {
        callback(`The maximum requests per second of any script phase cannot exceed ${
          settings.maxScriptRequestsPerSecond
        }`)
      } else {
        ret = true
      }
    } else {
      ret = true
    }
    return ret
  },
}

module.exports = impl.valid

/* test-code */
module.exports.modes = impl.modes
/* end-test-code */
