const aws = require('aws-sdk')
const BbPromise = require('bluebird')
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
const versioning = require('./versioning')()

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
  getScriptText: (options) => {
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
  parseScript: (input) => {
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
   * Validate that if the service has an enabled monitoring event schedule, that it also has a valid TOPIC_ARN configured for the purpose of
   * notifying of any events where observed errors exceeded the error budget.  Additionally warns users if they have an enabled monitoring
   * event schedule and a TOPIC_ARN configuration that references a topic without any subscribers.
   * @param service The service to validate for deployment preconditions
   */
  validateServiceForDeployment: (service) => {
    if (
      service &&
      service.functions &&
      service.functions[constants.TestFunctionName] &&
      service.functions[constants.TestFunctionName].events
    ) {
      const isMonitoringEvent = event =>
        (event && event.schedule && event.schedule.name && event.schedule.name === constants.ScheduleName)
      const topicArnRegex = /^arn:(?:\*|aws[\w-]*):sns:(?:\*|[\w-]+):\d+:\w+$/
      const monitoringEvent = service.functions[constants.TestFunctionName].events.filter(isMonitoringEvent)[0]
      if (
        monitoringEvent &&
        (
          !('enabled' in monitoringEvent.schedule) ||
          monitoringEvent.schedule.enabled
        )
      ) { // enabled monitoring event
        if (
          !service.functions[constants.TestFunctionName].environment ||
          !service.functions[constants.TestFunctionName].environment.TOPIC_ARN
        ) {
          throw new Error('An environment variable supplying a TOPIC_ARN for notifications must be supplied')
        } else if (
          typeof service.functions[constants.TestFunctionName].environment.TOPIC_ARN === 'string' &&
          !service.functions[constants.TestFunctionName].environment.TOPIC_ARN.match(topicArnRegex)
        ) {
          throw new Error(`If service.functions.${constants.TestFunctionName}.environment.TOPIC_ARN is a string, it must contain a valid SNS topic ARN`)
        } else if (
          !(typeof service.functions[constants.TestFunctionName].environment.TOPIC_ARN === 'string') &&
          !service.functions[constants.TestFunctionName].environment.TOPIC_ARN.Ref
        ) {
          throw new Error(`The variable service.functions.${constants.TestFunctionName}.environment.TOPIC_ARN must be a Ref to a SNS topic resource or string containing an SNS topic ARN`)
        } else if (
          !(typeof service.functions[constants.TestFunctionName].environment.TOPIC_ARN === 'string') &&
          service.functions[constants.TestFunctionName].environment.TOPIC_ARN.Ref &&
          (
            !service.resources.Resources[service.functions[constants.TestFunctionName].environment.TOPIC_ARN.Ref] ||
            service.resources.Resources[service.functions[constants.TestFunctionName].environment.TOPIC_ARN.Ref].Type !== 'AWS::SNS::Topic'
          )
        ) {
          throw new Error(`If service.functions.${constants.TestFunctionName}.environment.TOPIC_ARN is a Ref, it must reference an SNS topic`)
        } else if (
          !(typeof service.functions[constants.TestFunctionName].environment.TOPIC_ARN === 'string') &&
          service.functions[constants.TestFunctionName].environment.TOPIC_ARN.Ref &&
          !(
            service.resources.Resources[service.functions[constants.TestFunctionName].environment.TOPIC_ARN.Ref].Properties.Subscription &&
            Array.isArray(service.resources.Resources[service.functions[constants.TestFunctionName].environment.TOPIC_ARN.Ref].Properties.Subscription) &&
            service.resources.Resources[service.functions[constants.TestFunctionName].environment.TOPIC_ARN.Ref].Properties.Subscription.length > 0
          )
        ) {
          throw new Error('No subscriptions are supplied for the SNS topic associated with your enabled monitoring event')
        }
      }
    }
  },
  /**
   * Check the version of the local function assets version, the invocation options
   * and script mode and if the invocation type is monitoring and the default
   * version is found, then an error is thrown.
   * @param options The invoke command line options
   * @param script Artillery script being run
   * @param cwd Function to get the current working directory path
   */
  validateServiceForInvocation: (options, script, cwd = process.cwd) => {
    let toss = false
    try {
      const localService = require(path.join(cwd(), 'package.json')) // eslint-disable-line global-require, import/no-dynamic-require
      toss = !('version' in localService) &&
        (
          options.monitoring ||
          script.mode === task.def.modes.MON ||
          script.mode === task.def.modes.MONITORING
        )
    } catch (ex) {
      // can't be found.  that's okay, we could be using the default service
    }
    if (toss) {
      throw new Error([
        '',
        `Your local function project assets in ${cwd()} implements a service`,
        'version that does not support invocation with the monitoring flag.',
        '',
        'To use monitoring mode, please run the "configure" command',
        'in a clean directory and then customize your worker\'s assets.',
      ].join(`${os.EOL}\t`))
    }
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
  deploy: options => impl.serverlessLoader()
    .then((serverless) => {
      impl.validateServiceForDeployment(serverless.service)

      console.log(`${os.EOL}\tDeploying function...${os.EOL}`)

      return impl.serverlessRunner(options).then(() => {
        console.log(`${os.EOL}\tDeploy complete.${os.EOL}`)
      })
    }),
  /**
   * Send a script to the remote function.  Prefer a script identified by the `-s` or `--script` option over a
   * `script.yml` file in the current working directory over the global `script.yml`.
   * @param options The options given by the user.  See the ~/bin/serverless-artillery implementation for details.
   * @return {Promise.<TResult>} A promise that completes after the invocation of the function with the script given
   * by the user (or a fallback option).
   */
  invoke: options => impl.getScriptText(options)
    .then(impl.parseScript)
    .then((input) => {
      const script = input
      if (options.acceptance) {
        script.mode = task.def.modes.ACC
      } else if (options.monitoring) {
        script.mode = task.def.modes.MON
      }
      impl.replaceArgv(script)
      // check local assets version
      impl.validateServiceForInvocation(options, script)
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

          if (result && result.errors > 0) {
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
    console.log(`${os.EOL}\tRemoving function...${os.EOL}`)

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
        console.log('No conflicts found, creating a local copy of the function assets for deployment.')
      }
      constants.ServerlessFiles.forEach((file) => {
        const sourcePath = path.join(__dirname, 'lambda', file)
        const destPath = path.join(cwd, file)

        const content = fs.readFileSync(sourcePath, { encoding: 'utf8' })
        fs.writeFileSync(destPath, content.replace(
          'service: serverless-artillery',
          `service: serverless-artillery-${shortid.generate().replace(/_/g, 'A')}`))
      })
      const completeMessage = [
        `${os.EOL}\tYour function assets have been created.`,
        `${os.EOL}\tWe are glad that you see enough value in the project to do some customization!`,
        `${os.EOL}\tEdit serverless.yml to customize your load function but please note that you must`,
        `${os.EOL}\t\tdeploy the function before invoking and also after making any modifications.`,
        `${os.EOL}\tTo continuously monitoring your service, you will need to enable the capability.  See:`,
        `${os.EOL}\t\thttps://github.com/Nordstrom/serverless-artillery/README.md#monitoring-mode`,
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
    /**
     * Upgrade the local function assets to their latest form.
     * @param options The user's supplied options.
     * @returns {Promise<T>} A promise that completes after updating the local function assets.
     */
  }),
  upgrade: () => {
    const localAssetsPath = process.cwd()
    const localAssetsVersioning = versioning(localAssetsPath)
    const noUpgradeAvailable = !localAssetsVersioning.upgradeAvailable()
    if (noUpgradeAvailable) {
      console.log('Your function assets are up to date: no need to upgrade.')
      return Promise.resolve()
    }

    try {
      console.log('Upgrading project...')
      const version = localAssetsVersioning.upgradeService()
      console.log()
      console.log('Upgrade complete.')
      console.log()
      console.log('Existing project files were copied to `backup`.')
      console.log()
      console.log('It\'s possible that the upgraded project contained additional customizations:')
      console.log(`Diff \`backup\` with \`original-assets-${version}\` to understand how the project was originally customized.`)
      console.log('Diff `serverless.yml` with `backup/serverless.yml` to compare the previous cloud resources with the upgraded service.')
      console.log('Diff `project.json` with `backup/project.json` to compare the changes in project dependencies.')
      console.log()
      console.log('Please merge any missing customizations into the project to complete the upgrade.')
      console.log()
      // Please inspect the upgraded files by comparing with the backup files to make sure that your custom changes are maintained and manually merge it where needed.
    } catch (ex) {
      console.error('Upgrade failed:')
      console.error(ex)
      return Promise.reject(ex)
    }

    return Promise.resolve()
  },
}

// TODO remove before publishing?
/* test-code */
module.exports.constants = constants
module.exports.impl = impl
/* end-test-code */
