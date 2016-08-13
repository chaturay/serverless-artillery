# serverless-artillery [![Build Status](https://travis-ci.org/Nordstrom/serverless-artillery.svg)](https://travis-ci.org/Nordstrom/serverless-artillery)
Combine [`serverless`](serverless.com) with [`artillery`](artillery.io) and you get `serverless-artillery` (a.k.a. `slsart`) for instant, cheap, and easy performance testing at scale

## Installation
We assume you have node.js installed.  Likewise you should have the serverless framework.

```
npm install serverless-artillery
```

## Use

`slsart`

or

```
slsart deploy  // and then
slsart run     // repeat as desired, before
slsart cleanup
```

### Options

long | short | description | example
---- | ----- | ----------- | -------
`--script` | `-s` | specify the artilery script to use | `-s yourfile.json` or `-s yourfile.yaml` or `-s yourfile.yml`

## References
1. [artillery.io]() for documentation about how to define your load shape, volume, targets, inputs, et cetera
