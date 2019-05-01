# Bash Testing

Testing SA implementation via script automation.
Currently implemented for MacOS only.

## Test Overview

The scripts provided can be used to test SA deployment, invocation and removal.

Multiple SA packages may be validated in a single test run.
Each SA package listed will be installed in turn and one or more service deployments will be used to test.

Testing can be done with one or more SA services.
These steps are performed for each service deployed:
9. Service directory is created and `slsart configure` generates a custom SA service
9. `slsart script` is used to generate the default script
9. Service is deployed
9. SA is invoked a number of times in each mode, i.e.: performance, acceptance and monitoring
9. Service is removed from CF and local directory is deleted

## Setup

### Cloud Provider
In order to deploy the services, the user will need to be properly authenticated with the cloud provider.

### Node and NPM
Latest stable versions of `Node.js` and `NPM` are suggested unless testing requires otherwise.

### Testing Scope
Within the test scripts, there are a number of declared values which can be adjusted to control the extent of the testing.

#### SA Versions
Each line of the `slsart-package.list` descirbes an NPM package which will be installed and tested.
Any valid [NPM package](https://docs.npmjs.com/cli/install) description will work, e.g.:
```
serverless-artillery@0.3.5
git+https://github.com/Nordstrom/serverless-artillery.git#94983db3c3dc439c0bb9319d5aaa16a1f021fac7
```

This list would test both the NPM published package version and then a version from the github repository.
An empty line is required at the end of this file.

#### Number of Services to Deploy
Editing `test-all-versions.sh` to modify `stacks` will control the number of services deployed for a given SA test,
waiting `delay` seconds between deploying each.
Default is ten stacks deployed 30s apart.

#### Number of Test Invocations
Adjusting `test-deploy-invoke.sh` to modify `invocations` will control the number of times the SA service is invoked in each
of its test modes (performance, acceptance and monitoring.)
Default is ten invocations of each mode.

## Running Tests
To install each of the SA packages in the `slsart-package.list` use:
```
./test-all-versions.sh
```
which will install each SA package in turn and run the tests with each.
The `name` used for each package are the five characters, e.g.:
`serverless-artillery@0.3.5` becomes `0-3-5`.

Testing the currently installed SA package, the command:
```
./test-slsart-version.sh $stacks $name $delay
```

* `stacks` is the number of copies the SA service to deploy
* `name` basis for the output and error files
* `delay` number of seconds to wait between deploying each SA service

*NOTE:* Running the test in this way *will not wait for the tests to complete* before
the script exits. The command above will start the tests which will take several
minutes to complete, depending on the number of stacks deployed and delay used.

## Analyzing Results
Pass/Fail results are manual.
Both the standard output and error output are captured from each test
and can be searched for error messages and expected output.

Example:
```
cat error-0-3-2-* | grep Error
```
to find any `Error` in the testing error output for package version 0.3.2.
