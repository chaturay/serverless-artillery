const { join } = require('path')
const { safeDump } = require('js-yaml')
const { writeFileSync } = require('fs')

const { exec } = require('./deployToTemp')

const executeScript = (tempFolder, name, { script }, { testUrl }) => {
  const scriptFileName = join(tempFolder, name)
  const modifiedScript = Object.assign(
    {},
    script,
    { config: Object.assign({}, script.config, { target: testUrl }) },
  )
  writeFileSync(scriptFileName, safeDump(modifiedScript))
  return exec(`slsart invoke ${scriptFileName}`, { cwd: tempFolder })
}

const test = ({
  name,
  script,
  resources,
}) => {
  describe(name, () => {
    it('should execute the test', () =>
      resources
        .then(({ urls, tempFolder }) =>
          executeScript(tempFolder, name, script, urls))
    )

    it('should produce the expected load', () => {
      // todo
    })
  })
}

module.exports = {
  test,
}
