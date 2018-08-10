const idioms = require('./idioms.js')
const persistence = require('./persistence')

module.exports = Object.assign({}, idioms, persistence)
