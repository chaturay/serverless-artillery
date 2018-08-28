const aws = require('aws-sdk')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(chaiAsPromised)
chai.use(sinonChai)

const { expect } = chai

let awsStub

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', 'lib', 'lambda', 'func.js'))

const tagContext = {
  functionName: 'name',
}

const validScript = () => ({
  _funcAws: {
    functionName: tagContext.functionName,
  },
  config: {
    phases: [
      {
        duration: 1,
        arrivalRate: 1,
      },
    ],
  },
})

describe('./lib/lambda/funcExec.js', () => {
  beforeEach(() => {
    awsStub = sinon.stub(aws.Service.prototype, 'makeRequest')
  })
  afterEach(() => {
    awsStub.restore()
  })
  describe(':impl', () => {
    beforeEach(() => {
      // lambda invocation stubbing
      awsStub.withArgs('invoke', sinon.match.any, sinon.match.any).callsFake(
        () => ({ promise: () => Promise.resolve({ Payload: '{}' }) }) // eslint-disable-line comma-dangle
      )
    })
    afterEach(() => {
      awsStub.reset()
    })
    describe('#execute', () => {
      it('adds SERVERLESS_STAGE to the FunctionName if available', () => {
        let err
        const STAGE = 'MY_STAGE'
        const inEnv = 'SERVERLESS_STAGE' in process.env
        const slsStage = process.env.SERVERLESS_STAGE
        process.env.SERVERLESS_STAGE = STAGE
        return func.exec(validScript())
          .then(() => {
            expect(awsStub).to.have.been.calledOnce
            expect(awsStub.getCall(0).args[1].FunctionName).to.eql(`${tagContext.functionName}:${STAGE}`)
          })
          .catch((ex) => { err = ex })
          .then(() => {
            if (inEnv) {
              process.env.SERVERLESS_STAGE = slsStage
            }
            if (err) {
              throw err
            }
          })
      })
      it('defaults to an "Event" calling type', () =>
        func.exec(validScript())
          .then(() => {
            expect(awsStub).to.have.been.calledOnce
            expect(awsStub.getCall(0).args[1].InvocationType).to.eql('Event')
          }) // eslint-disable-line comma-dangle
      )
      it('defaults to an "Event" calling type', () => {
        const type = 'A_Type'
        return func.exec(validScript(), type)
          .then(() => {
            expect(awsStub).to.have.been.calledOnce
            expect(awsStub.getCall(0).args[1].InvocationType).to.equal(type)
          })
      })
      it('handles unparsable payloads', () => {
        awsStub.withArgs('invoke', sinon.match.any, sinon.match.any).callsFake(
          () => ({ promise: () => Promise.resolve({ Payload: '{ NOT PARSABLE' }) }) // eslint-disable-line comma-dangle
        )
        return expect(func.exec(validScript())).to.eventually.equal(undefined)
      })
      it('rejects failures during invocation', () => {
        awsStub.withArgs('invoke', sinon.match.any, sinon.match.any).callsFake(
          () => ({ promise: () => Promise.reject(new Error('REJECTED!')) }) // eslint-disable-line comma-dangle
        )
        return expect(func.exec(validScript())).to.eventually.be.rejected
      })
    })
  })
})
