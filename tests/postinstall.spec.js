const path = require('path')

describe('./postinstall.js', () => {
  // This test validates that the postinstall script (which won't have the context of the faas
  // folder's various node_modules, still loads properly.  Otherwise, it can fail during postinstall
  // which has the purpose of installing those dependencies.
  it('loads successfully', () => {
    const { ONLY_LOAD_MODULE } = process.env
    process.env.ONLY_LOAD_MODULE = true
    try {
      require(path.join('..', 'postinstall.js')) // eslint-disable-line global-require, import/no-dynamic-require
    } finally {
      if (ONLY_LOAD_MODULE) {
        process.env.ONLY_LOAD_MODULE = ONLY_LOAD_MODULE
      } else {
        delete process.env.ONLY_LOAD_MODULE
      }
    }
  })
})
