/* eslint-disable promise/prefer-await-to-callbacks */
import * as stream from 'node:stream';
import rewiremock from 'rewiremock/node';
import {createSandbox} from 'sinon';
import unexpected from 'unexpected';
import unexpectedSinon from 'unexpected-sinon';
const expect = unexpected.clone().use(unexpectedSinon);

describe('RokuDebugWriter', function () {
  /** @type {typeof import('../../../lib/debug/writer').RokuDebugWriter} */
  let RokuDebugWriter;

  /** @type {sinon.SinonSandbox} */
  let sandbox;

  let MockAppiumSupport;

  let mockClient;

  /** @type {stream.Writable} */
  let writable;

  beforeEach(function () {
    sandbox = createSandbox();

    writable = new stream.Writable({
      write: sandbox.stub().callsArgAsync(2),
      defaultEncoding: 'utf-8',
    });

    MockAppiumSupport = {
      fs: {
        mkdirp: sandbox.stub().resolves(),
        createWriteStream: sandbox.stub().returns(writable),
        unlink: sandbox.stub().resolves(),
      },
      logger: {
        getLogger: sandbox.stub().callsFake(() => MockAppiumSupport.logger.__logger),
        __logger: sandbox.stub(new global.console.Console(process.stdout, process.stderr)),
      },
    };

    // XXX: I'm not sure how to get utf-8 out of this stream, because
    // `writable` is not called with a utf-8 string...
    mockClient = Object.assign(
      stream.Readable.from(['a log message', 'another log message', 'yet another log message'], {
        encoding: 'utf-8',
      }),
      {
        hostSlug: 'localhost',
        connect: sandbox.stub().resolves(),
      }
    );
    sandbox.spy(mockClient, 'on');

    ({RokuDebugWriter} = rewiremock.proxy(() => require('../../../lib/debug/writer'), {
      'node:fs': {},
      'env-paths': sandbox.stub().returns({temp: '/tmp', log: '/var/log'}),
      'appium/support': MockAppiumSupport,
      'proper-lockfile': {
        lock: sandbox.stub(),
      },
      '../../../lib/debug/client': {
        DEFAULT_DEBUG_CLIENT_OPTS: {},
        RokuDebugClient: sandbox.stub().returns(mockClient),
      },
    }));
  });

  describe('constructor', function () {
    it('should instantiate a RokuDebugWriter', function () {
      expect(new RokuDebugWriter('localhost'), 'to be a', RokuDebugWriter);
    });

    it('should listen for the "close" event of its RokuDebugClient instance', function () {
      new RokuDebugWriter('localhost');
      expect(mockClient.on, 'to have a call satisfying', ['close', expect.it('to be a function')]);
    });

    describe('when provided no explicit logPath', function () {
      it('should create a logPath based on hostname', function () {
        const writer = new RokuDebugWriter('localhost');
        expect(writer.logPath, 'to equal', '/var/log/debug-localhost.log');
      });
    });

    describe('when provided an explicit logPath', function () {
      it('should use the logPath', function () {
        const writer = new RokuDebugWriter('localhost', {logPath: '/var/log/roku.log'});
        expect(writer.logPath, 'to equal', '/var/log/roku.log');
      });
    });
  });

  describe('static method', function () {
    describe('getEnvPaths()', function () {
      it('should return a log dir and lockfile dir', function () {
        expect(RokuDebugWriter.getEnvPaths(), 'to equal', {
          logDirpath: '/var/log',
          lockfileDirpath: '/tmp',
        });
      });
    });
  });

  describe('instance property', function () {
    /** @type {import('../../../lib/debug/writer').RokuDebugWriter} */
    let writer;

    beforeEach(function () {
      writer = new RokuDebugWriter('localhost');
    });

    it('should be a string', function () {
      expect(writer.logPath, 'to be a string');
    });
  });

  describe('instance method', function () {
    /** @type {import('../../../lib/debug/writer').RokuDebugWriter} */
    let writer;

    beforeEach(function () {
      writer = new RokuDebugWriter('localhost');
    });

    describe('pipe()', function () {
      it('should write the logs from the client to a file', async function () {
        await writer.pipe();
        expect(writable._write, 'to have calls satisfying', [
          [Buffer.from('a log message'), 'buffer', expect.it('to be a function')],
          [Buffer.from('another log message'), 'buffer', expect.it('to be a function')],
          [Buffer.from('yet another log message'), 'buffer', expect.it('to be a function')],
        ]);
      });

      describe('when the client emits an error', function () {
        let err;

        beforeEach(function () {
          err = new Error('some error');
          mockClient._read = sandbox.stub().callsFake(() => {
            mockClient.emit('error', err);
          });
        });

        it('should log an error', async function () {
          await writer.pipe();
          expect(MockAppiumSupport.logger.__logger.error, 'to have a call satisfying', [err]);
        });
      });

      describe('when "keepLogs" is false', function () {
        beforeEach(function () {
          writer = new RokuDebugWriter('localhost', {keepLogs: false});
        });
        it('should delete the logfile', async function () {
          await writer.pipe();
          expect(MockAppiumSupport.fs.unlink, 'to have a call satisfying', [writer.logPath]);
        });

        describe('when deletion fails', function () {
          it('should log a warning', async function () {
            const err = new Error('some error');
            MockAppiumSupport.fs.unlink.rejects(err);
            await writer.pipe();
            expect(MockAppiumSupport.logger.__logger.warn, 'to have a call satisfying', [err]);
          });
        });
      });
    });

    describe('unpipe', function () {
      it('should halt writing', async function () {
        // XXX the behavior here seems nondeterministic.
        // pipe() contains at minimum three async calls, and the abort could happen
        // any time between them.
        const promise = writer.pipe();
        writer.unpipe();
        await promise;
        // ... which is why all I can do is check the debug log
        expect(MockAppiumSupport.logger.__logger.debug, 'to have a call satisfying', [
          'Debug log pipe to /var/log/debug-localhost.log aborted',
        ]);
      });
    });
  });

  afterEach(function () {
    sandbox.restore();
  });
});
