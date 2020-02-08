import { BaseDriver } from 'appium-base-driver';
import { W3C_ELEMENT_KEY } from 'appium-base-driver/build/lib/protocol/protocol';
import _ from 'lodash';
import B from 'bluebird';
import log from './logger';
import uuid from 'uuid/v4';

let board;

export default class RokuDriver extends BaseDriver {
  constructor (opts = {}) {
    super(opts, false);
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
    return true;
  }

  validateDesiredCaps (caps) {
  }

  async createSession (...args) {
    let [sessionId, caps] = await super.createSession(...args);
    // TODO
    return [sessionId, caps];
  }

  findElOrEls (strategy, selector, mult, context) {
    if (strategy === "-custom") {
      // TODO
    }

  }

  async deleteSession () {
    log.info('Ending Roku session');
    await super.deleteSession();
  }
}
