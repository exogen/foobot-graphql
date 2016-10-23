/**
 * The Foobot API is rate limited. This class helpers us figure out when we're
 * allowed to make another request.
 *
 * In the worst case, consumers of this GraphQL service will want up-to-date
 * results for the entire day -- for example, by keeping open a dashboard that
 * is constantly refreshed with the most recent results. The API updates every
 * five minutes, but there's a problem: we're limited to 200 API requests per
 * day, yet there are 288 five-minute intervals in a day. So unless you MITM
 * the Foobot app and steal their unlimited API key (which works, but is
 * troublesome), we need to figure out how to make fewer API calls while
 * staying reasonably up to date.
 *
 * Limiter's job is to schedule spaced out fetches. The fetch delay is
 * determined based on the time of day and the number of remaining API requests
 * we think we have based on the headers in the previous request. Note that all
 * of the day's datapoints are still fetched no matter what (by expanding the
 * requested period). So there will never be any dropped datapoints, we just
 * might not fetch new ones right away.
 *
 *
 * Run this file as a standalone script to test the delay parameters.
 */
import dateFns from 'date-fns'
import formatDuration from 'humanize-duration'
import { ONE_MINUTE, ONE_HOUR, ONE_DAY } from './util'

const debug = require('debug')('foobot-graphql:limiter')
const MAX_DISTANCE = ONE_DAY / 2

// TODO: There is unused code here to allow consumers to specify a "peak time"
// during which we'll make requests at 5-minute intervals no matter what, and
// gradually make fewer requests the farther we get from that time. Currently,
// we just evenly space out the day's remaining requests.
export default class Limiter {
  constructor (client, {
    peakTimeUTC = ONE_HOUR / 2,
    resetTimeUTC = 0,
    limitTarget = 200
  } = {}) {
    this.client = client
    this.peakTimeUTC = peakTimeUTC
    this.resetTimeUTC = resetTimeUTC
    this.limitTarget = limitTarget
  }

  distanceFromPeak (date = new Date()) {
    const zero = new Date(date.getTime())
    zero.setUTCHours(0)
    zero.setUTCMinutes(0)
    zero.setUTCSeconds(0)
    zero.setUTCMilliseconds(0)
    const distanceFromZero = date.getTime() - zero.getTime()
    return Math.min(
      Math.abs(distanceFromZero - this.peakTimeUTC),
      Math.abs(distanceFromZero - this.peakTimeUTC + ONE_DAY),
      Math.abs(distanceFromZero - this.peakTimeUTC - ONE_DAY)
    )
  }

  delayAtDistance (distance) {
    const base = 5 * ONE_MINUTE
    const increase = 1000 * Math.exp(8.15 * distance / MAX_DISTANCE)
    const delay = base + increase
    return 1000 * Math.floor(delay / 1000) // Round down to second.
  }

  delayAtTime (date = new Date()) {
    return this.delayAtDistance(this.distanceFromPeak(date))
  }

  nextResetTime (date = new Date()) {
    const resetTime = new Date(date.getTime())
    resetTime.setUTCHours(0)
    resetTime.setUTCMinutes(0)
    resetTime.setUTCSeconds(0)
    resetTime.setUTCMilliseconds(this.resetTimeUTC)
    while (resetTime.getTime() <= date.getTime()) {
      resetTime.setUTCDate(resetTime.getUTCDate() + 1)
    }
    return resetTime
  }

  distanceFromReset (date = new Date()) {
    const resetTime = this.nextResetTime(date)
    return resetTime.getTime() - date.getTime()
  }

  delayAtLimit (lastRequestTime, lastRequestLimit, date = new Date()) {
    if (lastRequestTime == null || lastRequestLimit == null) {
      return 0
    }
    const wasReset = this.nextResetTime(lastRequestTime) <= date
    const limit = wasReset ? this.limitTarget : Math.min(this.limitTarget, lastRequestLimit)
    const distance = this.distanceFromReset(date)
    const avgDelay = distance / limit
    /*
    const base = minDelay
    const factor = 300 // Magic number to get the desired distribution.
    const increase = 500 * Math.exp(factor * avgDelay / maxDelay)
    */
    const delay = Math.min(distance, avgDelay)
    return 1000 * Math.floor(delay / 1000) // Round down to second.
  }

  nextRequestTime (date = new Date()) {
    let nextRequestTime = date
    if (this.client.lastRequestTime == null) {
      debug('No previous request.')
    } else if (this.client.lastRequestLimit === 0) {
      nextRequestTime = this.nextResetTime(this.client.lastRequestTime)
      debug('Request limit reached, delaying until next reset.')
    } else {
      const delay = this.delayAtLimit(
        this.client.lastRequestTime,
        this.client.lastRequestLimit,
        date
      )
      nextRequestTime = new Date(this.client.lastRequestTime.getTime() + delay)
      debug('Delaying based on previous request.')
    }
    return nextRequestTime
  }

  nextRequestDelay (date = new Date()) {
    const nextTime = this.nextRequestTime(date)
    let delay = 0
    if (nextTime > date) {
      delay = nextTime.getTime() - date.getTime()
    }
    debug(
      'Next request can be made %s.',
      delay ? `in ${formatDuration(delay)}` : 'now'
    )
    return delay
  }

  canMakeRequest (date = new Date()) {
    return date >= this.nextRequestTime(date)
  }
}

if (require.main === module) {
  const client = { lastRequestTime: null, lastRequestLimit: 50 }
  const limiter = new Limiter(client, { resetTime: 0 })

  // Check how the delay changes throughout the day.
  const now = new Date()
  for (let i = 0; i < 48; i++) {
    const time = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    time.setMilliseconds(i * ONE_HOUR / 2)
    client.lastRequestTime = time
    client.lastRequestLimit -= 1
    const delay = limiter.delayAtLimit(client.lastRequestTime, client.lastRequestLimit, time)
    console.log(
      `hour: ${dateFns.format(time, 'HH:mm')}, ` +
      `limit: ${client.lastRequestLimit}, ` +
      `delay: ${formatDuration(delay)}`
    )
  }

  console.log()

  // Check the maximum number of ticks that will occur under ideal conditions.
  let sum = 0
  let count = 0
  let time = new Date(2016, 8, 15)
  time.setUTCHours(0)
  time.setUTCMinutes(0)
  time.setUTCSeconds(0)
  time.setUTCMilliseconds(0)
  client.lastRequestTime = null
  client.lastRequestLimit = 200
  while (sum < ONE_DAY) {
    client.lastRequestTime = time
    client.lastRequestLimit -= 1
    let delay = limiter.nextRequestDelay(time)
    console.log(
      `time: ${dateFns.format(time, 'HH:mm')}, ` +
      `limit: ${client.lastRequestLimit}, ` +
      `delay: ${formatDuration(delay)}`
    )
    sum += delay
    count += 1
    const lastTime = time
    const nextResetTime = limiter.nextResetTime(lastTime)
    time = new Date(time.getTime() + delay)
    if (time >= nextResetTime) {
      client.lastRequestLimit = 200
    }
  }
  console.log(`Current settings will result in ~${count} API calls per day.`)
}
