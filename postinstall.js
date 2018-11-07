const path = require('path')

const npm = require('./lib/npm')
const constants = require('./lib/constants')

if (!process.env.ONLY_LOAD_MODULE) { // facilitates module load success testing
  constants.ServerlessDirectories.forEach((dir) => {
    const installPath = path.join(__dirname, 'lib', 'faas', dir)

    npm.install({}, installPath) // will throw out and fail install if this times out or returns a non-zero result
  })
}
