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
    parseYaml,
    configPath,
    readConfig,
    createParams,
    s3,
  },
} = require('./persistence')

describe.only('./tests/integration/idioms/persistence', () => {
  describe('pure', () => {
    describe('#readFile', () => {
      it('should pass through path, options and callback', () => {
        const readFileStub = stub()
        const path = 'foo'
        const options = {}
        readFile({ readFile: readFileStub })(path, options)
        assert(readFileStub.calledOnce, 'should be called once')
        assert(readFileStub.calledWith(path, options, func),
          'should be called with path, options and callback')
      })
      it('should resolve on success', () => {
        const content = 'foo'
        const data = { toString: () => content }
        const readFileStub = stub()
          .callsFake((path, options, callback) => callback(undefined, data))
        return assert.becomes(readFile({ readFile: readFileStub })(), content)
      })
      it('should reject on callback error', () => {
        const error = new Error()
        const readFileStub = stub()
          .callsFake((path, options, callback) => callback(error))
        return assert.isRejected(readFile({ readFile: readFileStub })(), error)
      })
      it('should reject on callback error', () => {
        const error = new Error()
        const readFileStub = stub()
          .callsFake((path, options, callback) => callback(error))
        return assert.isRejected(readFile({ readFile: readFileStub })(), error)
      })
      it('should reject on readFile error', () => {
        const error = new Error()
        const readFileStub = stub()
          .throws(error)
        return assert.isRejected(readFile({ readFile: readFileStub })(), error)
      })
    })
    describe('#parseYaml', () => {
      it('should parse yaml', () =>
        assert.deepStrictEqual(parseYaml('foo: bar'), { foo: 'bar' }))
    })
    describe('#readConfig', () => {
      it('should read config.yml', () => {
        const readFileStub = stub()
          .returns(Promise.resolve('foo: bar'))
        readConfig(readFileStub)()
        assert.ok(readFileStub.calledOnce)
        assert.ok(readFileStub.calledWithExactly(configPath))
      })
      it('should return json', () =>
        readConfig(stub().returns(Promise.resolve('foo: bar')))()
          .then(config => assert.deepStrictEqual(config, { foo: 'bar' })))
    })
    describe('#createParams', () => {
      const bucketName = 'foo-bucket'
      const readConfigStub = stub()
        .returns(Promise.resolve({ target: { bucket: bucketName } }))
      it('should set Bucket and Key', () =>
        createParams(readConfigStub)('foo')
          .then(params =>
            assert.deepStrictEqual(params, { Bucket: bucketName, Key: 'foo' })))
      it('should incorporate options', () =>
        createParams(readConfigStub)('foo', { Bar: 'baz' })
          .then(params =>
            assert.deepStrictEqual(
              params,
              { Bucket: bucketName, Key: 'foo', Bar: 'baz' }
            )))
      it('should not override bucket or key', () =>
        createParams(readConfigStub)('foo', { Bucket: 'wrong!', Key: 'wrong!' })
          .then(params =>
            assert.deepStrictEqual(params, { Bucket: bucketName, Key: 'foo' })))
    })
    describe('s3', () => {
      describe('#writeFile', () => {
        it('puts the object', () => {
          const putObjectStub = stub().returns({ promise: () => {} })
          const params = {}
          const createParamsStub = stub().returns(Promise.resolve(params))
          return s3({ putObject: putObjectStub }, createParamsStub).writeFile()
            .then(() =>
              assert.ok(putObjectStub.calledOnce &&
                putObjectStub.calledWithExactly(params)))
        })
      })
      describe('#listFiles', () => {
        it('')
      })
      describe('#readFile', () => {
        it('')
      })
    })
  })
})
