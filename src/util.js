import util from 'util'
import chalk from 'chalk'

export function prettyPrint (obj, options = {}) {
  return util.inspect(obj, { depth: 3, colors: true, ...options })
}

export function logObject (arr) {
  console.log(prettyPrint(arr, { breakLength: 120 }))
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
