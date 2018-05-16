const run = require('artillery').run

const def = require('./taskDef')
const exec = require('./taskExec')(run).execLoad
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
