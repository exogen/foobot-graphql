/**
 * A class for storing data returned by the Foobot API. Since the API is rate
 * limited, we want to avoid fetching data that we've already seen. Use this
 * class to store the highest resolution, un-averaged data returned by
 * the API. Consumers can then request the data from this cache instead, and
 * it'll do the necessary slicing and averaging using `period` and `averageBy`.
 */
import { toAveragedData } from './average-by'
import { ONE_MINUTE } from './util'

const debug = require('debug')('foobot-graphql:data-cache')
const MAX_CONNECTED_DISTANCE = 6 * ONE_MINUTE

export default class DataCache {
  constructor () {
    this.devices = {}
  }

  updateData (uuid, data) {
    const device = this.devices[uuid] = this.devices[uuid] || {}
    device.uuid = uuid
    device.sensors = data.sensors
    device.units = data.units
    device.datapoints = device.datapoints || []
    let j = 0
    let prepended = 0
    let appended = 0
    let inserted = 0
    let skipped = 0
    for (let i = 0; i < data.datapoints.length; i++) {
      const datapoint = data.datapoints[i]
      let handled = false
      while (!handled) {
        if (j >= device.datapoints.length) {
          handled = true
          device.datapoints.push(datapoint)
          device.date = data.date
          device.expires = data.expires
          appended += 1
        } else if (datapoint[0] < device.datapoints[j][0]) {
          handled = true
          device.datapoints.splice(j, 0, datapoint)
          if (j) {
            inserted += 1
          } else {
            prepended += 1
          }
          j += 1
        } else if (datapoint[0] === device.datapoints[j][0]) {
          handled = true
          skipped += 1
          j += 1
        } else if (datapoint[0] > device.datapoints[j][0]) {
          j += 1
        }
      }
    }
    debug(
      `Added datapoints. ` +
      `prepended=${prepended} ` +
      `inserted=${inserted} ` +
      `appended=${appended} ` +
      `skipped=${skipped}`
    )
  }

  add (uuid, data) {
    this.updateData(uuid, data)
  }

  hasCompleteData (uuid, period) {
    const device = this.devices[uuid] || { datapoints: [] }
    const { datapoints } = device
    if (datapoints.length) {
      const last = datapoints[datapoints.length - 1]
      const cutoff = last[0] - period
      const index = datapoints.findIndex(datapoint => datapoint[0] >= cutoff)
      if (index === -1) {
        return false
      }
      return datapoints.slice(index).every((datapoint, i, array) => {
        const time = datapoint[0] * 1000
        const prevTime = (i === 0 ? cutoff : array[i - 1][0]) * 1000
        return (time - prevTime) <= MAX_CONNECTED_DISTANCE
      })
    }
    return false
  }

  get (uuid, period, averageBy = 0) {
    let device = this.devices[uuid] || {
      uuid,
      start: null,
      end: null,
      sensors: ['time', 'pm', 'tmp', 'hum', 'co2', 'voc', 'allpollu'],
      units: ['s', 'ugm3', 'C', 'pc', 'ppm', 'ppb', '%'],
      datapoints: []
    }
    const { datapoints } = device
    if (datapoints.length) {
      const last = datapoints[datapoints.length - 1]
      const cutoff = last[0] - period
      const index = datapoints.findIndex(datapoint => datapoint[0] >= cutoff)
      device = {
        ...device,
        start: datapoints[index][0],
        end: last[0],
        datapoints: datapoints.slice(index)
      }
      if (averageBy >= 300) {
        device = toAveragedData(device, period, averageBy)
      }
    }
    return device
  }
}
