import fs from 'fs';
import request from 'request-promise';
import log from '../logger';
import { getAuthDigestParts, getAuthHeader } from '../utils';

const exts = {};

async function makePluginInstallReq (host, port, user, pass, formData) {
  const uri = '/plugin_install';
  const url = `http://${host}:${port}${uri}`;
  const method = 'POST';
  const authDigestParts = {
    ...await getAuthDigestParts(url, method),
    method,
    user,
    pass,
    uri,
  };
  const authHeader = getAuthHeader(authDigestParts);
  const reqOpts = {
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: authHeader,
    },
    formData,
  };
  await request(reqOpts);
}

exts.installApp = async function installApp (appPath) {
  log.info(`Installing app from ${appPath}`);
  await this.removeApp();
  const formData = {
    mySubmit: 'Install',
    archive: fs.createReadStream(appPath)
  };
  await makePluginInstallReq(this.opts.rokuHost, this.opts.rokuWebPort, this.opts.rokuUser,
    this.opts.rokuPass, formData);
};

exts.removeApp = async function removeApp (appId) {
  if (appId) {
    log.info(`App id ${appId} was provided to remove app but will be ignored; only dev app can be removed`);
  }
  const formData = {
    mySubmit: 'Delete',
    archive: ''
  };
  await makePluginInstallReq(this.opts.rokuHost, this.opts.rokuWebPort, this.opts.rokuUser,
    this.opts.rokuPass, formData);
};

exts.activateApp = async function activateApp (appId) {
  log.info(`Launching app ${appId}`);
  await this.rokuEcp(`/launch/${appId}`);
};

exts.getPageSource = async function getPagesource () {
  return await this.roku_appUI(true);
};

export default exts;
