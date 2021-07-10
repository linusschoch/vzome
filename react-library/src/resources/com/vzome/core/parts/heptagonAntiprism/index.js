
// These imports work because we are using @rollup/plugin-url.
// See package.json and rollup.config.js

import connectorUrl from './connector.vef'
import blueUrl from './blue.vef'
import redUrl from './red.vef'
import greenUrl from './green.vef'

const shapes = {
  connector: connectorUrl,
  blue: blueUrl,
  red: redUrl,
  green: greenUrl,
}

export default shapes