import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat
} from 'graphql'
import { client } from './loaders'

const Timestamp = GraphQLString

const sensorResolver = (source, args, context, info) => {
  const index = source.sensors.indexOf(info.fieldName)
  return {
    units: source.units[index],
    datapoints: source.datapoints.map(datapoint => ({
      time: new Date(datapoint[0] * 1000).toISOString(),
      value: datapoint[index]
    }))
  }
}

const createSensorField = (name, valueType = GraphQLFloat) => {
  const Datapoint = new GraphQLObjectType({
    name: `${name}Datapoint`,
    fields: {
      time: { type: Timestamp },
      value: { type: valueType }
    }
  })
  return {
    type: new GraphQLObjectType({
      name,
      fields: {
        units: { type: GraphQLString },
        datapoints: { type: new GraphQLList(Datapoint) }
      }
    }),
    resolve: sensorResolver
  }
}

const resolveToDate = (source, args, context, info) => {
  const value = source[info.fieldName]
  if (value != null) {
    return new Date(value * 1000).toISOString()
  }
  return value
}

const Sensors = new GraphQLObjectType({
  name: 'Sensors',
  fields: {
    start: { type: Timestamp, resolve: resolveToDate },
    end: { type: Timestamp, resolve: resolveToDate },
    expires: { type: Timestamp, resolve: resolveToDate },
    pm: createSensorField('ParticulateMatter'),
    tmp: createSensorField('Temperature'),
    hum: createSensorField('Humidity'),
    co2: createSensorField('CarbonDioxide'),
    voc: createSensorField('VolatileOrganicCompounds'),
    allpollu: createSensorField('AirPollutionIndex')
  }
})

const Device = new GraphQLObjectType({
  name: 'Device',
  fields: {
    uuid: { type: GraphQLString },
    name: {
      type: GraphQLString,
      resolve ({ uuid }, args, { deviceLoader }, info) {
        return deviceLoader.load(uuid).then(device => device.name)
      }
    },
    mac: {
      type: GraphQLString,
      resolve ({ uuid }, args, { deviceLoader }, info) {
        return deviceLoader.load(uuid).then(device => device.mac)
      }
    },
    userID: {
      type: GraphQLInt,
      resolve ({ uuid }, args, { deviceLoader }, info) {
        return deviceLoader.load(uuid).then(device => device.userId)
      }
    },
    sensors: {
      type: Sensors,
      args: {
        period: {
          type: GraphQLInt,
          defaultValue: 0,
          description: 'Number of seconds between start time of search and now'
        },
        averageBy: {
          type: GraphQLInt,
          defaultValue: 0,
          description:
          '0 or 300 for no average. Use 3600 (average hourly) or a multiple ' +
          'for long range requests (e.g. more than 1 day)'
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
            defaultValue: client.defaultDevice
          }
        },
        resolve (source, args, context, info) {
          return { uuid: args.uuid }
        }
      }
    }
  })
})

export default schema
