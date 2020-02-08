import log from './logger';
import { server as baseServer, routeConfiguringFunction } from '@appium/base-driver';
import RokuDriver from './driver';

async function startServer (port, address) {
  let d = new RokuDriver({port, address});
  let router = routeConfiguringFunction(d);
  let server = await baseServer({
    routeConfiguringFunction: router,
    port,
    hostname: address,
    allowCors: false,
  });
  log.info(`RokuDriver server listening on http://${address}:${port}`);
  return server;
}

export { startServer };
