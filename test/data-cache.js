import test from 'ava'
import DataCache from '../src/data-cache'
import { ONE_MINUTE } from '../src/util'

test('hasCompleteData detects completeness of datapoints', t => {
  const now = Date.now()
  const cache = new DataCache()
  cache.add('abc', {
    datapoints: [
      [(now - 40 * ONE_MINUTE) / 1000],
      [(now - 35 * ONE_MINUTE) / 1000],
      [(now - 30 * ONE_MINUTE) / 1000],
      [(now - 25 * ONE_MINUTE) / 1000],
      [(now - 20 * ONE_MINUTE) / 1000],
      [(now - 15 * ONE_MINUTE) / 1000],
      [(now - 10 * ONE_MINUTE) / 1000],
      [(now - 5 * ONE_MINUTE) / 1000]
    ]
  })
  t.true(cache.hasCompleteData('abc', 30 * ONE_MINUTE / 1000))
})

test('hasCompleteData detects missing datapoints', t => {
  const now = Date.now()
  const cache = new DataCache()
  cache.add('abc', {
    datapoints: [
      [(now - 35 * ONE_MINUTE) / 1000],
      [(now - 30 * ONE_MINUTE) / 1000],
      [(now - 25 * ONE_MINUTE) / 1000],
      [(now - 15 * ONE_MINUTE) / 1000], // Note that the 20-minute mark is missing!
      [(now - 10 * ONE_MINUTE) / 1000],
      [(now - 5 * ONE_MINUTE) / 1000]
    ]
  })
  t.false(cache.hasCompleteData('abc', 30 * ONE_MINUTE / 1000))
})

test('hasCompleteData detects incomplete period coverage', t => {
  const now = Date.now()
  const cache = new DataCache()
  cache.add('abc', {
    datapoints: [
      [(now - 25 * ONE_MINUTE) / 1000],
      [(now - 20 * ONE_MINUTE) / 1000],
      [(now - 15 * ONE_MINUTE) / 1000],
      [(now - 10 * ONE_MINUTE) / 1000],
      [(now - 5 * ONE_MINUTE) / 1000]
    ]
  })
  t.false(cache.hasCompleteData('abc', 30 * ONE_MINUTE / 1000))
})

test('add inserts datapoints into the correct chronological place', t => {
  const now = Date.now()
  const cache = new DataCache()
  cache.add('abc', {
    datapoints: [
      [(now - 30 * ONE_MINUTE) / 1000],
      [(now - 25 * ONE_MINUTE) / 1000],
      [(now - 20 * ONE_MINUTE) / 1000],
      [(now - 10 * ONE_MINUTE) / 1000],
      [(now - 5 * ONE_MINUTE) / 1000]
    ]
  })
  cache.add('abc', {
    datapoints: [
      [(now - 40 * ONE_MINUTE) / 1000],
      [(now - 35 * ONE_MINUTE) / 1000],
      [(now - 30 * ONE_MINUTE) / 1000],
      [(now - 25 * ONE_MINUTE) / 1000],
      [(now - 20 * ONE_MINUTE) / 1000],
      [(now - 15 * ONE_MINUTE) / 1000],
      [(now - 1 * ONE_MINUTE) / 1000]
    ]
  })
  t.deepEqual(cache.get('abc', 60 * ONE_MINUTE / 1000).datapoints, [
    [(now - 40 * ONE_MINUTE) / 1000],
    [(now - 35 * ONE_MINUTE) / 1000],
    [(now - 30 * ONE_MINUTE) / 1000],
    [(now - 25 * ONE_MINUTE) / 1000],
    [(now - 20 * ONE_MINUTE) / 1000],
    [(now - 15 * ONE_MINUTE) / 1000],
    [(now - 10 * ONE_MINUTE) / 1000],
    [(now - 5 * ONE_MINUTE) / 1000],
    [(now - 1 * ONE_MINUTE) / 1000]
  ])
})
