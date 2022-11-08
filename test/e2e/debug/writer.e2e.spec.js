import {promisify} from 'util';
import B from 'bluebird';
import {createSandbox} from 'sinon';
import {fs, tempDir} from 'appium/support';
import path from 'node:path';
import {RokuDebugWriter} from '../../../lib/debug/writer';
import unexpected from 'unexpected';
import {BASE_TELNET_OPTS, startNewTelnetServer} from '../helpers';

const expect = unexpected.clone();

describe('debug log writer behavior', function () {
  let sandbox;

  let tmpdir;

  let envPaths;

  let server;

  beforeEach(async function () {
    sandbox = createSandbox();
    tmpdir = await tempDir.openDir();
    envPaths = {
      logDirpath: path.join(tmpdir, 'log'),
      lockfileDirpath: path.join(tmpdir, 'tmp'),
    };
    sandbox.stub(RokuDebugWriter, 'getEnvPaths').returns(envPaths);
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

  describe('basic operation', function () {
    it('should pipe a data from a client to a logfile', async function () {
      const writer = new RokuDebugWriter(server.address(), {
        telnet: BASE_TELNET_OPTS,
        keepLogs: true,
      });
      await writer.pipe();
      await expect(fs.readFile(writer.logPath, 'utf8'), 'to be fulfilled with', 'HELLO\nWORLD\n!\n');
    });
  });

  afterEach(async function () {
    sandbox.restore();
    if (server) {
      await server.stop();
    }
  });
});
