const {
  assert: {
    strictEqual,
    deepStrictEqual,
    fail,
    ok,
  },
} = require('chai')
const { sep } = require('path')

const {
  impl: {
    findTargetSourceFiles,
    stageTarget,
    execAsync,
    deploy,
    tempLocation,
    remove,
    listTempDeployments,
    cleanupDeployments,
  },
} = require('./deployToTemp')

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
      deepStrictEqual(
        [name, args],
        [expectedName, expectedArgs || []],
        `expected ${expectedName}(${expectedArgs}); got ${name}(${args})`
      )
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
  describe('#findTargetSourceFiles', () => {
    const sourcePath = 'foo'
    const names = ['bar.js', 'bar.spec.js']
    const expected = [`foo${sep}bar.js`]
    const lsOk = path => Promise.resolve(path === sourcePath ? names : [])
    it('should resolve to target source file full paths', () =>
      findTargetSourceFiles(lsOk, sourcePath)()
        .then(fullPaths => deepStrictEqual(fullPaths, expected)))
  })

  describe('#stageTarget', () => {
    const sourceFiles = ['foo/first.js', 'foo/second.js']
    const findTargetSourceFilesOk = () => Promise.resolve(sourceFiles)
    const copyAllOk = destination =>
      files =>
        deepStrictEqual([destination, files], [values.destination, sourceFiles])
        || Promise.resolve(values.result)
    const writeConfigOk = (destination, instanceId) =>
      previous =>
        deepStrictEqual(
          [previous, destination, instanceId],
          [values.result, values.destination, values.instanceId]
        ) || Promise.resolve()
    const writeConfigFail = () =>
      () => Promise.reject(values.err)
    const stageTargetOk =
      stageTarget(findTargetSourceFilesOk, copyAllOk, writeConfigOk)
    const stageTargetFail =
      stageTarget(findTargetSourceFilesOk, copyAllOk, writeConfigFail)
    it('should copy all source files and write config', () =>
      stageTargetOk(values.destination, values.instanceId))
    it('should reject on failure to write config', () =>
      stageTargetFail(values.destination, values.instanceId)
        .then(() => fail('should reject'), isValue('err')))
  })

  describe('#execAsync', () => {
    const execOk = mockedCallback(
      [values.command, values.options],
      undefined, values.stdout
    )
    const error = new Error('reasons')
    const stderr = 'more reasons'
    const execFail = mockedCallback(
      [values.command, values.options],
      error, undefined, stderr
    )
    const execArgs = [values.command, values.options]
    it('should resolve to stdout', () =>
      execAsync(execOk)(...execArgs)
        .then(isValue('stdout')))
    it('should reject on fail', () =>
      execAsync(execFail)(...execArgs)
        .then(
          () => fail('should reject'),
          err => strictEqual(err.message, 'reasons more reasons')
        ))
  })

  describe('#deploy', () => {
    const execAsyncOk = (...args) =>
      deepStrictEqual(args, ['sls deploy', { cwd: values.directory }]) ||
        Promise.resolve()
    const error = new Error()
    const execAsyncFail = () => Promise.reject(error)
    it('should sls deploy in the given directory', () =>
      deploy(execAsyncOk)(values.directory))
    it('should pass through exec rejection', () =>
      deploy(execAsyncFail)()
        .then(() => fail('should reject'), err => strictEqual(err, error)))
  })

  describe('#tempLocation', () => {
    const instanceId = '123'
    const root = 'abc'
    const destination = `abc${sep}123`
    const randomInstanceId = '456'
    const random = () => randomInstanceId
    const randomDestination = `abc${sep}456`
    it('should join the root path and the random instance id', () =>
      deepStrictEqual(
        tempLocation(random, root)(),
        { instanceId: randomInstanceId, destination: randomDestination }
      ))
    it('should join the root path and the supplied instance id', () =>
      deepStrictEqual(
        tempLocation(random, root)(instanceId),
        { instanceId, destination }
      ))
  })

  describe('#remove', () => {
    const execAsyncOk = (...args) =>
      deepStrictEqual(args, ['sls remove', { cwd: values.directory }]) ||
        Promise.resolve()
    const error = new Error()
    const execAsyncFail = () => Promise.reject(error)
    it('should sls deploy in the given directory', () =>
      remove(execAsyncOk)(values.directory))
    it('should pass through exec rejection', () =>
      remove(execAsyncFail)()
        .then(() => fail('should reject'), err => strictEqual(err, error)))
  })

  describe('#listTempDeployments', () => {
    const root = 'foo'
    const directories = ['first', 'second']
    const lsOk = directory =>
      strictEqual(directory, root) || Promise.resolve(directories)
    it('should list all directories in the root path', () =>
      listTempDeployments(lsOk)(root)
        .then(deepStrictEqualTo([`foo${sep}first`, `foo${sep}second`])))
  })

  describe('#cleanupDeployments', () => {
    const root = 'temp'
    const cleanupDeploymentsWithMockSequence = (mockSequence) => {
      const mocks = sequence(mockSequence)
      return cleanupDeployments(
        mocks.list,
        mocks.remove,
        mocks.log,
        root
      )()
    }
    const directories = ['foo', 'bar']
    it('should resolve after logging, listing and removing each deployment', () =>
      cleanupDeploymentsWithMockSequence([
        ['log', ['cleaning up deployments in', root]],
        ['list', [root], Promise.resolve(directories)],
        ['remove', ['foo'], Promise.resolve()],
        ['remove', ['bar'], Promise.resolve()],
      ]))
  })
})
