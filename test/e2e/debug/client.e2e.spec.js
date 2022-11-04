import {pipeline} from 'node:stream/promises';
import B from 'bluebird';
import {promisify} from 'node:util';
import {RokuDebugClient} from '../../../lib/debug/client';
import {createServer} from 'telnetlib';
import getPort from 'get-port';
import unexpectedSinon from 'unexpected-sinon';
import unexpected from 'unexpected';
import stoppable from 'stoppable';

const expect = unexpected.clone().use(unexpectedSinon);

const TEST_HOST = '127.0.0.1';

/**
 * This is for debugging purposes only, allowing the debugger to pause on a breakpoint
 * without the connection timing out.
 * @type {import('telnet-client').ConnectOptions}
 */
const BASE_TELNET_OPTS = {
  timeout: 2147483647
};

describe('debug log client behavior', function () {
  /** @type {import('stoppable').StoppableServer} */
  let server;

  /** @type {number} */
  let port;

  /** @type {RokuDebugClient} */
  let rdl;

  afterEach(async function () {
    if (rdl) {
      await rdl.disconnect();
    }
    if (server?.listening) {
      await promisify(server.stop.bind(server))();
    }
  });

  describe('basic operation', function () {
    beforeEach(async function () {
      server = stoppable(
        // @ts-expect-error -- stoppable only supports http(s) but not really
        createServer({}, (socket) => {
          socket.on('negotiated', () => {
            socket.write('HELLO\n');
          });
        })
      );
      port = await getPort();
      await promisify(server.listen.bind(server))(port, TEST_HOST);
    });

    it('should connect to the device', async function () {
      rdl = new RokuDebugClient(TEST_HOST, {port, telnet: BASE_TELNET_OPTS});
      await expect(rdl.connect(), 'to be fulfilled');
    });

    it('should disconnect from the device', async function () {
      rdl = new RokuDebugClient(TEST_HOST, {port, telnet: BASE_TELNET_OPTS});
      await rdl.connect();
      await expect(rdl.disconnect(), 'to be fulfilled');
    });
  });

  describe('reading from device', function () {
    beforeEach(async function () {
      server = stoppable(
        // @ts-expect-error
        createServer({}, (socket) => {
          socket.on('negotiated', async () => {
            for await (const line of ['HELLO', 'WORLD', '!']) {
              socket.write(line + '\n');
              await B.delay(250); // note: this is probably flaky
            }
            await promisify(socket.end.bind(socket))();
          });
        })
      );
      port = await getPort();
      await promisify(server.listen.bind(server))(port, TEST_HOST);
    });

    describe('when disconnected', function () {
      it('should implement the async iterable protocol', async function () {
        rdl = new RokuDebugClient(TEST_HOST, {port, telnet: BASE_TELNET_OPTS});
        const lines = [];
        for await (const line of rdl) {
          lines.push(line);
        }
        expect(lines, 'to be empty');
      });
    });

    describe('after disconnection', function () {
      it('should not be connected, obviously', async function () {
        rdl = new RokuDebugClient(TEST_HOST, {port, telnet: BASE_TELNET_OPTS});
        await rdl.connect();
        await rdl.disconnect();
        expect(rdl.isConnected, 'to be false');
      });
    });

    describe('when connected', function () {
      it('should implement the async iteratable protocol', async function () {
        rdl = new RokuDebugClient(TEST_HOST, {port, telnet: BASE_TELNET_OPTS});
        await rdl.connect();
        const lines = [];
        for await (const line of rdl) {
          lines.push(line.trimEnd());
        }
        expect(lines, 'to equal', ['HELLO', 'WORLD', '!']);
      });

      it('should be usable in a pipeline', async function () {
        rdl = new RokuDebugClient(TEST_HOST, {port, telnet: BASE_TELNET_OPTS});
        await rdl.connect();
        let lines = await pipeline(rdl, async (source) => {
          const lines = [];
          for await (const chunk of source) {
            lines.push(chunk.trimEnd());
          }
          return lines;
        });
        expect(lines, 'to equal', ['HELLO', 'WORLD', '!']);
      });

      describe('when unexpectedly disconnected', function () {
        it('should gracefully close', async function () {
          await promisify(server.stop.bind(server))();
          server = stoppable(
            // @ts-expect-error
            createServer({}, (socket) => {
              socket.on('negotiated', async () => {
                await B.delay(250);
                socket.end();
              });
            }),
            0
          );
          port = await getPort();
          await promisify(server.listen.bind(server))(port, TEST_HOST);

          rdl = new RokuDebugClient(TEST_HOST, {port, telnet: BASE_TELNET_OPTS});
          await rdl.connect();
          await expect(
            new B((resolve) => {
              rdl.on('close', resolve);
            }),
            'to be fulfilled'
          );
        });
      });
    });
  });
});
