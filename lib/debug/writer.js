import {fs} from 'appium/support';
import B from 'bluebird';
import envPaths from 'env-paths';
import _ from 'lodash';
import {EventEmitter} from 'node:events';
import _fs from 'node:fs';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {lock} from 'proper-lockfile';
import log from '../logger';
import {DEFAULT_DEBUG_CLIENT_OPTS, RokuDebugClient} from './client';

/**
 * Base lockfile options, sans the lockfile path
 * @internal
 */
const BASE_LOCK_OPTS = Object.freeze(
  /** @type {import('proper-lockfile').LockOptions} */ ({
    realpath: false,
    fs: _fs,
    retries: {
      retries: 3,
      minTimeout: 100,
      maxTimeout: 1000,
      unref: true,
    },
  })
);

/**
 * Default opts for {@linkcode RokuDebugWriter}
 * @internal
 */
const DEFAULT_DEBUG_WRITER_OPTS = Object.freeze(DEFAULT_DEBUG_CLIENT_OPTS);

export class RokuDebugWriter extends EventEmitter {
  /**
   * User-provided opts
   * @type {WriterOpts}
   */
  #opts;

  /**
   * Directory which will contain debug logs
   * @type {string}
   */
  #logDirpath;

  /**
   * Directory which will contain lockfiles
   * @type {string}
   */
  #lockfileDirpath;

  /**
   * If logfile is locked, this will be a wrapped unlock function.
   *
   * @this {null}
   * @type {() => Promise<void>|undefined}
   */
  #_unlock;

  /**
   * @type {RokuDebugClient}
   */
  #client;

  /**
   * For {@linkcode RokuDebugWriter.pipe}/{@linkcode RokuDebugWriter.unpipe}
   * @type {AbortController}
   */
  #ac;

  /**
   * Sets class props and determines logfile path
   * @param {string} host
   * @param {RokuDebugWriterOpts} [opts]
   */
  constructor(host, opts = {}) {
    super();
    this.#opts = _.defaultsDeep(opts, DEFAULT_DEBUG_WRITER_OPTS);

    const {logDirpath, lockfileDirpath} = RokuDebugWriter.getEnvPaths();

    this.#client = new RokuDebugClient(host, opts);

    if (!this.#opts.logPath) {
      const logFileBasename = `debug-${this.#client.hostSlug}.log`;
      this.#opts.logPath = path.join(logDirpath, logFileBasename);
    }

    this.#lockfileDirpath = lockfileDirpath;
    this.#logDirpath = logDirpath;
    this.#ac = new AbortController();

    this.#client.on('close', () => {
      this.#cleanup();
    });
  }

  /**
   * Returns the paths to the log and lockfile directories for this package.
   *
   * This is the XDG "log" dir and "temp" dir, respectively.
   * @returns {{logDirpath: string, lockfileDirpath: string}}
   */
  static getEnvPaths() {
    const {log: logDirpath, temp: lockfileDirpath} = envPaths('appium-roku-driver');
    return {logDirpath, lockfileDirpath};
  }

  /**
   * Path to the logfile
   */
  get logPath() {
    return this.#opts.logPath;
  }

  /**
   * Locks the logfile if we're not using a file descriptor.
   */
  async #lockLogfile() {
    // `prepare-lockfile` does not support file descriptors
    if (_.isNil(this.#opts.logFd)) {
      const lockfilePath = path.join(this.#lockfileDirpath, `${this.#client.hostSlug}.lock`);
      const originalUnlock = await lock(this.logPath, {...BASE_LOCK_OPTS, lockfilePath});
      return async () => {
        try {
          await originalUnlock();
          log.debug(`Unlocked ${this.logPath}`);
        } catch (err) {
          // todo handle better
          log.warn(err);
        }
      };
    }
    return () => B.resolve();
  }

  /**
   * Unlocks lockfile and tries not to leak memory
   */
  async #cleanup() {
    try {
      await this.#_unlock?.();
    } finally {
      this.#_unlock = undefined;
    }
  }

  /**
   * Prepares filesystem for writing debug log
   *
   * Makes the dirs
   */
  async #prepareFs() {
    await B.all([fs.mkdirp(this.#logDirpath), fs.mkdirp(this.#lockfileDirpath)]);
  }

  /**
   * Returns a writable stream for the logfile
   * @returns {_fs.WriteStream}
   */
  #createLogfileStream() {
    return fs.createWriteStream(this.logPath, {
      fd: this.#opts.logFd,
      encoding: 'utf8',
      flags: 'a+'
    });
  }

  /**
   * Configure a pipe from the connected telnet client to the log file
   */
  async pipe() {
    const handleAbort = () => {
      log.debug(`Debug log pipe to ${this.logPath} aborted`);
      this.#ac = new AbortController();
    };

    if (this.#ac.signal.aborted) {
      return handleAbort();
    }

    await B.all([this.#client.connect(), this.#prepareFs]);

    if (this.#ac.signal.aborted) {
      return handleAbort();
    }

    this.#_unlock = await this.#lockLogfile();

    if (this.#ac.signal.aborted) {
      return handleAbort();
    }

    try {
      await pipeline(this.#client, this.#createLogfileStream(), {signal: this.#ac.signal});
    } catch (err) {
      if (this.#ac.signal.aborted) {
        handleAbort();
      } else {
        log.error(err);
      }
    } finally {
      // XXX does this happen before or after client 'close' event?
      if (!this.#opts.keepLogs) {
        try {
          await fs.unlink(this.logPath);
        } catch (err) {
          log.warn(err);
        }
      }
    }
  }

  /**
   * Stops piping
   */
  unpipe() {
    this.#ac.abort();
  }
}

/**
 * Options for {@linkcode RokuDebugWriter}
 * @typedef {import('type-fest').Simplify<WriterOpts & import('./client').RokuDebugClientOpts>} RokuDebugWriterOpts
 */

/**
 * @internal
 * @typedef WriterOpts
 * @property {boolean} [keepLogs] - If true, will not delete the log file when the client closes
 * @property {string} [logPath] - Path to destination
 * @property {_fs.promises.FileHandle | number} [logFd] - If provided {@linkcode ConnectDebugLogOpts.logPath} will be ignored
 */

/**
 * Options for {@linkcode lockLogfile}
 * @internal
 * @private
 * @typedef LockLogfileOpts
 * @property {_fs.promises.FileHandle | number} [fd]
 */
