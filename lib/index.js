const aws = require('aws-sdk')
const BbPromise = require('bluebird')
const diff = require('diff')
const fs = BbPromise.promisifyAll(require('fs'))
const os = require('os')
const path = require('path')
const semver = require('semver')
const shortid = require('shortid')
const stdin = require('get-stdin')
const url = require('url')
const yaml = require('js-yaml')

const func = require('./lambda/func')
const task = require('./lambda/task')
const npm = require('./npm')
const Serverless = require('./serverless-fx')

const constants = {
  CompatibleServerlessSemver: '^1.0.3',
  DefaultScriptName: 'script.yml',
  ServerlessFile: 'serverless.yml', // duplicated below but mentioned here for consistent use
  ServerlessFiles: [
    'alert.js',
    'handler.js',
    'func.js', 'funcDef.js', 'funcExec.js', 'funcHandle.js', 'funcValid.js',
    'package.json', 'package-lock.json',
    'serverless.yml',
    'task.js', 'taskDef.js', 'taskExec.js', 'taskPlan.js', 'taskResult.js', 'taskValid.js',
  ],
  TestFunctionName: 'loadGenerator',
  ScheduleName: '${self:service}-${opt:stage, self:provider.stage}-monitoring', // eslint-disable-line no-template-curly-in-string
  AlertingName: 'monitoringAlerts',
  yamlComments: { // ## YAML comments placeholders and content ##
    mustMatchKey: '-MUST_MATCH',
    mustMatchRex: /-MUST_MATCH(.*)/g,
    mustMatchVal: ' # must match topic name',
    doNotEditKey: '-DO_NOT_EDIT',
    doNotEditRex: /-DO_NOT_EDIT(.*)/g,
    doNotEditVal: ' # !!Do not edit this name!!',
    snsSubscriptionsKey: '-SNS_SUBSCRIPTIONS',
    snsSubscriptionsRex: /-SNS_SUBSCRIPTIONS(.*)/g,
    snsSubscriptionsVal: `
#        Subscription: # docs at https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-sns-subscription.html
#          - Endpoint: http://<host>/<path> # the endpoint is an URL beginning with "http://"
#            Protocol: http
#          - Endpoint: https://<host>/<path> # the endpoint is a URL beginning with "https://"
#            Protocol: https
#          - Endpoint: <target>@<host> # the endpoint is an email address
#            Protocol: email
#          - Endpoint: <target>@<host> # the endpoint is an email address
#            Protocol: email-json
#          - Endpoint: <phone-number> # the endpoint is a phone number of an SMS-enabled device
#            Protocol: sms
#          - Endpoint: <sqs-queue-arn> # the endpoint is the ARN of an Amazon SQS queue
#            Protocol: sqs
#          - Endpoint: <endpoint-arn> # the endpoint is the EndpointArn of a mobile app and device.
#            Protocol: application
#          - Endpoint: <lambda-arn> # the endpoint is the ARN of an AWS Lambda function.
#            Protocol: lambda`,
  },
  split: {
    ignored: /['"]/g, // quotes are insignificant in comparisons given that they are often stripped
    arrayEquiv: /( *)-\n+\s*\1 {2}-/g, // `-\n  -` is equivalent to `- -` and the like
    newlinesRex: /\n/g,
  },
  backupAttempts: 100,
}

const impl = {
  // FILE UTILS
  /**
   * Helper function that, given a path, returns true if it's a file.
   * @param {string} filePath location to check if file exists
   * @returns {boolean} true if file exists, false otherwise
   */
  fileExists: (filePath) => {
    try {
      return fs.lstatSync(filePath).isFile()
    } catch (ex) {
      return false
    }
  },
  // SCRIPT UTILS
  /**
   * Determine, given the user supplied script option, what script to use.  Use a given script if it exists but
   * otherwise fall back to a local script.yml if it exists and finally fall back to the global script.yml if it
   * does not.
   * @param scriptPath An optional path the script to find.  If supplied, it will be checked for existence.
   * @return A string indicating the path that was found.  If the user supplied a file path that could not be found
   * return `null` to indicate an error should be displayed.  Otherwise, return a local script.yml file or the global
   * script.yml file if the prior two conditions do not hold.
   */
  findScriptPath: (scriptPath) => {
    if (scriptPath) {
      if (impl.fileExists(scriptPath)) {
        if (path.isAbsolute(scriptPath)) {
          return scriptPath
        } else {
          return path.join(process.cwd(), scriptPath)
        }
      } else {
        return null // doesn't exist
      }
    } else {
      const localDefaultScript = path.join(process.cwd(), constants.DefaultScriptName)
      if (impl.fileExists(localDefaultScript)) {
        return localDefaultScript
      } else {
        return path.join(__dirname, 'lambda', constants.DefaultScriptName)
      }
    }
  },
  /**
   * Read the input into a parsible string
   * @param options The CLI flag settings to identify the input source.
   * @returns {Promise.<string>}
   */
  getInput: (options) => {
    // Priority: `--si`, `--stdIn`, `-d`, `--data`, `-p`, `--path`, ./script.yml, $(npm root -g)/script.yml
    if (options.si || options.stdIn) {
      return stdin()
    } else if (options.d || options.data) {
      return BbPromise.resolve(options.d || options.data)
    } else {
      const scriptPath = impl.findScriptPath(options.p || options.path)
      if (scriptPath) {
        return fs.readFileAsync(scriptPath, 'utf8')
      } else {
        return BbPromise.reject(new Error(`${os.EOL}\tScript '${options.script}' could not be found.${os.EOL}`))
      }
    }
  },
  /**
   * Parse the given input as either YAML or JSON, passing back the parsed object or failing otherwise.
   * @param input The input to attempt parsing
   * @returns {*} The parsed artillery script
   */
  parseInput: (input) => {
    const script = yaml.safeLoad(input)
    if (typeof script !== 'object') {
      throw new Error('could not parse input to object.')
    }
    func.valid(script)
    const settings = func.def.getSettings(script)
    settings.task = task.def.getSettings(script)
    task.valid(settings, script)
    return script
  },
  /**
   * Replace the given input flag with the `-d` flag, providing the stringification of the given script as its value.
   */
  replaceArgv: (script) => {
    const flags = [
      { flag: '-si', bool: true },
      { flag: '--stdIn', bool: true },
      { flag: '-d', bool: false },
      { flag: '--data', bool: false },
      { flag: '-p', bool: false },
      { flag: '--path', bool: false },
    ]
    for (let i = 0; i < flags.length; i++) {
      const idx = process.argv.indexOf(flags[i].flag)
      if (idx !== -1) {
        process.argv = process.argv.slice(0, idx).concat(process.argv.slice(idx + (flags[i].bool ? 1 : 2)))
      }
    }
    // add function flag
    process.argv.push('-f')
    process.argv.push(constants.TestFunctionName)
    // add data flag
    process.argv.push('-d')
    process.argv.push(JSON.stringify(script))
  },
  /**
   * Get the allowance for and requirement of the given script with regard to execution time
   * @param script The script to determine allowance and requirements for
   * @returns {{allowance: number, required: number}}
   */
  scriptConstraints: (script) => {
    const networkBuffer = 2 // seconds to allow for network transmission
    const resultsBuffer = 3 // seconds to allow for processing overhead (validation, decision making, results calculation)
    const settings = func.def.getSettings(script)
    const durationInSeconds = task.plan.impl.scriptDurationInSeconds(script)
    const requestsPerSecond = task.plan.impl.scriptRequestsPerSecond(script)
    let httpTimeout = 120 // default AWS setting
    if (
      aws.config &&
      aws.config.httpOptions &&
      'timeout' in aws.config.httpOptions
    ) {
      httpTimeout = Math.floor(aws.config.httpOptions.timeout / 1000) // convert from ms to s
    }
    const ret = {
      allowance: Math.min(httpTimeout, settings.maxChunkDurationInSeconds) - networkBuffer,
      required: durationInSeconds + resultsBuffer,
    }
    if (
      durationInSeconds > settings.maxChunkDurationInSeconds ||
      requestsPerSecond > settings.maxChunkRequestsPerSecond
    ) { // if splitting happens, the time requirement is increased by timeBufferInMilliseconds
      ret.required += Math.ceil(settings.timeBufferInMilliseconds / 1000) // convert from ms to s
    }
    return ret
  },
  generateScriptDefaults: (options) => {
    const opts = options || {}
    opts.endpoint = opts.endpoint || 'http://aws.amazon.com'
    opts.duration = opts.duration || 5
    opts.rate = opts.rate || 2
    opts.rampTo = opts.rampTo
    // extract and combine options into generated script
    opts.urlParts = url.parse(opts.endpoint)
    return opts
  },
  /**
   * Generate a script with the given options hive.  Return the default script generated with those settings, filling
   * in default values as appropriate.
   * @param options The options hive to use in building the default script
   * @return {string} The string containing a JSON object that comprises the default script.
   */
  generateScript: (options) => {
    // fallback to defaults
    const opts = impl.generateScriptDefaults(options)
    // extract and combine options into generated script
    return [`# Thank you for trying serverless-artillery!
# This default script is intended to get you started quickly.
# There is a lot more that Artillery can do.
# You can find great documentation of the possibilities at:
# https://artillery.io/docs/
config:
  # this hostname will be used as a prefix for each URI in the flow unless a complete URI is specified
  target: "${opts.urlParts.protocol}//${opts.urlParts.auth ? `${opts.urlParts.auth}@` : ''}${opts.urlParts.host}"
  phases:
    -
      duration: ${opts.duration}
      arrivalRate: ${opts.rate}`,
    opts.rampTo ? `
      rampTo: ${opts.rampTo}` : // note that this is a break in the template string (to avoid spurious newline)
      '', `
scenarios:
  -
    flow:
      -
        get:
          url: "${opts.urlParts.path}${opts.urlParts.hash ? opts.urlParts.hash : ''}"
`,
    ].join('')
  },
  // MONITORING UTILS
  /**
   * Validate that the given service meets the minimum requirements for being modified for the purpose
   * of adding monitoring mode related assets and configuration
   * @param config The service configuration that is to be validated for modification.
   */
  validateService: (config) => {
    if (!config || typeof config !== 'object') {
      throw new Error('The given service must be an object')
    } else if (
      !config.provider ||
      !config.provider.iamRoleStatements ||
      !Array.isArray(config.provider.iamRoleStatements)
    ) {
      throw new Error('The given service must have "provider.iamRoleStatements" defined as an array')
    } else if (
      !config.functions ||
      !config.functions[constants.TestFunctionName] ||
      !(typeof config.functions[constants.TestFunctionName] === 'object')
    ) {
      throw new Error(`The given service must have a function with the name "${constants.TestFunctionName}"`)
    } else if (
      config.functions[constants.TestFunctionName].environment &&
      'TOPIC_ARN' in config.functions[constants.TestFunctionName].environment
    ) {
      throw new Error(`The given service has function "${constants.TestFunctionName}" that already has environment variable "TOPIC_ARN" defined.`)
    } else if (
      config.functions[constants.TestFunctionName].environment &&
      'TOPIC_NAME' in config.functions[constants.TestFunctionName].environment
    ) {
      throw new Error(`The given service has function "${constants.TestFunctionName}" that already has environment variable "TOPIC_NAME" defined.`)
    } else if (
      config.functions[constants.TestFunctionName].events &&
      !Array.isArray(config.functions[constants.TestFunctionName].events)
    ) {
      throw new Error(`If defined, the events attribute of the "${constants.TestFunctionName}" function must be an array`)
    } else if (
      config.functions[constants.TestFunctionName].events &&
      config.functions[constants.TestFunctionName].events.find(event =>
        event.schedule &&
        event.schedule.name &&
        event.schedule.name === constants.ScheduleName)
    ) {
      throw new Error(`The "${constants.TestFunctionName}" function already has a schedule event named "${constants.ScheduleName}"`)
    } else if (
      config.resources &&
      config.resources.Resources &&
      config.resources.Resources[constants.AlertingName]
    ) {
      throw new Error(`A resource with logical ID ${constants.AlertingName} already exists`)
    } else {
      return config
    }
  },
  /**
   * Add monitoring assets to the given existing service.  These are the items which specify the infrastructure or services
   * and configuration required to perform the monitoring and notification tasks
   * @param existing The existing service to which monitoring assets are to be added
   * @returns {*} The given service, with monitoring assets added [in place] to it
   */
  addAssets: (existing, options) => {
    const service = existing
    // ## Assets to add ##
    const publishPolicy = {
      Effect: 'Allow',
      Action: ['sns:Publish'],
      Resource: {
        Ref: `${constants.AlertingName}${constants.yamlComments.mustMatchKey}`,
      },
    }
    const environment = {
      TOPIC_ARN: { Ref: constants.AlertingName },
      TOPIC_NAME: { 'Fn::GetAtt': [constants.AlertingName, 'TopicName'] },
    }
    const input = options.p || options.path || 'script.yml'
    const event = {
      schedule: {
        name: `${constants.ScheduleName}${constants.yamlComments.doNotEditKey}`,
        description: 'The scheduled event for running the function in monitoring mode',
        rate: 'rate(1 minute)',
        enabled: true,
        input: {
          [func.def.MERGE_FIELD]: input,
          mode: task.def.modes.MONITORING,
        },
      },
    }
    if (options.t || options.threshold) {
      event.schedule.input.threshold = options.t || options.threshold
    }
    const snsTopicLogicalId = `${constants.AlertingName}${constants.yamlComments.doNotEditKey}`
    const snsTopic = {
      Type: 'AWS::SNS::Topic',
      Properties: {
        DisplayName: `\${self:service} Monitoring Alerts${constants.yamlComments.snsSubscriptionsKey}`, // eslint-disable-line no-template-curly-in-string
      },
    }
    // ## Make the modifications that enable monitoring ##
    // add policy
    service.provider.iamRoleStatements.push(publishPolicy)
    // add environment variables
    if (!service.functions[constants.TestFunctionName].environment) {
      service.functions[constants.TestFunctionName].environment = {}
    }
    service.functions[constants.TestFunctionName].environment.TOPIC_ARN = environment.TOPIC_ARN
    service.functions[constants.TestFunctionName].environment.TOPIC_NAME = environment.TOPIC_NAME
    // add event
    if (!service.functions[constants.TestFunctionName].events) {
      service.functions[constants.TestFunctionName].events = []
    }
    service.functions[constants.TestFunctionName].events.push(event)
    // add alerting
    if (!service.resources) {
      service.resources = {}
    }
    if (!service.resources.Resources) {
      service.resources.Resources = {}
    }
    service.resources.Resources[snsTopicLogicalId] = snsTopic
    return service
  },
  // ## Restore existing comments and replace new comment placeholders ##
  /**
   * Split a given string by newline after replacing semantic equivalencies
   * @param value The string to split
   * @returns {string[]} The string split by newline, after ignoring semantic equivalencies
   */
  splitIgnore: value => value // split by newline after trimming, ignoring equivalencies
    .replace(constants.split.arrayEquiv, '$1- -')
    .trim()
    .replace(constants.split.ignored, '')
    .split('\n'),
  /**
   * Split a given string by newline, except across sematically equivalent newlines.
   * For example, this YAML:
   * ```
   * - - bar
   * ```
   * Is semantically equivalent to this YAML:
   * ```
   * -
   *   - bar
   * ```
   * Which both resolve to:
   * ```
   * [["bar"]]
   * ```
   * @param value The string to split on non-semantically equivalent newlines
   * @returns {string[]} An array of the strings split from the given string
   */
  splitExcept: (value) => { // split by newline, except those in equivalences
    // find the array declarations split over newlines
    const arrayMatches = []
    let match = constants.split.arrayEquiv.exec(value)
    while (match) {
      arrayMatches.push({
        start: match.index,
        end: constants.split.arrayEquiv.lastIndex,
      })
      match = constants.split.arrayEquiv.exec(value)
    }
    // find newlines not contained by the multi-line array declarations
    const newlines = []
    const contained = commaMatch => // curry the current commaMatch
      stringMatch => // check whether stringMatch containing the commaMatch
        stringMatch.start < commaMatch.index &&
        constants.split.newlinesRex.lastIndex < stringMatch.end
    match = constants.split.newlinesRex.exec(value)
    while (match) {
      const matchContained = contained(match)
      const containedBy = arrayMatches.find(matchContained)
      if (!containedBy) { // if uncontained, this comma respresents a splitting location
        newlines.push({
          start: match.index,
          end: constants.split.newlinesRex.lastIndex,
        })
      }
      match = constants.split.newlinesRex.exec(value)
    }
    // do the string splitting
    let prior = 0
    const results = []
    newlines.forEach((replacement) => {
      results.push(value.slice(prior, replacement.start))
      prior = replacement.end
    })
    results.push(value.slice(prior))
    return results.filter(result => result)
  },
  /**
   * Compare two given strings that represent original YAML content and the YAML serialization of a
   * modified version of the object represented in the original.  In this comparison, cases are
   * identified where the content is changed and additionally, the modification is a semantically
   * equivalent subset of the original.  Most usefully, this identifies cases where parsing has removed
   * comments from the original but otherwise made no modification.  In such cases, we can take the
   * original content as the proper output.
   * @param existing The original YAML content
   * @param augmented The modified YAML content, sans comments from the original, with added content
   * @returns {string} A string representing the merging of content of the existing YAML with the
   * content of the augmented YAML
   */
  compareRestore: (existing, augmented) => {
    let result = ''
    const lineDiffs = diff.diffLines(existing, augmented) // each entry can contain newlines
    for (let i = 0; i < lineDiffs.length; i++) {
      const lineDiff = lineDiffs[i]
      const prevDiff = i === 0 ? {} : lineDiffs[i - 1]
      if (lineDiff.added && prevDiff.removed) { // deletions followed by additions represent potential comment removals
        // i => ignored, s => split
        const iAdded = impl.splitIgnore(lineDiff.value) // ignored is used for comparison
        const sAdded = impl.splitExcept(lineDiff.value) // split is used for original content retention
        const iRemoved = impl.splitIgnore(prevDiff.value)
        const sRemoved = impl.splitExcept(prevDiff.value)
        for (let j = 0; j < iRemoved.length; j++) {
          const idx = iRemoved[j].indexOf(iAdded[j]) // if the "added" line is contained in the "removed" line
          if (idx === -1) {
            result += sRemoved[j]
            result += '\n'
          }
        }
        for (let j = iRemoved.length; j < iAdded.length; j++) {
          result += sAdded[j]
          result += '\n'
        }
      } else {
        result += lineDiff.value
      }
    }
    return result
  },
  /**
   * Replace comment placeholder keys in the given string with the associated comment content
   * @param input The string to replace comment placeholders in
   * @returns {string} The given string with all comment placeholders replaced with the associated comment content
   */
  replaceCommentKeys: (input) => {
    let result = input
    // Replace new comment placeholders
    result = result.replace(constants.yamlComments.mustMatchRex, `$1${constants.yamlComments.mustMatchVal}`)
    result = result.replace(constants.yamlComments.doNotEditRex, `$1${constants.yamlComments.doNotEditVal}`)
    result = result.replace(constants.yamlComments.snsSubscriptionsRex, `$1${constants.yamlComments.snsSubscriptionsVal}`)
    result = result.replace(/Effect: Allow/g, 'Effect: \'Allow\'')
    return result
  },
  // ## Write a backup file as a peer to the altered serverless.yml that is to be overwritten ##
  writeBackup: (content, index) => {
    if (index >= constants.backupAttempts) {
      const msg = `## Failure to backup 'serverless.yml' for ${constants.backupAttempts} attempts, aborting command ##`
      const headFoot = '#'.repeat(msg.length)
      return BbPromise.reject(new Error([headFoot, msg, headFoot].join(os.EOL)))
    }
    const target = `${constants.ServerlessFile}${index ? `.${index}` : ''}.bak`
    return fs.writeFileAsync(target, content, { flag: 'wx' })
      .then(() => console.log(`${os.EOL}Backup successfully written to ${target}`))
      .catch((err) => {
        if (err.code === 'EEXIST') {
          return impl.writeBackup(content, index ? index + 1 : 1)
        } else {
          throw err
        }
      })
  },
  // SERVERLESS UTILS
  /**
   * Checks working directory for service config, otherwise uses default.
   * @returns {string} - path to service config
   */
  findServicePath: () => {
    const localServerlessPath = path.join(process.cwd(), 'serverless.yml')

    if (impl.fileExists(localServerlessPath)) {
      return process.cwd()
    } else {
      // use the default serverless.yml in project
      return path.join(__dirname, 'lambda')
    }
  },
  /**
   * Invokes the Serverless code to perform a give task. Expects process.argv to
   * contain CLI parameters to pass to SLS.
   */
  serverlessRunner: (options) => {
    // pretend that SLS was called.
    process.argv[1] = Serverless.dirname
    // proceed with using SLS
    const serverless = new Serverless({
      interactive: false,
      servicePath: impl.findServicePath(),
    })
    if (options.verbose) {
      console.log(`Serverless version is ${serverless.version}, compatible version is '${constants.CompatibleServerlessSemver}'`)
    }
    if (!semver.satisfies(serverless.version, constants.CompatibleServerlessSemver)) {
      return BbPromise.reject(new Error(
        // eslint-disable-next-line comma-dangle
        `Loaded Serverless version '${serverless.version}' but the compatible version is ${constants.CompatibleServerlessSemver}`
      ))
    }
    let SLS_DEBUG
    if (options.debug) {
      if (options.verbose) {
        console.log(`Running Serverless with argv: ${process.argv}`)
      }
      ({ SLS_DEBUG } = process.env)
      process.env.SLS_DEBUG = '*'
    }
    let result
    return serverless.init()
      .then(() => { // add our intercepter
        const invoke = serverless.pluginManager.plugins.find(
          plugin => Object.getPrototypeOf(plugin).constructor.name === 'AwsInvoke' // eslint-disable-line comma-dangle
        )
        const { log } = invoke
        invoke.log = (response) => {
          if (response && 'Payload' in response && typeof response.Payload === 'string' && response.Payload.length) {
            try {
              result = JSON.parse(response.Payload)
            } catch (ex) {
              console.error(`exception parsing payload:${os.EOL
              }${JSON.stringify(response)}${os.EOL
              }${ex}${os.EOL}${os.EOL
              }Please report this error to this tool's GitHub repo so that we can dig into the cause:${os.EOL
              }https://github.com/Nordstrom/serverless-artillery/issues${os.EOL
              }Please scrub any sensitive information that may be present prior to submission.${os.EOL
              }Thank you!`)
            }
          }
          return log.call(invoke, response)
        }
      })
      .then(() => serverless.run())
      .then(() => {
        process.env.SLS_DEBUG = SLS_DEBUG
        return result
      })
      .catch((ex) => {
        process.env.SLS_DEBUG = SLS_DEBUG
        console.error(ex)
      })
  },
  /**
  * Load and resolve serverless service file so that the content of the returned serverless.service object
  * will reflect the names of the resources in the cloudprovider console
  * use when you need the names of resources in the cloud
  */
  serverlessLoader: () => {
    const serverless = new Serverless({
      interactive: false,
      servicePath: impl.findServicePath(),
    })
    return serverless.init()
      .then(() => serverless.variables.populateService(serverless.pluginManager.cliOptions))
      .then(() => {
        serverless.service.mergeArrays()
        serverless.service.setFunctionNames(serverless.processedInput.options)
      })
      .then(() => BbPromise.resolve(serverless))
  },
}

module.exports = {
  /**
   * Deploy the load generation function to the configured provider.  Prefer a local service over the global service
   * but better to have one service over having none.
   * @return {Promise.<TResult>} A promise that completes after the deployment of the function and reporting of that
   * deployment.
   */
  deploy: (options) => {
    console.log(`${os.EOL}\tDeploying Lambda to AWS...${os.EOL}`)

    return impl.serverlessRunner(options).then(() => {
      console.log(`${os.EOL}\tDeploy complete.${os.EOL}`)
    })
  },
  /**
   * Send a script to the remote function.  Prefer a script identified by the `-s` or `--script` option over a
   * `script.yml` file in the current working directory over the global `script.yml`.
   * @param options The options given by the user.  See the ~/bin/serverless-artillery implementation for details.
   * @return {Promise.<TResult>} A promise that completes after the invocation of the function with the script given
   * by the user (or a fallback option).
   */
  invoke: options => impl.getInput(options)
    .then(impl.parseInput)
    .then((input) => {
      const script = input
      if (options.acceptance) {
        script.mode = task.def.modes.ACC
      } else if (options.monitoring) {
        script.mode = task.def.modes.MON
      }
      impl.replaceArgv(script)
      // analyze script if tool or script is in performance mode
      let completeMessage = `${os.EOL}\tYour function invocation has completed.${os.EOL}`
      if (!task.def.isSamplingScript(script)) {
        const constraints = impl.scriptConstraints(script)
        if (constraints.allowance < constraints.required) { // exceeds limits?
          process.argv.push('-t')
          process.argv.push('Event')
          completeMessage = `${os.EOL}\tYour function has been invoked. The load is scheduled to be completed in ${constraints.required} seconds.${os.EOL}`
        }
      }
      const log = msg => console.log(msg)
      const logIf = (msg) => { if (!(options.jo || options.jsonOnly)) { log(msg) } }
      // run the given script on the deployed lambda
      logIf(`${os.EOL}\tInvoking test Lambda${os.EOL}`)
      return impl.serverlessRunner(options).then((result) => {
        logIf(completeMessage)
        if (options.acceptance || options.monitoring) {
          logIf('Results:')
          log(JSON.stringify(result, null, 2))
          if (result && result.errors) {
            console.error(`Errors exceeding errorBudget observed in ${result.errors} sample(s).`)
            process.exit(result.errors)
          }
        }
        return result
      })
    })
    .catch((ex) => {
      if (ex instanceof func.def.FunctionError) {
        console.error('Error validating function settings:')
      } else if (ex instanceof task.def.TaskError) {
        console.error('Error validating the task settings:')
      } else {
        console.error('Unexpected Error:')
      }
      throw ex
    }),
  /**
   * Kill an invoked lambda that is actively executing.
   */
  kill: (options) => {
    const lambda = new aws.Lambda()
    let funcName

    if (options.debug) {
      console.log('Rendering serverless.yml variables to obtain deployed function name')
    }
    return impl.serverlessLoader()
      .then((serverless) => {
        funcName = serverless.service.functions.loadGenerator.name
        if (options.debug) {
          console.log(`Setting concurrency to zero for function ${funcName}`)
        }
        const params = {
          FunctionName: funcName, // required
          ReservedConcurrentExecutions: 0,
        }
        return lambda.putFunctionConcurrency(params).promise()
          .catch((err) => {
            if (options.debug) {
              console.error(err.message)
              if (options.verbose) {
                console.error((new Error()).stack)
              }
            }
            if (err.code === 'ResourceNotFoundException') {
              throw new Error(`${os.EOL}The function ${funcName} is not deployed${os.EOL}`)
            } else {
              throw new Error(`${os.EOL}Unexpected error setting concurrency to zero: ${err.code}${os.EOL}`)
            }
          })
      })
      .then(() => {
        console.log(`${os.EOL}Concurrency successfully set to zero for ${funcName}.${os.EOL}`)
        options._ = 'remove' // eslint-disable-line no-param-reassign
        process.argv[2] = 'remove'
        return module.exports.remove(options)
          .then(() => {
            const oldDate = new Date()
            const deployTime = new Date(oldDate.getTime() + (5 * 60 * 1000)) // add five minutes to current time
            console.log(`${os.EOL}We advise to wait until ${deployTime.toLocaleTimeString('en-US')} before re-deploying to avoid possible problems. See https://github.com/Nordstrom/serverless-artillery/#Killing-a-Runaway-Performance-Test${os.EOL}`)
          })
      })
  },
  /**
   * Remove the CloudFormation Stack (or equivalent) from the configured provider.
   * @return {Promise.<TResult>} A promise that completes after the removal of the stack and reporting of its
   * completion.
   */
  remove: (options) => {
    console.log(`${os.EOL}\tRemoving Lambda from AWS...${os.EOL}`)

    return impl.serverlessRunner(options).then(() => {
      console.log(`${os.EOL}\tRemoval complete.${os.EOL}`)
    })
  },
  /**
   * Generate a script using the user's given options.  Place it into the given out path or the default out path if
   * none was given.
   * @param options The user's supplied options.
   */
  script: (options) => {
    const destPath = options.out || 'script.yml'
    if (impl.fileExists(destPath)) {
      return BbPromise.reject(new Error(`${os.EOL}\tConflict at path '${destPath}'. File exists.  No script generated.${os.EOL}`))
    } else {
      if (options.debug) {
        console.log('Generating script...')
      }
      const newScript = impl.generateScript(options)
      if (options.debug) {
        console.log(`Writing script:${os.EOL}${newScript}${os.EOL}to path: '${destPath}'`)
      }
      return fs.writeFileAsync(destPath, newScript)
        .then(() => console.log([
          `${os.EOL}\tYour script '${destPath}' is created.`,
          `${os.EOL}\tWe're very glad that you see enough value to create a custom script!`,
          `${os.EOL}\tEdit your script and review the documentation for your endpoint pummeling options at:`,
          `${os.EOL}\thttps://artillery.io/docs ${os.EOL}`,
        ].join('')))
    }
  },
  /**
   * Generate the function deployment assets and place them into the current working directory so that the user can
   * create and deploy a custom function definition.
   * @returns {Promise<T>} A promise that completes after the generation of function assets for subequent deployment.
   */
  configure: options => new BbPromise((resolve, reject) => {
    const conflicts = []
    const cwd = process.cwd()
    // identify conflicts
    if (options.debug) {
      console.log('Identifying any file conflicts...')
    }
    constants.ServerlessFiles.forEach((file) => {
      const destPath = path.join(cwd, file)
      if (impl.fileExists(destPath)) {
        conflicts.push(destPath)
      }
    })
    if (conflicts.length) {
      // report any conflicts
      if (options.debug) {
        console.log('Conflicts discovered, generating output message.')
      }
      let msg = `${os.EOL}\tConflict with existing files:`
      conflicts.forEach((file) => {
        msg += `${os.EOL}\t\t${file}`
      })
      msg += `${os.EOL}\tNo files created.${os.EOL}`
      reject(new Error(msg))
    } else {
      // create the configuration assets
      if (options.debug) {
        console.log('No conflicts found, creating a local copy of the Serverless files to deploy.')
      }
      constants.ServerlessFiles.forEach((file) => {
        const sourcePath = path.join(__dirname, 'lambda', file)
        const destPath = path.join(cwd, file)

        const content = fs.readFileSync(sourcePath, { encoding: 'utf8' })
        fs.writeFileSync(destPath, content.replace(
          'service: serverless-artillery',
          `service: serverless-artillery-${shortid.generate().replace(/_/g, 'A')}` // eslint-disable-line comma-dangle
        ))
      })
      const completeMessage = [
        `${os.EOL}\tYour function assets have been created.`,
        `${os.EOL}\tWe are glad that you see enough value in the project to do some customization!`,
        `${os.EOL}\tEdit serverless.yml to customize your load function but please note that you must`,
        `${os.EOL}\t\tdeploy the function before invoking and also after making any modifications.`,
        `${os.EOL}\tDocumentation available at https://docs.serverless.com ${os.EOL}`,
      ]
      try {
        if (options.debug) {
          console.log('Executing `npm install` to provide dependencies to the generated Serverless project.')
        }
        npm.install(cwd)
        resolve()
      } catch (ex) {
        completeMessage.push(
          `${os.EOL}`,
          `${os.EOL}An error occurred executing 'npm install'  please note and resolve any errors `,
          'and run \'npm install\' in the current working directory again.')
        reject(ex)
      }
      console.log(completeMessage.join(''))
    }
  }),
  /**
   * Generate or modify the function deployment assets in the current working directory so that they contain the
   * periodic monitoring event definition and alerting assets.
   * @param options The user's supplied options.
   * @returns {Promise<T>} A promise that completes after the modification or generation of function assets for
   * subequent deployment.
   */
  monitor: (options) => {
    // Check for the existence of a serverless.yml
    const preRead = []
    let preWrite
    const tasks = []
    let scriptPath = options.p || options.path || constants.DefaultScriptName
    const scriptMissing = !impl.fileExists(scriptPath)
    const slsYmlMissing = !impl.fileExists(constants.ServerlessFile)
    if (scriptMissing || slsYmlMissing) {
      console.log()
    }
    if (scriptMissing) {
      console.log(`A '${scriptPath}' file could not be found in the current directory, running script to generate one`)
      preRead.push(module.exports.script({})
        .then(() => console.log('Script generated locally...')))
      scriptPath = constants.DefaultScriptName
      tasks.push(`Modify your '${scriptPath}' to provide the details of invoking your service, as per https://artillery.io/docs`)
      tasks.push('Add a `match` clause to your requests, specifying your expectations of a successful request')
    }
    if (slsYmlMissing) {
      console.log(`A '${constants.ServerlessFile}' file not found in the current directory, running configure to generate function assets`)
      preRead.push(module.exports.configure({})
        .then(() => console.log('Function assets generated locally... modifying them for monitoring')))
      preWrite = () => BbPromise.resolve()
    } else {
      preRead.push(BbPromise.resolve()
        .then(() => console.log(`Reading your '${constants.ServerlessFile}' to add monitoring related assets and configuration`)))
      preWrite = impl.writeBackup
    }
    if (scriptMissing || slsYmlMissing) {
      console.log()
    }
    return BbPromise.all(preRead)
      .then(() => fs.readFileAsync(constants.ServerlessFile, 'utf8'))
      .then((input) => {
        const service = yaml.safeLoad(input)
        impl.validateService(service)
        const augmented = impl.addAssets(service, options)
        let output = yaml.safeDump(augmented, { lineWidth: -1 })
        output = impl.compareRestore(input, output)
        output = impl.replaceCommentKeys(output)
        tasks.push([
          `Modify your '${constants.ServerlessFile}' to enable subscriptions to any alerts raised by the monitoring function.`,
          `   (To help you out, we've provided commented-out examples of these for you in '${constants.ServerlessFile}')`,
          '   (What good is monitoring if noone is listening?)',
        ].join(os.EOL))
        tasks.push('Deploy your new assets/updated service using \'slsart deploy\'')
        return preWrite(input)
          .then(() => fs.writeFileAsync(constants.ServerlessFile, output))
          .then(() => console.log([
            `${os.EOL}Monitoring assets added to ${constants.ServerlessFile}${os.EOL}`,
            'Tasks for you:',
          ].concat(tasks.map((userTask, index) => `${index + 1}. ${userTask}`)).concat([
            `${os.EOL}Thank you for trying monitoring mode, may it help keep your systems up!`,
          ]).join(os.EOL)))
      })
      .catch((error) => {
        const msg = `An error occurred while attempting to ${
          scriptMissing ? 'generate a script or' : ''
        } ${
          slsYmlMissing ? 'generate' : 'modify the in-memory copy of'
        } '${
          constants.ServerlessFile
        }':${os.EOL}${
          error.stack
        }`
        throw new Error(msg)
      })
  },
}

// TODO remove before publishing?
/* test-code */
module.exports.constants = constants
module.exports.impl = impl
/* end-test-code */
