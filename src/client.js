/**
 * Simple Promise-based client for the Foobot API.
 *
 * Run this file as a standalone script to test different types of requests.
 */
import request from 'request'
import read from 'read'
import pkg from '../package.json'

const debug = require('debug')('foobot-graphql:api')

export default class FoobotClient {
  constructor (opts = {}) {
    this.apiKey = opts.apiKey || process.env.FOOBOT_API_KEY
    if (this.apiKey == null) {
      throw new Error(
        'FoobotClient must be configured with an API key. ' +
        'Use the `apiKey` option or `FOOBOT_API_KEY` environment variable.'
      )
    }
    this.username = opts.username || process.env.FOOBOT_USERNAME
    if (this.username == null) {
      throw new Error(
        'FoobotClient must be configured with a username. ' +
        'Use the `username` option or `FOOBOT_USERNAME` environment variable.'
      )
    }
    this.defaultDevice = opts.defaultDevice || process.env.FOOBOT_DEFAULT_DEVICE
    this.lastRequestTime = null
    this.lastRequestLimit = null
    this.http = request.defaults({
      baseUrl: 'https://api.foobot.io/',
      json: true,
      gzip: true,
      timeout: 60000,
      headers: {
        'x-api-key-token': this.apiKey,
        'User-Agent': `${pkg.name}/${pkg.version} ` +
          `( ${pkg.homepage || pkg.author.url || pkg.author.email} )`
      }
    })
  }

  _request (options) {
    return new Promise((resolve, reject) => {
      debug(`Sending request. url='${options.url}'`)
      const lastRequestTime = new Date()
      this.http(options, (err, response, body) => {
        if (err) {
          return reject(err)
        }
        const lastRequestLimit = response.headers['x-api-key-limit-remaining']
        if (this.lastRequestTime == null || this.lastRequestTime <= lastRequestTime) {
          this.lastRequestTime = lastRequestTime
          if (lastRequestLimit != null) {
            this.lastRequestLimit = parseInt(lastRequestLimit, 10)
          }
        }
        debug(
          `Received response. ` +
          `statusCode=${response.statusCode} ` +
          `lastRequestLimit=${lastRequestLimit}`
        )
        if (response.statusCode >= 200 && response.statusCode < 400) {
          return resolve(response)
        }
        let message = `Request failed with status code ${response.statusCode}`
        if (response.statusMessage) {
          message += `: ${response.statusMessage}`
        }
        err = new Error(message)
        err.response = response
        return reject(err)
      })
    })
  }

  /**
   * This endpoint is no longer necessary, as the API now uses the API key as
   * the auth token. Keep this around in case someone wants to use it anyway.
   */
  login (username = this.username, password) {
    this.username = username
    return this._request({
      url: `/v2/user/${username}/login/`,
      method: 'post',
      body: { password }
    }).then(response => {
      if (response.headers['x-auth-token']) {
        return response
      }
      throw new Error('Authentication failed.')
    })
  }

  devices (username = this.username) {
    return this._request({
      url: `/v2/owner/${username}/device/`
    }).then(response => response.body)
  }

  datapoints (uuid = this.defaultDevice, { start, end, period = 0, averageBy = 0 } = {}) {
    if (start instanceof Date) {
      start = start.toISOString()
    }
    if (end instanceof Date) {
      end = end.toISOString()
    }
    if (period instanceof Date) {
      const duration = Date.now() - period.getTime()
      period = Math.ceil(duration / 1000)
    }
    let url = `/v2/device/${uuid}/datapoint/${period}/last/${averageBy}/`
    if (start != null && end != null) {
      url = `/v2/device/${uuid}/datapoint/${start}/${end}/${averageBy}/`
    }
    return this._request({ url }).then(response => {
      response.body.date = Date.parse(response.headers.date) / 1000
      return response.body
    })
  }
}

if (require.main === module) {
  require('dotenv').config()
  const { logObject, logError, safeExit } = require('./util')

  const client = new FoobotClient()
  const command = process.argv[2]

  if (command === 'login') {
    const username = process.argv[3] || client.username ||
      new Promise((resolve, reject) => {
        read({ prompt: 'Username:' }, (err, username) => {
          return err ? reject(err) : resolve(username)
        })
      })
    Promise.resolve(username).then((username) => {
      return new Promise((resolve, reject) => {
        read({
          prompt: 'Password:',
          silent: true,
          replace: '•'
        }, (err, password) => {
          return err ? reject(err) : resolve({ username, password })
        })
      })
    }).then(({ username, password }) => {
      return client.login(username, password)
    }).then(response => {
      console.log(response.headers['x-auth-token'])
    }).catch(err => {
      logError(err)
      safeExit(1)
    })
  } else if (command === 'devices') {
    const username = process.argv[3]
    client.devices(username).then(devices => {
      logObject(devices)
    }).catch(err => {
      logError(err)
      safeExit(1)
    })
  } else if (command === 'datapoints') {
    const uuid = process.argv[3]
    const period = process.argv[4]
    const averageBy = process.argv[5]
    client.datapoints(uuid, { period, averageBy }).then(data => {
      logObject(data)
    }).catch(err => {
      logError(err)
      safeExit(1)
    })
  } else {
    console.log('Commands: login, devices, datapoints')
    safeExit(1)
  }
}
