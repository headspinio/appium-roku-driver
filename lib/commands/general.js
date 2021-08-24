import _ from 'lodash';
import fs from 'fs';
import request from 'request-promise';
import log from '../logger';
import Jimp from 'jimp';
import { getAuthDigestParts, getAuthHeader } from '../utils';

async function makePluginReq ({
  opts,
  formData,
  method = 'POST',
  uri = '/plugin_install',
  contentType = 'multipart/form-data',
  encoding
}) {
  const {rokuHost: host, rokuWebPort: port, rokuUser: user, rokuPass: pass} = opts;
  const url = `http://${host}:${port}${uri}`;
  const authDigestParts = {
    ...await getAuthDigestParts(url, method),
    method,
    user,
    pass,
    uri,
  };
  const authHeader = getAuthHeader(authDigestParts);
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

export async function installApp (appPath) {
  this.cachedSourceDirty = true;
  log.info(`Installing app from ${appPath}`);
  await this.removeApp();
  const formData = {
    mySubmit: 'Install',
    archive: fs.createReadStream(appPath)
  };
  await makePluginReq({opts: this.opts, formData});
}

export async function removeApp (appId) {
  this.cachedSourceDirty = true;
  if (appId) {
    log.info(`App id ${appId} was provided to remove app but will be ignored; only dev app can be removed`);
  }
  const formData = {
    mySubmit: 'Delete',
    archive: ''
  };
  await makePluginReq({opts: this.opts, formData});
}

export async function activateApp (appId) {
  this.cachedSourceDirty = true;
  log.info(`Launching app ${appId}`);
  await this.rokuEcp(`/launch/${appId}`);
}

export async function getPageSource () {
  if (this.cachedSourceDirty) {
    log.info('Page source cache is dirty, pulling source from ECP query');
    const source = await this.roku_appUI(true);
    const xmlHeader = '<?xml version="1.0"?>';
    this.cachedSource = `${xmlHeader}\n<AppiumAUT>\n${source.toString('utf8')}\n</AppiumAUT>`;
    this.cachedSourceDirty = false;
  } else {
    log.info('Responding with page source from cache');
  }
  return this.cachedSource;
}

export async function getScreenshot () {
  const formData = {
    mySubmit: 'Screenshot'
  };
  log.info(`Directing plugin inspector to take screenshot`);
  await makePluginReq({opts: this.opts, formData, uri: '/plugin_inspect'});
  const uri = `/pkgs/dev.jpg`;
  log.info(`Screenshot taken, attempting to retrieve from ${uri}`);
  try {
    const img = await makePluginReq({opts: this.opts, method: 'GET', uri, contentType: null, encoding: null});
    const jimpImg = await Jimp.read(img);
    const png = await jimpImg.getBufferAsync(Jimp.MIME_PNG);
    return png.toString('base64');
  } catch (e) {
    if (e.message.match(/404/)) {
      throw new Error(`Could not collect screenshot. Screenshots can only be taken of your dev channel.`);
    }
    throw e;
  }
}
