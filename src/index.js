#!/usr/bin/env node
import express from 'express'
import graphqlHTTP from 'express-graphql'
import compression from 'compression'
import FoobotClient from './api'
import schema from './schema'
import createLoaders from './loaders'

const formatError = (err) => ({
  message: err.message,
  locations: err.locations,
  stack: err.stack
})

const middleware = ({ client = new FoobotClient(), ...options } = {}) => {
  const DEV = process.env.NODE_ENV !== 'production'
  return graphqlHTTP({
    schema,
    context: { client, loaders: createLoaders(client) },
    pretty: DEV,
    graphiql: DEV,
    formatError: DEV ? formatError : undefined,
    ...options
  })
}

export default middleware

if (require.main === module) {
  require('dotenv').config()
  const app = express()
  const port = process.env.PORT || process.env.npm_package_config_port || 3000
  app.use(compression())
  app.use('/', middleware())
  app.listen(port, () => { console.log(`Listening on port ${port}.`) })
}
