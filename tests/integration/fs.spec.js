const {
  assert: {
    strictEqual, deepStrictEqual, ok,
  },
} = require('chai')
const { sep } = require('path')
const os = require('os')

const {
  pure: {
    mkdir,
    mkdirp,
    ls,
    listAbsolutePathsRecursively,
    cp,
    copyTofolder,
    copyAll,
    rm,
    rmdir,
    rmAny,
    rmrf,
  },
} = require('./fs')

const missing = value =>
  strictEqual(value, undefined)

const values = ([
  'directory',
  'err',
  'names',
  'sourcePath',
  'destination',
  'data',
  'result',
  'instanceId',
  'stdout',
  'stderr',
  'command',
  'options',
])
  .reduce(
    (result, key) => Object.assign({ [key]: { $: Symbol(key) } }, result),
    {}
  )

const deepStrictEqualTo = expected => value => deepStrictEqual(value, expected)

const isValue = valueName =>
  actual => deepStrictEqual(actual, values[valueName])

const mockedCallback = (expected, ...result) =>
  (...args) => {
    const callback = args.pop()
    deepStrictEqual(args, expected)
    callback(...result)
  }

// Takes an array of function calls where each call is in the form
//  [name, [args], returnValue]. Returns an object of mocks in the form
//  { functionName: () => {...}, ... }.
const sequence = (functions) => {
  const expected = [...functions]
  const mock = name =>
    (...args) => {
      ok(expected.length, `mock ${name} called after end of sequence`)
      const [expectedName, expectedArgs, returnValue] = expected.shift()
      deepStrictEqual([name, args], [expectedName, expectedArgs || []])
      return returnValue
    }
  return functions.reduce(
    (mocks, [name]) => (mocks[name]
      ? mocks
      : Object.assign({},
        mocks,
        { [name]: mock(name) })),
    {}
  )
}

