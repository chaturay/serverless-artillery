const def = require('./taskDef')

const impl = {
  /**
   * Analyze a set of reports, each of which is the result of an acceptance test's execution
   * @param reports The collection of reports to analyze
   */
  analyzeAcceptance: (reports) => {
    const report = {
      errors: 0,
      reports,
    }
    reports.forEach((subreport) => {
      if (
        subreport &&
        subreport.errors &&
        Object.keys(subreport.errors).length
      ) {
        report.errors += 1
      }
    })
    if (report.errors === 1) {
      report.errorMessage = `${report.errors} acceptance test failure`
    } else if (report.errors) {
      report.errorMessage = `${report.errors} acceptance test failures`
    }
    return report
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
   * @param script The script used to generate the results
   * @param results The results to generate a report from.  May contain undefined elements.
   * @returns {*}
   */
  result: (timeNow, script, settings, results) => {
    let ret
    if (script.mode === def.modes.ACC || script.mode === def.modes.ACCEPTANCE) {
      ret = impl.analyzeAcceptance(results)
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
