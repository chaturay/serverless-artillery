const assert = require('assert')
const {
  pipe, tap, map, freeze, tapif, pipeif,
} = require('../../lib/fp')

/* eslint-disable no-return-assign */
/* eslint-disable no-param-reassign */

describe('lib/fp', () => {
  describe('freeze', () => {
    it('should freeze an object', () => {
      pipe(freeze({}), [
        tap(frozen => (frozen.prop = true) || false), // eslint-disable-line no-param-reassign
        tap(frozen => assert(!frozen.prop)),
      ])
    })

    it('should freeze an array', () =>
      assert.throws(() => freeze([10, 20]).push(1)))

    it('should freeze nested members of complex object', () =>
      pipe(freeze({
        foo: {}, bar: [1], baz: 23, biz: new Date(),
      }), [
        tap(frozen => (frozen.foo.prop = true)), // eslint-disable-line no-param-reassign
        tap(frozen => assert(!frozen.foo.prop)),
        tap(frozen => assert.throws(() => frozen.bar.push(2))),
      ]))

    it('should freeze elements of array', () =>
      pipe(freeze([
        {}, [1], 23, new Date(),
      ]), [
        tap(frozen => frozen[0].prop = true),
        tap(frozen => assert(!frozen[0].prop)),
        tap(frozen => assert.throws(() => frozen[1].push(2))),
      ]))
  })

  describe('pipe', () => {
    it('should pipe', () =>
      assert.strictEqual(pipe(1, [n => n + 1, n => n.toString()]), '2'))

    it('should pipe with promises', () => pipe(1, [
      i => i + 1,
      i => Promise.resolve(i + 1),
      i => i + 1,
    ])
      .then(i => assert.strictEqual(i, 4)))
  })

  describe('tap', () => {
    it('should return the original value', () =>
      assert.strictEqual(tap(n => n.toString())(2), 2))

    it('should execute the side effect', () => {
      let mutatable = 2
      tap((n) => { mutatable = n })(3)
      assert(mutatable, 3)
    })
  })

  describe('pipeif', () => {
    it('should pipe to truepath if condition is true', () => {
      const actual =
        pipeif(value => value, [() => 'true'], [() => 'false'])(true)
      assert.strictEqual(actual, 'true')
    })

    it('should pipe to falsepath if condition is false', () => {
      const actual =
        pipeif(value => value, [() => 'true'], [() => 'false'])(false)
      assert.strictEqual(actual, 'false')
    })
  })

  describe('tapif', () => {
    const tapifExecutesSideEffect = (condition) => {
      let mutatable = 2
      tapif(condition)((n) => { mutatable = n })(3)
      return mutatable === 3
    }

    const truthyValues = [true, 1, 'foo', {}, [], () => {}]
    it('should execute the side effect when condition is truthy', () =>
      truthyValues
        .map(tapifExecutesSideEffect)
        .forEach(assert))

    const falsyValues = [undefined, null, false, 0, '']
    it('should not execute the side effect when condition is falsy', () =>
      falsyValues
        .map(tapifExecutesSideEffect)
        .forEach(hasSideEffect => assert(!hasSideEffect)))
  })

  describe('map', () => {
    it('should map to a new array', () => {
      const input = [10, 20]
      assert.notStrictEqual(map(n => n.toString())(input), input)
    })

    it('should map to an array with the correct values', () =>
      assert.deepStrictEqual(map(n => n.toString())([10, 20]), ['10', '20']))
  })
})

/* eslint-enable no-return-assign */
/* eslint-enable no-param-reassign */
