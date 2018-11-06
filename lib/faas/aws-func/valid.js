const def = require('./define')

const impl = {
  /**
   * Validate the given event's function relevant configuration, throwing an exception if invalid configuration is discovered.
   * @param event The event given to validate
   */
  validate: (event) => {
    // Splitting Settings [Optional]
    if ('_split' in event && typeof event._split !== 'object') { // eslint-disable-line no-underscore-dangle
      throw new def.FunctionError('If specified, the "_split" attribute must contain an object')
    } else {
      const settings = def.getSettings(event)
      if (
        'maxChunkDurationInSeconds' in settings &&
        (
          !Number.isInteger(settings.maxChunkDurationInSeconds) ||
          settings.maxChunkDurationInSeconds < def.MIN_CHUNK_DURATION_IN_SECONDS ||
          settings.maxChunkDurationInSeconds > def.MAX_CHUNK_DURATION_IN_SECONDS
        )
      ) {
        throw new def.FunctionError('If specified the "_split.maxChunkDurationInSeconds" attribute must be an integer ' +
          `inclusively between ${def.MIN_CHUNK_DURATION_IN_SECONDS} and ${def.MAX_CHUNK_DURATION_IN_SECONDS}.`)
      } else if (
        'maxScriptDurationInSeconds' in settings &&
        (
          !Number.isInteger(settings.maxScriptDurationInSeconds) ||
          settings.maxScriptDurationInSeconds <= 0 ||
          settings.maxScriptDurationInSeconds > def.MAX_SCRIPT_DURATION_IN_SECONDS
        )
      ) {
        throw new def.FunctionError('If specified the "_split.maxScriptDurationInSeconds" attribute must be an integer ' +
          `inclusively between 1 and ${def.MAX_SCRIPT_DURATION_IN_SECONDS}.`)
      } else if (
        'maxChunkRequestsPerSecond' in settings &&
        (
          !Number.isInteger(settings.maxChunkRequestsPerSecond) ||
          settings.maxChunkRequestsPerSecond <= 0 ||
          settings.maxChunkRequestsPerSecond > def.MAX_CHUNK_REQUESTS_PER_SECOND
        )
      ) {
        throw new def.FunctionError('If specified the "_split.maxChunkRequestsPerSecond" attribute must be an integer ' +
          `inclusively between 1 and ${def.MAX_CHUNK_REQUESTS_PER_SECOND}.`)
      } else if (
        'maxScriptRequestsPerSecond' in settings &&
        (
          !Number.isInteger(settings.maxScriptRequestsPerSecond) ||
          settings.maxScriptRequestsPerSecond <= 0 ||
          settings.maxScriptRequestsPerSecond > def.MAX_SCRIPT_REQUESTS_PER_SECOND
        )
      ) {
        throw new def.FunctionError('If specified the "_split.maxScriptRequestsPerSecond" attribute must be an integer ' +
          `inclusively between 1 and ${def.MAX_SCRIPT_REQUESTS_PER_SECOND}.`)
      } else if (
        'timeBufferInMilliseconds' in settings &&
        (
          !Number.isInteger(settings.timeBufferInMilliseconds) ||
          settings.timeBufferInMilliseconds <= 0 ||
          settings.timeBufferInMilliseconds > def.MAX_TIME_BUFFER_IN_MILLISECONDS
        )
      ) {
        throw new def.FunctionError('If specified the "_split.timeBufferInMilliseconds" attribute must be an integer ' +
          `inclusively between 1 and ${def.MAX_TIME_BUFFER_IN_MILLISECONDS}.`)
      }
    }
  },
}

module.exports = impl.validate
