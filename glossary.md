# Glossary of Terms

<!-- TODO define these as well
### Acceptance
(see also [Sampling](#sampling))

### Artillery
see https://artillery.io/

### Arrival
see https://artillery.io/docs/script-reference/#script-reference

### Burn

### Load

### Monitoring
(see also [Sampling](#sampling))

### Performance
-->

### Sampling

We use [this term](https://www.merriam-webster.com/dictionary/sampling) in the scientific sense.

The population from which we collect samples is the service's responses.  We generate synthetic requests (via artillery) and observe the responses to them as our collected samples.  Rather than attempting to collect a representative sample that would be senstive to service volume, we collect a deterministic number of samples.  You can imagine a scientist collecting water samples from a river at regular intervals to monitor ecosystem health.  The number of collected samples is sentive not to the higher and lower flows occurring across seasons but to a regular scheduled collection.

Once these samples are taken, they must be evaluated.  In the case of collecting water sample from a river, you might test the water to detect impurity levels and evaluate them relative to normal or desired levels.  With your service, we depend on either the artillery ["match" feature](https://github.com/shoreditch-ops/artillery/blob/master/core/lib/engine_util.js#L318) or an artillery plugin that will add or augment an error attribute to the artillery report for evaluating the service's responses.  An example of this section in a yml report might look like:

```yml
error:
  403: 2
  500: 1
```

The error type counts are summed and compared to the configured error budget.  If the number of errors observed exceeds the budget, an alert is sent as per configuration.  (to alter this behavior, you will need to change the logic in `~/task-artillery/result.js`)

If you accept defaults, the actual number of samples depends on the mode that you use.  Acceptance mode has a default of 1 sample.  Monitoring mode, on the other hand, has a default of 5 samples.  Whenever you are taking more than one sample, those samples are spread over time with dither in order to avoid damaging results from harmonic effects.  Each sample is preceeded by a pause.  The amount of time of that pause is determined by an average pause (in seconds) that is augmented with random variance (also in seconds) either before or after the average.

Example sampling configuration (defaults reflect monitoring mode):
```
sampling:
  size: 5           # The size of sample set
  averagePause: 5   # The average number of seconds to pause between samples
  pauseVariance: 2  # The maximum difference of the actual pause from the average pause (in either direction)
  errorBudget: 4    # The number of observed errors to accept before alerting
```

<!-- TODO define these as well
### Serverless
(see also [Serverless Framework](#serverless-framework))

### Serverless Framework
-->
