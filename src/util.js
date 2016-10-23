import util from 'util'
import chalk from 'chalk'

export const ONE_SECOND = 1000
export const ONE_MINUTE = 60 * ONE_SECOND
export const ONE_HOUR = 60 * ONE_MINUTE
export const ONE_DAY = 24 * ONE_HOUR

export function prettyPrint (obj, options = {}) {
  return util.inspect(obj, { depth: 3, colors: true, ...options })
}

export function logObject (obj) {
  console.log(prettyPrint(obj, { breakLength: 120 }))
}

export function logError (err) {
  console.error(chalk.red(err.toString()))
  if (err.response && err.response.headers) {
    console.error(prettyPrint(err.response.headers))
  }
  if (err.response && err.response.data) {
    console.error(prettyPrint(err.response.data))
  } else if (err.response && err.response.body) {
    console.error(prettyPrint(err.response.body))
  }
}

export function safeExit (code) {
  process.on('exit', () => {
    process.exit(code)
  })
}

export function wait (milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
