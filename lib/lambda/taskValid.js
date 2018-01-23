const def = require('./taskDef')
const plan = require('./taskPlan')

const impl = {
  validate: (constraints, script) => {
    if ( // Validate the Phases
      !(script.config && Array.isArray(script.config.phases) && script.config.phases.length > 0) && // must have phase
      !(script.mode === def.modes.ACC || script.mode === def.modes.ACCEPTANCE) // unless in acceptance mode
    ) {
      throw new def.TaskError('An Artillery script must contain at least one phase under the $.config.phases attribute which ' +
        `itself must be an Array unless mode attribute is specified to be ${def.modes.ACCEPTANCE} or ${def.modes.ACC}`)
    } else if (
      'mode' in script &&
      (
        !Object.keys(def.modes).includes(script.mode.toUpperCase()) ||
        def.modes[script.mode.toUpperCase()] !== script.mode
      )
    ) {
      throw new def.TaskError(`If specified, the mode attribute must be one of "${
        Object
          .keys(def.modes)
          .map(key => def.modes[key])
          .join('", "')
      }"`)
    } else if (
      !(
        script.mode === def.modes.ACC ||
        script.mode === def.modes.ACCEPTANCE
      )
    ) {
      const scriptDurationInSeconds = plan.impl.scriptDurationInSeconds(script)
      const scriptRequestsPerSecond = plan.impl.scriptRequestsPerSecond(script)
      if (scriptDurationInSeconds <= 0) {
        throw new def.TaskError(`Every phase must have a valid duration in seconds.  Observed: ${
          JSON.stringify(script.config.phases[scriptDurationInSeconds * -1])
        }`)
      } else if (scriptDurationInSeconds > constraints.maxScriptDurationInSeconds) {
        throw new def.TaskError(`The total duration in seconds of all script phases cannot exceed ${
          constraints.maxScriptDurationInSeconds
        }`)
      } else if (scriptRequestsPerSecond <= 0) {
        throw new def.TaskError(`Every phase must have a valid means to determine requests per second.  Observed: ${
          JSON.stringify(script.config.phases[scriptRequestsPerSecond * -1])
        }`)
      } else if (scriptRequestsPerSecond > constraints.maxScriptRequestsPerSecond) {
        throw new def.TaskError(`The maximum requests per second of any script phase cannot exceed ${
          constraints.maxScriptRequestsPerSecond
        }`)
      }
    }
  },
}

module.exports = impl.validate
