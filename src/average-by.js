/**
 * Instead of requesting averaged data from the API, which uses up our request
 * limit, we can instead always request the highest-resolution data and perform
 * the averaging ourselves. This means that for the same time period, we can
 * request any `averageBy` value using cached data we already have. Not only
 * will it help stay under the request limit, but it will also be faster since
 * we don't need to fetch the data again. We attempt to average the data using
 * methods as reasonably close to the real API as possible.
 *
 * Run this file as a standalone script to compare our results with live API
 * results.
 */
import Decimal from 'decimal.js'
import FoobotClient from './client'

const debug = require('debug')('foobot-graphql:average-by')

/**
 * Given an array of datapoints, group them into buckets using `averageBy` to
 * determine the bucket size.
 */
export function bucketize (datapoints, period, averageBy) {
  datapoints = datapoints.slice()
  averageBy = averageBy || 300
  let bucket = []
  let buckets = [bucket]
  const lastTime = datapoints[datapoints.length - 1][0]
  let cutoff = lastTime - period + averageBy
  while (datapoints.length) {
    const datapoint = datapoints[0]
    if (datapoint[0] < cutoff) {
      datapoints.shift()
      bucket.push([cutoff - averageBy, ...datapoint.slice(1)])
    } else {
      cutoff += averageBy
      bucket = []
      buckets.push(bucket)
    }
  }
  const beforeLength = buckets.length
  buckets = buckets.filter(bucket => bucket.length !== 0)
  const afterLength = buckets.length
  const removed = beforeLength - afterLength
  debug(`Bucketizing resulted in ${afterLength} bucket(s) (${removed} removed).`)
  return buckets
}

/**
 * Return the average of the `data` array, calculated using the arbitrary
 * precision Decimal type to avoid summation errors.
 */
export function average (data) {
  if (data.length) {
    const sum = data.reduce((sum, x) => sum.plus(x), new Decimal(0))
    const avg = sum.dividedBy(data.length)
    return parseFloat(avg.toPrecision(9))
  }
  return 0
}

export function averageBucket (datapoints) {
  const first = datapoints[0]
  if (first) {
    return first.map((value, i) => {
      return i === 0
        ? value
        : average(datapoints.map(datapoint => datapoint[i]))
    })
  }
  return []
}

export function toAveragedData (data, period, averageBy) {
  debug(`Averaging dataset. period=${period} averageBy=${averageBy}`)
  const buckets = bucketize(data.datapoints, period, averageBy)
  const datapoints = buckets.map(averageBucket)
  const first = datapoints[0]
  const last = datapoints[datapoints.length - 1]
  return {
    ...data,
    start: first ? first[0] : null,
    end: last ? last[0] : null,
    datapoints
  }
}

if (require.main === module) {
  require('dotenv').config()
  const { logObject, logError, safeExit } = require('./util')

  const client = new FoobotClient()
  const uuid = process.argv[2]
  const period = parseInt(process.argv[3] || 0, 10)
  const averageBy = parseInt(process.argv[4] || 300, 10)

  client.datapoints(uuid, { period, averageBy }).then(data => {
    console.log('API result:')
    logObject(data.datapoints.map(datapoint => {
      return [new Date(datapoint[0] * 1000)].concat(datapoint.slice(1))
    }))
    return client.datapoints(uuid, { period, averageBy: 0 })
  }).then(data => {
    console.log('Local result:')
    if (averageBy >= 300) {
      data = toAveragedData(data, period, averageBy)
    }
    logObject(data.datapoints.map(datapoint => {
      return [new Date(datapoint[0] * 1000)].concat(datapoint.slice(1))
    }))
  }).catch(err => {
    logError(err)
    safeExit(1)
  })
}
