import DataLoader from 'dataloader'
import FoobotClient from './api'

const client = new FoobotClient()

export const deviceLoader = new DataLoader(keys => {
  return client.devices().then(devices => {
    return keys.map(uuid => {
      const device = devices.filter(device => device.uuid === uuid)[0]
      if (device) {
        return device
      }
      throw new Error(`Device not found: ${uuid}`)
    })
  })
})

export const datapointsLoader = new DataLoader(keys => {
  return Promise.all(keys.map(key => {
    const [ uuid, period, averageBy ] = key
    let timeout
    return client.datapoints(uuid, { period, averageBy }).then(data => {
      const expires = data.end + 5 * 60
      const ttl = expires - data.date
      console.log(`Expiring datapoints in ${ttl} seconds:`, key)
      timeout = setTimeout(() => {
        console.log('Expiring datapoints:', key)
        datapointsLoader.clear(key)
      }, ttl * 1000)
      data.expires = expires
      return data
    }).catch(err => {
      clearTimeout(timeout)
      console.log('Expiring datapoints due to error:', key)
      console.error(err)
      datapointsLoader.clear(key)
    })
  }))
}, {
  cacheKeyFn: key => key.join('/')
})
