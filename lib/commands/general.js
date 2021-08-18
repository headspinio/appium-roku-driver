import fs from 'fs';
import request from 'request-promise';
import log from '../logger';

const exts = {};

async function makePluginInstallReq (host, port, formData) {
  const reqOpts = {
    method: 'POST',
    url: `http://${host}:${port}/plugin_install`,
    headers: {
      'Content-Type': 'multipart/form-data',
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
  await makePluginInstallReq(this.opts.rokuHost, this.opts.rokuWebPort, formData);
};

exts.removeApp = async function removeApp (appId) {
  if (appId) {
    log.info(`App id ${appId} was provided to remove app but will be ignored; only dev app can be removed`);
  }
  const formData = {
    mySubmit: 'Delete',
    archive: ''
  };
  await makePluginInstallReq(this.opts.rokuHost, this.opts.rokuWebPort, formData);
};

exts.activateApp = async function activateApp (appId) {
  log.info(`Launching app ${appId}`);
  await this.rokuEcp(`/launch/${appId}`);
};

export default exts;
