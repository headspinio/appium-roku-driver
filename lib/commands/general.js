import log from '../logger';

const exts = {};

exts.installApp = async function installApp (app) {
  log.info(`Installing app from ${app}`);
  await this.removeApp();
};

exts.removeApp = async function removeApp (appId) {
  if (appId) {
    log.info(`App id ${appId} was provided to remove app but will be ignored; only dev app can be removed`);
  }
  // TODO
};

exts.activateApp = async function activateApp (appId) {
  log.info(`Launching app ${appId}`);
  await this.rokuEcp(`/launch/${appId}`);
};

export default exts;
