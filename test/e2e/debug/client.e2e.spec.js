import {pipeline} from 'node:stream/promises';
import B from 'bluebird';
import {promisify} from 'node:util';
import {RokuDebugClient} from '../../../lib/debug/client';
import unexpectedSinon from 'unexpected-sinon';
import unexpected from 'unexpected';
import {BASE_TELNET_OPTS, startNewTelnetServer} from '../helpers';

const expect = unexpected.clone().use(unexpectedSinon);

describe('debug log client behavior', function () {
  /** @type {import('../helpers').TestTelnetServer} */
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
      await server.stop();
    }
  });

  describe('basic operation', function () {
    beforeEach(async function () {
      server = await startNewTelnetServer((socket) => {
        socket.on('negotiated', () => {
          socket.write('HELLO\n');
        });
      });
    });

    it('should connect to the device', async function () {
      rdl = new RokuDebugClient(server.address(), {telnet: BASE_TELNET_OPTS});
      await expect(rdl.connect(), 'to be fulfilled');
    });

    it('should disconnect from the device', async function () {
      rdl = new RokuDebugClient(server.address(), {port, telnet: BASE_TELNET_OPTS});
      await rdl.connect();
      await expect(rdl.disconnect(), 'to be fulfilled');
    });
  });

  describe('reading from device', function () {
    beforeEach(async function () {
      server = await startNewTelnetServer((socket) => {
        socket.on('negotiated', async () => {
          for await (const line of ['HELLO', 'WORLD', '!']) {
            await B.delay(250); // note: this is probably flaky
            socket.write(line + '\n');
          }
          await promisify(socket.end.bind(socket))();
        });
      });
    });

    describe('when disconnected', function () {
      it('should implement the async iterable protocol', async function () {
        rdl = new RokuDebugClient(server.address(), {telnet: BASE_TELNET_OPTS});
        const lines = [];
        for await (const line of rdl) {
          lines.push(line);
        }
        expect(lines, 'to be empty');
      });
    });

    describe('after disconnection', function () {
      it('should not be connected, obviously', async function () {
        rdl = new RokuDebugClient(server.address(), {telnet: BASE_TELNET_OPTS});
        await rdl.connect();
        await rdl.disconnect();
        expect(rdl.isConnected, 'to be false');
      });
    });

    describe('when connected', function () {
      it('should implement the async iteratable protocol', async function () {
        rdl = new RokuDebugClient(server.address(), {telnet: BASE_TELNET_OPTS});
        await rdl.connect();
        const lines = [];
        for await (const line of rdl) {
          lines.push(line.trimEnd());
        }
        expect(lines, 'to equal', ['HELLO', 'WORLD', '!']);
      });

      it('should be usable in a pipeline', async function () {
        rdl = new RokuDebugClient(server.address(), {telnet: BASE_TELNET_OPTS});
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
          await server.stop();
          server = await startNewTelnetServer((socket) => {
            socket.on('negotiated', async () => {
              await B.delay(250);
              socket.end();
            });
          });
          rdl = new RokuDebugClient(server.address(), {telnet: BASE_TELNET_OPTS});
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
