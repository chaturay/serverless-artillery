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
$ slsart invoke   // repeat as desired, before...
$ slsart remove
```

### Deeper Dive

```
$ slsart deploy                  // If not already deployed.

// create a custom test against your service with a 10 second duration and 3 RPS:
$ slsart script -e https://your.endpoint.com -d 10 -r 3
$ slsart invoke     // iterate on editing `./script.yml` and invoking as desired, before...

$ slsart remove
```

### More advanced use cases

Use arbitrary script files

`$ slsart -s /my/path/to/my.other.script.yml`

Generate a customizable script on the CLI (hit `https://your.endpoint.com` with `10` requests per second, scaling up to `25` requests per second over `60` seconds)

`$ slsart script -e https://your.endpoint.com -d 60 -r 10 -t 25`

Generate a local copy of the function that can be edited and redeployed with your changed settings.  This enables more advanced configurations of the function to send [load against VPC hosted services](https://serverless.com/framework/docs/providers/aws/vpc/), [use CSV files to specify variables in your URLs](https://artillery.io/docs/script-reference.html#Payloads) (hint: put your `csv` in the same directory as your `serverless.yml` and redeploy), or other non-default use cases.  Similarly, you'll want to do this if you need to alter hard-coded limits.  See https://docs.serverless.com for function configuration related documentation.  See https://artillery.io/docs for script configuration related documentation.

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
  invoke     Invoke your function with your Artillery script.  Will prefer a
             script given by `-s` over a `script.[yml|json]` in the current
             directory over the default script.
  remove     Remove the function and the associated resources created for or by
             it.
  script     Create a local Artillery script so that you can customize it for
             your specific load requirements.  See https://artillery.io for
             documentation.
  configure  Create a local copy of the deployment assets for modification and
             deployment.  See https://docs.serverless.com for documentation.

Options:
  --help         Show help                                             [boolean]
  --version      Show version number                                   [boolean]
  -D, --debug    Execute the command in debug mode.  It will be chatty about
                 what it is happening in the code.
  -V, --verbose  Execute the command in verbose mode.  It will be chatty about
                 what it is attempting to accomplish.
```

### Commands

#### deploy
```
$ slsart deploy --help

slsart deploy
```

#### invoke
```
$ slsart invoke --help

slsart invoke

Options:
  -s, --script  The Artillery script to execute.                        [string]
```

#### remove
```
$ slsart remove --help

slsart remove

```

#### script
```
$ slsart script --help

slsart script

Options:
  -e, --endpoint  The endpoint to load with traffic.                    [string]
  -d, --duration  The duration, in seconds, to load the given endpoint. [number]
  -r, --rate      The rate, in requests per second, at which to load the given
                  endpoint.                                             [number]
  -t, --rampTo    The rate to adjust towards away from the given rate, in
                  requests per second at which to load the given endpoint.
                                                                        [number]
  -o, --out       The file to output the generated script in to.        [string]
```

#### configure
```
$ slsart configure

slsart configure
```

## Script Customization

```
$ mkdir myCustomLoadTest    // Make your own test directory
$ cd myCustomLoadTest
$ slsart script             // Use slsart to get basic files
$ nano script.yml           // Edit event.json to change test endpoint
```

Modify the script.yml file to point at your own endpoint with the load profile that you want to test your application with.  See https://artillery.io for documentation on scripts.

For example, change the script to target your service:

```
---
  config:
    target: "https://your.endpoint.com"
  scenarios:
    -
      flow:
        -
          get:
            url: "/your/path"

```

and up the duration of the test to one minute and provide more load:

```
  config:
    phases:
      -
        duration: 60      # Duration of test in seconds
        arrivalRate: 100  # Starting rate (requests per second)
        rampTo: 200       # Ending rate (RPS at end of test duration)
```

Then invoke the function with your script again using:

```
$ slsart invoke
```

Now you can create a copy of the test, edit that copy, and invoke the function with it.

```
$ cp script.yml trafficSpike.yml
$ nano trafficSpike.yml
```

Update the load spec...  Then invoke it!

```
$ slsart invoke -s trafficSpike.yml
```

## Function Customization

TODO

## References
1. [artillery.io](https://artillery.io) for documentation about how to define your load shape, volume, targets, inputs, et cetera
2. [serverless.com](https://docs.serverless.com) for documentation about how to create a custom function configuration
