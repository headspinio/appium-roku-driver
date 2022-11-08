import {promisify} from 'node:util';
import {createServer} from 'telnetlib';
import stoppable from 'stoppable';
import getPort from 'get-port';

export const TEST_HOST = '127.0.0.1';

/**
 * This is for debugging purposes only, allowing the debugger to pause on a breakpoint
 * without the connection timing out.
 * @type {import('telnet-client').ConnectOptions}
 */
export const BASE_TELNET_OPTS = {
  timeout: 2147483647,
};

/**
 * @type {Set<string|symbol>}
 */
const PROMISIFIED_SERVER_METHODS = new Set(['listen', 'stop']);

/**
 * Create a dummy telnet server for testing.
 * @param {(socket: import("net").Socket & import("telnetlib").TelnetSocket) => void} connectionListener
 * @returns {Promise<{port: number, host: string, server: TestTelnetServer}>}
 */
export async function createTelnetServer(connectionListener) {
  const server = stoppable(
    // @ts-expect-error -- stoppable only supports http(s) but not really
    createServer({}, connectionListener)
  );

  const proxy = /** @type {TestTelnetServer} */ (
    /** @type {unknown} */ (
      new Proxy(server, {
        get(target, prop) {
          if (PROMISIFIED_SERVER_METHODS.has(prop)) {
            return promisify(target[prop].bind(target));
          }
          return target[prop];
        },
      })
    )
  );
  const port = await getPort();
  return {server: proxy, port, host: TEST_HOST};
}

/**
 * Creates a dummy telnet server for testing and begins listening on a random port.
 * @param {(socket: import("net").Socket & import("telnetlib").TelnetSocket) => void} connectionListener
 * @returns {Promise<TestTelnetServer>}
 */
export async function startNewTelnetServer(connectionListener) {
  const {server, port, host} = await createTelnetServer(connectionListener);
  await server.listen(port, host);
  return server;
}

/**
 * A telnet server with a `Promise`-returning `stop()` method and a `Promise`-returning `listen()` method.
 * @typedef {Omit<import('stoppable').StoppableServer, 'stop'|'listen'|'address'> & {stop(): Promise<void>, listen(port: number, host: string): Promise<void>, address(): import('node:net').AddressInfo}} TestTelnetServer
 */
