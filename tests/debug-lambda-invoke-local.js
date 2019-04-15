/*
 * Use this NodeJS script to invoke the lambda handler
 * in order to debug it locally. Useful things to adjust
 * below would be the input event (script) content (1),
 * the invocation context (2), including the name of a lambda
 * deployed which might be invoked (3).
 */

const handler = require('../lib/lambda/handler.js')
const yaml = require('js-yaml')
const fs = require('fs')

const script = fs.readFileSync('./script.yml', 'utf8')
const input = yaml.safeLoad(script)

// 1) Use this code to inject script directly.
// Otherwise, will use script.yml in current directory.
//
// const input = JSON.parse(`{
//     "sampling": {
//         "size": 4,
//         "errorBudget": 3,
//         "warningThreshold": 1
//     },
//     "mode": "acc",
//     "config": {
//         "target": "https://postman-echo.com/headers",
//         "phases": [
//             {
//                 "duration": 1,
//                 "arrivalRate": 1
//             },
//             {
//                 "duration": 1,
//                 "arrivalRate": 1
//             }
//         ],
//         "defaults": {
//             "headers": {
//                 "my-sample-header": "my-sample-header-value"
//             }
//         }
//     },
//     "scenarios": [
//         {
//             "flow": [
//                 {
//                     "get": {
//                         "url": "/",
//                         "match": [
//                             {
//                                 "json": "$.headers.my-sample-header",
//                                 "value": "my-sample-header-valueXXX"
//                             },
//                             {
//                                 "json": "$.headers.host",
//                                 "value": "postman-echo.com"
//                             }
//                         ]
//                     }
//                 }
//             ]
//         }
//     ]
// }`)

// 2) Change the invocation context, if needed.
const context = JSON.parse(`{
    "callbackWaitsForEmptyEventLoop": true,
    "logGroupName": "/aws/lambda/serverless-artillery-vdOLEihMSq-greg-loadGenerator",
    "logStreamName": "2019/03/13/[$LATEST]463c049bf6854346bb3d8ffb3f88b611",
    "functionName": "serverless-artillery-vdOLEihMSq-greg-loadGenerator",
    "memoryLimitInMB": "1024",
    "functionVersion": "$LATEST",
    "invokeid": "d5a46516-64da-4de8-b534-875e6d6d97e8",
    "awsRequestId": "d5a46516-64da-4de8-b534-875e6d6d97e8",
    "invokedFunctionArn": "arn:aws:lambda:us-east-1:515126931066:function:serverless-artillery-vdOLEihMSq-greg-loadGenerator"
}`)
context.getRemainingTimeInMillis = () => 90 * 1000

// 3) Adjust the name of the deployed function, if it needs to be invoked.
context.functionName = 'serverless-artillery-greg-loadGenerator'

handler.handler(input, context, (error, result) => {
  if (error) console.log('Error: ', JSON.stringify(error))
  if (result) console.log('Result: ', JSON.stringify(result))
})
