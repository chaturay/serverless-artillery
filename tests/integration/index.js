const {
  deployNewTestResources,
  cleanupDeployments,
} = require('./tests/integration/deployToTemp')

const runTests = ({ testUrl, listUrl, deleteUrl }) => {
  // your logic here
}

deployNewTestResources()
  .then(runTests)
  .then(cleanupDeployments)
