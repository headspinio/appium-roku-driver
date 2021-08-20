import { BaseDriver } from '@appium/base-driver';
import request from 'request-promise';
import log from './logger';
import commands from './commands';
import LRU from 'lru-cache';

const MAX_ELEMENTS_CACHE = 1024;

export default class RokuDriver extends BaseDriver {
  constructor (opts = {}) {
    super(opts, false);
    this.elCache = new LRU({max: MAX_ELEMENTS_CACHE});
  }

  proxyActive () {
    return false;
  }

  getProxyAvoidList () {
    return [];
  }

  canProxy () {
    return false;
  }

  validateLocatorStrategy (strategy) {
    return ['xpath'].includes(strategy);
  }

  validateDesiredCaps (caps) {
    if (!caps.rokuHost) {
      throw new Error(`'udid' cap is required, should be the IP:PORT of ` +
                      `the ECP service on the Roku`);
    }
  }

  async createSession (...args) {
    let [sessionId, caps] = await super.createSession(...args);
    // TODO sideload app if possible
    await this.roku_pressKey({key: 'Home'});
    return [sessionId, caps];
  }

  async rokuEcp (urlStr, method = 'POST', body = '') {
    const {rokuHost, rokuEcpPort, rokuUser, rokuPass, rokuHeaderHost} = this.opts;
    const url = `http://${rokuHost}:${rokuEcpPort}${urlStr}`;
    log.info(`Running ECP command: ${url}`);
    return await request({
      method,
      url,
      headers: {'HOST': rokuHeaderHost},
      auth: {user: rokuUser, pass: rokuPass},
      body
    });
  }

  async deleteSession () {
    log.info('Ending Roku session');
    // always press home to end
    await this.roku_pressKey({key: 'Home'});
    await super.deleteSession();
  }
}

Object.assign(RokuDriver.prototype, commands);
