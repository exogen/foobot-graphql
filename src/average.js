import Decimal from 'decimal.js'
import FoobotClient from './api'

export function bucketize (datapoints, period, averageBy) {
  datapoints = datapoints.slice()
  averageBy = averageBy || 300
  let bucket = []
  const buckets = [bucket]
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
  return buckets.filter(bucket => bucket.length !== 0)
}

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
  const buckets = bucketize(data.datapoints, period, averageBy)
  const datapoints = buckets.map(averageBucket)
  return {
    ...data,
    start: datapoints[0][0],
    end: datapoints[datapoints.length - 1][0],
    datapoints
  }
}

if (require.main === module) {
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
