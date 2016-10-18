# *** UNDER ACTIVE DEVELOPMENT - EXPECT LOTS OF CHURN THRU Friday October 21, 2016 ***

# serverless-artillery [![Build Status](https://travis-ci.org/Nordstrom/serverless-artillery.svg)](https://travis-ci.org/Nordstrom/serverless-artillery)
Combine [`serverless`](https://serverless.com) with [`artillery`](https://artillery.io) and you get `serverless-artillery` (a.k.a. `serverless-artillery`) for instant, cheap, and easy performance testing at scale

## Installation
We assume you have node.js (v4 or better) installed.  Likewise you should have the serverless framework (v1.0+) either installed globally or available in the local `node_modules`.

```
npm install -g serverless-artillery
```

## Usage

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

### Quick Start & Finish

```
slsart deploy   // and then
slsart run      // repeat as desired, before
slsart cleanup
```

### Options

#### deploy
```
slsart deploy --help
```

#### run
```
slsart run --help

Options:
  --script, -s  The Artillery script to execute.                        [string]
```

#### cleanup
```
slsart cleanup --help
```

#### script
```
slsart script --help

Options:
  --endpoint, -e  The endpoint to load with traffic.                    [string]
  --duration, -d  The duration, in seconds, to load the given endpoint. [number]
  --rate, -r      The rate, in requests per second, at which to load the given
                  endpoint.                                             [number]
  --rampTo, -t    The rate to adjust towards away from the given rate, in
                  requests per second at which to load the given endpoint.
                                                                        [number]
```

#### configure
```
slsart configure
```

### Script Customization

```
mkdir myCustomLoadTest    // Make your own test directory
cd myCustomLoadTest
slsart script             // Use slsart to get basic files
nano script.yml           // Edit event.json to change test endpoint
```

Modify the script.yml file to point at your own endpoint with the load profile that you want to test your application with.  See https://artillery.io for documentation on scripts.

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
slsart run
```

Now you can create a copy of the test and run a different test.

```
cp script.yml trafficSpike.yml
nano trafficSpike.yml
```

Update the test spec...  Then run it!

```
slsart run -f trafficSpike.yml
```

### Function Customization

TODO

## References
1. [artillery.io](https://artillery.io) for documentation about how to define your load shape, volume, targets, inputs, et cetera
