const BbPromise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const fs = BbPromise.promisifyAll(require('fs'))
const os = require('os')
const path = require('path')

BbPromise.longStackTraces()
chai.use(chaiAsPromised)

const { expect } = chai

const slsart = require('../../lib/index')
const npm = require('../../lib/npm')

describe('./lib/npm.js:exports', function npmExports() { // eslint-disable-line prefer-arrow-callback
  describe('#install', function exportsConfigure() { // eslint-disable-line prefer-arrow-callback
    const { cwd } = process
    const replaceCwd = (dirToReplace) => {
      process.cwd = () => dirToReplace
    }
    const restoreCwd = () => {
      process.cwd = cwd
    }
    const tmpdir = path.join(os.tmpdir(), path.join('serverlessArtilleryLibNpm'))
    const rmdir = (dir) => {
      fs.readdirSync(dir).forEach((file) => {
        const curPath = path.join(dir, file)
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          rmdir(curPath)
        } else { // delete file
          fs.unlinkSync(curPath)
        }
      })
      fs.rmdirSync(dir)
    }
    it('installs project dependencies and not dev dependencies',
      function createUniqueArtifacts() { // eslint-ignore-line prefer-arrow-callback
        const options = { debug: true, trace: true }
        this.timeout(60000)
        return fs.mkdirAsync(tmpdir)
          .then(() => {
            replaceCwd(tmpdir)
            return slsart.configure(options)
          })
          .then(() => {
            slsart.constants.ServerlessDirectories.forEach((dir) => {
              npm.install(options, path.join(tmpdir, dir), 'aws-sdk') // given that it is skipped as "already present in lambda"
            })
            require(path.join(tmpdir, 'aws', 'handler.js')) // eslint-disable-line global-require, import/no-dynamic-require
          })
          .then(() => {
            let dependencyChecks = []
            slsart.constants.ServerlessDirectories.forEach((dir) => {
              const packageJson = require(path.join(tmpdir, dir, 'package.json')) // eslint-disable-line global-require, import/no-dynamic-require
              if (packageJson.dependencies) {
                dependencyChecks = dependencyChecks.concat(
                  Object.keys(packageJson.dependencies)
                    .map(dependency => fs.accessAsync(path.join(tmpdir, dir, 'node_modules', dependency))
                      .then((err) => {
                        expect(err).to.be.undefined
                      })))
              }
              if (packageJson.devDependencies) {
                dependencyChecks = dependencyChecks.concat(
                  Object.keys(packageJson.devDependencies)
                    .map(devDependency => fs.accessAsync(path.join(tmpdir, dir, 'node_modules', devDependency))
                      .then((err) => {
                        expect(err).to.be.an('object')
                        expect(err).to.have.a.property('code')
                        expect(err.code).to.eql('ENOENT')
                      })))
              }
            })
            return BbPromise.all(dependencyChecks)
          })
          .finally(() => {
            rmdir(tmpdir)
            restoreCwd()
          })
      } // eslint-disable-line comma-dangle
    )
  })
})
