const express = require('express')

const app = express()

const stats = () => {
  let requests = {}

  return {
    reset: () => { requests = {} },
    requests: () => requests,
    totals: () => {
      const totals = {}
      Object.keys(requests)
        .forEach((time) => {
          requests[time].forEach((sample) => {
            totals[sample] = totals[sample] ?
              totals[sample] + 1 : 1
          })
        })
      return totals
    },
    count: (req) => {
      const sample = req.path
      const time = Math.floor(Date.now() / 1000) // One second buckets
      requests[time] = requests[time] ?
        requests[time].concat(sample) : [sample]
    },
  }
}

const theStats = stats()

app.get('/reset', (req, res) => {
  console.log('resetting stats')
  theStats.reset()
  res.send(`RESET @ ${Date.now()}`)
})

app.get('/requests', (req, res) => {
  console.log('reporting requests')
  res
    .type('application/json')
    .send(JSON.stringify(theStats.requests()))
})

app.get('/totals', (req, res) => {
  console.log('reporting totals')
  res
    .type('application/json')
    .send(JSON.stringify(theStats.totals()))
})

app.get('/', (req, res) => {
  console.log(`waiting for ${process.env.WAIT} ms`)
  res
    .type('application/json')
    .send(JSON.stringify({})
})

app.all('/*', (req, res) => {
  console.log(req.path)
  theStats.count(req)
  res.send(`OK - ${req.path}`)
})

module.exports = app
