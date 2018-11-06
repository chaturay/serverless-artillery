const { run } = require('artillery')

const define = require('./define')
const execute = require('./execute')(run)
const plan = require('./plan')
const result = require('./result')
const valid = require('./valid')

module.exports = {
  define,
  execute,
  plan,
  result,
  valid,
}
