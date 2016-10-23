import DataLoader from 'dataloader'
import formatDuration from 'humanize-duration'
import FoobotClient from './api'
import ExpiringMap from './expiring-map'
import DataCache from './data-cache'
import Limiter from './limiter'
import { ONE_DAY, ONE_HOUR, ONE_MINUTE, wait } from './util'

const debug = require('debug')('foobot-graphql:loaders')
export const client = new FoobotClient()
export const cache = new DataCache()
export const limiter = new Limiter(client)

const PERIOD_BUFFER = 10 * ONE_MINUTE

export const deviceLoader = new DataLoader(keys => {
  return client.devices().then(devices => {
    const found = []
    const notFound = []
    keys.forEach(key => {
      const device = devices.find(device => device.uuid === key)
      device ? found.push(device) : notFound.push(key)
    })
    if (notFound.length) {
      notFound.forEach(deviceLoader.clear, deviceLoader)
      throw new Error(`Devices not found: ${notFound.join(', ')}`)
    }
    return found
  })
}, {
  cacheKeyFn: key => `device=${key}`,
  cacheMap: new ExpiringMap({ ttl: ONE_DAY })
})

export const datapointsLoader = new DataLoader(keys => {
  return Promise.all(keys.map(key => {
    const [ uuid, period, averageBy ] = key
    return client.datapoints(uuid, { period, averageBy }).then(data => {
      // Mark the data as expiring 5 minutes after the most recent datapoint.
      data.expires = data.end + 5 * 60
      cache.add(uuid, data)
      return data
    })
  }))
}, {
  cacheKeyFn: ([ uuid, period, averageBy ]) => {
    return `live: device=${uuid} period=${period} averageBy=${averageBy}`
  },
  cacheMap: new ExpiringMap({
    ttl: (key, value) => {
      return value.then(data => {
        return data.expires == null ? 0 : (data.expires - data.date) * 1000
      }).catch(err => {
        console.error(err)
        return 0
      })
    }
  })
})

export const cachedDatapointsLoader = new DataLoader(keys => {
  return Promise.all(keys.map(key => {
    const [ uuid, period, averageBy ] = key
    debug(`Incoming request. device=${uuid} period=${period} averageBy=${averageBy}`)
    const now = new Date()
    const hasCompleteData = cache.hasCompleteData(uuid, period)
    if (!hasCompleteData) {
      debug(`Incomplete data for the requested period.`)
    }
    const delay = hasCompleteData ? limiter.nextRequestDelay(now) : 0
    // If a request is allowed in the next few seconds, don't retrieve cached
    // results, just wait.
    if (delay <= 3000) {
      debug(`Requesting from API. delay=${delay}`)
      return wait(delay).then(() => {
        const data = cache.get(uuid, 0, 0)
        let requestPeriod = period
        if (data.end != null) {
          const lastTime = data.end * 1000
          // Fetch the period between now and the last known datapoint,
          // expanded by a buffer zone of ten minutes to make sure we don't
          // miss any due to clock skew, and rounded up to the nearest hour.
          requestPeriod = (now.getTime() - lastTime) + PERIOD_BUFFER
          requestPeriod = ONE_HOUR * Math.ceil(requestPeriod / ONE_HOUR)
          requestPeriod /= 1000
          requestPeriod = Math.min(requestPeriod, period)
        }
        requestPeriod = Math.floor(requestPeriod) // Integer seconds.
        return datapointsLoader.load([uuid, requestPeriod, 0]).then(data => {
          return cache.get(uuid, period, averageBy)
        })
      })
    } else {
      debug(
        `Next request delayed, retrieving from cache. ` +
        `delay='${formatDuration(delay)}'`
      )
      return cache.get(uuid, period, averageBy)
    }
  }))
}, { cache: false })
