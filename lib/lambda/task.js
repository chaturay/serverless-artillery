const { run } = require('artillery')

const def = require('./taskDef')
const exec = require('./taskExec')(run)
const plan = require('./taskPlan')
const result = require('./taskResult')
const valid = require('./taskValid')

module.exports = {
  def,
  exec,
  plan,
  result,
  valid,
}
