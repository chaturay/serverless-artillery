/* eslint-disable no-return-assign, no-nested-ternary */

const AWS = require('aws-sdk')

module.exports = (
  logGroupName,
  cloudWatchLogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28' }),
  log = console.log
) => ({
  recordRequest: path => log(`REQUEST ${path}`),
  getRequests: (path) => {
    const params = {
      logGroupName,
      filterPattern: `REQUEST ${path}`,
    }

    let allRequests = []

    const query = p => cloudWatchLogs.filterLogEvents(p).promise()
      .then((logEvents) => {
        const pathRequests = logEvents.events.map((event) => {
          const { timestamp } = event

          return {
            path,
            timestamp,
          }
        })

        allRequests = allRequests.concat(pathRequests)

        return logEvents
      })

    const queryAll = p => query(p)
      .then((logEvents) => {
        if (logEvents.nextToken !== undefined) {
          const updatedParams = Object.assign({}, p, { nextToken: logEvents.nextToken })
          return queryAll(updatedParams)
        } else {
          return JSON.stringify(allRequests)
        }
      })

    return queryAll(params)
  },
})
