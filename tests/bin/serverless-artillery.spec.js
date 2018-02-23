const spawn = require('child_process').spawn
const expect = require('chai').expect

const slsart = (args, expectedCode, done) => {
  spawn('bin/serverless-artillery', args).on('close', (code) => {
    expect(code).to.equal(expectedCode)
    done()
  })
}

describe('./bin/serverless-artillery', function slsartCli() { // eslint-disable-line prefer-arrow-callback
  this.timeout(0)
  describe('#invoke', () => {
    // ##!! LEGACY MANAGEMENT BEGIN !!##
    describe('rejects legacy flags', () => {
      it('rejects `-s`', (done) => {
        slsart(['invoke', '-s', 'script.yml'], 1, done)
      })
      it('rejects `--script`', (done) => {
        slsart(['invoke', '--script', 'script.yml'], 1, done)
      })
    })
    // ##!! LEGACY MANAGEMENT END   !!##

    describe('rejects reserved and unsupported flags', () => {
      // Reserved Flags
      it('rejects reserved flag `-t`', (done) => {
        slsart(['invoke', '-t', 'Event'], 1, done)
      })
      it('rejects reserved flag `--type`', (done) => {
        slsart(['invoke', '--type', 'Event'], 1, done)
      })
      it('rejects reserved flag `-f`', (done) => {
        slsart(['invoke', '-f', 'funcName'], 1, done)
      })
      it('rejects reserved flag `--function`', (done) => {
        slsart(['invoke', '--function', 'funcName'], 1, done)
      })
      // Unsupported Flags
      it('rejects unsupported flag `--raw`', (done) => {
        slsart(['invoke', '--raw'], 1, done)
      })
    })
  })
})
