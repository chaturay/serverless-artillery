# *** UNDER ACTIVE DEVELOPMENT - EXPECT LOTS OF CHURN THRU Friday October 21, 2016 ***

# serverless-artillery [![Build Status](https://travis-ci.org/Nordstrom/serverless-artillery.svg)](https://travis-ci.org/Nordstrom/serverless-artillery)
Combine [`serverless`](https://serverless.com) with [`artillery`](https://artillery.io) and you get `serverless-artillery` (a.k.a. `serverless-artillery`) for instant, cheap, and easy performance testing at scale

## Installation
We assume you have node.js (v4 or better) installed.  Likewise you should have the serverless framework (v1.0+) either installed globally or available in the local `node_modules`.

```
npm install -g serverless-artillery
```

## Quick Start & Finish

```
$ slsart deploy   // and then
$ slsart run      // repeat as desired, before...
$ slsart cleanup
```

### Deeper Dive

```
$ slsart deploy                  // If not already deployed.

// create a custom test against your service with a 10 second duration and 3 RPS, save to myScript.yml:
$ slsart script -e http://your.endpoint.com -d 10 -r 3 > myScript.yml

$ slsart run -s myScript.yml     // iterate on editting and running as desired, before...

$ slsart cleanup
```

### More advanced use cases

Use arbitrary script files

`$ slsart -s my.other.script.yml`

Configure a generated script on the CLI (hit your.endpoint.com with 10 requests per second, scaling up to 25 requests per second over 60 seconds)

`$ slsart script -e http://your.endpoint.com -d 60 -r 10 -t 25`

Create a local copy of the function that can be editted and redeployed with the new settings.  This enables more advanced configurations of the function to load VPC hosted services or other non-default use cases.  Similarly, you'll want to do this if you need to alter hard-coded limits.  See https://docs.serverless.com for configuration related documentation.

```
$ slsart configure
$ nano serverless.yml
$ nano handler.js
```

## Detailed Usage

```
$ slsart --help
Commands:
  deploy     Deploy a default version of the function that will execute your
             Artillery scripts.
  run        Run your Artillery script.  Will prefer a script given by `-s` over
             a `script.[yml|json]` in the current directory over the default
             script.
  cleanup    Remove the function and the associated resources created for or by
             it.
  script     Create a local Artillery script so that you can customize it for
             your specific load requirements.  See https://artillery.io for
             documentation.
  configure  Create a local copy of the deployment assets for modification and
             deployment.  See https://docs.serverless.com for documentation.

Options:
  --help         Show help                                             [boolean]
  --version      Show version number                                   [boolean]
  --debug, -D    Run the command in debug mode.
  --verbose, -v  Run the command in verbose mode.
```

### Commands

#### deploy
```
$ slsart deploy --help

slsart deploy

Options:
  --help       Show help  [boolean]
  --version    Show version number  [boolean]
  --debug, -D  Run the command in debug mode.
  --func, -f   Lambda function name to execute.  [string] [default: "loadGenerator"]

```

#### run
```
$ slsart run --help

slsart run

Options:
  --help        Show help  [boolean]
  --version     Show version number  [boolean]
  --debug, -D   Run the command in debug mode.
  --script, -s  The Artillery script to execute.  [string] [default: "script.yml"]
  --func, -f    Lambda function name to execute.  [string] [default: "loadGenerator"]


```

#### cleanup
```
$ slsart cleanup --help

slsart cleanup

Options:
  --help       Show help  [boolean]
  --version    Show version number  [boolean]
  --debug, -D  Run the command in debug mode.
  --func, -f   Lambda function name to execute.  [string] [default: "loadGenerator"]

```

#### script
```
$ slsart script --help

Commands:
  deploy     Deploy a default version of the function that will execute your Artillery scripts.
  run        Run your Artillery script.  Will prefer a script given by `-s` over a `script.[yml|json]`
             in the current directory over the default script.
  cleanup    Remove the function and the associated resources created for or by it.
  script     Create a local Artillery script so that you can customize it for your specific load requirements.
             See https://artillery.io for documentation.
  configure  Create a local copy of the deployment assets for modification and deployment.
             See https://docs.serverless.com for documentation.

Options:
  --help         Show help  [boolean]
  --version      Show version number  [boolean]
  --debug, -D    Run the command in debug mode.
  --verbose, -v  Run the command in verbose mode.


```

#### configure
```
$ slsart configure
```

## Script Customization

```
$ mkdir myCustomLoadTest    // Make your own test directory
$ cd myCustomLoadTest
$ slsart script             // Use slsart to get basic files
$ nano script.yml           // Edit event.json to change test endpoint
```

Modify the script.yml file to point at your own endpoint with the load profile that you want to test your application with.  See https://artillery.io for documentation on scripts.

For example, change the "flow" to hit your application:

```
 scenarios:
    -
      flow:
        -
          get:
            url: "http://your.endpoint.com"    # URL of service to test

```

and up the duration of the test to one minute and provide more load:

```
    phases:
      -
        duration: 60      # Duration of test in seconds
        arrivalRate: 100  # Starting rate (requests per second)
        rampTo: 200       # Ending rate (RPS at end of test duration)
```

Then run the test again using:

```
$ slsart run
```

Now you can create a copy of the test and run a different test.

```
$ cp script.yml trafficSpike.yml
$ nano trafficSpike.yml
```

Update the test spec...  Then run it!

```
$ slsart run -f trafficSpike.yml
```

## Function Customization

TODO

## References
1. [artillery.io](https://artillery.io) for documentation about how to define your load shape, volume, targets, inputs, et cetera
2. [serverless.com](https://docs.serverless.com) for documentation about how to create a custom function configuration
