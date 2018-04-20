/* eslint-disable no-underscore-dangle */

const alert = require('./alert')
const func = require('./func')
const task = require('./task')

const impl = {
  /**
   * Delay for the given number of milliseconds before resolving the returned promise.
   * @param ms The number of milliseconds to delay before resolving the returned promise.
   * @returns {Promise<any>}
   */
  delay: (ms) => {
    if (ms > 0) {
      return new Promise(resolve => setTimeout(resolve, ms))
    } else {
      return Promise.resolve()
    }
  },
  /**
   * Wait the requested time delay before simulating execution (simulation mode) or sending the given event to a new
   * copy of this function for execution (standard mode)
   * @param timeDelay The amount of time to delay before sending the remaining jobs for execution
   * @param event The event containing the remaining jobs that is to be sent to the next Lambda
   * @param invocationType The lambda invocationType
   * @returns {Promise<any>}
   */
  invokeSelf(timeDelay, event, invocationType) {
    const exec = () => {
      if (event._simulation) {
        console.log('SIMULATION: self invocation.')
        return impl.handle(event)
      } else {
        if (event._trace) {
          console.log(`invoking self for ${event._genesis} in ${event._start} @ ${Date.now()}`)
        }
        return func.exec(event, invocationType)
          .then((result) => {
            if (event._trace) {
              console.log(`invoke self complete for ${event._genesis} in ${event._start} @ ${Date.now()}`)
            }
            return result
          })
      }
    }
    if (event._trace) {
      console.log(`scheduling self invocation for ${event._genesis} in ${event._start} with a ${timeDelay} ms delay`)
    }
    return impl.delay(timeDelay).then(exec)
  },
  /**
   * Execute the given plans distributed across copies of this function
   * @param timeNow The time ID of the current function
   * @param script The script that caused the execution of the current function
   * @param settings The settings to use for executing in the current function
   * @param plans The plans (each an event) to distribute over copies of this function
   * @returns {Promise<any>}
   */
  distribute: (timeNow, script, settings, plans) => {
    if (script._trace) {
      console.log(`distributing ${plans.length} plans from ${script._genesis} in ${timeNow}`)
    }
    const invocations = plans.map(plan => impl.invokeSelf(
      (plan._start - Date.now()) - settings.timeBufferInMilliseconds,
      plan,
      plan._invokeType // eslint-disable-line comma-dangle
    ).then((result) => {
      if (script._trace) {
        console.log(`load test from ${script._genesis} executed by ${timeNow} partially complete @ ${Date.now()}`)
      }
      return result
    }))
    return Promise.all(invocations)
      .then((results) => {
        if (script._trace) {
          console.log(`load test from ${script._genesis} in ${timeNow} completed @ ${Date.now()}`)
        }
        return Promise.resolve(task.result(timeNow, script, settings, results))
      })
  },
  /**
   * Execute the given event in place, which is to say in the current function
   * @param timeNow The time ID of the current function
   * @param event The event to execute in the current function
   * @param settings The settings to use for executing in the current function
   * @returns {Promise<T>}
   */
  execute: (timeNow, event, settings) => {
    const script = event
    if (!script._start) {
      script._start = timeNow
    }
    const timeDelay = script._start - Date.now()
    return impl.delay(timeDelay)
      .then(() => {
        if (script._trace) {
          console.log(`executing load script from ${script._genesis} in ${timeNow} @ ${Date.now()}`)
        }
        return task.exec(timeNow, script)
          .then((result) => {
            if (script._trace) {
              console.log(`execution complete from ${script._genesis} in ${timeNow} @ ${Date.now()}`)
            }
            return Promise.resolve(task.result(timeNow, script, settings, [result]))
          })
      })
      .catch((ex) => {
        console.error(`error executing load script from ${script._genesis} in ${timeNow} @ ${Date.now()}:`)
        console.error(ex.stack)
        throw ex
      })
  },
  getSettings: (script) => {
    const settings = func.def.getSettings(script)
    settings.alert = alert
    settings.task = task.def.getSettings(script)
    return settings
  },
  /**
   * Handle event given by the function infrastructure, using the task plugin to plan and execute it (in this function
   * or distributed across copies of it using the func plugin).
   *
   * TODO What if there is not external reporting for a script that requires splitting?  Detect this and error out?
   *
   * @param event The event to plan and execute (in this function or distributed across copies of it)
   * @returns {*}
   */
  handle: (event) => {
    const script = event
    const settings = impl.getSettings(script)
    const timeNow = Date.now()
    task.valid(settings, script)
    const plans = task.plan(timeNow, script, settings)
    if (plans.length > 1) {
      return impl.distribute(timeNow, script, settings, plans)
    } else if (plans.length === 1) {
      return impl.execute(timeNow, plans[0], settings)
    } else {
      const msg = `ERROR, no executable content in:\n${JSON.stringify(script)}!`
      console.error(msg)
      return Promise.reject(new Error(msg))
    }
  },
}

module.exports = {
  handler: func.handle(impl.handle),
}

/* test-code */
module.exports.impl = impl
/* end-test-code */
