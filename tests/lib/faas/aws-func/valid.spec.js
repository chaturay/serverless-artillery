const chai = require('chai')
const path = require('path')

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', '..', 'lib', 'faas', 'aws-func'))

const tagScript = () => ({
  config: {
    phases: [
      { duration: 1, arrivalRate: 2 },
    ],
  },
})

let script

describe('./lib/faas/aws-func/valid.js', () => {
  describe(':impl', () => {
    describe('#validScript', () => {
      /* eslint-disable no-underscore-dangle */
      beforeEach(() => {
        script = tagScript()
      })
      it('accepts the valid script', () => {
        func.valid(script)
      })
      describe('_split usage', () => {
        const validSplitScript = () => {
          const ret = tagScript()
          ret._split = {}
          return ret
        }
        beforeEach(() => {
          script = validSplitScript()
        })
        it('accepts a valid _split', () => {
          func.valid(script)
        })
        it('rejects a defined, non-object _split', () => {
          script._split = ''
          expect(() => func.valid(script)).to.throw(func.define.FunctionError)
        })
        const settings = [
          { name: 'maxChunkDurationInSeconds', max: func.define.MAX_CHUNK_DURATION_IN_SECONDS, min: func.define.MIN_CHUNK_DURATION_IN_SECONDS },
          { name: 'maxScriptDurationInSeconds', max: func.define.MAX_SCRIPT_DURATION_IN_SECONDS },
          { name: 'maxChunkRequestsPerSecond', max: func.define.MAX_CHUNK_REQUESTS_PER_SECOND },
          { name: 'maxScriptRequestsPerSecond', max: func.define.MAX_SCRIPT_REQUESTS_PER_SECOND },
          { name: 'timeBufferInMilliseconds', max: func.define.MAX_TIME_BUFFER_IN_MILLISECONDS },
        ]
        settings.forEach((setting) => {
          describe(`validates _split.${setting.name}`, () => {
            it('rejects non integer values', () => {
              script._split[setting.name] = 'not a number'
              expect(() => func.valid(script)).to.throw(func.define.FunctionError)
            })
            it('rejects negative values', () => {
              script._split[setting.name] = -1
              expect(() => func.valid(script)).to.throw(func.define.FunctionError)
            })
            it(`rejects values greater than ${setting.max}`, () => {
              script._split[setting.name] = setting.max + 1
              expect(() => func.valid(script)).to.throw(func.define.FunctionError)
            })
            if (setting.min) {
              it(`rejects values less than ${setting.min}`, () => {
                script._split[setting.name] = setting.min - 1
                expect(() => func.valid(script)).to.throw(func.define.FunctionError)
              })
            }
          })
        })
      })
    })
  })
})
