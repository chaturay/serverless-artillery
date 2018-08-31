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
    readObject,
    writeObject,
    streamObjects,
  },
} = require('./persistence')

describe('./tests/integration/idioms/persistence', () => {
  describe('pure', () => {
    describe('#createParams', () => {
      const bucketName = 'slsart-integration-target-requests'
      it('should set Bucket', () =>
        assert.deepStrictEqual(createParams(), { Bucket: bucketName }))
      it('should incorporate options', () =>
        assert.deepStrictEqual(
          createParams({ Bar: 'baz' }),
          { Bucket: bucketName, Bar: 'baz' }
        ))
      it('should not override bucket', () =>
        assert.deepStrictEqual(
          createParams({ Bucket: 'wrong!' }),
          { Bucket: bucketName }
        ))
    })

    describe('s3', () => {
      describe('#writeFile', () => {
        it('should put the object', () => {
          const putObjectStub = stub()
            .returns({ promise: () => Promise.resolve() })
          const params = {}
          const createParamsStub = stub().returns(params)
          return s3({ putObject: putObjectStub }, createParamsStub).writeFile()
            .then(() =>
              assert.ok(putObjectStub.calledOnce &&
                putObjectStub.calledWithExactly(params)))
        })
      })

      describe('#listFiles', () => {
        it('should list the files', () => {
          const listObjectsV2Stub = stub().returns({
            promise: () => Promise.resolve({ Contents: [{ Key: 'foo' }, { Key: 'bar' }] }),
          })
          const createParamsStub = stub().returns(Promise.resolve({}))
          return s3({ listObjectsV2: listObjectsV2Stub }, createParamsStub)
            .listFiles()
            .then(({ keys }) =>
              assert.deepStrictEqual(keys, ['foo', 'bar']))
        })
        it('should not provide a next function when there are no more files', () => {
          const listObjectsV2Stub = stub().returns({
            promise: () => Promise.resolve({ Contents: [{ Key: 'foo' }, { Key: 'bar' }] }),
          })
          const createParamsStub = stub().returns(Promise.resolve({}))
          return s3({ listObjectsV2: listObjectsV2Stub }, createParamsStub)
            .listFiles()
            .then(({ next }) => assert(!next))
        })
        it('should provide a next function when there are more files to list', () => {
          const continuationToken = {}
          const listObjectsV2Stub = stub().returns({
            promise: () => Promise.resolve({
              Contents: [{ Key: 'foo' }, { Key: 'bar' }],
              IsTruncated: true,
              NextContinuationToken: continuationToken,
            }),
          })
          const createParamsStub = stub().returns(Promise.resolve({}))
          return s3({ listObjectsV2: listObjectsV2Stub }, createParamsStub)
            .listFiles()
            .then(({ next }) => assert(next && (typeof next === 'function')))
        })
        it('should list remaining files when calling next', () => {
          const continuationToken = {}
          const listObjectsV2Stub = stub()
            .onFirstCall().returns({
              promise: () => Promise.resolve({
                Contents: [{ Key: 'foo' }, { Key: 'bar' }],
                IsTruncated: true,
                NextContinuationToken: continuationToken,
              }),
            })
            .onSecondCall()
            .returns({
              promise: () => Promise.resolve({
                Contents: [{ Key: 'baz' }, { Key: 'biz' }],
              }),
            })
          const createParamsStub = stub().returns(Promise.resolve({}))
          return s3({ listObjectsV2: listObjectsV2Stub }, createParamsStub)
            .listFiles()
            .then(({ next }) => next())
            .then(({ keys, next }) => {
              assert(!next)
              assert.deepStrictEqual(keys, ['baz', 'biz'])
            })
        })
      })

      describe('#readFile', () => {
        it('should get the object', () => {
          const expected = 'foo'
          const getObjectStub = stub()
            .returns({
              promise: () =>
                Promise.resolve({ Body: Buffer.from(expected) }),
            })
          const params = {}
          const createParamsStub = stub().returns(Promise.resolve(params))
          return s3({ getObject: getObjectStub }, createParamsStub).readFile()
            .then(data =>
              assert.strictEqual(data, expected))
        })
      })
    })

    describe('#readObject', () => {
      it('should read json', () =>
        assert.eventually.deepStrictEqual(
          readObject(key =>
            (key === 'my-object'
              ? Promise.resolve('{"foo":"bar"}')
              : Promise.reject('not found'))
          )('my-object'),
          { foo: 'bar' }
        ))
    })

    describe('#writeObject', () => {
      it('should write json', () => {
        const writeFileStub = stub()
        const key = 'my-object'
        writeObject(writeFileStub)(key, { foo: 'bar' })
        assert.ok(writeFileStub.calledWithExactly(key, '{"foo":"bar"}'))
      })
    })

    describe('#streamObjects', () => {
      it('should stream objects', () => {
        const keys1 = ['foo', 'bar']
        const keys2 = ['baz', 'biz']
        const listFilesStub = stub().returns(Promise.resolve({
          keys: keys1,
          next: () => Promise.resolve({ keys: keys2 }),
        }))
        const expected = {
          foo: { i: 1 },
          bar: { i: 2 },
          baz: { i: 3 },
          biz: { i: 4 },
        }
        const readObjectsStub = stub().callsFake(key =>
          Promise.resolve(expected[key]))
        const prefix = 'dir/'
        return new Promise((resolve, reject) => {
          const streamed = []
          streamObjects(listFilesStub, readObjectsStub)(prefix, (o) => {
            o
              ? streamed.push(o)
              : resolve(streamed)
          })
        })
          .then((objects) => {
            assert.ok(listFilesStub.calledWithExactly(prefix))
            assert.deepStrictEqual(
              objects,
              Object.keys(expected).map(k => expected[k])
            )
          })
      })
    })
  })
})
