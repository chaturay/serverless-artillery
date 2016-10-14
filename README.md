# serverless-artillery [![Build Status](https://travis-ci.org/Nordstrom/serverless-artillery.svg)](https://travis-ci.org/Nordstrom/serverless-artillery)
Combine [`serverless`](https://serverless.com) with [`artillery`](https://artillery.io) and you get `serverless-artillery` (a.k.a. `serverless-artillery`) for instant, cheap, and easy performance testing at scale

## Installation
We assume you have node.js (v4 or better) installed.  Likewise you should have the serverless framework.

```
npm install -global serverless
npm install -global serverless-artillery
```

## Usage

```
$ slsart --help

  Usage: serverless-artillery <action>

  Load testing using Serverless and Artillery.

  Actions:

    deploy  - Upload testing Lambda to AWS
    run     - Use Lambda to perform test
    cleanup - Remove the testing Lambda from AWS
    copy    - Copy Lambda service files to current directory

  Options:

    -h, --help                 output usage information
    -V, --version              output the version number
    -s, --script <testScript>  Path to Artillery test script (for "run" action)
    -f, --func <functionName>  Name of Lambda function


```

### Example

```
slsart deploy   // and then
slsart run      // repeat as desired, before
slsart cleanup
```

### Options

long | short | description | example
---- | ----- | ----------- | -------
`--script` | `-s` | specify the artilery script to use | `-s yourfile.json` or `-s yourfile.yaml` or `-s yourfile.yml`
`--func` | `-f` | specify the function name to use | `-f gnarlySuperLoadTestLambda`

### Customization

```
cd ~
mkdir myCustomLoadTest    // Make your own test directory
slsart copy               // Use slsart to get basic files
nano event.json           // Edit event.json to change test endpoint

```

Modify the event.json file to test your application.

For example, change the "flow" to hit your application:

```
                   "get": {
                        "url": "http://my-super-app.com"
                    }
```

and up the duration of the test to one minute and provide more load:

```
       "phases": [
            {
                "duration": 60,
                "arrivalRate": 10,
                "rampTo": 20
            }
        ]
```

Then run the test again using:

```
slsart run -f ./event.json
```

## References
1. [artillery.io](https://artillery.io) for documentation about how to define your load shape, volume, targets, inputs, et cetera
