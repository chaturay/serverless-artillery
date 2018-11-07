const path = require('path')

const npm = require('./lib/npm')
const slsart = require('./lib')

slsart.constants.ServerlessDirectories.forEach((dir) => {
  const installPath = path.join(__dirname, 'lib', 'faas', dir)

  npm.install({}, installPath) // will throw out and fail install if this times out or returns a non-zero result
})
