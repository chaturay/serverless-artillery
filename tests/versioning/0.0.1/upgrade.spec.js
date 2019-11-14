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

const upgrade = require('../../../lib/versioning/0.0.1/upgrade.js')

describe('upgrade plugin for version 0.0.1', () => {
  it('properly identifies there is no next version', () => {
    expect(upgrade().nextVersion).to.equal(null)
  })

  it('includes all asset files in the manifest', () => {
    expect(upgrade().fileManifest()).to.deep.equal([
      '.slsart',
      'alert.js',
      'analysis.js',
      'artillery-acceptance.js',
      'artillery-monitoring.js',
      'artillery-performance.js',
      'artillery-task.js',
      'handler.js',
      'modes.js',
      'node_modules',
      'package-lock.json',
      'package.json',
      'planning.js',
      'platform-settings.js',
      'sampling.js',
      'script.yml',
      'serverless.yml',
    ])
  })

  it('loads asset file contents for its version', () => {
    const fs = fsSpies()
    const testFilePath = join(__dirname, '..', '..', '..', 'lib', 'lambda', 'theFile.ext')

    fs.readFileSync.withArgs(testFilePath).returns('the file contents')

    expect(upgrade(fs).fileContents('theFile.ext')).to.equal('the file contents')
    expect(fs.readFileSync.firstCall.args[0]).to.equal(testFilePath)
  })

  it('reads dependencies from package.json', () => {
    expect(upgrade().projectDependencies()).to.deep.equal({
      artillery: 'git+https://github.com/Nordstrom/artillery.git#25852a11f5f559fc11076314c086ae40ee129348',
      'js-yaml': '^3.13.1',
      'lodash.merge': '^4.6.2',
      'lodash.omit': '^4.5.0',
      'util-promisify': '^2.1.0',
    })
  })

  it('does not provide a service definition schema', () => {
    expect(upgrade().serviceDefinitionSchema()).to.deep.equal({})
  })

  it('provides a schema to detect conflicting user changes', () => {
    expect(upgrade().serviceDefinitionConflictSchema()).to.deep.equal({
      properties: {
        functions: {
          properties: {
            loadGenerator: {
              properties: {
                environment: {
                  propertyNames: {
                    pattern: '^(?!TOPIC_ARN|TOPIC_NAME).*',
                  },
                  type: 'object',
                },
                events: {
                  items: {
                    properties: {
                      schedule: {
                        properties: {
                          name: {
                            // eslint-disable-next-line no-template-curly-in-string
                            pattern: '^(?!\\${self:service}-\\${opt:stage, self:provider\\.stage}-monitoring).*',
                            type: 'string',
                          },
                        },
                        type: 'object',
                      },
                    },
                  },
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
          type: 'object',
        },
        resources: {
          properties: {
            Resources: {
              propertyNames: {
                pattern: '^(?!monitoringAlerts).*',
              },
              type: 'object',
            },
          },
          type: 'object',
        },
      },
      type: 'object',
    })
  })

  describe('detects changes which conflict with the upgraded service definition', () => {
    const minimumService = () => ({
      provider: {
        iamRoleStatements: [],
      },
      functions: {
        loadGenerator: {
          createHandler: '',
          timeout: '',
        },
      },
    })

    const minimumServiceSchema = upgrade().serviceDefinitionConflictSchema()
    const verifyServiceIsValid = service => expect(ajv.validate(minimumServiceSchema, service)).to.be.true
    const verifyServiceFailsValidation = (service, message) => {
      const valid = ajv.validate(minimumServiceSchema, service)
      expect(valid).to.be.false
      expect(ajv.errorsText()).to.equal(message)
    }

    it('accepts undefined functions.loadGenerator.environment', () => {
      const service = minimumService()
      delete service.functions.loadGenerator.environment
      verifyServiceIsValid(service)
    })
    it('accepts functions[constants.TestFunctionName].environment without TOPIC_ARN or TOPIC_NAME', () => {
      const service = minimumService()
      service.functions.loadGenerator.environment = { NOT_TOPIC_ARN_OR_TOPIC_NAME: 'anything' }
      verifyServiceIsValid(service)
    })
    it('rejects functions[constants.TestFunctionName].environment with TOPIC_ARN', () => {
      const service = minimumService()
      service.functions.loadGenerator.environment = { TOPIC_ARN: 'anything' }
      verifyServiceFailsValidation(service, 'data.functions.loadGenerator.environment should match pattern "^(?!TOPIC_ARN|TOPIC_NAME).*", data.functions.loadGenerator.environment property name \'TOPIC_ARN\' is invalid')
    })
    it('rejects functions[constants.TestFunctionName].environment with TOPIC_NAME', () => {
      const service = minimumService()
      service.functions.loadGenerator.environment = { TOPIC_NAME: 'anything' }
      verifyServiceFailsValidation(service, 'data.functions.loadGenerator.environment should match pattern "^(?!TOPIC_ARN|TOPIC_NAME).*", data.functions.loadGenerator.environment property name \'TOPIC_NAME\' is invalid')
    })
    it('accepts an undefined functions[constants.TestFunctionName].events', () => {
      const service = minimumService()
      delete service.functions.loadGenerator.events
      verifyServiceIsValid(service)
    })
    it('rejects non-array functions[constants.TestFunctionName].events', () => {
      const service = minimumService()
      service.functions.loadGenerator.events = 'anything'
      verifyServiceFailsValidation(service, 'data.functions.loadGenerator.events should be array')
    })
    it('rejects functions[constants.TestFunctionName].events with a schedule event named constants.ScheduleName', () => {
      const service = minimumService()
      // eslint-disable-next-line no-template-curly-in-string
      service.functions.loadGenerator.events = [{ schedule: { name: '${self:service}-${opt:stage, self:provider.stage}-monitoring' } }]
      // eslint-disable-next-line no-template-curly-in-string
      verifyServiceFailsValidation(service, 'data.functions.loadGenerator.events[0].schedule.name should match pattern "^(?!\\${self:service}-\\${opt:stage, self:provider\\.stage}-monitoring).*"')
    })
    it('accepts an undefined resources', () => {
      const service = minimumService()
      delete service.resources
      verifyServiceIsValid(service)
    })
    it('accepts an undefined resources.Resources', () => {
      const service = minimumService()
      if (service.resources) {
        delete service.resources.Resources
      }
      verifyServiceIsValid(service)
    })
    it('accepts an undefined resources.Resources.monitoringAlerts', () => {
      const service = minimumService()
      if (service.resources && service.resources.Resources) {
        delete service.resources.Resources.monitoringAlerts
      }
      verifyServiceIsValid(service)
    })
    it('reject a defined resources.Resources.monitoringAlerts', () => {
      const service = minimumService()
      service.resources = {
        Resources: {
          monitoringAlerts: 'anything',
        },
      }
      verifyServiceFailsValidation(service, 'data.resources.Resources should match pattern "^(?!monitoringAlerts).*", data.resources.Resources property name \'monitoringAlerts\' is invalid')
    })
    it('validates a minimal service with no conflicts', () => {
      verifyServiceIsValid(minimumService())
    })
  })
})
