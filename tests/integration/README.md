# SLSART Integration Testing
Sequence of events when running the test:
1. Create test project.
2. Deploy target project.
3. Deploy test project.
4. Invoke tests.
5. Analyze results.

Each integration test will create a random string at start of test. This random string will be included in each payload so that results will be meaningful even with concurrent tests.

## Target
The target includes an API gateway, lambda and either an S3 bucket. The lambda will:
1. Save the call details, and payload in the bucket (file names include the unique test run ID).
2. Delay, succeed and/or fail depending on the payload.

## Test Project
The test project will contain as many script files as there are individual test cases.
1. `slsart deploy` creates the project one time and deploys it
2. deploy the target for each test case
3. `slsart invoke` for each test case (passing each test script)

## Analyzing results
Add the analysis logic to the test project. When the controller is finished running the test, it will execute the analysis. (Or should we deploy a stand-alone analysis lambda? To be decided...)

## Spec File
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
# (in the final report only)
testRunId: fd78as9gdfs789gdf7a89
summary:
  - succeeded: 100 # total
  - failed: 0 # total
  - deviation: 7% # avg
```

## Final Report
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
