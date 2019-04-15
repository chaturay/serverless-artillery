const chai = require('chai')
const path = require('path')

const { expect } = chai

// eslint-disable-next-line import/no-dynamic-require
const sampling = require(path.join('..', '..', '..', 'lib', 'lambda', 'sampling.js'))

describe('Sampling configuration', () => {
  let script
  let settings

  beforeEach(() => {
    settings = { maxScriptDurationInSeconds: 9999 }
    script = sampling.applyAcceptanceSamplingToScript({}, settings)
  })

  it('provides default configuration as a basis', () => {
    const defaults = sampling.defaultSampling({}, {})
    expect(defaults).to.deep.equal({
      size: 5,
      averagePause: 0.2,
      pauseVariance: 0.1,
      errorBudget: 4,
      warningThreshold: 0.9,
    })
  })

  it('can apply acceptance settings to script', () => {
    const acceptanceScript = sampling.applyAcceptanceSamplingToScript({}, {})
    expect(acceptanceScript).to.deep.equal({
      sampling: {
        averagePause: 0.2,
        errorBudget: 0,
        pauseVariance: 0.1,
        size: 1,
        warningThreshold: 0.9,
      },
    })
  })

  it('can apply monitoring settings to script', () => {
    const acceptanceScript = sampling.applyMonitoringSamplingToScript({}, {})
    expect(acceptanceScript).to.deep.equal({
      sampling: {
        size: 5,
        averagePause: 0.2,
        pauseVariance: 0.1,
        errorBudget: 4,
        warningThreshold: 0.9,
      },
    })
  })

  it('rejects non-number size values', () => {
    script.sampling.size = '1'
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects size values of 0', () => {
    script.sampling.size = 0
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects negative size values', () => {
    script.sampling.size = -1
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects non-number averagePause values', () => {
    script.sampling.averagePause = '1'
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects averagePause values of 0', () => {
    script.sampling.averagePause = 0
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects negative averagePause values', () => {
    script.sampling.averagePause = -1
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects non-number pauseVariance values', () => {
    script.sampling.pauseVariance = '1'
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects negative pauseVariance values', () => {
    script.sampling.pauseVariance = -1
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects non-number errorBudget values', () => {
    script.sampling.errorBudget = '1'
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects negative errorBudget values', () => {
    script.sampling.errorBudget = -1
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects non-number warningThreshold values', () => {
    script.sampling.warningThreshold = '1'
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects warningThreshold values of 0', () => {
    script.sampling.warningThreshold = 0
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects negative warningThreshold values', () => {
    script.sampling.warningThreshold = -1
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('accepts warningThreshold values of 1', () => {
    script.sampling.warningThreshold = 1
    sampling.validateSampling(script, settings)
  })

  it('rejects warningThreshold values greater than 1', () => {
    script.sampling.warningThreshold = 1.1
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects errorBudgets equal to the size', () => {
    script.sampling.size = 5
    script.sampling.errorBudget = 5
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects errorBudgets greater than size', () => {
    script.sampling.size = 4
    script.sampling.errorBudget = 5
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })

  it('rejects pauseVariances greater than averagePause', () => {
    script.sampling.averagePause = 4
    script.sampling.pauseVariance = 5
    expect(() => sampling.validateSampling(script, settings)).to.throw(Error)
  })
})
