# Serverless-artillery [![Build Status](https://travis-ci.org/Nordstrom/serverless-artillery.svg?branch=master)](https://travis-ci.org/Nordstrom/serverless-artillery) [![Coverage Status](https://coveralls.io/repos/github/Nordstrom/serverless-artillery/badge.svg?branch=master)](https://coveralls.io/github/Nordstrom/serverless-artillery?branch=master)

[//]: # (Thanks to https://www.divio.com/en/blog/documentation/)

# Introduction
Combine [`serverless`](https://serverless.com) with [`artillery`](https://artillery.io) and you get `serverless-artillery` (a.k.a. `slsart`). 

Serverless-artillery makes it easy to test your services for performance and functionality quickly, easily and without having to maintain any servers or testing infrastructure.

### Use serverless-artillery if
1. You want to know if your services (either internal or public) can handle different amount of traffic load (i.e. performance or load testing).
1. You want to test if your services behave as you expect after you deploy new changes (i.e. acceptance testing).
1. You want to constantly monitor your services over time to make sure the latency of your services is under control (i.e. monitoring mode).

# Table of Contents
- [Installation](#installation)
  - [Installing on local machine](#installing-on-local-machine)
    - [Prerequisite](#prerequisite)
      - [1. Node JS](#1-node-js)
      - [2. Serverless Framework CLI](#2-serverless-framework-cli)
    - [Installing serverless-artillery](#installing-serverless-artillery)
  - [Installing in Docker](#installing-in-docker)
- [Uninstallation](#uninstallation)
- [How it works?](#how-it-works)
  - [Load generator Lambda function on AWS](#load-generator-lambda-function-on-aws)
- [Before running serverless-artillery](#before-running-serverless-artillery)
  - [Setup for Nordstrom Technology](#setup-for-nordstrom-technology)
  - [Setup for everyone else](#setup-for-everyone-else)
- [Tutorial 1: Run a quick performance test](#tutorial-1-run-a-quick-performance-test)
  - [1. Setup AWS account credentials](#1-setup-aws-account-credentials)
  - [2. Command line](#2-command-line)
  - [3. Deploy](#3-deploy)
  - [4. Invoke](#4-invoke)
  - [5. Remove](#5-remove)
- [Tutorial 2: Performance test with custom script](#tutorial-2-performance-test-with-custom-script)
  - [1. Create new directory](#1-create-new-directory)
  - [2. Create `script.yml`](#2-create-scriptyml)
  - [3. Understanding `script.yml`](#3-understanding-scriptyml)
  - [4. Customizing `script.yml`](#4-customizing-scriptyml)
  - [5. Setup AWS account credentials](#5-setup-aws-account-credentials)
  - [6. Deploy assets to AWS](#6-deploy-assets-to-aws)
  - [7. Invoke performance test](#7-invoke-performance-test)
  - [8. Remove assets from AWS](#8-remove-assets-from-aws)
- [Tutorial 3: Performance test with custom deployment assets](#tutorial-3-performance-test-with-custom-deployment-assets)
  - [1. Create new directory](#1-create-new-directory-1)
  - [2. Create `script.yml`](#2-create-scriptyml)
  - [3. Understanding `script.yml`](#3-understanding-scriptyml)
  - [4. Customizing `script.yml`](#4-customizing-scriptyml)
  - [5. Create custom deployment assets](#5-create-custom-deployment-assets)
  - [6. Understanding `serverless.yml`](#6-understanding-serverlessyml)
    - [a. Service name](#a-service-name)
    - [b. Load generator Lambda function name](#b-load-generator-lambda-function-name)
    - [c. Load generator Lambda function permissions](#c-load-generator-lambda-function-permissions)
  - [7. Customizing `serverless.yml`](#7-customizing-serverlessyml)
    - [a. Customization for Nordstrom Engineers](#a-customization-for-nordstrom-engineers)
    - [b. Service name](#b-service-name)
    - [c. Plugins](#c-plugins)
      - [i. CloudWatch plugin](#i-cloudwatch-plugin)
      - [ii. Datadog plugin](#ii-datadog-plugin)
  - [8. Setup AWS account credentials](#8-setup-aws-account-credentials)
  - [9. Deploy assets to AWS](#9-deploy-assets-to-aws)
  - [10. Invoke performance test](#10-invoke-performance-test)
  - [11. Remove assets from AWS](#11-remove-assets-from-aws)
- [Tutorial 4: Killing in-progress performance test](#tutorial-4-killing-in-progress-performance-test)
  - [1. Increase `duration`](#1-increase-duration)
  - [2. Setup AWS account credentials](#2-setup-aws-account-credentials)
  - [3. Deploy assets to AWS](#3-deploy-assets-to-aws)
  - [4. Invoke performance test](#4-invoke-performance-test)
  - [5. Kill the in-progress performance test](#5-kill-the-in-progress-performance-test)
  - [6. Wait before re-deploying](#6-wait-before-re-deploying)
- [Performance test workshop](#performance-test-workshop)
- [Other commands and use cases](#other-commands-and-use-cases)
  - [Killing in-progress performance test](#killing-in-progress-performance-test)
  - [Create customized `script.yml`](#create-customized-scriptyml)
  - [Performance test using script file with different name/path](#performance-test-using-script-file-with-different-namepath)
  - [Reserved and unsupported flags](#reserved-and-unsupported-flags)
    - [Reserved flags](#reserved-flags)
    - [Unsupported flags](#unsupported-flags)
  - [Providing a data store to view the results of your performance test](#providing-a-data-store-to-view-the-results-of-your-performance-test)
  - [Related tools and plugins](#related-tools-and-plugins)
  - [Performance testing VPC hosted services](#performance-testing-vpc-hosted-services)
  - [Using Payload/CSV files to inject data in scenarios of your `script.yml`](#using-payloadcsv-files-to-inject-data-in-scenarios-of-your-scriptyml)
  - [Advanced customization use cases](#advanced-customization-use-cases)
    - [Deployment assets and settings customization](#deployment-assets-and-settings-customization)
    - [Test script and execution customization using Artillery.io](#test-script-and-execution-customization-using-artilleryio)
    - [Script splitting customization](#script-splitting-customization)
    - [Debugging and Tracing Behavior Customization](#debugging-and-tracing-behavior-customization)
      - [`_trace`](#_trace)
      - [`_simulation`](#_simulation)
    - [Splitting and Distribution Logic Customization](#splitting-and-distribution-logic-customization)
      - [Scripts](#scripts)
      - [Splitting](#splitting)
- [Acceptance mode](#acceptance-mode)
  - [`match` clause](#match-clause)
  - [Acceptance test command](#acceptance-test-command)
  - [Tutorial 5: Acceptance mode](#tutorial-5-acceptance-mode)
    - [1. Customize `script.yml`](#1-customize-scriptyml)
    - [2. Setup AWS account credentials](#2-setup-aws-account-credentials-1)
    - [3. Deploy assets to AWS](#3-deploy-assets-to-aws-1)
    - [4. Invoke acceptance test](#4-invoke-acceptance-test)
    - [5. Observe the results](#5-observe-the-results)
    - [6. Test failure scenario](#6-test-failure-scenario)
      - [6.1. Edit `script.yml` to fail `match`](#61-edit-scriptyml-to-fail-match)
      - [6.2. Invoke acceptance test](#62-invoke-acceptance-test)
      - [6.3. Observe the results](#63-observe-the-results)
    - [7. Remove assets from AWS](#7-remove-assets-from-aws)
  - [More about acceptance mode](#more-about-acceptance-mode)
    - [Acceptance testing in CI/CD](#acceptance-testing-in-cicd)
    - [Run `script.yml` exclusively in acceptance mode](#run-scriptyml-exclusively-in-acceptance-mode)
    - [Use same `script.yml` for performance and acceptance testing and monitoring](#use-same-scriptyml-for-performance-and-acceptance-testing-and-monitoring)
    - [To configure acceptance behavior](#to-configure-acceptance-behavior)
- [Monitoring mode](#monitoring-mode)
  - [Tutorial 6: Monitoring mode without serverless-artillery alert](#tutorial-6-monitoring-mode-without-serverless-artillery-alert)
    - [1. Create custom deployment assets](#1-create-custom-deployment-assets)
    - [2. Setup AWS account credentials](#2-setup-aws-account-credentials-2)
    - [3. Tryout monitoring mode](#3-tryout-monitoring-mode)
      - [3.1. Deploy assets to AWS](#31-deploy-assets-to-aws)
      - [3.2. Invoke monitoring once](#32-invoke-monitoring-once)
    - [4. Customize deployment assets to turn on monitoring](#4-customize-deployment-assets-to-turn-on-monitoring)
    - [5. Deploy assets to AWS to start monitoring](#5-deploy-assets-to-aws-to-start-monitoring)
    - [6. Pause monitoring](#6-pause-monitoring)
      - [6.1. Method 1: Using CloudWatch Rules](#61-method-1-using-cloudwatch-rules)
      - [6.2. Method 2: Turn monitoring off in `serverless.yml`](#62-method-2-turn-monitoring-off-in-serverlessyml)
    - [7. Remove assets from AWS](#7-remove-assets-from-aws-1)
  - [Tutorial 7: Monitoring mode with serverless-artillery alert](#tutorial-7-monitoring-mode-with-serverless-artillery-alert)
    - [1. Create custom deployment assets](#1-create-custom-deployment-assets-1)
    - [2. Setup AWS account credentials](#2-setup-aws-account-credentials-3)
    - [3. Customize script to have `match` clause](#3-customize-script-to-have-match-clause)
    - [4. Customize deployment assets to add at least one subscription](#4-customize-deployment-assets-to-add-at-least-one-subscription)
    - [5. Tryout monitoring mode](#5-tryout-monitoring-mode)
      - [5.1. Deploy assets to AWS](#51-deploy-assets-to-aws)
      - [5.2. Invoke monitoring once](#52-invoke-monitoring-once)
    - [6. Test failure scenario](#6-test-failure-scenario-1)
      - [6.1. Edit `script.yml` to fail `match`](#61-edit-scriptyml-to-fail-match-1)
      - [6.2. Invoke monitoring once](#62-invoke-monitoring-once)
    - [7. Customize deployment assets to turn on monitoring](#7-customize-deployment-assets-to-turn-on-monitoring)
    - [8. Deploy assets to AWS to start monitoring](#8-deploy-assets-to-aws-to-start-monitoring)
    - [9. Pause monitoring](#9-pause-monitoring)
    - [10. Remove assets from AWS](#10-remove-assets-from-aws)
  - [More about monitoring mode](#more-about-monitoring-mode)
    - [Run `script.yml` exclusively in monitoring mode](#run-scriptyml-exclusively-in-monitoring-mode)
    - [Use same `script.yml` for performance and acceptance testing and monitoring](#use-same-scriptyml-for-performance-and-acceptance-testing-and-monitoring-1)
    - [To configure monitoring behavior](#to-configure-monitoring-behavior)
- [Upgrading customized projects built with older versions of serverless-artillery](#upgrading-customized-projects-built-with-older-versions-of-serverless-artillery)
  - [Known Upgrade Issues](#known-upgrade-issues)
- [Detailed Usage](#detailed-usage)
  - [Commands](#commands)
    - [`deploy`](#deploy)
    - [`invoke`](#invoke)
    - [`kill`](#kill)
    - [`remove`](#remove)
    - [`script`](#script)
    - [`configure`](#configure)
    - [`upgrade`](#upgrade)
- [Troubleshooting](#troubleshooting)
  - [Problems installing?](#problems-installing)
- [External References](#external-references)
- [If you've read this far](#if-youve-read-this-far)

# Installation

## Installing on local machine
You can install serverless-artillery on your local machine as follows.
### Prerequisite
#### 1. Node JS
Before installing serverless-artillery, install Node JS from https://nodejs.org/en/download/ or with your operating system’s package manager. You can install the latest LTS version. We support any version higher than maintenance LTS (v8+).
#### 2. Serverless Framework CLI
Before installing serverless-artillery, install Serverless Framework CLI (a.k.a. Serverless) (v1.38+). It should be either installed globally or available in the local node_modules. To install globally use the following command.
```
npm install -g serverless
```

### Installing serverless-artillery
Now you can install serverless-artillery on your local machine using the following command.
```
npm install -g serverless-artillery
```
To check that the installation succeeded, run:
```
slsart --version
```
You should see serverless-artillery print its version if the installation has been successful.

## Installing in Docker
If you prefer using Docker, refer to [example Dockerfile](Dockerfile) for installation. Please note that, post installation causes permission issues when installing in a Docker image. To successfully install in Docker make sure to add the following to your Dockerfile before the Serverless Framework CLI (a.k.a. Serverless) and serverless-artillery install.
```
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin
```

# Uninstallation
When needed, you can uninstall serverless-artillery from you local machine using the following command.
```
npm uninstall -g serverless-artillery
```

# How it works?
<img src="docs/HowItWorks.jpg" width="442">

* Serverless-artillery would be installed and run on your local machine. From command line run `slsart --help` to see various serverless-artillery commands.
* It takes your JSON or YAML load script (`script.yml`) that specifies 
  * test target/URL/endpoint/service
  * load progression
  * and the scenarios that are important for your service to test.
* When you run `slsart deploy` command, serverless-artillery deploys a **load generator Lambda function**, on your AWS account along with other assets.
* Running the tests
  * **Performance test:** When you run `slsart invoke` command, serverless-artillery would invoke the load generator Lambda function.
    * It would generate the number of requests as specified in `script.yml` to specified test target in order to run the specified scenarios.
  * **Acceptance test:** When you run `slsart invoke -a` command, serverless-artillery would invoke the load generator Lambda function in acceptance test mode where it runs each scenario in your script exactly once and reports the results.
  * **Monitoring:** When you customize the deployment assets to turn on monitoring and deploy those assets using `slsart deploy` command, the load generator Lambda function is invoked in monitoring mode once a minute 24x7 where it runs each scenario in your script 5 times and sends an alert if it detects a problem. 
* When you run `slsart remove` command, serverless-artillery would remove these assets from your AWS account.
* When you run `slsart kill` command, serverless-artillery would kill the in-progress test and remove these assets from your AWS account.

## Technologies powering serverless-artillery
<details><summary>Click to expand/collapse</summary>
<p>

### Serverless Framework
- The [Serverless Framework](https://serverless.com) makes managing (deploying/updating/removing) cloud assets easy.
- It translates a `yaml` file to deployable assets of the target cloud provider (like AWS).
- Serverless-artillery uses it to manage required assets to your cloud account.

### Artillery.io
- [Artillery.io](https://artillery.io/) (built by Hassy Veldstra of shoreditch-ops) is an existing open-source node package, built for easy load testing and functional testing of a target/service/endpoint/URL. It provides a simple but powerful means of specifying how much load to create and what requests that load should comprise.
- It takes in a developer-friendly JSON or YAML load script that specifies 
  - target/URL/endpoint
  - load progression
  - and the scenarios that are important for your service to test.
- It generates specified load, and measures and reports the resulting latency and return codes.
- It generates the load by running on your local machine or servers.
- However, if you specify more load in your script than what can be produced on your machine, artillery will throttle down the load specified in your script. While it is simple to distribute artillery across a fleet of servers, you must then manage, coordinate, and retire them. It is not a serverless solution. This is the task that serverless-artillery steps in to remove from your plate.

### Serverless-artillery
- Serverless-artillery allows your script to specify an amount of load far exceeding the capacity of a single server to execute.
- It breaks that script into smaller chunks (sized for a single instance of load generator Lambda function) and distribute the chunks for execution across multiple instances of load generator Lambda function.
- Since this is done using a FaaS provider, the ephemeral infrastructure used to execute your load disappears as soon as your load tests are complete.

</p>
</details>

## Load generator Lambda function on AWS
<details><summary>Click to expand/collapse</summary>
<p>

<img src="docs/Architecture.gif">

- Serverless-artillery generates the requests to run the specified tests using load generator Lambda function, which is deployed and invoked on AWS along with other assets.
  -  Naming format is `<customized-service-name default:serverless-artillery>-<optional-unique-string-><stage default:dev>-loadGenerator`. For example, `serverless-artillery-dev-loadGenerator` or `serverless-artillery-XnBa473psJ-dev-loadGenerator`.
- It has an ephimeral architecture. It only exists as long as you need it.
- It runs Artillery.io node package in AWS Lambda function.
  - Each lambda function can only generate a certain amount of load, and can only run for up to five minutes (five minutes was a built-in limitation of AWS Lambda. Now it has been raised to 15 minutes). 
  - Given these limitations, it is often necessary to invoke more lambdas - both to scale horizontally (to generate higher load) as well as handing off the work to a new generation of lambdas before their run-time has expired.
- Above diagram shows how Serverless Artillery solves this problem.
  - It first runs the Lamdba function in a **controller** mode. It examines the submitted load config JSON/YAML script (this is identical to the original “servered” [Artillery.io](https://artillery.io/) script). This script is also referred to as original script. If the load in the original script exceeds what a single lambda is configured to handle, then the load config is chopped up into workloads achievable by a single lambda.
  - Controller lambda then invokes as many **worker** lambdas as necessary to generate the load. Controller lambda passes a script to worker lambda that is created by chopping up the original script.
  - Towards the end of the Lambda runtime the controller lambda invokes a new controller lambda to produce load for the remaining duration.
- The result of the load test can be reported to CloudWatch, InfluxDB or Datadog through plugins and then visualized with CloudWatch, Grafana or Datadog dashboard.

</p>
</details>

# Before running serverless-artillery
Serverless-artillery needs to _deploy_ assets like [load generator Lambda function](#load-generator-lambda-function-on-aws) to AWS, _invoke_ the function to run the tests and _remove_ these assets from AWS when not needed. Hence you need an AWS account and setup credentials with which to deploy, invoke and remove the assets from AWS.

## Setup for Nordstrom Technology
If you are a **_Nordstrom_** engineer, please see the page titled **_`Serverless Artillery - Nordstrom Technology Setup`_** in **Confluence** and follow the instructions there.
## Setup for everyone else
In order to use serverless-artillery, depending on the AWS account environment you're working in, you may need to define `AWS_PROFILE` to declare the AWS credentials to use and possibly `HTTP_PROXY` in order to escape your corporate proxy.  See the [Serverless Framework docs](https://serverless.com/framework/docs/) or serverless-artillery workshop's [Lesson 0](https://github.com/Nordstrom/serverless-artillery-workshop/tree/master/Lesson0%20-%20Before%20the%20workshop) followed by [**Step 1** of Lesson 1](https://github.com/Nordstrom/serverless-artillery-workshop/tree/master/Lesson1%20-%20Hello%2C%20artillery#step-1-serverless-artillery-requires-aws-credentials) for details of how to set your local machine for successful deployment, invocation, and removal of assets from your AWS accounts. 

# Performance mode (performance/load testing)
You can use serverless-artillery to performance test or load test your service/target/endpoint/URL. Performance testing framework forms the basis of the other two modes of serverless-artillery, i.e. acceptance mode and monitoring mode.

## Tutorial 1: Run a quick performance test
If you want to quickly test your setup or see serverless-artillery in action, do the following to quickly run a **small load/performance test**.

### 1. Setup AWS account credentials
Make sure you have [setup your AWS account credentials](#before-running-serverless-artillery) before proceeding.

### 2. Command line
Go to command line for all the following steps in this tutorial. You can run the steps of this tutorial from anywhere in command line since the commands you run in this tutorial will not create any files on your local machine.

### 3. Deploy
The `slsart deploy` command deploys required assets (like [load generator Lambda function](#load-generator-lambda-function-on-aws)) to the AWS account you selected in the previous step. 

By _default_ it uses `service` name `serverless-artillery` and `stage` name `dev`. And hence the _default_ AWS CloudFormation Stack name becomes `serverless-artillery-dev` (format: `<service-name default:serverless-artillery>-<stage-name default:dev>`). You will see that if you go to your AWS account console > CloudFormation after running the command.

Since multiple developers could share an AWS account, we recommend creating a unique stack for your use. For that we recommend either using custom deployment assets as shown in [Tutorial 3](#tutorial-3-performance-test-with-custom-deployment-assets) or use the _optional_ `stage` argument as shown in the following command.
```
slsart deploy --stage <your-unique-stage-name>
```
The AWS CloudFormation Stack name would be `serverless-artillery-<your-unique-stage-name>`.

For example,
```
slsart deploy --stage test1
```
The AWS CloudFormation Stack name in this case would be `serverless-artillery-test1`. 

### 4. Invoke
The following command will invoke [load generator Lambda function](#load-generator-lambda-function-on-aws) using the default load script (`script.yml`), creating small traffic against the sample endpoint specified in the default script. Note that this default load script is part of the global install of serverless-artillery and not in the local folder from where you are running the command.
```
slsart invoke --stage <your-unique-stage-name>
```
At the end of the test serverless-artillery will generate a report of the test. **Please note that this report is generated only for small load.** See [here](#providing-a-data-store-to-view-the-results-of-your-performance-test) for details.

If you go to AWS Lambda console > find the `loadGenerator` Lambda corresponding to your stack > `Monitoring` tab > `Invocations` graph, you will see that the Lambda function was invoked to generate the load. You can also see the logs produced by the Lambda in CloudWatch Logs.

### 5. Remove
The following command will remove the AWS CloudFormation Stack deployed in step 3. If you are a **_Nordstrom_** engineer, please see the page titled **_`Serverless Artillery - Remove Instructions`_** in **Confluence** and follow the instructions there.
```
slsart remove --stage <your-unique-stage-name>
```

## Tutorial 2: Performance test with custom script
Throughout this tutorial we will walk you towards performance testing the AWS website, https://aws.amazon.com/.

We would test with our _custom_ script but would use _default_ deployment assets.

### 1. Create new directory
Start by creating a new directory for this tutorial and go to that directory in command line.

### 2. Create `script.yml`
Serverless-artillery needs to know information about the performance test that user wants to run. It needs information like, the target URL of the service that user wants to test, load progression, user's interaction with the service (scenarios) etc. All these are described in a `yml` file. It is the same `yml` that Artillery.io uses. 
- **Please see [here for basic concepts for Artillery.io usage](https://artillery.io/docs/basic-concepts/#basic-concepts).**
- **Please see [here for Artillery.io's test script reference](https://artillery.io/docs/script-reference/).**

Run the following command to create the initial `script.yml` file.
```
slsart script
```

### 3. Understanding `script.yml`
Open `script.yml` with your favorite editor to see what it contains.
<details><summary>Click to expand/collapse</summary>
<p>

```
# Thank you for trying serverless-artillery!
# This default script is intended to get you started quickly.
# There is a lot more that Artillery can do.
# You can find great documentation of the possibilities at:
# https://artillery.io/docs/
config:
  # this hostname will be used as a prefix for each URI in the flow unless a complete URI is specified
  target: "http://aws.amazon.com"
  phases:
    -
      duration: 5
      arrivalRate: 2
scenarios:
  -
    flow:
      -
        get:
          url: "/"
