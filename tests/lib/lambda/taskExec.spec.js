const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
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
    const runnerFailIfCalled = () => {
      throw new Error('run() should not be called.')
    }

    const runnerMock = (expectedScript, actualResults, exitCode) =>
      (aScript, options) => {
        expect(aScript).to.deep.equal(expectedScript)
        if (actualResults) options.output(actualResults)
        process.exit(exitCode)
      }

    it('does nothing in simulation mode', () => {
      script = { _trace: true, _simulation: true }
      return taskExec(runnerFailIfCalled)(1, script)
        .should.eventually.eql({ Payload: '{ "errors": 0 }' })
    })

    it('invokes artillery:run and returns the results', () => {
      script = { _trace: true, _simulation: false }
      const artilleryResults = { aggregate: { Payload: '{ "errors": 0 }' } }
      results = { Payload: '{ "errors": 0 }' }

      return taskExec(runnerMock(script, artilleryResults, 0))(1, script)
        .should.eventually.eql(results)
    })

    it('throws for non-zero exit codes', () => {
      script = { _trace: true, _simulation: false }
      results = { Payload: '{ "errors": 0 }' }

      return taskExec(runnerMock(script, results, 1))(1, script)
        .should.be.rejectedWith('Artillery exited with non-zero code: 1')
    })

    it('throws if results not set for 0 exit code', () => {
      script = { _trace: true, _simulation: false }
      results = null

      return taskExec(runnerMock(script, results, 0))(1, script)
        .should.be.rejectedWith('Artillery exited with zero, but test results not set.')
    })
  })
})
