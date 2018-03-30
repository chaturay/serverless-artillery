const constants = {
  /**
   * The mode the script is to be run in.
   */
  modes: {
    PERF: 'perf',
    PERFORMANCE: 'performance',
    ACC: 'acc',
    ACCEPTANCE: 'acceptance',
    MON: 'mon',
    MONITORING: 'monitoring',
  },
}

class TaskError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TaskError'
  }
}

module.exports = constants
module.exports.TaskError = TaskError