describe('./tests/integration/deployToTemp', () => {
  describe('#mkdir', () => {
    const mkdirOk = mockedCallback([values.directory])
    const mkdirFail =
      mockedCallback([values.directory], values.err)
    it('should resolve empty on success', () =>
      mkdir(mkdirOk)(values.directory)
        .then(missing))
    it('should resolve with the error on fail', () =>
      mkdir(mkdirFail)(values.directory)
        .then(err => deepStrictEqual(err, values.err)))
  })

  describe('#mkdirp', () => {
    const rootPath = os.type() === 'Windows_NT'
      ? `c:${sep}`
      : sep
    const mkdirpWithMockSequence = (directory, mockSequence) => {
      const mocks = sequence(mockSequence)
      return mkdirp(mocks.mkdir)(directory)
    }
    it('should create progressive paths and resolve', () =>
      mkdirpWithMockSequence(
        `${rootPath}foo${sep}bar`,
        [
          ['mkdir', [`${rootPath}foo`], Promise.resolve()],
          ['mkdir', [`${rootPath}foo${sep}bar`], Promise.resolve()],
        ]).then(missing))
    it('should resolve despite errors', () =>
      mkdirpWithMockSequence(
        `${rootPath}foo${sep}bar`,
        [
          ['mkdir', [`${rootPath}foo`], Promise.resolve(values.err)],
          ['mkdir', [`${rootPath}foo${sep}bar`], Promise.resolve()],
        ]).then(missing))
    it('should resolve the final error', () =>
      mkdirpWithMockSequence(
        `${rootPath}foo${sep}bar`,
        [
          ['mkdir', [`${rootPath}foo`], Promise.resolve()],
          ['mkdir', [`${rootPath}foo${sep}bar`], Promise.resolve(values.err)],
        ]).then(isValue('err')))
  })

  describe('#ls', () => {
    const readdirOk = mockedCallback([values.directory], undefined, values.names)
    const readdirFail = mockedCallback([values.directory], values.err)
    it('should resolve names on success', () =>
      ls(readdirOk)(values.directory).then(isValue('names')))
    it('should resolve empty array on fail', () =>
      ls(readdirFail)(values.directory)
        .then(names => deepStrictEqual(names, [])))
  })

  describe('#listAbsolutePathsRecursively', () => {
    const mockLs = fileSystem =>
      (basePath) => {
        const dir = basePath.split(sep).reduce(
          (fileSystemPart, pathPart) => fileSystemPart[pathPart],
          fileSystem
        )
        return Promise.resolve(Object.keys(dir))
      }
    const rootPath = 'foo'
    const assertPathsListedRecursively = (fileSystem, expected) => {
      const rootedFileSystem = { [rootPath]: fileSystem }
      return listAbsolutePathsRecursively(mockLs(rootedFileSystem))(rootPath)
        .then(paths => [...paths].sort())
        .then(deepStrictEqualTo([...expected].sort()))
    }
    it('resolves to only the root path when no sub-files exist', () =>
      assertPathsListedRecursively({}, [rootPath]))
    it('resolves to the root path and nested child paths', () =>
      assertPathsListedRecursively(
        {
          l1a: {
            l2a: {},
            l2b: {},
          },
          l2a: {},
        },
        [
          rootPath,
          [rootPath, 'l1a'].join(sep),
          [rootPath, 'l1a', 'l2a'].join(sep),
          [rootPath, 'l1a', 'l2b'].join(sep),
          [rootPath, 'l2a'].join(sep),
        ]
      ))
  })

  describe('#cp', () => {
    const copyFileOk = mockedCallback([values.source, values.destination])
    const copyFileFail =
      mockedCallback([values.source, values.destination], values.err)
    it('should resolve empty on success', () =>
      cp(copyFileOk)(values.destination)(values.source)
        .then(missing))
    it('should resolve with the error on fail', () =>
      cp(copyFileFail)(values.destination)(values.source)
        .then(err => deepStrictEqual(err, values.err)))
  })

  describe('#copyTofolder', () => {
    const filePath = `foo${sep}first.js`
    const destination = 'bar'
    const expectedCpArgs = [`bar${sep}first.js`, filePath]
    const cpOk = destinationFile =>
      sourceFile =>
        deepStrictEqual([destinationFile, sourceFile], expectedCpArgs) ||
          Promise.resolve()
    it('should copy a source file to the destination folder', () =>
      copyTofolder(cpOk)(destination)(filePath)
        .then(missing)
    )
  })

  describe('#copyAll', () => {
    const destination = 'bar'
    const sourceFiles = [`foo${sep}first.js`, `foo${sep}second.js`]
    const expectedSourceFiles = [...sourceFiles]
    const copyTofolderOk = directory =>
      strictEqual(directory, destination) || (actual =>
        strictEqual(actual, expectedSourceFiles.shift()) || Promise.resolve())
    it('should copy all source files to the destination directory', () =>
      copyAll(copyTofolderOk)(destination)(sourceFiles)
        .then(() => strictEqual(expectedSourceFiles.length, 0))
        .then(missing))
  })

  describe('#rm', () => {
    const unlinkOk = mockedCallback([values.directory])
    const unlinkFail =
      mockedCallback([values.directory], values.err)
    it('should resolve empty on success', () =>
      rm(unlinkOk)(values.directory)
        .then(missing))
    it('should resolve with the error on fail', () =>
      rm(unlinkFail)(values.directory)
        .then(err => deepStrictEqual(err, values.err)))
  })

  describe('#rmdir', () => {
    const rmdirOk = mockedCallback([values.directory])
    const rmdirFail =
      mockedCallback([values.directory], values.err)
    it('should resolve empty on success', () =>
      rmdir(rmdirOk)(values.directory)
        .then(missing))
    it('should resolve with the error on fail', () =>
      rmdir(rmdirFail)(values.directory)
        .then(err => deepStrictEqual(err, values.err)))
  })

  describe('#rmAny', () => {
    const givenDirectoryResolve = returnValue =>
      arg =>
        strictEqual(arg, values.directory) || Promise.resolve(returnValue)
    const rmOk = givenDirectoryResolve(false)
    const rmdirOk = givenDirectoryResolve(false)
    const rmFail = givenDirectoryResolve(values.err)
    const rmdirFail = givenDirectoryResolve(values.err)
    it('should resolve removing file', () =>
      rmAny(rmOk, rmdirFail)(values.directory)
        .then(value => value === false))
    it('should resolve removing directory', () =>
      rmAny(rmFail, rmdirOk)(values.directory)
        .then(value => value === false))
    it('should resolve to error when remove file and directory fail', () =>
      rmAny(rmFail, rmdirFail)(values.directory)
        .then(isValue('err')))
  })

  describe('#rmrf', () => {
    const files = ['foo', 'bar']
    const listAllOk = directory =>
      isValue('directory')(directory) || Promise.resolve(files)
    const rmAnyOk = path => Promise.resolve(path)
    it('should remove all listed files and directories', () =>
      rmrf(listAllOk, rmAnyOk)(values.directory)
        .then(removed => [...removed].sort())
        .then(deepStrictEqualTo([...files, values.directory].sort())))
  })
})
