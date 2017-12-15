const assert = require('assert')
const { stub } = require('sinon')
const configurator = require('../../lib/configurator')
const { freeze } = require('../../lib/fp')

const { serviceName, messages, serverlessFiles } = configurator
const randomValue = 'ABC123'

describe('lib/configurator', () => {
  describe('configure', () => {
    context('with successful file write and npm install', () => {
      const fileData = `file data ${serviceName} more file data`
      let sideEffects
      beforeEach(() => {
        sideEffects = freeze({
          logger: stub(),
          randomid: stub().returns(randomValue),
          writeFileIfNotExists: stub().returns(Promise.resolve(true)),
          readLocalFile: stub().returns(Promise.resolve(fileData)),
          deleteFile: stub().returns(Promise.resolve()),
          npmInstall: stub().returns(Promise.resolve()),
        })
        return configurator(sideEffects)()
      })

      const expectedLogs = [[messages.complete]]
      it('should log status messages', () =>
        assert.deepStrictEqual(sideEffects.logger.args, expectedLogs))

      const expectedFileData =
        `file data ${serviceName}-${randomValue} more file data`
      it('should write files', () => {
        const writeFileIfNotExists = sideEffects.writeFileIfNotExists
        serverlessFiles.map(file =>
          assert(writeFileIfNotExists.calledWith(file, expectedFileData)))
      })

      it('should NPM install', () =>
        assert.strictEqual(sideEffects.npmInstall.callCount, 1))
    })

    context('debug with successful file write and npm install', () => {
      const fileData = `file data ${serviceName} more file data`
      let sideEffects
      beforeEach(() => {
        sideEffects = freeze({
          logger: stub(),
          randomid: stub().returns(randomValue),
          writeFileIfNotExists: stub().returns(Promise.resolve(true)),
          readLocalFile: stub().returns(Promise.resolve(fileData)),
          deleteFile: stub().returns(Promise.resolve()),
          npmInstall: stub().returns(Promise.resolve()),
        })
        return configurator(sideEffects)({ debug: true })
      })

      const expectedLogs = [
        [messages.identifying],
        [messages.noConflict],
        [messages.npmInstall],
        [messages.complete],
      ]
      it('should log status and debug messages', () =>
        assert.deepStrictEqual(sideEffects.logger.args, expectedLogs))

      const expectedFileData =
        `file data ${serviceName}-${randomValue} more file data`
      it('should write files', () => {
        const writeFileIfNotExists = sideEffects.writeFileIfNotExists
        serverlessFiles.map(file =>
          assert(writeFileIfNotExists.calledWith(file, expectedFileData)))
      })

      it('should NPM install', () =>
        assert.strictEqual(sideEffects.npmInstall.callCount, 1))
    })

    context('with successful file write and failed npm install', () => {
      const fileData = `file data ${serviceName} more file data`
      let sideEffects
      beforeEach(() => {
        sideEffects = freeze({
          logger: stub(),
          randomid: stub().returns(randomValue),
          writeFileIfNotExists: stub().returns(Promise.resolve(true)),
          readLocalFile: stub().returns(Promise.resolve(fileData)),
          deleteFile: stub().returns(Promise.resolve()),
          npmInstall: stub().returns(Promise.reject(new Error('failed'))),
        })
        return configurator(sideEffects)()
      })

      const expectedLogs = [[messages.complete], [messages.npmInstallError]]
      it('should log status messages', () =>
        assert.deepStrictEqual(sideEffects.logger.args, expectedLogs))

      const expectedFileData =
        `file data ${serviceName}-${randomValue} more file data`
      it('should write files', () => {
        const writeFileIfNotExists = sideEffects.writeFileIfNotExists
        serverlessFiles.map(file =>
          assert(writeFileIfNotExists.calledWith(file, expectedFileData)))
      })

      it('should NPM install', () =>
        assert.strictEqual(sideEffects.npmInstall.callCount, 1))

      it('should clean up files', () => {
        const deleteFile = sideEffects.deleteFile
        serverlessFiles.forEach(file => assert(deleteFile.calledWith(file)))
      })
    })

    context('debug with successful file write and failed npm install', () => {
      const fileData = `file data ${serviceName} more file data`
      let sideEffects
      beforeEach(() => {
        sideEffects = freeze({
          logger: stub(),
          randomid: stub().returns(randomValue),
          writeFileIfNotExists: stub().returns(Promise.resolve(true)),
          readLocalFile: stub().returns(Promise.resolve(fileData)),
          deleteFile: stub().returns(Promise.resolve()),
          npmInstall: stub().returns(Promise.reject(new Error('failed'))),
        })
        return configurator(sideEffects)({ debug: true })
      })

      const expectedLogs = [
        [messages.identifying],
        [messages.noConflict],
        [messages.npmInstall],
        [messages.complete],
        [messages.npmInstallError],
      ]
      it('should log status and debug messages', () =>
        assert.deepStrictEqual(sideEffects.logger.args, expectedLogs))

      const expectedFileData =
        `file data ${serviceName}-${randomValue} more file data`
      it('should write files', () => {
        const writeFileIfNotExists = sideEffects.writeFileIfNotExists
        serverlessFiles.map(file =>
          assert(writeFileIfNotExists.calledWith(file, expectedFileData)))
      })

      it('should NPM install', () =>
        assert.strictEqual(sideEffects.npmInstall.callCount, 1))

      it('should clean up files', () => {
        const deleteFile = sideEffects.deleteFile
        assert.strictEqual(deleteFile.callCount, serverlessFiles.length)
        serverlessFiles.forEach(file => assert(deleteFile.calledWith(file)))
      })
    })

    context('with file conflicts', () => {
      const fileData = `file data ${serviceName} more file data`
      const conflictFiles = [serverlessFiles[0]]
      const noConflictFiles = serverlessFiles.slice(1)
      let sideEffects
      beforeEach(() => {
        sideEffects = freeze({
          logger: stub(),
          randomid: stub().returns(randomValue),
          writeFileIfNotExists: stub().callsFake(name =>
            Promise.resolve(!conflictFiles.includes(name))),
          readLocalFile: stub().returns(Promise.resolve(fileData)),
          deleteFile: stub().returns(Promise.resolve()),
          npmInstall: stub().returns(Promise.resolve()),
        })
        return configurator(sideEffects)()
      })

      const expectedLogs = [[messages.conflictList(conflictFiles)]]
      it('should log status messages', () =>
        assert.deepStrictEqual(sideEffects.logger.args, expectedLogs))

      const expectedFileData =
        `file data ${serviceName}-${randomValue} more file data`
      it('should write files', () => {
        const writeFileIfNotExists = sideEffects.writeFileIfNotExists
        serverlessFiles.map(file =>
          assert(writeFileIfNotExists.calledWith(file, expectedFileData)))
      })

      it('should clean up no-conflict files', () => {
        const deleteFile = sideEffects.deleteFile
        assert.strictEqual(deleteFile.callCount, noConflictFiles.length)
        noConflictFiles.forEach(file => assert(deleteFile.calledWith(file)))
      })
    })

    context('debug with file conflicts', () => {
      const fileData = `file data ${serviceName} more file data`
      const conflictFiles = [serverlessFiles[0]]
      const noConflictFiles = serverlessFiles.slice(1)
      let sideEffects
      beforeEach(() => {
        sideEffects = freeze({
          logger: stub(),
          randomid: stub().returns(randomValue),
          writeFileIfNotExists: stub().callsFake(name =>
            Promise.resolve(!conflictFiles.includes(name))),
          readLocalFile: stub().returns(Promise.resolve(fileData)),
          deleteFile: stub().returns(Promise.resolve()),
          npmInstall: stub().returns(Promise.resolve()),
        })
        return configurator(sideEffects)({ debug: true })
      })

      const expectedLogs = [
        [messages.identifying],
        [messages.conflict],
        [messages.conflictList(conflictFiles)],
      ]
      it('should log status messages', () =>
        assert.deepStrictEqual(sideEffects.logger.args, expectedLogs))

      const expectedFileData =
        `file data ${serviceName}-${randomValue} more file data`
      it('should write files', () => {
        const writeFileIfNotExists = sideEffects.writeFileIfNotExists
        serverlessFiles.map(file =>
          assert(writeFileIfNotExists.calledWith(file, expectedFileData)))
      })

      it('should clean up no-conflict files', () => {
        const deleteFile = sideEffects.deleteFile
        assert.strictEqual(deleteFile.callCount, noConflictFiles.length)
        noConflictFiles.forEach(file => assert(deleteFile.calledWith(file)))
      })
    })
  })
})
