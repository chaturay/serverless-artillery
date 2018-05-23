const idioms = require('./idioms')

const expectation = {
  c: 'd',
  e: {
    f: {
      g: {
        h: 'i',
      },
    },
  },
}

const result = {
  a: 'b',
  c: 'd',
  e: {
    f: {
      g: {
        h: 'i',
      },
    },
  },
}

try {
  idioms.expect(expectation)(result)
} catch (ex) {
  console.log(ex.stack)
}
