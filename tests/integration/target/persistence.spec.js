const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)

const { assert } = chai

const persistance = require('./persistence')

describe('./tests/integration/target/persistence', () => {
  const logGroupName = '/this/is/the/log/group'
  const path = 'this/is/a/test'

  describe('#recordRequest', () => {
    it('writes a request', () =>
      persistance({},
        message => assert.equal(message, `REQUEST ${path}`, 'must log request path')
      ).recordRequest(path)
    )
  })

  describe('#getRequests', () => {
    const message = `2018-07-17T18:39:15.973Z\tb065119e-89f0-11e8-9622-99e8e46d8b8b\tREQUEST ${path}\n`

    const items = [
      { path, timestamp: 100 },
      { path, timestamp: 500 },
    ]
    const items2 = [
      { path, timestamp: 100 },
      { path, timestamp: 500 },
      { path, timestamp: 1000 },
      { path, timestamp: 1500 },
    ]
    const logEvents = [
      { message, timestamp: 100 },
      { message, timestamp: 500 },
    ]
    const logEvents2 = [
      { message, timestamp: 1000 },
      { message, timestamp: 1500 },
    ]

    it('reads requests within a range', () =>
      persistance(logGroupName, {
        // Mock of CloudWatchLogs filterLogEvents to validate parameters and return results
        filterLogEvents: (params) => {
          assert.equal(params.logGroupName, logGroupName, 'correct log group is queried')
          assert.equal(params.filterPattern, `REQUEST ${path}`, 'uses path to find requests')

          return { promise: () => Promise.resolve({ events: logEvents }) }
        },
      }).getRequests(path)
        .then(result => assert.equal(result, JSON.stringify(items), 'returns records found'))
    )

    it('paginates query to retrieve all requests', () =>
      persistance(logGroupName, {
        // Mock of CloudWatchLogs filterLogEvents to validate parameters and return results
        filterLogEvents: params => ({
          promise: () => {
            const nextToken = 'this-is-a-token'
            if (!params.nextToken) {
              return Promise.resolve({ events: logEvents, nextToken })
            } else {
              assert.equal(params.nextToken, nextToken, 'uses the last key')
              return Promise.resolve({ events: logEvents2 })
            }
          },
        }),
      }).getRequests(path)
        .then(result => assert.equal(result, JSON.stringify(items2), 'returns records found'))
    )
  })
})
