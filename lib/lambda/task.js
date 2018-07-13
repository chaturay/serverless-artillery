const importFresh = require('import-fresh')

const runFresh = (script, options) => importFresh('artillery').run(script, options)

const def = require('./taskDef')
const exec = require('./taskExec')(runFresh)
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
