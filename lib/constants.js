const path = require('path')

module.exports = {
  CompatibleServerlessSemver: '^1.0.3',
  DefaultScriptName: 'script.yml',
  ServerlessFile: 'serverless.yml', // duplicated below but mentioned here for consistent use
  ServerlessDirectories: [
    'aws-alert', // !!! WARNING: These are in DEPENDENCY ORDER!!!
    'aws-func', // !!! This is depended upon in `~/lib/index.js` (configure function), `~/postinstall.js`, and `~/tests/lib/npm.spec.js` !!!
    'task-artillery',
    'serverless-star',
    'aws',
  ],
  ServerlessFiles: [
    ...['handler.js', 'package.json', 'serverless.yml']
      .map(file => path.join('aws', file)),
    ...['index.js', 'package.json']
      .map(file => path.join('aws-alert', file)),
    ...['define.js', 'index.js', 'invoke.js', 'handle.js', 'package.json', 'valid.js']
      .map(file => path.join('aws-func', file)),
    ...['handler.js', 'package.json']
      .map(file => path.join('serverless-star', file)),
    ...['define.js', 'execute.js', 'index.js', 'package.json', 'plan.js', 'result.js', 'valid.js']
      .map(file => path.join('task-artillery', file)),
  ],
  TestFunctionName: 'loadGenerator',
  ScheduleName: '${self:service}-${opt:stage, self:provider.stage}-monitoring', // eslint-disable-line no-template-curly-in-string
  AlertingName: 'monitoringAlerts',
}
