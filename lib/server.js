import log from './logger';
import { server as baseServer, routeConfiguringFunction } from 'appium-base-driver';
import RaspiDriver from './driver';

async function startServer (port, address) {
  let d = new RaspiDriver({port, address});
  let router = routeConfiguringFunction(d);
  let server = await baseServer(router, port, address);
  log.info(`RaspiDriver server listening on http://${address}:${port}`);
  return server;
}

export { startServer };
