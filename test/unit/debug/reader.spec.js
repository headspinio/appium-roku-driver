import rewiremock from 'rewiremock/node';
import {createSandbox} from 'sinon';

import unexpected from 'unexpected';
import unexpectedSinon from 'unexpected-sinon';

const expect = unexpected.clone().use(unexpectedSinon);

describe('FileReader', function () {
  /** @type {typeof import('../../../lib/debug/reader').FileReader} */
  let FileReader;

  /** @type {sinon.SinonSandbox} */
  let sandbox;

  /** @type {Buffer} */
  let buf;

  let fh;

  /** @type {{open: sinon.SinonStub<any[], typeof fh>}} */
  let MockFs;

  beforeEach(function () {
    sandbox = createSandbox();
    buf = Buffer.from('hello world');
    fh = {
      /** @type {number} */
      __position: 0,
      // eslint-disable-next-line require-await
      read: sandbox.stub().callsFake(async (opts = {}) => {
        const {length: chunkSize} = opts;
        // if we have a 'length', that means we do not use the default chunk size
        // so we need to return the buffer in bits and pieces. this means tracking our own pointer,
        // which is `__position`
        const retval =
          fh.__position >= buf.length
            ? {
                buffer: Buffer.alloc(0),
                bytesRead: 0,
              }
            : {
                buffer: buf.subarray(fh.__position, fh.__position + chunkSize),
                bytesRead: Math.min(chunkSize, buf.length - fh.__position),
              };
        fh.__position += retval.bytesRead;

        return retval;
      }),
      close: sandbox.stub().resolves(),
    };
    MockFs = {
      open: sandbox.stub().resolves(fh),
    };
    ({FileReader} = rewiremock.proxy(() => require('../../../lib/debug/reader'), {
      'node:fs/promises': MockFs,
    }));
  });

  describe('constructor', function () {
    it('should instantiate a FileReader', function () {
      expect(new FileReader('anarchists-cookbook.txt'), 'to be defined');
    });

    describe('when not provided a logPath parameter', function () {
      it('should throw', function () {
        // @ts-expect-error
        expect(() => new FileReader(), 'to throw a', TypeError);
      });
    });

    describe('when chunkSize option is a positive, finite, safe integer', function () {
      it('should instantiate a FileReader', function () {
        expect(new FileReader('anarchists-cookbook.txt', {chunkSize: 100}), 'to be defined');
      });
    });

    describe('when chunkSize is negative', function () {
      it('should throw', function () {
        expect(
          () => new FileReader('anarchists-cookbook.txt', {chunkSize: -100}),
          'to throw a',
          TypeError
        );
      });
    });

    describe('when chunkSize is a float', function () {
      it('should throw', function () {
        expect(
          () => new FileReader('anarchists-cookbook.txt', {chunkSize: 2.5}),
          'to throw a',
          TypeError
        );
      });
    });

    describe('when chunkSize is infinite', function () {
      it('should throw', function () {
        expect(
          () => new FileReader('anarchists-cookbook.txt', {chunkSize: Infinity}),
          'to throw a',
          TypeError
        );
      });
    });

    describe('when chunkSize is a too big', function () {
      it('should throw', function () {
        expect(
          () => new FileReader('anarchists-cookbook.txt', {chunkSize: Number.MAX_SAFE_INTEGER + 1}),
          'to throw a',
          TypeError
        );
      });
    });
  });

  describe('method', function () {
    /** @type {import('../../../lib/debug/reader').FileReader} */
    let reader;

    beforeEach(function () {
      reader = new FileReader('anarchists-cookbook.txt');
    });

    describe('open()', function () {
      describe('when the file exists', function () {
        it('should open the file at logPath for reading', async function () {
          await expect(reader.open(), 'to be fulfilled');
        });
      });

      describe('when the file does not exist', function () {
        beforeEach(function () {
          MockFs.open.rejects({code: 'ENOENT'});
        });

        it('should reject', async function () {
          await expect(
            reader.open(),
            'to be rejected with',
            'File does not exist: anarchists-cookbook.txt'
          );
        });
      });
    });

    describe('read()', function () {
      describe('when the file is not open', function () {
        it('should reject', async function () {
          await expect(
            reader.read(),
            'to be rejected with',
            'File anarchists-cookbook.txt is not open for reading; call open() first'
          );
        });
      });

      describe('when the file is open', function () {
        it('should resolve with a string', async function () {
          await reader.open();
          await expect(reader.read(), 'to be fulfilled with', 'hello world');
        });

        describe('when the chunk size is smaller than the bytes to read', function () {
          it('should resolve with a string', async function () {
            reader = new FileReader('anarchists-cookbook.txt', {chunkSize: 2});
            await reader.open();
            await expect(reader.read(), 'to be fulfilled with', 'hello world');
          });
        });
      });
    });

    describe('close()', function () {
      describe('when the file is open', function () {
        beforeEach(async function () {
          await reader.open();
        });

        it('should close the file', async function () {
          await reader.close();
          expect(fh.close, 'was called once');
        });
      });

      describe('when the file is not open', function () {
        it('should not throw', async function () {
          await expect(reader.close(), 'to be fulfilled');
        });
      });
    });
  });

  afterEach(function () {
    sandbox.restore();
  });
});
