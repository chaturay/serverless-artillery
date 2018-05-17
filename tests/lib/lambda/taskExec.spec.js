const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const path = require('path')
const sinonChai = require('sinon-chai')
const fs = require('fs')
const os = require('os')

chai.use(chaiAsPromised)
chai.use(sinonChai)
chai.should()

const expect = chai.expect

// eslint-disable-next-line import/no-dynamic-require
const taskExec = require(path.join('..', '..', '..', 'lib', 'lambda', 'taskExec.js'))

let script

describe('./lib/lambda/taskExec.js', () => {
  describe('#execLoad', () => {
    const scriptPath = path.resolve(os.tmpdir(), 'script.json')
    const outputPath = path.resolve(os.tmpdir(), 'output.json')
    console.error('test', scriptPath, outputPath)

    const runnerFailure = () => {
      throw new Error('run() should not be called.')
    }

    const runnerCheckScript = expectedScript =>
      (aScriptPath) => {
        expect(fs.readFileSync(aScriptPath, { encoding: 'utf8' })).to.equal(expectedScript)
        fs.writeFileSync(outputPath, JSON.stringify({ Payload: '{ "errors": 0 }' }))
        process.exit(0)
      }

    afterEach(() => {
      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath)
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
    })

    it('does nothing in simulation mode', () => {
      script = { _trace: true, _simulation: true }
      return taskExec.impl(runnerFailure).execLoad(1, script)
        .should.eventually.eql({ Payload: '{ "errors": 0 }' })
        .then(() => {
          expect(fs.existsSync(scriptPath)).to.be.false
          expect(fs.existsSync(outputPath)).to.be.false
        })
    })

    it('writes event to script.json', () => {
      script = { _trace: true, _simulation: false }
      return taskExec.impl(
        runnerCheckScript(JSON.stringify(script))).execLoad(1, script)
        .should.eventually.eql({ Payload: '{ "errors": 0 }' })
        .then(() => {
          expect(fs.existsSync(scriptPath)).to.be.true
        })
    })

    it('returns contents of output.json', () => {
      script = { _trace: true, _simulation: false }
      return taskExec.impl(
        runnerCheckScript(JSON.stringify(script))).execLoad(1, script)
        .should.eventually.eql({ Payload: '{ "errors": 0 }' })
        .then(() => {
          expect(fs.existsSync(outputPath)).to.be.true
        })
    })
  })
})
