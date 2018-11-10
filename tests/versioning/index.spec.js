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
  readdirSync: sinon.stub(),
})

describe('versioning module', () => {
  describe('implementation', () => {
    describe('readAssetsVersion', () => {
      it('checks for .slsart file', () => {
        const fs = fsSpies()

        versioning(fs)('target-project').readAssetsVersion()

        expect(fs.existsSync.calledOnce).to.be.true
        expect(fs.existsSync.firstCall.args[0]).to.equal('target-project/.slsart')
      })

      it('reads version from .slsart file, if found', () => {
        const fs = fsSpies()
        fs.existsSync.returns(true)
        fs.readFileSync.returns('version: 1.2.3')

        const versionRead = versioning(fs)('target-project').readAssetsVersion()

        expect(fs.existsSync.calledOnce).to.be.true
        expect(fs.existsSync.firstCall.args[0]).to.equal('target-project/.slsart')
        expect(versionRead).to.equal('1.2.3')
      })

      it('returns 0.0.0 if no .slsart file found', () => {
        const fs = fsSpies()
        fs.existsSync.returns(false)

        const versionRead = versioning(fs)('target-project').readAssetsVersion()

        expect(fs.existsSync.calledOnce).to.be.true
        expect(fs.existsSync.firstCall.args[0]).to.equal('target-project/.slsart')
        expect(versionRead).to.equal('0.0.0')
      })
    })

    describe('checkForProjectDependencies', () => {
      it('reads form the package.json', () => {
        const fs = fsSpies()
        fs.existsSync.withArgs('target-project/.slsart').returns(false)
        fs.readFileSync.withArgs('target-project/package.json').returns('{}')

        expect(versioning(fs)('target-project').checkForProjectDependencies({}))
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

        expect(() => versioning(fs)('target-project').checkForProjectDependencies({
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

        expect(() => versioning(fs)('target-project').checkForProjectDependencies({
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

        expect(() => versioning(fs)('target-project').checkForProjectDependencies({
          'some-package': '^1.0',
          'another-package': '2.0.4',
        })).to.throw('Invalid package.json dependency package version found:\n' +
          '\tsome-package expected ^1.0 found ^2.0\n' +
          '\tanother-package expected 2.0.4 found 9.9.9')
      })
    })

    describe('validate minimum viable service', () => {
      describe('check that all required service files are present in the project directory', () => {
        it('looks for the files based on the file manifest', () => {
          const fs = fsSpies()

          fs.existsSync.withArgs('target-project/one.js').returns(true)
          fs.existsSync.withArgs('target-project/two.yml').returns(true)
          fs.existsSync.withArgs('target-project/three.json').returns(true)

          expect(() => versioning(fs)('target-project').checkForServiceFiles([
            'one.js',
            'two.yml',
            'three.json',
          ])).not.to.throw()

          expect(fs.existsSync.calledThrice).to.be.true
          expect(fs.existsSync.firstCall.args[0]).to.equal('target-project/one.js')
          expect(fs.existsSync.secondCall.args[0]).to.equal('target-project/two.yml')
          expect(fs.existsSync.thirdCall.args[0]).to.equal('target-project/three.json')
        })

        it('throws if any file is missing', () => {
          const fs = fsSpies()

          fs.existsSync.withArgs('target-project/one.js').returns(true)
          fs.existsSync.withArgs('target-project/two.yml').returns(true)
          fs.existsSync.withArgs('target-project/three.json').returns(false)

          expect(() => versioning(fs)('target-project').checkForServiceFiles([
            'one.js',
            'two.yml',
            'three.json',
          ])).to.throw('Missing asset files: target-project/three.json')

          expect(fs.existsSync.calledThrice).to.be.true
          expect(fs.existsSync.firstCall.args[0]).to.equal('target-project/one.js')
          expect(fs.existsSync.secondCall.args[0]).to.equal('target-project/two.yml')
          expect(fs.existsSync.thirdCall.args[0]).to.equal('target-project/three.json')
        })

        it('provides a complete list of missing files', () => {
          const fs = fsSpies()

          fs.existsSync.withArgs('target-project/one.js').returns(true)
          fs.existsSync.withArgs('target-project/two.yml').returns(false)
          fs.existsSync.withArgs('target-project/three.json').returns(false)

          expect(() => versioning(fs)('target-project').checkForServiceFiles([
            'one.js',
            'two.yml',
            'three.json',
          ])).to.throw('Missing asset files: target-project/two.yml, target-project/three.json')

          expect(fs.existsSync.calledThrice).to.be.true
          expect(fs.existsSync.firstCall.args[0]).to.equal('target-project/one.js')
          expect(fs.existsSync.secondCall.args[0]).to.equal('target-project/two.yml')
          expect(fs.existsSync.thirdCall.args[0]).to.equal('target-project/three.json')
        })
      })

      describe('checks the package.json dependencies', () => {
        it('reads from the package.json', () => {
          const fs = fsSpies()

          const existingDependencies = {
            'package-one': 'v0.0.0',
            'package-two': 'v1.1.1',
          }

          const packageJson = JSON.stringify({ dependencies: existingDependencies })

          fs.readFileSync.withArgs('target-project/package.json').returns(packageJson)

          expect(() => versioning(fs)('target-project').checkForProjectDependencies(existingDependencies))
            .not.to.throw()

          expect(fs.readFileSync.calledOnce).to.be.true
          expect(fs.readFileSync.firstCall.args[0]).to.equal('target-project/package.json')
        })

        it('throws if a dependency is missing', () => {
          const fs = fsSpies()

          const existingDependencies = {
            'package-two': 'v1.1.1',
          }

          const packageJson = JSON.stringify({ dependencies: existingDependencies })

          fs.readFileSync.withArgs('target-project/package.json').returns(packageJson)

          expect(() => versioning(fs)('target-project').checkForProjectDependencies({
            'package-one': 'v0.0.0',
            'package-two': 'v1.1.1',
          })).to.throw('Missing package.json dependency: package-one')

          expect(fs.readFileSync.calledOnce).to.be.true
          expect(fs.readFileSync.firstCall.args[0]).to.equal('target-project/package.json')
        })

        it('provides a complete list of missing dependencies', () => {
          const fs = fsSpies()

          const existingDependencies = {}
          const packageJson = JSON.stringify({ dependencies: existingDependencies })

          fs.readFileSync.withArgs('target-project/package.json').returns(packageJson)

          expect(() => versioning(fs)('target-project').checkForProjectDependencies({
            'package-one': 'v0.0.0',
            'package-two': 'v1.1.1',
          })).to.throw('Missing package.json dependency: package-one, package-two')

          expect(fs.readFileSync.calledOnce).to.be.true
          expect(fs.readFileSync.firstCall.args[0]).to.equal('target-project/package.json')
        })

        it('throws if a dependency is wrong version', () => {
          const fs = fsSpies()

          const existingDependencies = {
            'package-one': 'v0.0.1',
            'package-two': 'v1.1.1',
          }

          const packageJson = JSON.stringify({ dependencies: existingDependencies })

          fs.readFileSync.withArgs('target-project/package.json').returns(packageJson)

          expect(() => versioning(fs)('target-project').checkForProjectDependencies({
            'package-one': 'v0.0.0',
            'package-two': 'v1.1.1',
          })).to.throw(`Invalid package.json dependency package version found:
	package-one expected v0.0.0 found v0.0.1`) // eslint-disable-line no-tabs

          expect(fs.readFileSync.calledOnce).to.be.true
          expect(fs.readFileSync.firstCall.args[0]).to.equal('target-project/package.json')
        })

        it('provides a complete list of mismatched versions', () => {
          const fs = fsSpies()

          const existingDependencies = {
            'package-one': 'v0.0.1',
            'package-two': 'v2.2.2',
          }

          const packageJson = JSON.stringify({ dependencies: existingDependencies })

          fs.readFileSync.withArgs('target-project/package.json').returns(packageJson)

          /* eslint-disable */
          expect(() => versioning(fs)('target-project').checkForProjectDependencies({
            'package-one': 'v0.0.0',
            'package-two': 'v1.1.1',
          })).to.throw(`Invalid package.json dependency package version found:
	package-one expected v0.0.0 found v0.0.1
	package-two expected v1.1.1 found v2.2.2
`)
          /* eslint-enable */

          expect(fs.readFileSync.calledOnce).to.be.true
          expect(fs.readFileSync.firstCall.args[0]).to.equal('target-project/package.json')
        })
      })

      describe('checks the service definition for minimum requirements', () => {
        it('uses a JSON schema to check the service definition', () => {
          expect(() => versioning()('target-project').checkForMinimumRequirements({
            required: ['something'],
            type: 'object',
          }, {
            something: 'value',
          })).not.to.throw()
        })

        it('can identify missing values', () => {
          expect(() => versioning()('target-project').checkForMinimumRequirements({
            required: ['something'],
            type: 'object',
          }, {})).to.throw('data should have required property \'.something\'')
        })

        it('can identify incorrect types', () => {
          expect(() => versioning()('target-project').checkForMinimumRequirements({
            required: ['something'],
            type: 'object',
          }, '')).to.throw('data should be object')
        })
      })

      describe('checks the service definition for conflicts', () => {
        it('uses a JSON schema to check the service definition', () => {
          expect(() => versioning()('target-project').checkForConflicts({
            required: ['something'],
            type: 'object',
          }, {
            something: 'value',
          })).not.to.throw()
        })

        it('can prevent the use of a property value', () => {
          expect(() => versioning()('target-project').checkForConflicts({
            properties: {
              cantBeFoo: {
                type: 'string',
                pattern: '^(?!foo).*',
              },
            },
          }, {
            cantBeFoo: 'foo',
          })).to.throw('data.cantBeFoo should match pattern "^(?!foo).*"')
        })

        it('can prevent the use of a property name', () => {
          expect(() => versioning()('target-project').checkForConflicts({
            propertyNames: {
              pattern: '^(?!foo).*',
            },
          }, {
            foo: 'any value',
          })).to.throw('data should match pattern "^(?!foo).*", data property name \'foo\' is invalid')
        })
      })
    })
  })
})
