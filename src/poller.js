/**
 * In the worst case, consumers of this GraphQL service will want up-to-date
 * results throughout the whole day -- for example, by rendering a dashboard
 * that is constantly updating with the most recent results. The highest
 * resolution update interval is five minutes, but there's a problem: we're
 * limited to 200 API requests per day, yet there are 288 five-minute intervals
 * in a day. So unless you MITM the Foobot app and steal their unlimited API
 * key (which works, but is troublesome), we need to figure out how to make
 * fewer API calls while staying reasonably up to date.
 *
 * Poller's job is to schedule spaced out fetches. The basic idea is that
 * during the day when people are likely to be looking at a dashboard, we can
 * make more frequent requests close to the five-minute interval. Late at
 * night, we slow way down. Note that all of the day's datapoints are still
 * captured (by expanding the requested period), but we simply fetch them less
 * often. The fetch delay is determined based on the exact time of day using an
 * exponential function.
 *
 * Run this file as a standalone script to test the delay parameters.
 */
import formatDuration from 'humanize-duration'
import { ONE_MINUTE, ONE_HOUR, ONE_DAY } from './util'

const debug = require('debug')('foobot-graphql:poller')
const MAX_DISTANCE = ONE_DAY / 2

export default class Poller {
  constructor ({ fetch, peakTime = 17 * ONE_HOUR } = {}) {
    this.peakTime = peakTime
    this.fetch = fetch
    this.start = this.start.bind(this)
    this.delay = this.delay.bind(this)
    this.tick = this.tick.bind(this)
    this._timeout = null
  }

  distanceFromPeak (date = new Date()) {
    const zero = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const distanceFromZero = date - zero
    return Math.min(
      Math.abs(distanceFromZero - this.peakTime),
      Math.abs(distanceFromZero - this.peakTime + ONE_DAY),
      Math.abs(distanceFromZero - this.peakTime - ONE_DAY)
    )
  }

  delayAtDistance (distance) {
    const base = 5 * ONE_MINUTE
    const increase = 1000 * Math.exp(8.15 * distance / MAX_DISTANCE)
    const delay = base + increase
    return 1000 * Math.floor(delay / 1000) // Round down to second.
  }

  delayAtTime (date) {
    return this.delayAtDistance(this.distanceFromPeak(date))
  }

  start () {
    debug('Starting poller.')
    this.tick()
  }

  stop () {
    debug('Stopping poller.')
    clearTimeout(this._timeout)
  }

  delay () {
    return new Promise((resolve, reject) => {
      const delay = this.delayAtTime()
      debug(`Delaying for ${formatDuration(delay)}.`)
      this._timeout = setTimeout(resolve, delay)
    }).catch(err => {
      console.error(err)
    })
  }

  resolvedDelay () {
    return this.delay()
  }

  rejectedDelay (err) {
    debug(`Fetch failed: ${err}`)
    return this.delay()
  }

  tick () {
    debug('Running fetch.')
    this.fetch(this)
      .then(this.resolvedDelay, this.rejectedDelay)
      .then(this.tick)
  }
}

if (require.main === module) {
  const poller = new Poller()

  // Check how the delay changes throughout the day.
  for (let i = 0; i < 24; i++) {
    const delay = poller.delayAtTime(new Date(2016, 8, 9, i))
    console.log(`hour: ${i}, delay: ${formatDuration(delay)}`)
  }

  // Check the maximum number of ticks that will occur under ideal conditions.
  let sum = 0
  let count = 0
  let time = new Date(2016, 8, 9, 17)
  while (sum < ONE_DAY) {
    let delay = poller.delayAtTime(time)
    sum += delay
    count += 1
    time = new Date(time.getTime() + delay)
  }
  console.log(`Current settings will result in ~${count} API calls per day.`)
}
