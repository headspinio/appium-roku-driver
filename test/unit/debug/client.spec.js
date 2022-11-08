import rewiremock from 'rewiremock/node';
import {createSandbox} from 'sinon';
import {EventEmitter} from 'node:events';
import unexpected from 'unexpected';
import unexpectedSinon from 'unexpected-sinon';
import unexpectedEventemitter from 'unexpected-eventemitter';

const expect = unexpected.clone().use(unexpectedSinon).use(unexpectedEventemitter);

describe('RokuDebugClient', function () {
  /** @type {typeof import('../../../lib/debug/client').RokuDebugClient} */
  let RokuDebugClient;

  /** @type {sinon.SinonSandbox} */
  let sandbox;

  let MockTelnet;

  let MockSlug;

  let telnet;

  beforeEach(function () {
    sandbox = createSandbox();

    telnet = new EventEmitter();

    class MockSocket extends Array {
      setEncoding = sandbox.stub()
    }

    const socket = new MockSocket('chunk', 'another chunk', 'yet another chunk');

    Object.assign(telnet, {
      connect: sandbox.stub().resolves(),
      end: sandbox.stub().resolves(),
      destroy: sandbox.stub().resolves(),
      getSocket: sandbox.stub().returns(socket),
    });

    MockTelnet = {
      Telnet: sandbox.stub().returns(telnet),
    };

    MockSlug = sandbox.stub().returnsArg(0);

    ({RokuDebugClient} = rewiremock.proxy(() => require('../../../lib/debug/client'), {
      'telnet-client': MockTelnet,
      slug: MockSlug,
    }));
  });

  describe('constructor', function () {
    describe('when provided a host parameter', function () {
      it('should instantiate a RokuDebugClient', function () {
        expect(new RokuDebugClient('localhost'), 'to be a', RokuDebugClient);
      });
    });

    describe('when not provided a host parameter', function () {
      it('should throw', function () {
        // @ts-expect-error
        expect(() => new RokuDebugClient(), 'to throw', 'host is required');
      });
    });
  });

  describe('instance property', function () {
    let client;

    beforeEach(function () {
      client = new RokuDebugClient('localhost');
    });

    describe('hostSlug', function () {
      it('should return a slugified host', function () {
        expect(client.hostSlug, 'to be a', 'string');
      });
    });

    describe('isConnected', function () {
      describe('when connected to the host', function () {
        it('should be `true`', async function () {
          await client.connect();
          expect(client.isConnected, 'to be true');
        });
      });

      describe('when disconnected from the host', function () {
        it('should be `false`', function () {
          expect(client.isConnected, 'to be false');
        });
      });
    });
  });

  describe('instance method', function () {
    let client;

    beforeEach(function () {
      client = new RokuDebugClient('localhost');
    });

    describe('connect()', function () {
      it('should connect to the host', async function () {
        await client.connect();
        expect(telnet.connect, 'was called once');
      });

      it('should set the encoding to utf-8', async function () {
        await client.connect();
        expect(telnet.getSocket().setEncoding, 'to have a call satisfying', ['utf-8']);
      });

      describe('when already connected', function () {
        it('should not attempt to reconnect', async function () {
          await client.connect();
          await client.connect();
          expect(telnet.connect, 'was called once');
        });
      });

      describe('event handling', function () {
        beforeEach(async function () {
          await client.connect();
        });

        describe('when the client emits event `error`', function () {
          it('should emit event `error`', function () {
            const error = new Error('some error');

            expect(() => telnet.emit('error', error), 'to emit from', client, 'error', error);
          });

          it('should clean up', function () {
            const error = new Error('some error');
            client.on('error', () => {}); // eat error
            telnet.emit('error', error);
            expect(client.isConnected, 'to be false');
          });
        });

        describe('when the client emits event `close`', function () {
          it('should emit event `close`', function () {
            expect(() => telnet.emit('close'), 'to emit from', client, 'close');
          });

          it('should clean up', function () {
            telnet.emit('close');
            expect(client.isConnected, 'to be false');
          });
        });

        describe('when the client emits event `timeout`', function () {
          it('should emit event `timeout`', function () {
            expect(() => telnet.emit('timeout'), 'to emit from', client, 'timeout');
          });

          it('should clean up', function () {
            telnet.emit('timeout');
            expect(client.isConnected, 'to be false');
          });
        });
      });
    });

    describe('disconnect()', function () {
      describe('when connected to the host', function () {
        it('should disconnect', async function () {
          await client.connect();
          await client.disconnect();
          expect(telnet.end, 'was called once');
        });

        it('should clean up', async function () {
          await client.connect();
          await client.disconnect();
          expect(client.isConnected, 'to be false');
        });

        describe('when disconnecting fails', function () {
          it('should destroy the socket', async function () {
            await client.connect();
            telnet.end.rejects(new Error('some error'));
            await client.disconnect();
            expect(telnet.destroy, 'was called once');
          });
        });
      });
    });
  });

  describe('AsyncIterable behavior', function () {
    // https://tc39.es/proposal-array-from-async/ would be handy here

    /** @type {import('../../../lib/debug/client').RokuDebugClient} */
    let client;

    beforeEach(function () {
      client = new RokuDebugClient('localhost');
    });

    describe('when connected', function () {
      beforeEach(async function () {
        await client.connect();
      });

      it('should be async iterable', async function () {
        const chunks = [];
        for await (const chunk of client) {
          chunks.push(chunk);
        }
        expect(chunks, 'to equal', Array.from(telnet.getSocket()));
      });
    });
  });

  describe('static method', function () {
    describe('slugify', function () {
      it('should delegate to `slug` package', function () {
        RokuDebugClient.slugify('localhost');
        expect(MockSlug, 'was called once');
      });
    });
  });

  afterEach(function () {
    sandbox.restore();
  });
});
