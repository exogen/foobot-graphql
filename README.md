# foobot-graphql

An [Express][] server and middleware for querying your [Foobot][] using
[GraphQL][].

```sh
npm install --save foobot-graphql
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Contents

- [Usage](#usage)
  - [As a standalone server](#as-a-standalone-server)
  - [As Express middleware](#as-express-middleware)
  - [Environment Variables](#environment-variables)
  - [Debugging](#debugging)
- [Schema](#schema)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Usage

This package can be used both as a standalone GraphQL server and as Express
middleware supplying a GraphQL endpoint.

### As a standalone server

Run the included `foobot-graphql` executable to start the server. The server
is configured using [Environment Variables](#environment-variables).

```sh
$ foobot-graphql
Listening on port 3000.
```

### As middleware

```js
import express from 'express';
import foobotGraphQL from 'foobot-graphql';

const app = express();

app.use('/foobot', foobotGraphQL({ /* options */ }));

app.listen(3000);
```

The `foobotGraphQL` middleware function accepts the following options:

* **`client`**: A custom API client instance to use. See the
  [client submodule](src/client.js) for help with creating a custom instance.
* Any remaining See the [express-graphql][] documentation for

### Environment Variables

* **`FOOBOT_API_KEY`**: API key to authenticate with. [Request an API key][API]
  at the Foobot site.
* **`FOOBOT_USERNAME`**: Username of the account owner.
* **`FOOBOT_DEFAULT_DEVICE`**: Device UUID of to use as the default, so you
  don’t have to look it up and specify it every time if you only have one
  device.
* **`PORT`**: Port number to use, if running the standalone server.

When running the standalone server, [dotenv][] is used to load these variables
from a `.env` file, if one exists in the current working directory.

### Debugging

The `DEBUG` environment variable can be used to enable logging for all of this
package’s submodules:

```sh
$ DEBUG=foobot-graphql:* foobot-graphql
```

See the [debug][] package for more information.

## Schema

```graphql

# A single datapoint from a sensor.
type Datapoint {
  # The timestamp of the reading.
  time: Date

  # The numeric value of the sensor reading.
  value: Float
}

scalar Date

# Information about a single device.
type Device {
  # The UUID of the device.
  uuid: String

  # The friendly name of the device.
  name: String

  # The MAC of the device.
  mac: String

  # The ID of the user who owns the device.
  userID: Int

  # The set of sensors on a single device.
  sensors(
    # Number of seconds between start time of the period and now.
    period: Int = 0

    # Resolution of the returned datapoints in seconds. Use 0 or 300 for no
    # averaging. For long range requests, it is recommended to use 3600 (hourly
    # average) or a multiple.
    averageBy: Int = 0
  ): Sensors
}

type Query {
  device(
    # The UUID of the device. If none is supplied, the default will be determined based on the server’s configuration.
    uuid: String
  ): Device
}

# Information from a single sensor.
type Sensor {
  # The units for the value returned in each datapoint.
  units: String

  # The set of datapoints for the requested period.
  datapoints: [Datapoint]
}

type Sensors {
  # The timestamp of the earliest returned datapoint.
  start: Date

  # The timestamp of the last returned datapoint.
  end: Date

  # The timestamp at which we expect a new datapoint from the device. Clients can
  # use this to determine when their data is stale.
  expires: Date

  # Particulate matter.
  pm: Sensor

  # Temperature.
  tmp: Sensor

  # Humidity.
  hum: Sensor

  # Carbon dioxide.
  co2: Sensor

  # Volatile organic compounds.
  voc: Sensor

  # Overall pollution index.
  allpollu: Sensor
}

```

[Express]: http://expressjs.com/
[Foobot]: http://foobot.io/
[GraphQL]: http://graphql.org/
[API]: https://api.foobot.io/apidoc/index.html
[dotenv]: https://www.npmjs.com/package/dotenv
[debug]: https://www.npmjs.com/package/debug
[express-graphql]: https://www.npmjs.com/package/express-graphql
