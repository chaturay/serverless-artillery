const def = require('./taskDef')

const impl = {
  // Error Budgets
  getErrorBudget: (script, defaultErrorBudget) => (
    (script && script.sampling ? script.sampling.errorBudget : undefined) ||
    defaultErrorBudget ||
    def.sampling.DefaultErrorBudget),
  // Display Ready Mode Names
  /**
   * Get a friendly mode string for the script's mode.
   * @param script The script from which to obtain the mode
   * @returns {String} The friendly mode name of the script's mode
   */
  getDisplayReadyMode: (script) => {
    if (!script.mode) {
      return 'sampling'
    } else if (script.mode === def.modes.ACC) {
      return def.modes.ACCEPTANCE
    } else if (script.mode === def.modes.MON) {
      return def.modes.MONITORING
    }
    return script.mode
  },
  // Analysis
  /**
   * Analyze a set of sampling reports, each of which is the result of a sample battery's execution
   * results.
   * @param reports The collection of reports to analyze
   */
  analyzeSamples: (script, reports, defaultErrorBudget) => {
    const errorBudget = impl.getErrorBudget(script, defaultErrorBudget)
    const sumErrors = subreport => Object.keys(subreport.errors).reduce((a, k) => (a + subreport.errors[k]), 0)
    const report = {
      errors: 0,
      reports,
    }
    reports.forEach((subreport) => {
      if (
        subreport &&
        subreport.errors &&
        sumErrors(subreport) > errorBudget
      ) {
        report.errors += 1
      }
    })
    if (report.errors) {
      report.errorMessage = `${
        impl.getDisplayReadyMode(script)
      } test failure${
        report.errors > 1 ? 's' : ''
      }: ${
        report.errors
      }/${
        reports.length
      } exceeded budget of ${
        errorBudget
      } errors`
    }
    return report
  },
  /**
   * Analyze a set of reports, each of which is the result of an acceptance test's execution
   * @param reports The collection of reports to analyze
   */
  analyzeAcceptance: (script, reports) => impl.analyzeSamples(script, reports, def.acceptance.DefaultErrorBudget),
  /**
   * Analyze a set of reports, each of which is the result of an monitoring test's execution
   * @param reports The collection of reports to analyze
   */
  analyzeMonitoring: (script, settings, reports) => {
    const analysis = impl.analyzeSamples(script, reports, def.monitoring.DefaultErrorBudget)
    if (analysis.errors) {
      return settings.alert.send(script, analysis)
        .then(() => Promise.resolve(analysis))
    }
    return analysis
  },
  /**
   * Analyze the performance results.  If there is one payload, then it is a report.  Otherwise, it is a set of payloads.
   * @param timeNow The time ID of the executing function.
   * @param script The script used to obtain the payloads.
   * @param payloads The payloads received from the callers.
   * @returns {*}
   */
  analyzePerformance: (timeNow, script, payloads) => {
    if (payloads.length === 1) {
      return payloads[0] // return the report
    } else { // eslint-disable-next-line no-underscore-dangle
      return { message: `load test from ${script._genesis} successfully completed from ${timeNow} @ ${Date.now()}` }
    }
  },
  /**
   * Calculate the result to report for the original task
   * @param timeNow The time stamp/ID of the originating function
   * @param script The script used to generate the results
   * @param settings The settings
   * @param results The results to generate a report from.  May contain undefined elements.
   * @returns {*}
   */
  result: (timeNow, script, settings, results) => {
    let ret
    if (def.isAcceptanceScript(script)) {
      ret = impl.analyzeAcceptance(script, results)
    } else if (def.isMonitoringScript(script)) {
      ret = impl.analyzeMonitoring(script, settings, results)
    } else {
      ret = impl.analyzePerformance(timeNow, script, results)
    }
    return ret
  },
}

module.exports = impl.result

/* test-code */
module.exports.impl = impl
/* end-test-code */
