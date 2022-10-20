import B from 'bluebird';
import {fs} from 'appium/support';
import {promisify} from 'node:util';
import {RokuDebugClient} from '../../../lib/debug/client';
import {createServer} from 'telnetlib';
import getPort from 'get-port';
import unexpectedSinon from 'unexpected-sinon';
import unexpected from 'unexpected';

const expect = unexpected.clone().use(unexpectedSinon);

const TEST_HOST = '127.0.0.1';

describe('debug log behavior', function () {
  /** @type {import('net').Server} */
  let server;

  /** @type {number} */
  let port;

  /** @type {RokuDebugClient} */
  let rdl;

  afterEach(async function () {
    if (rdl) {
      await rdl.disconnect();
    }
    if (server) {
      await promisify(server.close.bind(server))();
    }
  });

  describe('basic operation', function () {
    beforeEach(async function () {
      server = createServer({}, (socket) => {
        socket.on('negotiated', () => {
          socket.write('HELLO\n');
        });
      });
      port = await getPort();
      await promisify(server.listen.bind(server))(port, TEST_HOST);
    });

    it('should connect to the device', async function () {
      rdl = new RokuDebugClient(TEST_HOST, {port});
      await rdl.connect();

      await expect(rdl.nextData(), 'to be fulfilled with', 'HELLO\n');
    });

    it('should write to the log', async function () {
      rdl = new RokuDebugClient(TEST_HOST, {port});
      await rdl.connect();
      await rdl.nextData();
      await fs.readFile(rdl.logPath, 'utf8').should.eventually.equal('HELLO\n');
    });

    it('should read some data', async function () {
      rdl = new RokuDebugClient(TEST_HOST, {port});
      await rdl.connect();
      await expect(rdl.nextData(), 'to be fulfilled with', 'HELLO\n');
    });
  });

  describe('with multiple lines', function () {
    beforeEach(async function () {
      server = createServer({}, (socket) => {
        socket.on('negotiated', async () => {
          for await (const line of ['HELLO', 'WORLD', '!']) {
            socket.write(line + '\n');
            await B.delay(250); // note: this is probably flaky
          }
          await promisify(socket.end.bind(socket))();
        });
      });
      port = await getPort();
      await promisify(server.listen.bind(server))(port, TEST_HOST);
    });

    describe('when disconnected', function () {
      it('should implement the async iterator protocol', async function () {
        rdl = new RokuDebugClient(TEST_HOST, {port});
        const lines = [];
        for await (const line of rdl) {
          lines.push(line);
        }
        expect(lines, 'to be empty');
      });
    });

    describe('after disconnection', function () {
      it('should not be connected, obviously', async function () {
        rdl = new RokuDebugClient(TEST_HOST, {port});
        await rdl.connect();
        await rdl.disconnect();
        expect(rdl.isConnected, 'to be false');
      });
    });

    describe('when connected', function () {
      it('should implement the async iterator protocol', async function () {
        rdl = new RokuDebugClient(TEST_HOST, {port});
        await rdl.connect();
        const lines = [];
        for await (const line of rdl) {
          lines.push(line.trimEnd());
        }
        expect(lines, 'to equal', ['HELLO', 'WORLD', '!']);
      });

      it('should read the entire logfile', async function () {
        rdl = new RokuDebugClient(TEST_HOST, {port});
        await rdl.connect();
        await new B((resolve) => {
          // we only do this because otherwise we could run into a race condition
          // waiting for the socket writes
          rdl.on('finish', resolve);
        });
        await expect(rdl.getLog(), 'to be fulfilled with', 'HELLO\nWORLD\n!\n');
      });
    });
  });
});
