const chai = require('chai')
const path = require('path')

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', '..', 'lib', 'faas', 'aws-func'))

let script
let expected

describe('./lib/faas/aws-func/define.js', () => {
  describe(':impl', () => {
    describe('#getSettings', () => {
      const defaultSettings = () => ({
        maxScriptDurationInSeconds: func.define.DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS,
        maxScriptRequestsPerSecond: func.define.DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND,
        maxChunkDurationInSeconds: func.define.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
        maxChunkRequestsPerSecond: func.define.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
        timeBufferInMilliseconds: func.define.DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS,
      })
      it('returns default settings if not given a script', () => {
        expect(func.define.getSettings()).to.eql(defaultSettings())
      })
      it('returns default settings if no settings are specified in the script', () => {
        script = {}
        expect(func.define.getSettings(script)).to.eql(defaultSettings())
      })
      it('extracts the maxScriptDurationInSeconds setting specification', () => {
        script = {
          _split: {
            maxScriptDurationInSeconds: 1,
          },
        }
        expected = defaultSettings()
        expected.maxScriptDurationInSeconds = 1
        expect(func.define.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts the maxChunkDurationInSeconds setting specification', () => {
        script = {
          _split: {
            maxChunkDurationInSeconds: 1,
          },
        }
        expected = defaultSettings()
        expected.maxChunkDurationInSeconds = 1
        expect(func.define.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts the maxScriptRequestsPerSecond setting specification', () => {
        script = {
          _split: {
            maxScriptRequestsPerSecond: 1,
          },
        }
        expected = defaultSettings()
        expected.maxScriptRequestsPerSecond = 1
        expect(func.define.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts the maxChunkRequestsPerSecond setting specification', () => {
        script = {
          _split: {
            maxChunkRequestsPerSecond: 1,
          },
        }
        expected = defaultSettings()
        expected.maxChunkRequestsPerSecond = 1
        expect(func.define.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts the timeBufferInMilliseconds setting specification', () => {
        script = {
          _split: {
            timeBufferInMilliseconds: 1,
          },
        }
        expected = defaultSettings()
        expected.timeBufferInMilliseconds = 1
        expect(func.define.getSettings(script)).to.eql(expected) // eslint-disable-line no-underscore-dangle
      })
      it('extracts complete setting specifications', () => {
        script = {
          _split: {
            maxScriptDurationInSeconds: 1,
            maxChunkDurationInSeconds: 1,
            maxScriptRequestsPerSecond: 1,
            maxChunkRequestsPerSecond: 1,
            timeBufferInMilliseconds: 1,
          },
        }
        expect(func.define.getSettings(script)).to.eql(script._split) // eslint-disable-line no-underscore-dangle
      })
    })
  })
})
