import {BaseDriver} from 'appium/driver';
import LRU from 'lru-cache';
import {
  activateApp,
  click,
  executeRoku,
  findElOrEls,
  focus,
  focusElement,
  getPageSource,
  getScreenshot,
  installApp,
  makeNextFocusMove,
  performActions,
  performActionWithKeyboard,
  removeApp,
  rokuEcp,
  roku_activateApp,
  roku_appUI,
  roku_deviceInfo,
  roku_getApps,
  roku_installApp,
  roku_pressKey,
  setValue,
  setValueByEcp,
  setValueByKeyboard,
  _getElementFromNode,
  _getXPathNodes,
} from './commands';
import log from './logger';

const MAX_ELEMENTS_CACHE = 2048;

const DEV_APPID = 'dev';
const KEY_HOME = 'Home';

export const ROKU_DRIVER_CONSTRAINTS = /** @type {const} */({
  debugLog: {
    isBoolean: true,
  },
});

/**
 * @extends {BaseDriver<RokuDriverCapConstraints>}
 */
export default class RokuDriver extends BaseDriver {
  /**
   * @type {string|undefined}
   */
  _cachedSource;

  /**
   * @type {boolean}
   */
  _cachedSourceDirty = true;

  /** @type {LRU} */
  elCache;

  supportedLogTypes = {
    debug: /** @type {import('@appium/types').LogDef<RokuDriverCapConstraints, string>} */ ({
      description: 'Roku debug logs',
      async getter(driver) {
        return await ['foo'];
      },
    }),
  };

  desiredCapConstraints = ROKU_DRIVER_CONSTRAINTS;

  /**
   * @param {RokuDriverOpts} [opts]
   */
  constructor(opts = /** @type {RokuDriverOpts} */ ({})) {
    super(opts, false);
    this.elCache = new LRU({max: MAX_ELEMENTS_CACHE});
  }

  proxyActive() {
    return false;
  }

  getProxyAvoidList() {
    return [];
  }

  canProxy() {
    return false;
  }

  /**
   * @param {string} strategy
   * @returns {boolean}
   */
  validateLocatorStrategy(strategy) {
    return strategy === 'xpath';
  }

  /**
   *
   * @param {W3CDriverCaps} w3cCaps
   * @param {W3CDriverCaps} [w3cCaps2]
   * @param {W3CDriverCaps} [w3cCaps3]
   * @param {import('@appium/types').DriverData[]} [driverData]
   * @returns {Promise<[string, DriverCaps]>}
   */
  async createSession(w3cCaps, w3cCaps2, w3cCaps3, driverData) {
    let [sessionId, caps] = /** @type {[string, DriverCaps]} */ (
      await super.createSession(w3cCaps, w3cCaps2, w3cCaps3, driverData)
    );
    if (caps.app) {
      if (caps.app !== DEV_APPID) {
        // if the user specifies 'dev' as the app, just assume it's installed and skip trying to
        // install it here
        await this.installApp(caps.app);
      }
      await this.roku_activateApp({appId: DEV_APPID});
    } else {
      // in the case where we start without an app, just make sure we're at the home screen
      await this.roku_pressKey({key: KEY_HOME});
    }
    return [sessionId, caps];
  }

  async deleteSession() {
    log.info('Ending Roku session');
    // always press home to end
    await this.roku_pressKey({key: KEY_HOME});
    await super.deleteSession();
  }

  performActions = performActions;
  click = click;
  setValue = setValue;
  removeApp = removeApp.bind(this);
  activateApp = activateApp.bind(this);
  installApp = installApp.bind(this);
  getPageSource = getPageSource.bind(this);
  getScreenshot = getScreenshot;
  findElOrEls = findElOrEls;

  // *** Roku specific commands ***

  focus = focus;
  focusElement = focusElement;
  setValueByEcp = setValueByEcp;
  setValueByKeyboard = setValueByKeyboard;
  performActionWithKeyboard = performActionWithKeyboard;
  makeNextFocusMove = makeNextFocusMove;
  rokuEcp = rokuEcp;
  _getXPathNodes = _getXPathNodes;
  _getElementFromNode = _getElementFromNode;
  executeRoku = executeRoku;
  roku_activateApp = roku_activateApp;
  roku_appUI = roku_appUI;
  roku_deviceInfo = roku_deviceInfo;
  roku_getApps = roku_getApps;
  roku_installApp = roku_installApp;
  roku_pressKey = roku_pressKey;
}

export {RokuDriver};

/**
 * @typedef {typeof ROKU_DRIVER_CONSTRAINTS} RokuDriverCapConstraints
 */

/**
 * @typedef {import('@appium/types').ExternalDriver} ExternalDriver
 * @typedef {import('@appium/types').DriverCaps<RokuDriverCapConstraints>} DriverCaps
 * @typedef {import('@appium/types').W3CDriverCaps<RokuDriverCapConstraints>} W3CDriverCaps
 * @typedef {import('@appium/types').DriverOpts<RokuDriverCapConstraints>} RokuDriverOpts
 */
