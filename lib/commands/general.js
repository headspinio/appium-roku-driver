import _ from 'lodash';
import fs from 'fs';
import log from '../logger';
import Jimp from 'jimp';
import {getAuthDigestParts, getAuthHeader, slowAxios} from '../utils';

const _VALID_MEDIA_TYPES = /** @type {const} */([
  'movie',
  'episode',
  'season',
  'series',
  'shortFormVideo',
  'special',
  'live',
]);
export const VALID_MEDIA_TYPES = new Set(_VALID_MEDIA_TYPES);

/**
 * @param {MakePluginReqOpts} opts
 * @returns {Promise<any>}
 */
async function makePluginReq({
  opts,
  formData,
  method = 'POST',
  uri = '/plugin_install',
  contentType = 'multipart/form-data',
  responseType,
}) {
  // @ts-expect-error
  const {rokuHost: host, rokuWebPort: port, rokuUser: user, rokuPass: pass, rokuWebCooldown: cooldown} = opts;
  const url = `http://${host}:${port}${uri}`;
  const authDigestParts = {
    ...(await getAuthDigestParts(url, method, cooldown)),
    method,
    user,
    pass,
    uri,
  };
  const authHeader = getAuthHeader(authDigestParts);
  /** @type {import('axios').AxiosRequestConfig} */
  const reqOpts = {
    url,
    method,
    headers: {
      Authorization: authHeader,
    },
  };
  if (contentType) {
    reqOpts.headers['Content-Type'] = contentType;
  }
  if (formData) {
    reqOpts.data = formData;
  }
  if (!_.isUndefined(responseType)) {
    reqOpts.responseType = responseType;
  }
  log.info(`Calling ${method} ${url}`);
  // For some reason if we call the Roku web server too many times or too quickly, we get a weird
  // socket disconnection error. So far the solution appears to be to wait a bit and retry.
  return (await slowAxios(reqOpts, cooldown)).data;
}

/**
 * @this RokuDriver
 * @param {string} appPath
 * @returns {Promise<void>}
 */
export async function installApp(appPath) {
  this._cachedSourceDirty = true;
  log.info(`Installing app from ${appPath}`);
  try {
    await this.removeApp();
  } catch (ign) { /** ignore since this is not necessary to leave message as the app installation. */}
  const formData = {
    mySubmit: 'Install',
    archive: fs.createReadStream(appPath),
  };
  await makePluginReq({opts: this.opts, formData});
}

/**
 * @this RokuDriver
 * @param {string} [appId]
 * @returns {Promise<void>}
 */
export async function removeApp(appId) {
  this._cachedSourceDirty = true;
  if (appId) {
    log.info(
      `App id ${appId} was provided to remove app but will be ignored; only dev app can be removed`
    );
  }
  const formData = {
    mySubmit: 'Delete',
    archive: '',
  };
  await makePluginReq({opts: this.opts, formData});
}

/**
 * @this RokuDriver
 * @param {string} appId
 * @param {ActivateAppOptions} opts
 */
export async function activateApp(appId, {contentId, mediaType}) {
  this._cachedSourceDirty = true;
  log.info(`Launching app ${appId}`);
  let launchUrl = `/launch/${appId}`;
  if (contentId) {
    if (!mediaType) {
      throw new Error(`If you include a contentId parameter to activate, must also include mediaType`);
    }
    if (!VALID_MEDIA_TYPES.has(/** @type {ValidMediaTypes} */(mediaType))) {
      throw new Error(`mediaType must be one of: ${JSON.stringify([...VALID_MEDIA_TYPES])}`);
    }
    log.info(`Including parameters contentId of ${contentId} and mediaType of ${mediaType}`);
    launchUrl = `${launchUrl}?contentId=${encodeURIComponent(contentId)}&mediaType=${mediaType}`;
  }
  await this.rokuEcp(launchUrl);
}

/**
 * @this RokuDriver
 * @returns {Promise<string>}
 */
export async function getPageSource() {
  if (this._cachedSourceDirty) {
    log.info('Page source cache is dirty, pulling source from ECP query');
    const source = await this.roku_appUI(true);
    const xmlHeader = '<?xml version="1.0"?>';
    this._cachedSource = `${xmlHeader}\n<AppiumAUT>\n${
      Buffer.isBuffer(source) ? source.toString('utf8') : source
    }\n</AppiumAUT>`;
    this._cachedSourceDirty = false;
  } else {
    log.info('Responding with page source from cache');
  }
  return this._cachedSource;
}

/**
 * @this RokuDriver
 * @returns {Promise<string>}
 */
export async function getScreenshot() {
  const formData = {
    mySubmit: 'Screenshot',
  };
  log.info(`Directing plugin inspector to take screenshot`);
  await makePluginReq({opts: this.opts, formData, uri: '/plugin_inspect'});
  const uri = `/pkgs/dev.jpg`;
  log.info(`Screenshot taken, attempting to retrieve from ${uri}`);
  try {
    const img = await makePluginReq({
      opts: this.opts,
      method: 'GET',
      uri,
      contentType: null,
      responseType: 'arraybuffer',
    });
    const jimpImg = await Jimp.read(img);
    const png = await jimpImg.getBufferAsync(Jimp.MIME_PNG);
    return png.toString('base64');
  } catch (e) {
    if (e.message.match(/404/)) {
      throw new Error(
        `Could not collect screenshot. Screenshots can only be taken of your dev channel.`
      );
    }
    throw e;
  }
}

/**
 * A dummy implementation to return 200 ok with NATIVE_APP context for
 * webdriverio compatibility. https://github.com/headspinio/appium-roku-driver/issues/175
 *
 * @this RokuDriver
 * @returns {Promise<string>}
 */
// eslint-disable-next-line require-await
export async function getCurrentContext() {
  return 'NATIVE_APP';
}

/**
 * @typedef {import('../driver').RokuDriver} RokuDriver
 */

/**
 * @typedef {typeof _VALID_MEDIA_TYPES[number]} ValidMediaTypes
 */

/**
 * @typedef {import('./roku').ActivateAppOptions} ActivateAppOptions
 */

/**
 * @typedef MakePluginReqOpts
 * @property {import('../driver').RokuDriverOpts} opts
 * @property {import('@appium/types').StringRecord} [formData]
 * @property {string} [uri]
 * @property {import('@appium/types').HTTPMethod} [method]
 * @property {string?} [contentType]
 * @property {import('axios').ResponseType?} [responseType]
 */
