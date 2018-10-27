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
