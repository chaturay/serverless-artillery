const constants = {
  // Modes
  modes: {
    PERF: 'perf',
    PERFORMANCE: 'performance',
    ACC: 'acc',
    ACCEPTANCE: 'acceptance',
    MON: 'mon',
    MONITORING: 'monitoring',
  },
  // Tests
  isAcceptanceScript: script => script && script.mode && (script.mode === constants.modes.ACC || script.mode === constants.modes.ACCEPTANCE),
  isMonitoringScript: script => script && script.mode && (script.mode === constants.modes.MON || script.mode === constants.modes.MONITORING),
  isPerformanceScript: script => script && script.mode && (script.mode === constants.modes.PERF || script.mode === constants.modes.PERFORMANCE),
  isSamplingScript: script => constants.isAcceptanceScript(script) || constants.isMonitoringScript(script),
  // Sampling Defaults
  acceptance: {
    DefaultSize: 1,
    DefaultAveragePause: 5,
    DefaultPauseVariance: 2,
    DefaultErrorBudget: 0,
  },
  monitoring: {
    DefaultSize: 5,
    DefaultAveragePause: 5,
    DefaultPauseVariance: 2,
    DefaultErrorBudget: 4,
  },
  sampling: {
    DefaultSize: 5,
    DefaultAveragePause: 5,
    DefaultPauseVariance: 2,
    DefaultErrorBudget: 4,
    DefaultWarningThreshold: 0.9,
  },
}

class TaskError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TaskError'
  }
}

const impl = {
  defaultsToSettings: defaults => ({
    size: defaults.DefaultSize,
    averagePause: defaults.DefaultAveragePause,
    pauseVariance: defaults.DefaultPauseVariance,
    errorBudget: defaults.DefaultErrorBudget,
    warningThreshold: constants.sampling.DefaultWarningThreshold,
  }),
  /**
   * Obtain settings, replacing any of the defaults with mode specific defaults and then with user supplied values.
   * @param event The script that sampling settings were supplied to.
   * @returns
   * {
   *   {
   *     size: number,
   *     averagePause: number,
   *     pauseVariance: number,
   *     errorBudget: number,
   *   }
   * }
   * The settings for the given script which consists of core defaults overwritten by mode defaults overwritten by
   * any user supplied values.
   */
  getSettings: (event) => {
    const settings = {}
    // Sampling Settings
    if (constants.isAcceptanceScript(event)) {
      settings.sampling = impl.defaultsToSettings(constants.acceptance)
    } else if (constants.isMonitoringScript(event)) {
      settings.sampling = impl.defaultsToSettings(constants.monitoring)
    } else {
      settings.sampling = impl.defaultsToSettings(constants.sampling)
    }
    if (event && event.sampling) {
      if ('size' in event.sampling) {
        settings.sampling.size = event.sampling.size
      }
      if ('averagePause' in event.sampling) {
        settings.sampling.averagePause = event.sampling.averagePause
      }
      if ('pauseVariance' in event.sampling) {
        settings.sampling.pauseVariance = event.sampling.pauseVariance
      }
      if ('errorBudget' in event.sampling) {
        settings.sampling.errorBudget = event.sampling.errorBudget
      }
      if ('warningThreshold' in event.sampling) {
        settings.sampling.warningThreshold = event.sampling.warningThreshold
      }
    }
    return settings
  },
}

module.exports = constants
module.exports.TaskError = TaskError
module.exports.getSettings = impl.getSettings
module.exports.defaultsToSettings = impl.defaultsToSettings
