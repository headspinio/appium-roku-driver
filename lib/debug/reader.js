import _ from 'lodash';
import log from '../logger';
import {open} from 'node:fs/promises';

/**
 * Max number of bytes to read from the file at once.
 *
 * This is just Node.js' default.
 */
export const DEFAULT_CHUNK_SIZE = 16384;

/**
 * Returns `true` if `value` is positive, finite, and a safe integer.
 * @param {any} value
 * @returns {value is number}
 */
const isPositiveFiniteInteger = _.overEvery(_.isFinite, _.isSafeInteger, _.partialRight(_.gt, 0));

/**
 * Reads a file from current position to the end.
 *
 * Intended for use with files concurrently being written-to.
 */
export class FileReader {
  /**
   * Path to file on disk
   * @type {string}
   */
  #filepath;

  /**
   * Open file handle
   * @type {import('node:fs/promises').FileHandle|undefined}
   */
  #fh;

  /**
   * Max number of bytes to read from the logfile at once.
   * @type {number}
   */
  #chunkSize;

  /**
   * @param {string} filepath - Path to log file
   * @param {FileReaderOpts} [opts] - Options
   */
  constructor(filepath, opts = {}) {
    if (!filepath) {
      throw new TypeError('logPath is required');
    }
    this.#filepath = filepath;
    if (opts.chunkSize !== undefined && !isPositiveFiniteInteger(opts.chunkSize)) {
      throw new TypeError('chunkSize must be a positive finite integer');
    }
    this.#chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  }

  /**
   * Opens logfile for reading
   * @returns {Promise<void>}
   */
  async open() {
    try {
      this.#fh = await open(this.#filepath, 'r');
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`File does not exist: ${this.#filepath}`);
      }
    }
  }

  /**
   * Reads data from the log file until EOF
   * @returns {Promise<string>}
   */
  async read() {
    if (!this.#fh) {
      throw new ReferenceError(`File ${this.#filepath} is not open for reading; call open() first`);
    }
    /** @type {Buffer[]} */
    const buffers = [];
    /** @type {number} */
    let lastBytesRead;
    do {
      let buffer;
      ({bytesRead: lastBytesRead, buffer} = await this.#fh.read({length: this.#chunkSize}));
      buffers.push(buffer.subarray(0, lastBytesRead));
    } while (lastBytesRead === this.#chunkSize);

    return Buffer.concat(buffers).toString('utf-8');
  }

  async close() {
    try {
      await this.#fh.close();
    } catch (err) {
      log.warn(err);
    } finally {
      this.#cleanup();
    }
  }

  #cleanup() {
    this.#fh = undefined;
  }
}

/**
 * Options for {@linkcode FileReader}
 * @typedef FileReaderOpts
 * @property {number} [chunkSize] - Max number of bytes to read from the file at once
 */
