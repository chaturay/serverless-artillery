const curry = (fn, arity) =>
  (arity > -1
    ? (...args) =>
      (args.length >= arity
        ? fn(...args)
        : curry(fn.bind(null, ...args), arity - args.length))
    : curry(fn, fn.length))

const memoize = (fn, arity) => {
  const cache = {}
  const serialize = value =>
    (typeof value === 'function'
      ? value.toString()
      : JSON.stringify(value))
  return curry(
    (...args) =>
      (key => (cache.hasOwnProperty(key)
        ? cache[key]
        : (cache[key] = fn(...args))))(serialize(args)),
    arity || fn.length
  )
}

module.exports = {
  curry,
  memoize,
}
