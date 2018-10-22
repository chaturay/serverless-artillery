
class UpdatePreconditionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UpdatePreconditionError'
  }
}
class UpdateConflictError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UpdateConflictError'
  }
}

const impl = {
  /**
   * Validate that the given service meets the minimum requirements for being updated from 0.3.2 or earlier
   * @param config The service configuration that is to be validated for update
   */
  validateServiceForUpdate: (config, constants, PreconditionError = UpdatePreconditionError, ConflictError = UpdateConflictError) => {
    if (!config || typeof config !== 'object') {
      throw new PreconditionError('The given service must be an object')
    } else if (
      !config.provider ||
      !config.provider.iamRoleStatements ||
      !Array.isArray(config.provider.iamRoleStatements)
    ) {
      throw new PreconditionError('The given service must have "provider.iamRoleStatements" defined as an array')
    } else if (
      !config.functions ||
      !config.functions[constants.TestFunctionName] ||
      !(typeof config.functions[constants.TestFunctionName] === 'object')
    ) {
      throw new PreconditionError(`The given service must have a function with the name "${constants.TestFunctionName}"`)
    } else if (
      config.functions[constants.TestFunctionName].environment &&
      'TOPIC_ARN' in config.functions[constants.TestFunctionName].environment
    ) {
      throw new ConflictError(`The given service has function "${constants.TestFunctionName}" that already has environment variable "TOPIC_ARN" defined.`)
    } else if (
      config.functions[constants.TestFunctionName].environment &&
      'TOPIC_NAME' in config.functions[constants.TestFunctionName].environment
    ) {
      throw new ConflictError(`The given service has function "${constants.TestFunctionName}" that already has environment variable "TOPIC_NAME" defined.`)
    } else if (
      config.functions[constants.TestFunctionName].events &&
      !Array.isArray(config.functions[constants.TestFunctionName].events)
    ) {
      throw new PreconditionError(`If defined, the events attribute of the "${constants.TestFunctionName}" function must be an array`)
    } else if (
      config.functions[constants.TestFunctionName].events &&
      config.functions[constants.TestFunctionName].events.find(event =>
        event.schedule &&
        event.schedule.name &&
        event.schedule.name === constants.ScheduleName)
    ) {
      throw new ConflictError(`The "${constants.TestFunctionName}" function already has a schedule event named "${constants.ScheduleName}"`)
    } else if (
      config.resources &&
      config.resources.Resources &&
      config.resources.Resources[constants.AlertingName]
    ) {
      throw new ConflictError(`A resource with logical ID ${constants.AlertingName} already exists`)
    } else {
      return config
    }
  },
}

module.exports = impl
