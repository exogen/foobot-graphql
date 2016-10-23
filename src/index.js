import express from 'express'
import graphqlHTTP from 'express-graphql'
import compression from 'compression'
import schema from './schema'
import { deviceLoader, cachedDatapointsLoader } from './loaders'

const formatError = (err) => ({
  message: err.message,
  locations: err.locations,
  stack: err.stack
})

const middleware = ({ ...options } = {}) => {
  const DEV = process.env.NODE_ENV !== 'production'
  return graphqlHTTP({
    schema,
    context: { deviceLoader, datapointsLoader: cachedDatapointsLoader },
    pretty: DEV,
    graphiql: DEV,
    formatError: DEV ? formatError : undefined,
    ...options
  })
}

export default middleware

if (require.main === module) {
  const app = express()
  app.use(compression())
  app.use('/', middleware())
  app.listen(process.env.PORT || 3001)
}
