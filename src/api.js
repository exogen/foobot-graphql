import request from 'request'
import read from 'read'
import pkg from '../package.json'

export default class FoobotClient {
  constructor (opts = {}) {
    this.apiKey = opts.apiKey || process.env.FOOBOT_API_KEY
    this.authToken = opts.authToken || process.env.FOOBOT_AUTH_TOKEN
    this.username = opts.username || process.env.FOOBOT_USERNAME
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
      this.http(options, (err, response, body) => {
        if (err) {
          return reject(err)
        }
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

  login (username = this.username, password) {
    this.username = username
    return this._request({
      url: `/v2/user/${username}/login/`,
      method: 'post',
      body: { password }
    }).then(response => {
      const authToken = response.headers['x-auth-token']
      if (authToken) {
        this.authToken = authToken
        return response
      }
      throw new Error('Authentication failed.')
    })
  }

  devices (username = this.username) {
    return this._request({
      url: `/v2/owner/${username}/device/`,
      headers: { 'x-auth-token': this.authToken }
    }).then(response => response.body)
  }

  datapoints (uuid, { start, end, period = 0, averageBy = 0 } = {}) {
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
    return this._request({
      url,
      headers: { 'x-auth-token': this.authToken }
    }).then(response => {
      response.body.date = Date.parse(response.headers.date) / 1000
      return response.body
    })
  }
}

if (require.main === module) {
  const { logObject, logError, safeExit } = require('./util')

  const client = new FoobotClient()
  const command = process.argv[2]

  if (command === 'login') {
    const username = process.argv[3] || process.env.FOOBOT_USERNAME ||
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
    const username = process.argv[3] || process.env.FOOBOT_USERNAME
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
  }
}
