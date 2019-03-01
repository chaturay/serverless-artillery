# Load generating Lambda function

## Artillery.io
- [Artillery.io](https://artillery.io/) (built by Hassy Veldstra of shoreditch-ops) is an existing open-source node package built for easy load testing and functional testing of an endpoint/URL.
- It takes in a developer-friendly JSON or YAML load script that specifies 
  - target/URL/endpoint, 
  - load progression,
  - and the scenarios that are important for your service to test.
- It generates specified load, and measures and reports the resulting latency and return codes. 

## Load generating Lambda
<img src="docs/Architecture.gif">

- Serverless-artillery generates the requests to run the specified tests using load generating Lambda function named `serverless-artillery-*dev-loadGenerator` that is deployed and invoked on AWS along with other assets.
- It has an ephimeral architecture. It only exists as long as you need it.
- It runs Artillery.io node package in AWS Lambda function.
  - Each lambda function can only generate a certain amount of load, and can only run for up to five minutes (five minutes is a built-in limitation of AWS Lambda) (now 15 minutes). 
  - Given these limitations, it is often necessary to invoke more lambdas - both to scale horizontally as well as handing off the work to a new generation of lambdas before their run-time has expired.
- Above diagram shows how Serverless Artillery solves this problem.
  - It first runs the Lamdba function in a **control** mode. It examines the submitted load config JSON/YAML script (this is identical to the original “servered” [Artillery.io](https://artillery.io/) script). If the load exceeds what a single lambda is configured to handle, then the load config is chopped up into workloads achievable by a single lambda. 
  - Control lambda then invokes as many **worker** lambdas as necessary to generate the load. 
  - Towards the end of the five-minute runtime the controller lambda invokes a new controller lambda to produce load for the remaining duration.
- The result of the load test can be reported to CloudWatch, InfluxDB or Datadog through plugins and then visualized with CloudWatch, Grafana or Datadog dashboard.
