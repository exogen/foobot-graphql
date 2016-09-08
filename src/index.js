import express from 'express'
import graphqlHTTP from 'express-graphql'
import schema from './schema'
import { deviceLoader, datapointsLoader } from './loaders'

const formatError = (err) => ({
  message: err.message,
  locations: err.locations,
  stack: err.stack
})

const middleware = (options = {}) => {
  const IS_DEV = process.env.NODE_ENV !== 'production'
  return graphqlHTTP({
    schema,
    context: { deviceLoader, datapointsLoader },
    pretty: IS_DEV,
    graphiql: IS_DEV,
    formatError: IS_DEV ? formatError : undefined,
    ...options
  })
}

export default middleware

if (require.main === module) {
  const app = express()
  app.use('/', middleware())
  app.listen(process.env.PORT || 3001)
}
