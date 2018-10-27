/* globals describe it */
const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)

const { expect } = chai

const versioning = require('../../lib/versioning')

const fsSpies = () => ({
  existsSync: sinon.stub(),
  readFileSync: sinon.stub(),
})

describe('versioning module', () => {
  describe('implementation', () => {
    describe('readAssetsVersion', () => {
      it('checks for .slsart file', () => {
        const fs = fsSpies()

        versioning(fs).readAssetsVersion('target-project')

        expect(fs.existsSync.calledOnce).to.be.true
        expect(fs.existsSync.firstCall.args[0]).to.equal('target-project/.slsart')
      })

      it('reads version from .slsart file, if found', () => {
        const fs = fsSpies()
        fs.existsSync.returns(true)
        fs.readFileSync.returns('version: 1.2.3')

        const versionRead = versioning(fs).readAssetsVersion('target-project')

        expect(fs.existsSync.calledOnce).to.be.true
        expect(fs.existsSync.firstCall.args[0]).to.equal('target-project/.slsart')
        expect(versionRead).to.equal('1.2.3')
      })

      it('returns 0.0.0 if no .slsart file found', () => {
        const fs = fsSpies()
        fs.existsSync.returns(false)

        const versionRead = versioning(fs).readAssetsVersion('target-project')

        expect(fs.existsSync.calledOnce).to.be.true
        expect(fs.existsSync.firstCall.args[0]).to.equal('target-project/.slsart')
        expect(versionRead).to.equal('0.0.0')
      })
    })

    describe('validateProjectDependencies', () => {
      it('reads form the package.json', () => {
        const fs = fsSpies()
        fs.existsSync.withArgs('target-project/.slsart').returns(false)
        fs.readFileSync.withArgs('target-project/package.json').returns('{}')

        expect(versioning(fs).validateProjectDependencies('target-project', {}))
          .to.equal(undefined)

        expect(fs.readFileSync.calledOnce).to.be.true
        expect(fs.readFileSync.firstCall.args[0]).to.equal('target-project/package.json')
      })

      it('expects to find correct dependencies', () => {
        const fs = fsSpies()
        fs.readFileSync.withArgs('target-project/package.json').returns(`{
          "dependencies": {
             "some-package": "^1.0",
             "another-package": "2.0.4"
          }
        }`)

        expect(() => versioning(fs).validateProjectDependencies('target-project', {
          'some-package': '^1.0',
          'another-package': '2.0.4',
        })).to.not.throw()
      })

      it('throws if dependencies are missing', () => {
        const fs = fsSpies()
        fs.readFileSync.withArgs('target-project/package.json').returns(`{
          "dependencies": {
          }
        }`)

        expect(() => versioning(fs).validateProjectDependencies('target-project', {
          'some-package': '^1.0',
          'another-package': '2.0.4',
        })).to.throw('Missing package.json dependency: some-package, another-package')
      })

      it('throws if dependencies are wrong version', () => {
        const fs = fsSpies()
        fs.readFileSync.withArgs('target-project/package.json').returns(`{
          "dependencies": {
            "some-package": "^2.0",
            "another-package": "9.9.9"
          }
        }`)

        expect(() => versioning(fs).validateProjectDependencies('target-project', {
          'some-package': '^1.0',
          'another-package': '2.0.4',
        })).to.throw('Invalid package.json dependency package version found:\n' +
          '\tsome-package expected ^1.0 found ^2.0\n' +
          '\tanother-package expected 2.0.4 found 9.9.9')
      })
    })

    describe('validateServiceDefinition', () => {
      it('reads form the serverless.yml', () => {
        const fs = fsSpies()
        fs.readFileSync.withArgs('target-project/serverless.yml').returns('')

        expect(() => versioning(fs).validateServiceDefinition('target-project'))
          .to.throw()

        expect(fs.readFileSync.calledOnce).to.be.true
        expect(fs.readFileSync.firstCall.args[0]).to.equal('target-project/serverless.yml')
      })

      const validateScriptConfig = (
        config,
        message,
        errorType
      ) => {
        const fs = fsSpies()
        fs.readFileSync.withArgs('target-project/serverless.yml').returns(config)

        let exceptionThrown = false;

        try {
          versioning(fs).validateServiceDefinition('target-project')
        } catch(ex) {
          exceptionThrown = true
          expect(ex.message).to.equal(message)
          expect(ex.constructor.name).to.equal(errorType)
        }
        expect(exceptionThrown).to.be.true
      }

      it('checks if the script is an object', () => {
        validateScriptConfig(
          '',
          'The given service must be an object',
          'UpdatePreconditionError'
        )
      })

      it('checks if the given service must have "provider.iamRoleStatements" defined as an array', () => {
        validateScriptConfig(
          'provider:\n' +
          '  name: aws',
          'The given service must have "provider.iamRoleStatements" defined as an array',
          'UpdatePreconditionError'
        )
      })

      it('checks if the given service must have a function with the name "loadGenerator"', () => {
        validateScriptConfig(
          'provider:\n' +
          '  iamRoleStatements: []',

          'The given service must have a function with the name "loadGenerator"',
          'UpdatePreconditionError'
        )
      })

      it('checks if the given service has function "loadGenerator" that already has environment variable "TOPIC_ARN" defined.', () => {
        validateScriptConfig(
          'provider:\n' +
          '  iamRoleStatements: []\n' +
          'functions:\n' +
          '  loadGenerator:\n' +
          '    environment:\n' +
          '      TOPIC_ARN: arn\n',

          'The given service has function "loadGenerator" that already has environment variable "TOPIC_ARN" defined.',
          'UpdateConflictError'
        )
      })

      it('checks if the given service has function "loadGenerator" that already has environment variable "TOPIC_NAME" defined.', () => {
        validateScriptConfig(
          'provider:\n' +
          '  iamRoleStatements: []\n' +
          'functions:\n' +
          '  loadGenerator:\n' +
          '    environment:\n' +
          '      TOPIC_NAME: aTopic',

          'The given service has function "loadGenerator" that already has environment variable "TOPIC_NAME" defined.',
          'UpdateConflictError'
        )
      })

      it('checks if defined, that the events attribute of the "loadGenerator" function must be an array.', () => {
        validateScriptConfig(
          'provider:\n' +
          '  iamRoleStatements: []\n' +
          'functions:\n' +
          '  loadGenerator:\n' +
          '    events: one',

          'If defined, the events attribute of the "loadGenerator" function must be an array.',
          'UpdatePreconditionError'
        )
      })

      it('checks if "loadGenerator" function already has a schedule event named "${self:service}-${opt:stage, self:provider.stage}-monitoring"', () => {
        validateScriptConfig(
          'provider:\n' +
          '  iamRoleStatements: []\n' +
          'functions:\n' +
          '  loadGenerator:\n' +
          '    events:\n' +
          '      - schedule:\n' +
          '          name: ${self:service}-${opt:stage, self:provider.stage}-monitoring\n',

          'The "loadGenerator" function already has a schedule event named "${self:service}-${opt:stage, self:provider.stage}-monitoring"',
          'UpdateConflictError'
        )
      })

      it('checks if a resource with logical ID monitoringAlerts already exists', () => {
        validateScriptConfig(
          'provider:\n' +
          '  iamRoleStatements: []\n' +
          'functions:\n' +
          '  loadGenerator:\n' +
          '    events:\n' +
          '      - schedule:\n' +
          '          name: scheduleName\n' +
          'resources:\n' +
          '  Resources:\n' +
          '    monitoringAlerts:\n' +
          '      Type: \'AWS::SNS::Topic\'\n',

          'A resource with logical ID monitoringAlerts already exists',
          'UpdateConflictError'
        )
      })

      it('validates a valid service configuration script', () => {
        const fs = fsSpies()
        fs.readFileSync.withArgs('target-project/serverless.yml').returns(
          'provider:\n' +
          '  iamRoleStatements: []\n' +
          'functions:\n' +
          '  loadGenerator:\n' +
          '    events:\n' +
          '      - schedule:\n' +
          '          name: scheduleName\n' +
          'resources:\n' +
          '  Resources:\n' +
          '    anotherTopic:\n' +
          '      Type: \'AWS::SNS::Topic\'\n',

          'A resource with logical ID monitoringAlerts already exists',
          'UpdateConflictError'
        )

        expect(() => versioning(fs).validateServiceDefinition('target-project'))
          .to.not.throw()
      })
    })

    describe('functionAssetFiles', () => {
      it('generates a correct list for v0.0.0', () => {
        const fs = fsSpies()

        expect(versioning(fs).functionAssetFiles('0.0.0'))
          .to.deep.equal([
            'handler.js',
            'package.json',
            'serverless.yml',
          ])
      })
    })

    describe('checkForServiceFiles', () => {
      it('looks for version 0.0.0 files', () => {
        const fs = fsSpies()
        fs.existsSync.withArgs('target-project/.slsart').returns(false)
        fs.existsSync.withArgs('target-project/handler.js').returns(true)
        fs.existsSync.withArgs('target-project/package.json').returns(true)
        fs.existsSync.withArgs('target-project/serverless.yml').returns(true)

        expect(() => versioning(fs).checkForServiceFiles('target-project'))
          .to.not.throw()
      })

      it('throws if one of the files is missing', () => {
        const fs = fsSpies()
        fs.existsSync.withArgs('target-project/.slsart').returns(false)
        fs.existsSync.withArgs('target-project/handler.js').returns(false)
        fs.existsSync.withArgs('target-project/package.json').returns(true)
        fs.existsSync.withArgs('target-project/serverless.yml').returns(true)

        expect(() => versioning(fs).checkForServiceFiles('target-project'))
          .to.throw(/handler\.js/)
      })

      it('lists all the files, if missing', () => {
        const fs = fsSpies()
        fs.existsSync.withArgs('target-project/.slsart').returns(false)
        fs.existsSync.withArgs('target-project/handler.js').returns(false)
        fs.existsSync.withArgs('target-project/package.json').returns(false)
        fs.existsSync.withArgs('target-project/serverless.yml').returns(false)

        expect(() => versioning(fs).checkForServiceFiles('target-project'))
          .to.throw(/target-project\/handler\.js, target-project\/package\.json, target-project\/serverless\.yml/)
      })
    })
  })
})
