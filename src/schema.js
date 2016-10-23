import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  printSchema
} from 'graphql'
import GraphQLDate from 'graphql-date'

const resolveToDate = (source, args, context, info) => {
  const value = source[info.fieldName]
  if (value != null) {
    return new Date(value * 1000).toISOString()
  }
  return value
}

const resolveSensor = (source, args, context, info) => {
  const index = source.sensors.indexOf(info.fieldName)
  return {
    units: source.units[index],
    datapoints: source.datapoints.map(datapoint => ({
      time: new Date(datapoint[0] * 1000).toISOString(),
      value: datapoint[index]
    }))
  }
}

const Datapoint = new GraphQLObjectType({
  name: 'Datapoint',
  description: 'A single datapoint from a sensor.',
  fields: {
    time: {
      type: GraphQLDate,
      description: 'The timestamp of the reading.'
    },
    value: {
      type: GraphQLFloat,
      description: 'The numeric value of the sensor reading.'
    }
  }
})

const Sensor = new GraphQLObjectType({
  name: 'Sensor',
  description: 'Information from a single sensor.',
  fields: {
    units: {
      type: GraphQLString,
      description: 'The units for the value returned in each datapoint.'
    },
    datapoints: {
      type: new GraphQLList(Datapoint),
      description: 'The set of datapoints for the requested period.'
    }
  }
})

const Sensors = new GraphQLObjectType({
  name: 'Sensors',
  fields: {
    start: {
      type: GraphQLDate,
      description: 'The timestamp of the earliest returned datapoint.',
      resolve: resolveToDate
    },
    end: {
      type: GraphQLDate,
      description: 'The timestamp of the last returned datapoint.',
      resolve: resolveToDate
    },
    expires: {
      type: GraphQLDate,
      description:
        'The timestamp at which we expect a new datapoint from the device. ' +
        'Clients can use this to determine when their data is stale.',
      resolve: resolveToDate
    },
    pm: {
      type: Sensor,
      description: 'Particulate matter.',
      resolve: resolveSensor
    },
    tmp: {
      type: Sensor,
      description: 'Temperature.',
      resolve: resolveSensor
    },
    hum: {
      type: Sensor,
      description: 'Humidity.',
      resolve: resolveSensor
    },
    co2: {
      type: Sensor,
      description: 'Carbon dioxide.',
      resolve: resolveSensor
    },
    voc: {
      type: Sensor,
      description: 'Volatile organic compounds.',
      resolve: resolveSensor
    },
    allpollu: {
      type: Sensor,
      description: 'Overall pollution index.',
      resolve: resolveSensor
    }
  }
})

const Device = new GraphQLObjectType({
  name: 'Device',
  description: 'Information about a single device.',
  fields: {
    uuid: {
      type: GraphQLString,
      description: 'The UUID of the device.'
    },
    name: {
      type: GraphQLString,
      description: 'The friendly name of the device.',
      resolve ({ uuid }, args, { deviceLoader }, info) {
        return deviceLoader.load(uuid).then(device => device.name)
      }
    },
    mac: {
      type: GraphQLString,
      description: 'The MAC of the device.',
      resolve ({ uuid }, args, { deviceLoader }, info) {
        return deviceLoader.load(uuid).then(device => device.mac)
      }
    },
    userID: {
      type: GraphQLInt,
      description: 'The ID of the user who owns the device.',
      resolve ({ uuid }, args, { deviceLoader }, info) {
        return deviceLoader.load(uuid).then(device => device.userId)
      }
    },
    sensors: {
      type: Sensors,
      description: 'The set of sensors on a single device.',
      args: {
        period: {
          type: GraphQLInt,
          defaultValue: 0,
          description:
            'Number of seconds between start time of the period and now.'
        },
        averageBy: {
          type: GraphQLInt,
          defaultValue: 0,
          description:
            'Resolution of the returned datapoints in seconds. Use 0 or 300 ' +
            'for no averaging. For long range requests, it is recommended to ' +
            'use 3600 (hourly average) or a multiple.'
        }
      },
      resolve ({ uuid }, { period, averageBy }, { datapointsLoader }, info) {
        return datapointsLoader.load([uuid, period, averageBy])
      }
    }
  }
})

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      device: {
        type: Device,
        args: {
          uuid: {
            type: GraphQLString,
            description:
              'The UUID of the device. If none is supplied, the default will ' +
              'be determined based on the server’s configuration.'
          }
        },
        resolve (source, args, context, info) {
          const uuid = args.uuid || context.client.defaultDevice
          if (!uuid) {
            throw new Error('Supply a device UUID or configure a default.')
          }
          return { uuid }
        }
      }
    }
  })
})

export default schema

if (require.main === module) {
  console.log(printSchema(schema))
}
