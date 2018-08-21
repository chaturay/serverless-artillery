const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)
chai.use(chaiAsPromised)

const { assert } = chai
const { stub, match: { func, has } } = sinon

const {
  pure: {
    readFile,
  },
} = require('./persistence')

describe.only('./tests/integration/idioms/persistence', () => {
  describe('pure', () => {
    describe('#readFile', () => {
      it('should pass through path, options and callback', () => {
        const readFileStub = stub()
        const path = 'foo'
        const options = {}
        const result = readFile({ readFile: readFileStub })(path, options)
        assert(readFileStub.calledOnce, 'should be called once')
        assert(readFileStub.calledWith(path, options, func),
          'should be called with path, options and callback')
      })
    })
  })
})
