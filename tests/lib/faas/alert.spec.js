const aws = require('aws-sdk')
const chai = require('chai')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)
chai.should()

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const alert = require(path.join('..', '..', '..', 'lib', 'faas', 'alert.js'))
// eslint-disable-next-line import/no-dynamic-require
const task = require(path.join('..', '..', '..', 'lib', 'faas', 'task.js'))

let analysis
let result

describe('./lib/faas/taskResult.js', () => {
  describe(':', () => {
    describe('#briefAnalysis', () => {
      it('removes latencies from reports before stringifying the analysis', () => {
        analysis = {
          errors: 1,
          errorMessage: `sampling test failure: 1/2 exceeded budget of ${task.def.monitoring.DefaultErrorBudget} errors`,
          reports: [
            {
              errors: {
                404: task.def.sampling.DefaultErrorBudget + 1,
              },
              latencies: ['stuff', 'we', 'don\'t', 'want'],
            },
            {
              errors: {},
              latencies: ['stuff', 'we', 'don\'t', 'want'],
            },
          ],
        }
        const preAnalysis = JSON.parse(JSON.stringify(analysis))
        result = JSON.parse(alert.briefAnalysis(analysis))
        expect(analysis).to.eql(preAnalysis) // leaves the given analysis unchanged
        delete analysis.reports[0].latencies // destructive change after already calling briefAnalysis
        delete analysis.reports[1].latencies
        expect(result).to.eql(analysis) // doesn't contain latencies
      })
    })
    describe('#send', () => {
      let awsStub
      const topicArn = process.env.TOPIC_ARN
      beforeEach(() => {
        awsStub = sinon.stub(aws.Service.prototype, 'makeRequest').returns({ promise: () => Promise.resolve() })
      })
      afterEach(() => {
        awsStub.restore()
        if (topicArn) {
          process.env.TOPIC_ARN = topicArn
        }
      })
      it('Logs a warning if the alerting code doesn\'t have its required configuration', () => {
        delete process.env.TOPIC_ARN
        const consoleLog = console.error
        let logCalled = false
        console.error = () => { logCalled = true }
        try {
          return alert.send({}, {}).should.be.fulfilled
            .then(() => expect(logCalled).to.be.true)
        } finally {
          console.error = consoleLog
        }
      })
      it('sends an alert to SNS using the given TOPIC_ARN', () => {
        process.env.TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:my_corporate_topic'
        return alert.send({}, { reports: [] }).should.be.fulfilled
          .then(() => {
            expect(awsStub).to.have.been.calledOnce
            expect(awsStub.getCall(0).args[1].TopicArn).to.eql(process.env.TOPIC_ARN)
          })
      })
    })
  })
})
