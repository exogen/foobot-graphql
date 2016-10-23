/**
 * By default, DataLoader caches keys forever. This is not ideal for the types
 * of requests we make to the API. For example, we want to be able to tell the
 * cache to expire datapoint results five minutes after the last datapoint,
 * since that's how often the endpoint updates. Use this with DataLoader's
 * `cacheMap` option.
 */
import util from 'util'
import formatDuration from 'humanize-duration'
import { EventEmitter } from 'events'
import uuid from 'node-uuid'

const debug = require('debug')('foobot-graphql:expiring-map')

function formatKey (key) {
  return util.inspect(key, { breakLength: Infinity })
}

export default class ExpiringMap extends EventEmitter {
  constructor (options = {}, iterable) {
    super()
    this.ttl = options.ttl
    this.map = new Map(iterable)
    this.ids = new Map()
    this.timeouts = new Map()
    this.has = this.map.has.bind(this.map)
    this.get = this.map.get.bind(this.map)
    this.entries = this.map.entries.bind(this.map)
    this.forEach = this.map.forEach.bind(this.map)
    this.keys = this.map.keys.bind(this.map)
    this.values = this.map.values.bind(this.map)
  }

  get size () {
    return this.map.size
  }

  clear () {
    for (const key of this.timeouts.keys()) {
      this.clearTimeout(key)
    }
    this.ids.clear()
    this.map.clear()
  }

  clearTimeout (key) {
    const timeout = this.timeouts.get(key)
    if (timeout) {
      debug(`Clearing timeout. key=${formatKey(key)}`)
      clearTimeout(timeout)
    }
    this.timeouts.delete(key)
  }

  delete (key) {
    this.clearTimeout(key)
    this.ids.delete(key)
    return this.map.delete(key)
  }

  expire (key, id) {
    if (this.ids.get(key) === id) {
      const value = this.get(key)
      this.delete(key)
      debug(`Expired value. key=${formatKey(key)}.`)
      this.emit('expire', key, value)
    }
  }

  set (key, value) {
    const id = uuid.v4()
    this.ids.set(key, id)
    this.map.set(key, value)
    this.clearTimeout(key)
    let { ttl } = this
    if (typeof ttl === 'function') {
      ttl = ttl(key, value)
    }
    if (ttl != null) {
      Promise.resolve(ttl).then(ttl => {
        // Make sure we still care about expiring this particular value by
        // checking whether the ID is still the same.
        if (ttl != null && this.ids.get(key) === id) {
          const expire = () => { this.expire(key, id) }
          const timeout = setTimeout(expire, ttl)
          this.timeouts.set(key, timeout)
          debug(`Expiration set to ${formatDuration(ttl)}. key=${formatKey(key)}`)
        }
      })
    }
    return this
  }
}
