import { BaseDriver } from '@appium/base-driver';
import log from './logger';
import * as commands from './commands';
import LRU from 'lru-cache';

const MAX_ELEMENTS_CACHE = 1024;

export default class RokuDriver extends BaseDriver {
  constructor (opts = {}) {
    super(opts, false);
    this.elCache = new LRU({max: MAX_ELEMENTS_CACHE});
    this.cachedSource = null;
    this.cachedSourceDirty = true;
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

  async createSession (...args) {
    let [sessionId, caps] = await super.createSession(...args);
    if (caps.app) {
      await this.installApp(caps.app);
      await this.roku_activateApp({appId: 'dev'});
    } else {
      // in the case where we start without an app, just make sure we're at the home screen
      await this.roku_pressKey({key: 'Home'});
    }
    return [sessionId, caps];
  }

  async deleteSession () {
    log.info('Ending Roku session');
    // always press home to end
    await this.roku_pressKey({key: 'Home'});
    await super.deleteSession();
  }
}

Object.assign(RokuDriver.prototype, commands);
