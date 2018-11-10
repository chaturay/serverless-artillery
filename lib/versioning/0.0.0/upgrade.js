const fsDefault = require('fs')
const diff = require('diff')
const { join } = require('path')
const yaml = require('js-yaml')

// Upgrades from version 0.0.0 to 0.0.1
module.exports =
  ({
    readdirSync,
    readFileSync,
  } = fsDefault) => ({
    nextVersion: '0.0.1',
    fileManifest: () => {
      const versionPath = join(__dirname, 'assets')
      return readdirSync(versionPath)
    },
    fileContents: (assetFile) => {
      const filePath = join(__dirname, 'assets', assetFile)
      return readFileSync(filePath, 'utf8')
    },
    projectDependencies: () => {
      const packagePath = join(__dirname, 'assets', 'package.json')
      const packageJSON = readFileSync(packagePath)
      const packageObj = JSON.parse(packageJSON)
      return packageObj.dependencies
    },
    serviceDefinitionSchema: () => {
      const schemaPath = join(__dirname, 'serverless.yml.preconditions.schema.json')
      const schemaJSON = readFileSync(schemaPath)
      const schema = JSON.parse(schemaJSON)
      return schema
    },
    serviceDefinitionConflictSchema: () => ({}),
    upgradeServiceDefinition: (input) => {
      const service = yaml.safeLoad(input)

      // Inject new resources into serverless.yml.
      const constants = {
        TestFunctionName: 'loadGenerator',
        ScheduleName: '${self:service}-${opt:stage, self:provider.stage}-monitoring', // eslint-disable-line no-template-curly-in-string
        AlertingName: 'monitoringAlerts',
        yamlComments: {
          mustMatch: {
            regex: /-MUST_MATCH(.*)/g,
            key: '-MUST_MATCH',
            value: ' # must match topic name',
          },
          doNotEdit: {
            key: '-DO_NOT_EDIT',
            regex: /-DO_NOT_EDIT(.*)/g,
            value: ' # !!Do not edit this name!!',
          },
          snsSubscriptions: {
            key: '-SNS_SUBSCRIPTIONS',
            regex: /-SNS_SUBSCRIPTIONS(.*)/g,
            value: `
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
          timerEnableWarning: {
            key: '-BEFORE_ENABLING',
            regex: /-BEFORE_ENABLING(.*)/g,
            value: `
            ########################################################################################################################
            ### !! BEFORE ENABLING... !!!
            ### 0. Change \`'>>': script.yml\` below to reference the script you want to use for monitoring if that is not its name.
            ###    The script must be in this directory or a subdirectory.
            ### 1. Modify your \`script.yml\` to provide the details of invoking every important surface of your service, as per
            ###    https://artillery.io/docs
            ### 2. To receive alerts when errors exceed the budget:
            ###    i.  Add a \`match\` clause to your requests, specifying your expectations of a successful request.  This relatively
            ###        undocumented feature is implemented at: https://github.com/shoreditch-ops/artillery/blob/82bdcdfc32ce4407bb197deff2cee13b4ecbab3b/core/lib/engine_util.js#L318
            ###        We would welcome the contribution of a plugin replacing this as discussed in https://github.com/Nordstrom/serverless-artillery/issues/116
            ###    ii. Modify the \`monitoringAlerts\` SNS Topic below, uncommenting \`Subscription\` and providing subscriptions for any
            ###        alerts that might be raised by the monitoring function.  (To help you out, we've provided commented-out examples)
            ###        (After all, what good is monitoring if noone is listening?)
            ### 3. Deploy your new assets/updated service using \`slsart deploy\`
            ### 4. [As appropriate] approve the subscription verifications for the SNS topic that will be sent following its creation
            ### 5. Re-deploy whenever you update your monitoring script
            ########################################################################################################################`,
          },
        },
        split: {
          ignored: /['"]/g, // quotes are insignificant in comparisons given that they are often stripped
          arrayEquiv: /( *)-\n+\s*\1 {2}-/g, // `-\n  -` is equivalent to `- -` and the like
          newlinesRex: /\n/g,
        },
      }

      const splitIgnore = value =>
        value // split by newline after trimming, ignoring equivalencies
          .replace(constants.split.arrayEquiv, '$1- -')
          .trim()
          .replace(constants.split.ignored, '')
          .split('\n')

      const splitExcept = (value) => { // split by newline, except those in equivalences
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
      }

      const compareRestore = (existing, augmented) => {
        let result = ''
        const lineDiffs = diff.diffLines(existing, augmented) // each entry can contain newlines
        for (let i = 0; i < lineDiffs.length; i++) {
          const lineDiff = lineDiffs[i]
          const prevDiff = i === 0 ? {} : lineDiffs[i - 1]
          if (lineDiff.added && prevDiff.removed) { // deletions followed by additions represent potential comment removals
            // i => ignored, s => split
            const iAdded = splitIgnore(lineDiff.value) // ignored is used for comparison
            const sAdded = splitExcept(lineDiff.value) // split is used for original content retention
            const iRemoved = splitIgnore(prevDiff.value)
            const sRemoved = splitExcept(prevDiff.value)
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
      }

      const replaceCommentKeys = (yamlInput) => {
        // Replace new comment placeholders
        let expandedYaml = Object.keys(constants.yamlComments).reduce((result, comment) =>
          result.replace(constants.yamlComments[comment].regex, `$1${constants.yamlComments[comment].value}`), yamlInput)
        expandedYaml = expandedYaml.replace(/Effect: Allow/g, 'Effect: \'Allow\'')
        return expandedYaml
      }

      const addAssets = (existing) => {
        const upgradedService = existing
        // ## Assets to add ##
        const publishPolicy = {
          Effect: 'Allow',
          Action: ['sns:Publish'],
          Resource: {
            Ref: `${constants.AlertingName}${constants.yamlComments.mustMatch.key}`,
          },
        }
        const environment = {
          TOPIC_ARN: { Ref: constants.AlertingName },
          TOPIC_NAME: { 'Fn::GetAtt': [constants.AlertingName, 'TopicName'] },
        }
        const event = {
          schedule: {
            name: `${constants.ScheduleName}${constants.yamlComments.doNotEdit.key}`,
            description: 'The scheduled event for running the function in monitoring mode',
            rate: `rate(1 minute)${constants.yamlComments.timerEnableWarning.key}`,
            enabled: false,
            input: {
              '>>': 'script.yml',
              mode: 'monitoring',
            },
          },
        }
        const snsTopicLogicalId = `${constants.AlertingName}${constants.yamlComments.doNotEdit.key}`
        const snsTopic = {
          Type: 'AWS::SNS::Topic',
          Properties: {
            DisplayName: `\${self:service} Monitoring Alerts${constants.yamlComments.snsSubscriptions.key}`, // eslint-disable-line no-template-curly-in-string
          },
        }
        // ## Make the modifications that enable monitoring ##
        // add policy
        upgradedService.provider.iamRoleStatements.push(publishPolicy)
        // add environment variables
        if (!upgradedService.functions[constants.TestFunctionName].environment) {
          upgradedService.functions[constants.TestFunctionName].environment = {}
        }
        upgradedService.functions[constants.TestFunctionName].environment.TOPIC_ARN = environment.TOPIC_ARN
        upgradedService.functions[constants.TestFunctionName].environment.TOPIC_NAME = environment.TOPIC_NAME
        // add event
        if (!upgradedService.functions[constants.TestFunctionName].events) {
          upgradedService.functions[constants.TestFunctionName].events = []
        }
        upgradedService.functions[constants.TestFunctionName].events.push(event)
        // add alerting
        if (!upgradedService.resources) {
          upgradedService.resources = {}
        }
        if (!upgradedService.resources.Resources) {
          upgradedService.resources.Resources = {}
        }
        upgradedService.resources.Resources[snsTopicLogicalId] = snsTopic
        return upgradedService
      }

      const augmented = addAssets(service)
      let output = yaml.safeDump(augmented, { lineWidth: -1 })
      output = compareRestore(input, output)
      output = replaceCommentKeys(output)

      return output
    },
  })
