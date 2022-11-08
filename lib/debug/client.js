import log from '../logger';
import {Telnet} from 'telnet-client';
import slug from 'slug';
import _ from 'lodash';
import {EventEmitter} from 'node:events';

/**
 * Debug port on Roku device
 * @see https://developer.roku.com/en-ca/docs/developer-program/debugging/debugging-channels.md
 */
export const DEBUG_PORT = 8085;

/**
 * Default opts for {@linkcode Telnet.connect}
 * @internal
 */
export const DEFAULT_TELNET_OPTS = Object.freeze(
  /** @type {TelnetOptions} */ ({
    negotiationMandatory: false,
    encoding: 'utf8',
    timeout: 2000,
  })
);

/**
 * Default opts for {@link RokuDebugClient}
 * @internal
 */
export const DEFAULT_DEBUG_CLIENT_OPTS = Object.freeze(
  /** @type {RokuDebugClientOpts} */ ({
    telnet: DEFAULT_TELNET_OPTS,
  })
);

/**
 * @implements {AsyncIterable<string>}
 */
export class RokuDebugClient extends EventEmitter {
  /**
   * User-provided opts
   * @type {RokuDebugClientOpts}
   */
  #opts;

  /**
   * Host of Telnet server
   * @type {string}
   */
  #host;

  /**
   * Host of Telnet server, slugified for use in filenames
   * @type {string}
   */
  #hostSlug;

  /**
   * Telnet client
   * @type {Telnet|undefined}
   */
  #telnetClient;

  /**
   * Assigns defaults & computes host slug
   * @param {string|import('node:net').AddressInfo} host - Hostname or IP address of Roku device or an `AddressInfo` object
   * @param {RokuDebugClientOpts} [opts] - Options
   */
  constructor(host, opts = {}) {
    super();
    if (!host) {
      throw new Error('host is required');
    }
    this.#opts = _.defaultsDeep(opts, DEFAULT_DEBUG_CLIENT_OPTS);
    if (typeof host === 'object') {
      this.#host = host.address;
      this.#opts.port = this.#opts.port ?? host.port;
    } else {
      this.#host = host;
    }
    this.#hostSlug = RokuDebugClient.slugify(this.#host);
  }

  /**
   * Slugifies a string in preparation for writing to filesystem
   *
   * May be used by those wanting to provide a custom `logPath` option to the constructor
   *
   * Just a re-export of `slug` module
   * @see https://npm.im/slug
   */
  static slugify = slug;

  /**
   *
   */
  #cleanup() {
    this.#telnetClient = undefined;
  }

  /**
   * Returns a slug of the hostname, suitable for use in filenames
   */
  get hostSlug() {
    return this.#hostSlug;
  }

  /**
   * Connects Roku debug server over telnet
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnected) {
      return;
    }

    const client = (this.#telnetClient = new Telnet());
    await client.connect({
      host: this.#host,
      port: this.#opts.port,
      encoding: 'utf8',
      ...this.#opts.telnet,
    });
    log.debug(`Connected to ${this.#host}`);
    client.getSocket().setEncoding('utf-8');
    client
      .on('error', (err) => {
        log.error(err);
        try {
          this.emit('error', err);
        } finally {
          this.#cleanup();
        }
      })
      .on('close', (hadError) => {
        if (hadError) {
          log.info(`Connection to host ${this.#host} closed with error`);
        } else {
          log.info(`Connection to host ${this.#host} closed`);
        }
        try {
          this.emit('close');
        } finally {
          this.#cleanup();
        }
      })
      .on('end', () => {
        this.emit('end');
      })
      .on('timeout', () => {
        // connection timeout
        const timeout = this.#opts.telnet.timeout;
        log.error(`Connection to host ${this.#host} timed out (${timeout} ms)`);
        try {
          this.emit('timeout');
        } finally {
          this.#cleanup();
        }
      });
  }

  /**
   * Disconnect from the host (if connected)
   */
  async disconnect() {
    if (this.#telnetClient) {
      try {
        await this.#telnetClient.end();
      } catch {
        await this.#telnetClient.destroy();
      } finally {
        this.#cleanup();
      }
    }
  }

  /**
   * Iterates over data coming out of Telnet host
   * @returns {AsyncGenerator<string>}
   */
  async *[Symbol.asyncIterator]() {
    const sock = this.#telnetClient?.getSocket();
    if (sock) {
      for await (const chunk of sock) {
        yield chunk;
      }
    }
  }

  /**
   * Returns `true` if we're connected to the host
   */
  get isConnected() {
    return Boolean(this.#telnetClient);
  }
}

/**
 * Options for {@linkcode RokuDebugClient}
 * @typedef RokuDebugClientOpts
 * @property {number} [port] - Debug port on Roku device; `8085` by default
 * @property {TelnetOptions} [telnet] - Options for {@linkcode Telnet}
 */

/**
 * @typedef {import('telnet-client').ConnectOptions} TelnetOptions
 */
