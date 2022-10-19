import _ from 'lodash';
import fs from 'fs';
import request from 'request-promise';
import log from '../logger';
import Jimp from 'jimp';
import {getAuthDigestParts, getAuthHeader} from '../utils';

// Note: it seems like axis's FormData does not work well against
// the device for now. It got 411 error in the axios's general way
// to send formData to the target, They required content-length.

/**
 * @template [TRes=any]
 * @param {MakePluginReqOpts} opts
 * @returns {Promise<TRes>}
 */
async function makePluginReq({
  opts,
  formData,
  method = 'POST',
  uri = '/plugin_install',
  contentType = 'multipart/form-data',
  encoding,
}) {
  // @ts-expect-error
  const {rokuHost: host, rokuWebPort: port, rokuUser: user, rokuPass: pass} = opts;
  const url = `http://${host}:${port}${uri}`;
  const authDigestParts = {
    ...(await getAuthDigestParts(url, method)),
    method,
    user,
    pass,
    uri,
  };
  const authHeader = getAuthHeader(authDigestParts);
  /** @type {import('request-promise').Options} */
  const reqOpts = {
    method,
    url,
    headers: {
      Authorization: authHeader,
    },
  };
  if (contentType) {
    reqOpts.headers['Content-Type'] = contentType;
  }
  if (formData) {
    reqOpts.formData = formData;
  }
  if (!_.isUndefined(encoding)) {
    reqOpts.encoding = encoding;
  }
  log.info(`Calling ${method} ${url}`);
  return await request(reqOpts);
}

/**
 * @this RokuDriver
 * @param {string} appPath
 * @returns {Promise<void>}
 */
export async function installApp(appPath) {
  this._cachedSourceDirty = true;
  log.info(`Installing app from ${appPath}`);
  await this.removeApp();
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
 */
export async function activateApp(appId) {
  this._cachedSourceDirty = true;
  log.info(`Launching app ${appId}`);
  await this.rokuEcp(`/launch/${appId}`);
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
      encoding: null,
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
 * @typedef {import('../driver').RokuDriver} RokuDriver
 */

/**
 * @typedef MakePluginReqOpts
 * @property {import('../driver').RokuDriverOpts} opts
 * @property {import('@appium/types').StringRecord} [formData]
 * @property {string} [uri]
 * @property {import('@appium/types').HTTPMethod} [method]
 * @property {string?} [contentType]
 * @property {string?} [encoding]
 */
