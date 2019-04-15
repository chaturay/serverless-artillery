/* globals describe it */
/* globals describe it */
const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { join } = require('path')
const Ajv = require('ajv')

chai.use(sinonChai)

const { expect } = chai

const fsSpies = () => ({
  readFileSync: sinon.stub(),
})

const ajv = new Ajv()

const upgrade = require('../../../lib/versioning/0.0.0/upgrade.js')

describe('upgrade plugin for version 0.0.0', () => {
  it('properly identifies version 0.0.1 as next version', () => {
    expect(upgrade().nextVersion).to.equal('0.0.1')
  })

  it('includes all asset files in the manifest', () => {
    expect(upgrade().fileManifest()).to.deep.equal([
      'handler.js',
      'package.json',
      'serverless.yml',
    ])
  })

  it('loads asset file contents for its version', () => {
    const fs = fsSpies()
    const testFilePath = join(__dirname, '..', '..', '..', 'lib', 'versioning', '0.0.0', 'assets', 'theFile.ext')

    fs.readFileSync.withArgs(testFilePath).returns('the file contents')

    expect(upgrade(fs).fileContents('theFile.ext')).to.equal('the file contents')
    expect(fs.readFileSync.firstCall.args[0]).to.equal(testFilePath)
  })

  it('reads dependencies from package.json', () => {
    expect(upgrade().projectDependencies()).to.deep.equal({
      'artillery-core': '^2.0.3-0',
      'csv-parse': '^1.1.7',
    })
  })

  it('provides a schema to describe the existing minimum service configuration', () => {
    expect(upgrade().serviceDefinitionSchema()).to.deep.equal({
      properties: {
        functions: {
          properties: {
            loadGenerator: {
              required: [
                'handler',
                'timeout',
              ],
              type: 'object',
            },
          },
          required: [
            'loadGenerator',
          ],
          type: 'object',
        },
        provider: {
          properties: {
            iamRoleStatements: {
              type: 'array',
            },
          },
          required: [
            'iamRoleStatements',
          ],
          type: 'object',
        },
      },
      required: [
        'provider',
        'functions',
      ],
      type: 'object',
    })
  })

  describe('enforces minimum project requirements', () => {
    const minimumService = () => ({
      provider: {
        iamRoleStatements: [],
      },
      functions: {
        loadGenerator: {
          handler: '',
          timeout: '',
        },
      },
    })

    const minimumServiceSchema = upgrade().serviceDefinitionSchema()
    const verifyServiceIsValid = (service) => {
      expect(ajv.validate(minimumServiceSchema, service)).to.be.true
    }
    const verifyServiceFailsValidation = (service, message) => {
      const valid = ajv.validate(minimumServiceSchema, service)
      expect(valid).to.be.false
      expect(ajv.errorsText()).to.equal(message)
    }

    it('rejects falsy service configurations', () => {
      const service = undefined
      verifyServiceFailsValidation(service, 'data should be object')
    })
    it('rejects non-object service configurations', () => {
      const service = 'anything'
      verifyServiceFailsValidation(service, 'data should be object')
    })
    it('rejects falsy provider', () => {
      const service = minimumService()
      service.provider = false
      verifyServiceFailsValidation(service, 'data.provider should be object')
    })
    it('rejects falsy provider.iamRoleStatements', () => {
      const service = minimumService()
      service.provider.iamRoleStatements = false
      verifyServiceFailsValidation(service, 'data.provider.iamRoleStatements should be array')
    })
    it('rejects non-array provider.iamRoleStatements', () => {
      const service = minimumService()
      service.provider.iamRoleStatements = 'anything'
      verifyServiceFailsValidation(service, 'data.provider.iamRoleStatements should be array')
    })
    it('rejects falsy functions', () => {
      const service = minimumService()
      service.functions = false
      verifyServiceFailsValidation(service, 'data.functions should be object')
    })
    it('rejects falsy functions[constants.TestFunctionName]', () => {
      const service = minimumService()
      service.functions.loadGenerator = false
      verifyServiceFailsValidation(service, 'data.functions.loadGenerator should be object')
    })
    it('rejects non-object functions[constants.TestFunctionName]', () => {
      const service = minimumService()
      service.functions.loadGenerator = 'anything'
      verifyServiceFailsValidation(service, 'data.functions.loadGenerator should be object')
    })
    it('validates a minimal service', () => {
      verifyServiceIsValid(minimumService())
    })
  })

  it('does not provide a conflicting schema', () => {
    expect(upgrade().serviceDefinitionConflictSchema()).to.deep.equal({})
  })
})
