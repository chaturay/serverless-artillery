# serverless-artillery [![Build Status](https://travis-ci.org/Nordstrom/serverless-artillery.svg)](https://travis-ci.org/Nordstrom/serverless-artillery)
Combine [`serverless`](https://serverless.com) with [`artillery`](https://artillery.io) and you get `serverless-artillery` (a.k.a. `serverless-artillery`) for instant, cheap, and easy performance testing at scale.

We were motivated to create this project in order to facilitate moving performance testing earlier and more frequently into our CI/CD pipelines such that the question wasn't '`whether...`' but '`why wouldn't...`' '`...you automatically test perf test your system every time you check in?`'.

If you would like a more detailed walk through of motivations, setup, and usage, please consider taking a look at the workshop that was initially presented at the Serverless Conference, London 2016: https://github.com/Nordstrom/serverless-artillery-workshop. Load testing an ApiGateway endpoint?  You may want to use the [artillery-plugin-aws-sigv4](https://github.com/Nordstrom/artillery-plugin-aws-sigv4).  Want to record your results in InfluxDb?  You may want to use [artillery-plugin-influxdb](https://github.com/Nordstrom/artillery-plugin-influxdb).  Want to record your results without setting up a database? You may want to use [artillery-plugin-cloudwatch](https://github.com/Nordstrom/artillery-plugin-cloudwatch).

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

// run acceptance tests
$ slsart invoke -a               // iterate on editing `./script.yml` and invoking as desired, before...

// run performance tests
$ slsart invoke

$ slsart remove
```

Note that you may need to define `AWS_PROFILE` to declare the AWS credentials to use and perhaps `HTTP_PROXY` in order to escape your corporate proxy.  See the [Serverless Framework docs](https://serverless.com/framework/docs/) or the [workshop](https://github.com/Nordstrom/serverless-artillery-workshop) for details of how to set your system up for successful deployment, invocation, and removal.

### More advanced use cases

Use arbitrary script files

`$ slsart -s /my/path/to/my.other.script.yml`

Generate a customizable script on the CLI (hit `https://your.endpoint.com` with `10` requests per second, scaling up to `25` requests per second over `60` seconds)

`$ slsart script -e https://your.endpoint.com -d 60 -r 10 -t 25`

Generate a local copy of the function that can be edited and redeployed with your changed settings.  This enables more advanced configurations of the function to send [load against VPC hosted services](https://serverless.com/framework/docs/providers/aws/guide/functions/#vpc-configuration), [use CSV files to specify variables in your URLs](https://artillery.io/docs/script-reference.html#Payloads) (hint: put your `csv` in the same directory as your `serverless.yml` and redeploy), or other non-default use cases.  Similarly, you'll want to do this if you need to alter hard-coded limits.  See https://docs.serverless.com for function configuration related documentation.  See https://artillery.io/docs for script configuration related documentation.

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
             directory over the default script.  Defaults to running
             in performance mode but can be run in acceptance mode (-a).
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

Options:
  -r, --region  The region to deploy the function into.                 [string]
```

#### invoke
```
$ slsart invoke --help

slsart invoke

Options:
  -r, --region  The region to invoke the function in.                   [string]
  -s, --script  The Artillery script to execute.                        [string]
  -a, --acceptance  Execute the script in acceptance mode.  It will execute each
                    flow once, reporting failures.

```

#### remove
```
$ slsart remove --help

slsart remove

Options:
  -r, --region  The region to remove the function from.                 [string]
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
config:
  target: "https://your.endpoint.com"
scenarios:
  - flow:
    - get:
        url: "/your/path"

```

and up the duration of the test to one minute and provide more load:

```
config:
  phases:
    - duration: 60      # Duration of test in seconds
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
### Acceptance Mode 

Find defects before performance testing! Acceptance mode runs each flow in your script exactly once and reports the results.

To use:
 
Add -a to `invoke` command:
```
$ slsart invoke -a
```

To run exclusively in acceptance mode, hard code the mode into your script:
```
  mode: acceptance
  ...
```
*note: 'acceptance' may be abbreviated to 'acc' in the script*

Scripts running in acceptance mode do not require a `phases` array in the `config` section of the script but it is expected that performance tests will be run in this mode (via the `-a` flag) and have them anyway.

For the purposes of facilitating the use of this tool in a CI/CD pipeline, if any of the acceptance tests fail to successfully complete, the process will exit with a non-zero exit code.

## Function Customization

Sometimes you need to customize your load testing function.  Sometimes occassionally becomes all the times.  The endpoints you need to slam are in the VPC or you need to separate out various versions of the load testing function in order to maintain least privilege.  Perhaps you really want to draw from a data payload to feed IDs into the endpoints you will be hitting.  We welcome you to:

`slsart configure`

This command gives you a copy of the [Serverless](https://www.serverless.com/) service artifacts used to create and deploy your load testing function.  As such, you have free reign!

!!! Note that any time you make modifications you must execute `slsart deploy` to have them applied !!!

### Deployment and Settings Customization

Open up the `serverless.yml` you just created.  It will contain the default Serverless Framework service definition.  The Serverless Framework helps coalesce the specification of Lambda and various other serverless technologies in an easy to manage and maintain format.  Add a `vpc` attribute ([docs](https://serverless.com/framework/docs/providers/aws/guide/functions#vpc-configuration)) with `subnetIds` and `securityGroupIds` sub-attributes to target your VPC protected endpoints.  Add custom IAM rights ([docs](https://serverless.com/framework/docs/providers/aws/guide/iam/)) to the service to maintain least privilege.  You can use payloads by adding the payload to your lambda directory and adding the payload configuration to your script ([docs](https://artillery.io/docs/script-reference.html#Payloads)).

Full documentation of what is in the serverless.yml and the options you have available can be found at https://docs.serverless.com/framework/docs/.

### Load Test Execution Customization (artillery.io)

The script allows you to add plugins for various capabilities.  Load testing an ApiGateway endpoint?  You may want to use the [artillery-plugin-aws-sigv4](https://github.com/Nordstrom/artillery-plugin-aws-sigv4).  Want to record your results in InfluxDb?  You may want to use [artillery-plugin-influxdb](https://github.com/Nordstrom/artillery-plugin-influxdb).  Docs for plugin use and configuration are available from those projects and from [artillery-core's plugin docs](https://github.com/shoreditch-ops/artillery/blob/master/docs/plugins.md).

### Script Splitting Customization

The following controls are available in the default deployed function.  That said, the defaults are good and you generally won't need them until you have gotten deeper into implementation which is why we've put off mentioning until now.  If you define a `_split` attribute within the script, the values of that object will be used to alter the splitting of your script.
```
{
  _split: {
    maxScriptDurationInSeconds: 86400,  # Default listed.  Hard-coded max is 518400
    maxChunkDurationInSeconds: 240,     # Default listed.  Hard-coded max is 285
    maxScriptRequestsPerSecond: 5000,   # Default listed.  Hard-coded max is 50000
    maxChunkRequestsPerSecond: 25,      # Default listed.  Hard-coded max is 500
    timeBufferInMilliseconds: 15000,    # Default listed.  Hard-coded max is 30000
  }
  ...
}
```

See the [Splitting and Distribution Logic Customization](#Splitting and Distribution Logic Customization) section for an in depth discussion of how splitting is implemented and what you control with these parameters as well as the concerns involved in making decisions about them.  See the comments in [`~/lambda/handler.js`](lib/lambda/handler.js) for detailed documentation of the semantics the code has with regard to them (search for '`const constants`').  By the way, you now have the source code to change those hard-coded limits and can change them at will if you so desire - we wanted to provide a margin of safety and guardrails but not restrictions.

### Debugging and Tracing Behavior Customization

There are two primary tools for debugging and tracing the function and how it splits and executes the task it has been given.  Define the following in your script:

```
{
  _trace: true,
  _simulation: true,
  ...
}
```

#### _trace
The first causes the code to report the actions it is taking with your script and the chunks that it breaks your script into.  Expect statements such as this:

```
scheduling self invocation for 1234567890123 in 2345678901234 with a 3456789012345 ms delay
```

This would be produced by the following:

```
console.log(`scheduling self invocation for ${event._genesis} in ${event._start} with a ${timeDelay} ms delay`);
```

There are definitions that will help you understand these statements.  In the code you will see `_genesis`, `_start`, `now`, and `timeDelay`:

`_genesis`:   the datetime stamp immediately taken by the function that received the original script.  `_genesis` is added to the original script so that all child function executions of the original handler have a datetime stamp of when the original "load execution request" was received.  If you are not running many load tests simultaneously then this can serve as a unique ID for the current load execution.  This can be useful for correlation.  An improvement could include adding a unique factor to avoid collisions in such usage.  
`_start`:     the datetime stamp immediately taken by the current function that is executing on either the original script or a chunk of that original script.  This allows relative time reporting and evaluation with a function execution.  
`now`:        the datetime stamp taken when the log entry was produced.  
`timeDelay`:  a time delta (in milliseconds) between the current time of the current function and when it has scheduled to take the action reported in the current log entry.  

This mode is very useful in identifying what the system is doing or where something is going wrong.  #bugs-happen

#### _simulation

Setting the `_simulation` attribute to a truthy value will cause the function to split the script without taking action on the script.  Functionally, this comprises splitting the given script into pieces without invoking functions to handle the split chunks and/or execute the load described by those chunks.  Concretely, when it comes time to invoke new function instances for distributing the load, it simply invokes (or schedules an invokation of) itself.  Likewise, when it comes time to invoke the `artillery-core` entry point for generating load from the chunk, it instead invokes the simulation shim that reports what would have been executed and immediately completes.

This mode, in combination with `_trace` related behavior is very helpful in debugging script splitting behavior and identifying what the logic declares should occur.

### Splitting and Distribution Logic Customization

You've got the code.  Have at!  Have fun and consider contributing improvements back into the tool.  Thank you!

Some helpful notions used in the code and discussion of them follows...

#### Length

An artillery script also has a "length" and by length we mean that it specifies that some described load is to be executed over some absolute amount of time and that amount is the script's length.

#### Width

An artillery script has a "width" and by width we mean that it specifies some number of Requets Per Second (RPS) and the maximum number of RPS specified during any period of the script is its width.

#### Scripts

In fact, an artillery script is composed of a number of phases which occur one after the other.  Each of these phases has its own length and width.  The length is straightforwardly the duration of the phase.  The width of the phase is the maximum RPS that are declared for the entirety of that phase (e.g. a phase declaring a ramp from 0 to 500 RPS has a width of 500 RPS).  Phases are declared in serial in order to provide warming or not as appropriate for the load testing scenario that iterests you.

The length of the script is the sum of the lengths of these phases.  The width of the script is the maximum RPS that any of these phases declares.

#### Splitting

The splitting of a script comprises taking "chunks" off of the script.

First, we take chunks from the script by length.  This is driven by the maximum duration of the underlying function as a service (FaaS) provider that we are using.  For AWS Lambda, this is currently 5 minutes.  However, we need to allow for cold starts and as such must provide a buffer of time before we begin the execution of any specific load job.  Following the execution of a load job, the artillery-core framework calculates a summary and invokes custom analyzers (via the plugin capabilities it offers).  As a result, a tailing buffer is also needed to ensure execution can properly complete.

The result is a script chunk that can be executed within the length limited period the FaaS provider allows (no guarantees yet exist on whether a single function can execute the demanded load).  This chunk will be called the script for referential simplicity.  We also may have a remainder script that must be executed by a new function instance as the current splitting function nears its timeout.

Next, we take chunks from the script by width.  This is driven by the maximum requests per second that a single execution of the underlying function as a service (FaaS) provider is capable of pushing with high fidelity.  For AWS Lambda, we found 25 RPS to be a good level.  This is lower than the absolute ceiling that Lambda is capable of pushing for a reason.  First, each connection will be a separate opened and closed socket.  Second, if we are producing to many connections, we can be in the middle of making a request when we receive the response of a separate request.  Given that this is implemented in nodejs, we have one thread and that means the timestamping of the receipt of that response is artificially and incorrectly delayed.  We found that at RPS above 25 we observed an increase in the volatility of observed latencies.  That written, if you do not intend to record your latencies, then you could bump this up to the limit of the FaaS service (i.e. `_split.maxChunkRequestsPerSecond = 300` or so).  If you don't care about having separate sockets per request, you can alter that with artillery configuration as well.

Anyway...  The result is a script chunk that is less than the limited period and also executable by a single function instance.  Therefore, we invoke a single function with the chunk to execute it.

## Generalization

Wait.  There's a general pattern here of distributed load execution!

Yes!

We know!

We're excited too!

We've already begun writing a plugin-driven generalization of this pattern.  Any task that a declaration can be provided for which itself can be executed in parallel and broken into parallelizable chunks can be driven using this capabiltiy.

Watch for that effort here: https://github.com/Nordstrom/serverless-star

We expect to retro-fit this project with the serverless-star project as its first use case and proof-of-not-a-painful-waste-of-our-time-ness™.

## References
1. [artillery.io](https://artillery.io) for documentation about how to define your load shape, volume, targets, inputs, et cetera
2. [serverless.com](https://docs.serverless.com/framework/docs/) for documentation about how to create a custom function configuration
3. [serverless-artillery](https://github.com/Nordstrom/serverless-artillery) README for documentation on the use of this tool
4. [serverless-star](https://github.com/Nordstrom/serverless-star) Next generation implementation and generalization of the arbitrarily wide work distribution capability
