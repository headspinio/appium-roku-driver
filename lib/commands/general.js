import _ from 'lodash';
import fs from 'fs';
import request from 'request-promise';
import log from '../logger';
import Jimp from 'jimp';
import { getAuthDigestParts, getAuthHeader } from '../utils';

const exts = {};

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

exts.installApp = async function installApp (appPath) {
  log.info(`Installing app from ${appPath}`);
  await this.removeApp();
  const formData = {
    mySubmit: 'Install',
    archive: fs.createReadStream(appPath)
  };
  await makePluginReq({opts: this.opts, formData});
};

exts.removeApp = async function removeApp (appId) {
  if (appId) {
    log.info(`App id ${appId} was provided to remove app but will be ignored; only dev app can be removed`);
  }
  const formData = {
    mySubmit: 'Delete',
    archive: ''
  };
  await makePluginReq({opts: this.opts, formData});
};

exts.activateApp = async function activateApp (appId) {
  log.info(`Launching app ${appId}`);
  await this.rokuEcp(`/launch/${appId}`);
};

exts.getPageSource = async function getPagesource () {
  return await this.roku_appUI(true);
};

exts.getScreenshot = async function getScreenshot () {
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
};

export default exts;
