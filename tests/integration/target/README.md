# Target: Test Service

Simple Express service which records the requests made against it for testing
purposes.

## Deployment

Using the Serverless framework:

```bash
serverless deploy --stage test --region us-west-2
```

In the `/tests/integration/target` directory. The `--stage` and
`--region` arguments are optional.

## Testing

Service records all requests made to any path with any verb
(excluding GET requests to the pages mentioned below.)

Currently, request history is stored in memory.

The basic testing process is generally:

### 1. Resetting Stats

Doing a GET request on the `/reset` path will set all request counts
to zero and clear the request history.  

### 2. Test Requests

Load the test target service using serverless artillery with a given
load profile.

### 3. Getting Totals & Requests

The `/totals` endpoint returns a histogram of total requests grouped by 
path:

```JSON
{
    "/001": 1,
    "/002/item": 1,
    "/003/location": 1,
}
```

And the `/requests` endpoints returns the series of requests actually
made partitioned by arrival second:

```JSON
{
    "1531332681": [
        "/001"
    ],
    "1531332688": [
        "/002/item"
    ],
    "1531332696": [
        "/003/location"
    ]
}
```
