const pipe = (initialValue, steps) =>
  steps.reduce((value, step) => (step
    ? value && value.then
      ? value.then(step)
      : step(value)
    : value), initialValue)

const tap = sideEffect =>
  value => pipe(value, [sideEffect, () => value])

const tapif = condition =>
  (condition ? tap : () => value => value)

const map = mapper =>
  iterable => iterable.map(mapper)

const freeze = obj => (obj
  ? Array.isArray(obj)
    ? pipe(obj, [
      Object.freeze,
      tap(frozen => frozen.forEach(freeze)),
    ])
    : (typeof obj === 'object') && !(obj instanceof Date)
      ? pipe(obj, [
        Object.freeze,
        tap(value => Object.keys(value).map(key => freeze(value[key]))),
      ])
      : obj
  : obj)

module.exports = {
  pipe, tap, map, freeze, tapif,
}
