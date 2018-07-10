const idioms = require('../idioms')

module.exports = () => idioms.runIn(__dirname,
  Promise.resolve()
    .then(idioms.deployTarget())
)
