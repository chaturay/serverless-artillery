const chai = require('chai')
const path = require('path')

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const analysis = require(path.join('..', '..', '..', 'lib', 'lambda', 'analysis.js'))

describe('Results analysis', () => {
  const testTimeNow = 111111111111111
  const testScript = { name: 'test-script', _genesis: 22222222222222 }
  const testSettings = { prop: 'value' }
  const testResultsFailing = {
    reports: [
      {
        scenariosCreated: 5,
        scenariosCompleted: 4,
        requestsCompleted: 3,
        codes: {
          200: 3,
          400: 2,
        },
        errors: {
          'ERROR 1': 1,
          'ERROR 2': 2,
        },
      },
      {
        scenariosCreated: 3,
        scenariosCompleted: 2,
        requestsCompleted: 1,
        codes: {
          200: 1,
          400: 2,
          500: 2,
        },
        errors: {
          'ERROR 1': 1,
          'ERROR 3': 3,
        },
      },
    ],
  }
  const testResultsPassing = {
    reports: [
      {
        scenariosCreated: 10,
        scenariosCompleted: 10,
        requestsCompleted: 10,
        codes: {
          200: 10,
        },
        errors: {},
      },
    ],
  }

  it('passes on a singular performance result', () => {
    const singleResult = analysis.analyzePerformance(testTimeNow, testScript, testSettings, [testResultsFailing])
    expect(singleResult).to.deep.equal(testResultsFailing)
  })

  it('passes on multiple results', () => {
    const multipleResult = analysis.analyzePerformance(testTimeNow, testScript, testSettings, [testResultsFailing, testResultsFailing])
    expect(multipleResult).to.deep.equal([testResultsFailing, testResultsFailing])
  })

  it('provides a message if no load provided', () => {
    const messageResult = analysis.analyzePerformance(testTimeNow, testScript, testSettings, null)
    expect(messageResult.message).to.match(/load test from 22222222222222 successfully completed from 111111111111111/)
  })

  it('merges code counts for across sample results', () => {
    const finalReport = analysis.analyzeAcceptance(testTimeNow, testScript, testSettings, testResultsFailing)
    expect(finalReport.totals.codes).to.deep.equal({
      200: 4,
      400: 4,
      500: 2,
    })
  })

  it('merges error counts for across sample results', () => {
    const finalReport = analysis.analyzeAcceptance(testTimeNow, testScript, testSettings, testResultsFailing)
    expect(finalReport.totals.errors).to.deep.equal({
      'ERROR 1': 2,
      'ERROR 2': 2,
      'ERROR 3': 3,
    })
  })

  it('merges scenarioCreated counts for across sample results', () => {
    const finalReport = analysis.analyzeAcceptance(testTimeNow, testScript, testSettings, testResultsFailing)
    expect(finalReport.totals.scenariosCreated).to.equal(8)
  })

  it('merges scenariosCompleted counts for across sample results', () => {
    const finalReport = analysis.analyzeAcceptance(testTimeNow, testScript, testSettings, testResultsFailing)
    expect(finalReport.totals.scenariosCompleted).to.equal(6)
  })

  it('merges requestsCompleted counts for across sample results', () => {
    const finalReport = analysis.analyzeMonitoring(testTimeNow, testScript, testSettings, testResultsFailing)
    expect(finalReport.totals.requestsCompleted).to.equal(4)
  })

  it('does not add an errorMessage for passing results', () => {
    const finalReport = analysis.analyzeMonitoring(testTimeNow, testScript, testSettings, testResultsPassing)
    expect(finalReport.errorMessage).to.equal(undefined)
  })

  it('adds an errorMessage for failing results', () => {
    const finalReport = analysis.analyzeMonitoring(testTimeNow, testScript, testSettings, testResultsFailing)
    expect(finalReport.errorMessage).to.equal('performance failure: scenarios run: 8, total errors: 7, error budget: 4')
  })
})
