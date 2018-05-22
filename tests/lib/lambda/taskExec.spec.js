const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const fs = require('fs')
const os = require('os')
const path = require('path')
const sinonChai = require('sinon-chai')

chai.use(chaiAsPromised)
chai.use(sinonChai)
chai.should()

const expect = chai.expect

// eslint-disable-next-line import/no-dynamic-require
const taskExec = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskExec.js'))

let results
let script

describe('./lib/lambda/taskExec.js', () => {
  describe('#execLoad', () => {
    const scriptPath = path.resolve(os.tmpdir(), 'script.json')
    const outputPath = path.resolve(os.tmpdir(), 'output.json')

    const runnerFailIfCalled = () => {
      throw new Error('run() should not be called.')
    }

    const runnerMock = (expectedScript, actualResults, exitCode) =>
      (aScriptPath) => {
        expect(fs.readFileSync(aScriptPath, { encoding: 'utf8' })).to.equal(expectedScript)
        fs.writeFileSync(outputPath, JSON.stringify(actualResults))
        process.exit(exitCode)
      }

    afterEach(() => {
      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath)
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
    })

    it('does nothing in simulation mode', () => {
      script = { _trace: true, _simulation: true }
      return taskExec(runnerFailIfCalled)(1, script)
        .should.eventually.eql({ Payload: '{ "errors": 0 }' })
        .then(() => {
          expect(fs.existsSync(scriptPath)).to.be.false
          expect(fs.existsSync(outputPath)).to.be.false
        })
    })

    it('invokes artillery:run and returns the results', () => {
      script = { _trace: true, _simulation: false }
      results = { Payload: '{ "errors": 0 }' }

      return taskExec(runnerMock(JSON.stringify(script), results, 0))(1, script)
        .should.eventually.eql(results)
        .then(() => {
          // Verify files have been cleaned up
          expect(fs.existsSync(scriptPath)).to.be.false
          expect(fs.existsSync(outputPath)).to.be.false
        })
    })

    it('throws for non-zero exit codes', () => {
      script = { _trace: true, _simulation: false }
      results = { Payload: '{ "errors": 0 }' }

      return taskExec(runnerMock(JSON.stringify(script), results, 1))(1, script)
        .then(() => { throw new Error('run should not return normally') })
        .catch(err => expect(err.message).to.contain('Artillery exited with non-zero code: 1'))
        .then(() => {
          // Verify files have been cleaned up
          expect(fs.existsSync(scriptPath)).to.be.true
          expect(fs.existsSync(outputPath)).to.be.true
        })
    })
  })
})
