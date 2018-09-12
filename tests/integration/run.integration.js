/**
 * The purpose of this test suite is to provide automated user-level tests of the workflows users are expecting to work with serverless-artillery
 */
const aws = require('aws-sdk')
const BbPromise = require('bluebird')

BbPromise.longStackTraces()

aws.config.setPromisesDependency(require('bluebird'))

if (process.env.AWS_PROFILE) {
  aws.config.credentials = new aws.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE })
}

if (!aws.config.region) {
  aws.config.region = 'us-east-1'
}

const introWorkflow = require('./intro/intro')
const loadWorkflow = require('./load/load')
const monitoringWorkflow = require('./monitor/monitor')

BbPromise.resolve()
  // ## !! PRIORITY 1 !! ##
  // The "intro" to the tool workflow
  // .then(introWorkflow) // https://github.com/Nordstrom/serverless-artillery/issues/179
  .then(loadWorkflow)
  // .then(monitoringWorkflow)
