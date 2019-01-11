# SLSART Integration Testing

Start an integration test by running the command:
`npm run integration`

## Definition of Terms
*Test Instance*
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
2. Stage and deploy the test instances.
3. Start the test instances concurrently.
4. Analyze and report the results.
5. Remove the target and test instances and delete the temp folders.

## Analyzing results
WIP

Add the analysis logic. Analysis involves retrieving the requests from the target and then using a spec file to assert that the requests observed by the target match the expected load shape.

### Sample Spec File
WIP
```yml
name: steady load
scale: second
frames:
  - succeeded: 1
    failed: 0
    deviation: 0%
  - succeeded: 5
    failed: 0
    deviation: 15
```

### Sample Final Report
WIP

NOTE: offer flags such as:
  * full reports or just summaries
  * report to file instead of console

```yml
name: steady load
testRunId: fd78as9gdfs789gdf7a89
scale: second
frames:
  - succeeded: 25
    failed: 0
    deviation: 0%
  - succeeded: 75
    failed: 0
    deviation: 14%
summary:
  - succeeded: 100 # total
  - failed: 0 # total
  - deviation: 7% # avg
```
