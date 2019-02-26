# Serverless-artillery [![Build Status](https://travis-ci.org/Nordstrom/serverless-artillery.svg?branch=master)](https://travis-ci.org/Nordstrom/serverless-artillery) [![Coverage Status](https://coveralls.io/repos/github/Nordstrom/serverless-artillery/badge.svg?branch=master)](https://coveralls.io/github/Nordstrom/serverless-artillery?branch=master)

[//]: # (Thanks to https://www.divio.com/en/blog/documentation/)


# Introduction
Combine [`serverless`](https://serverless.com) with [`artillery`](https://artillery.io) and you get `serverless-artillery` (a.k.a. `slsart`). 

Serverless-artillery makes it easy to test your services for load and functionality quickly, with almost no code and without having to maintain any servers or testing infrastructure.

### Use serverless-artillery if
1. You want to know if your services (either internal or public) can handle different amount of traffic load (i.e. performance testing).
1. You want to test if your services behave as you expect after you deploy new changes (i.e. acceptance testing).
1. You want to constantly monitor your services over time to make sure the latency of your services is under control (i.e. monitoring mode).

# Table of Contents
<details><summary>Click to expand/collapse</summary>
<ul>
    <li><a href="#installation">Installation</a></li>
        <ul>
            <li><a href="#prerequisite">Prerequisite</a></li>
            <ul>
                <li><a href="#1-node-js">1. Node JS</a></li>
                <li><a href="#2-serverless-framework-cli">2. Serverless Framework CLI</a></li>
            </ul>
            <li><a href="#installing-serverless-artillery">Installing serverless-artillery</a></li>
            <li><a href="#problems-installing">Problems installing?</a></li>
            <ul>
                <li><a href="#error-npm-err-code-eacces">Error: npm ERR! code EACCES</a></li>
                <li><a href="#installing-in-docker">Installing in Docker?</a></li>
            </ul>
        </ul>
    <li><a href="#uninstallation">Uninstallation</a></li>
    <li><a href="#before-running-serverless-artillery">Before running serverless-artillery</a></li>
        <ul>
            <li><a href="#setup-for-nordstrom-technology">Setup for Nordstrom Technology</a></li>
            <li><a href="#setup-for-everyone-else">Setup for everyone else</a></li>
        </ul>
    <li><a href="#run-a-quick-test">Run a quick test</a></li>
    <li><a href="#simple-performance-testing-yutorial">Simple Performance Testing Tutorial</a></li>
        <ul>
            <li><a href="#1-create-scriptyml">1. Create script.yml</a></li>
            <li><a href="#2-understanding-scriptyml">2. Understanding script.yml</a></li>
            <li><a href="#3-deploy-serverless-artillery">3. Deploy serverless-artillery</a></li>
            <li><a href="#4-invoke-performance-test">4. Invoke performance test</a></li>
            <li><a href="#5-remove-serverless-artillery">5. Remove serverless-artillery</a></li>
        </ul>
</ul>
</details>

# Installation

## Prerequisite
### 1. Node JS
Before installing serverless-artillery, install Node JS from https://nodejs.org/en/download/ or with your operating system’s package manager. You can install the latest LTS version. We support any version higher than maintenance LTS (v6+).
### 2. Serverless Framework CLI
Before installing serverless-artillery, install Serverless Framework CLI (a.k.a. Serverless) (v1.0+). It should be either installed globally or available in the local node_modules. To install globally use the following command.
```
npm install -g serverless
```

## Installing serverless-artillery
Now you can install serverless-artillery using the following command.
```
npm install -g serverless-artillery
```
To check that the installation succeeded, run:
```
slsart --version
```
You should see serverless-artillery print its version if the installation has been successful.

## Problems installing?
**ASHMITODO:Look into this:**
### Error: npm ERR! code EACCES
If you are installing into a node_modules owned by root and getting error `npm ERR! code EACCES`, [read this](root-owns-node-modules.md).
### Installing in Docker?
Post installation causes permission issues when installing in a Docker image. To successfully install in Docker make sure to add the following to your Dockerfile before the serverless and serverless-artillery install. Refer to the [example Dockerfile](Dockerfile).
```
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin
```

# Uninstallation
When needed, you can uninstall serverless-artillery using the following command.
```
npm uninstall -g serverless-artillery
```

# Before running serverless-artillery
**ASHMITODO:Look into this:**
## Setup for Nordstrom Technology
If you are a **_Nordstrom_** engineer, please see the page titled **_`Serverless Artillery - Nordstrom Technology Setup`_** in **Confluence** and follow the instructions there.
## Setup for everyone else
In order to use serverless-artillery, depending on the AWS account environment you're working in, you may need to define `AWS_PROFILE` to declare the AWS credentials to use and possibly `HTTP_PROXY` in order to escape your corporate proxy.  See the [Serverless Framework docs](https://serverless.com/framework/docs/) or [serverless-artillery workshop](https://github.com/Nordstrom/serverless-artillery-workshop)'s [Lesson 0](https://github.com/Nordstrom/serverless-artillery-workshop/tree/master/Lesson0%20-%20Before%20the%20workshop) for details of how to set your system up for successful deployment, invocation, and removal. 

# Run a quick test
If you want to quickly test your setup or see the tool in action, do the following to quickly run a **small load/performance test**. Don't worry about what these commands do in detail. This document explains them in detail later.

1. The following command will deploy serverless-artillery to the AWS account you selected in the [previous step](#before-running-serverless-artillery) with default AWS stack name `serverless-artillery-dev`.
```
slsart deploy
```
2. The following command will invoke/run serverless-artillery using default load script (`script.yml`), creating small traffic against the sample endpoint specified in the default script. At the end of the test serverless-artillery will generate a report of the test. **Please note that this report is generated only for small load.**
```
slsart invoke
```
3. The following command will removed the default AWS stack deployed in step 1.
```
slsart remove
```

# Simple Performance Testing Tutorial
Let’s learn by example. 

Throughout this tutorial we will walk you towards performance testing the AWS website, https://aws.amazon.com/.

### 1. Create script.yml
Serverless-artillery needs to know information about the performance test that user wants to perform. It needs information like, the target URL of the service that user wants to test, load progression, user's interaction with the service etc. All these are described in a `script.yml` file. It is the same `script.yml` that Artillery.io uses. 
- **Please see [here for basic concepts for Artillery.io usage](https://artillery.io/docs/basic-concepts/#basic-concepts).**
- **Please see [here for Artillery.io's test script reference](https://artillery.io/docs/script-reference/).**

Run the following command to create the initial `script.yml` file.
```
slsart script
```

### 2. Understanding script.yml
Open `script.yml` with your favorite editor to see what it contains.
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

```
- The script has [`config` section](https://artillery.io/docs/script-reference/#the-config-section)
  - under which it specifies http://aws.amazon.com as the `target` for the test
    - and that requests should be made using [HTTP protocol](https://artillery.io/docs/http-reference/)
  - There is one [load `phase`](https://artillery.io/docs/script-reference/#load-phases) of `duration` of 5 sec and `arrivalRate` of 2 new virtual users arriving every second.
- The script has [`scenarios` section](https://artillery.io/docs/script-reference/#scenarios)
  - which contains one scenario
    - which contains one flow
      - which has one [flow action](https://artillery.io/docs/http-reference/#flow-actions) to send [GET request](https://artillery.io/docs/http-reference/#get-post-put-patch-delete-requests) for the specified `target`.

### 3. Deploy serverless-artillery
We need to deploy serverless-artillery to you AWS account before we can use it to start our test.
1. Make sure you have [set up an AWS account and set up your credentials](#before-running-serverless-artillery) before proceeding.
1. Use the following command to deploy serverless-artillery.
```
slsart deploy
```
You can go to your AWS account console > CloudFormation, and see AWS stack `serverless-artillery-dev` created there if the command is successful.

### 4. Invoke performance test
Now you are all set to invoke performance test using following command.
```
slsart invoke
```
At the end of the test serverless-artillery will generate a report of the test. **Please note that this report is generated only for small load.**
### 5. Remove serverless-artillery
After the test is done, you can remove serverless-artillery from AWS using following command.
```
slsart remove
```

# Glossary
- service/ end point/ target URL
- load/ traffic/ requests
- deploy to AWS
- AWS stack
- SA script
- load testing
- performance testing
- acceptance testing
- monitoring
