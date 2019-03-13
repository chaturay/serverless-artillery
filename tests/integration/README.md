# SLSART Integration Testing

These tests deploy a target AWS API Gateway endpoint and use Serverless Artillery to make requests.
The test then checks the logs for the endpoint to validate the timing and number of requests made.

Start an integration test by running the command:
`npm run integration`

To enable logging in test runs, set a DEBUG environment variable before starting the tests.
e.g. `export DEBUG=*`

Make sure that you are running Node version 8 or higher.
Also, if you have set an environment variable for AWS Region, make sure it is the same region as your test instance and target (see definition of terms below).

## Definition of Terms
*SA Project*
> A Serverless Artillery project that will be deployed to execute a single integration test.

*Target*
> An API gateway that will record all incoming traffic from test instances and can be queried to get back a list of all traffic for a given test instance.

*Test Run*
> The process of deploying a target, creating test instances, running the test instances and analyzing the results.

## Staging and Deployment
The target and test instances are staged and deployed from folders within the system temp directory. The temp folders are named with a random ID, e.g. `/tmp/slsart-integration/ABC123`. Each project is deployed with a service name that includes the random ID such that a target staged in the `/tmp/slsart-integration/ABC123` folder is deployed as `slsart-integration-target-ABC123`.

## Process
A SLSART integration test run follows these steps:

1. Stage and deploy the target.
2. Stage and deploy the SA project.
3. Start the test instances concurrently.
4. Analyze and report the results.
5. Remove the target and test instances and delete the temp folders.

## Analyzing results
Add the analysis logic. Analysis involves retrieving the requests from the target and then using a spec file to assert that the requests observed by the target match the expected load shape.

### Sample Script File
WIP
```yml
script:
  config:
    target: 'https://example.com'
    phases:
      - duration: 10
        arrivalRate: 5
  scenarios:
    - flow:
      - get:
          url: '/'
expectations:
  - from: 0
    to: 10
    min: 45
    max: 55
```
