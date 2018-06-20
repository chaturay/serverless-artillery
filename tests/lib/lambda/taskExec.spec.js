const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const fs = require('fs')
const os = require('os')
const path = require('path')
const sinonChai = require('sinon-chai')

chai.use(chaiAsPromised)
chai.use(sinonChai)
chai.should()

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const taskExec = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskExec.js'))

let results
let script

describe('./lib/lambda/taskExec.js', () => {
  describe('#execLoad', () => {
    const outputPath = path.resolve(os.tmpdir(), 'output.json')

    const runnerFailIfCalled = () => {
      throw new Error('run() should not be called.')
    }

    const runnerMock = (expectedScript, actualResults, exitCode) =>
      (aScript) => {
        expect(aScript).to.deep.equal(expectedScript)
        fs.writeFileSync(outputPath, JSON.stringify(actualResults))
        process.exit(exitCode)
      }

    afterEach(() => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
    })

    it('does nothing in simulation mode', () => {
      script = { _trace: true, _simulation: true }
      return taskExec(runnerFailIfCalled)(1, script)
        .should.eventually.eql({ Payload: '{ "errors": 0 }' })
    })

    it('invokes artillery:run and returns the results', () => {
      script = { _trace: true, _simulation: false }
      results = { Payload: '{ "errors": 0 }' }

      return taskExec(runnerMock(script, results, 0))(1, script)
        .should.eventually.eql(results)
        .then(() => {
          // Verify files have been cleaned up
          expect(fs.existsSync(outputPath)).to.be.false
        })
    })

    it('throws for non-zero exit codes', () => {
      script = { _trace: true, _simulation: false }
      results = { Payload: '{ "errors": 0 }' }

      return taskExec(runnerMock(script, results, 1))(1, script)
        .should.be.rejectedWith('Artillery exited with non-zero code: 1')
        .then(() => {
          // Files will remain in this case. S/B helpful for troubleshooting.
          expect(fs.existsSync(outputPath)).to.be.true
        })
    })
  })
})
