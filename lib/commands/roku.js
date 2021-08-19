import log from '../logger';
import B from 'bluebird';
import _ from 'lodash';
import { errors } from '@appium/base-driver';
import xml2js from 'xml2js';
import { DOMParser, XMLSerializer } from 'xmldom';
import xpath from 'xpath';

const extensions = {};

extensions.execute = async function execute (script, args) {
  if (script.match(/^roku:/)) {
    log.info(`Executing Roku command '${script}'`);
    script = script.replace(/^roku:/, '').trim();
    return await this.executeRoku(script, _.isArray(args) ? args[0] : args);
  }

  throw new errors.NotImplementedError();
};

extensions.executeRoku = async function (rokuCommand, opts = {}) {
  const rokuCommands = [
    'deviceInfo',
    'pressKey',
    'getApps',
    'activeApp',
    'appUI',
    'activateApp',
    'installApp',
    'removeApp',
  ];

  if (!_.includes(rokuCommands, rokuCommand)) {
    throw new errors.UnknownCommandError(`Unknown roku command "${rokuCommand}". ` +
      `Only ${rokuCommands} commands are supported.`);
  }
  return await this[`roku_${rokuCommand}`](opts);
};

extensions.roku_pressKey = async function ({key}) {
  await this.rokuEcp(`/keypress/${key}`);
  if (this.opts.keyCooldown) {
    await B.delay(this.opts.keyCooldown);
  }
};

extensions.roku_deviceInfo = async function rokuDeviceInfo () {
  const deviceXml = await this.rokuEcp('/query/device-info', 'GET');
  const parser = new xml2js.Parser();
  const info = (await parser.parseStringPromise(deviceXml))['device-info'];
  const niceInfo = {};
  for (const key of Object.keys(info)) {
    niceInfo[key] = info[key][0];
  }
  return niceInfo;
};

extensions.roku_getApps = async function rokuGetApps () {
  const appXml = await this.rokuEcp('/query/apps', 'GET');
  const parser = new xml2js.Parser();
  return (await parser.parseStringPromise(appXml)).apps.app.map((a) => {
    const {id, subtype, type, version} = a.$;
    return {id, subtype, type, version, name: a._};
  });
};

extensions.roku_activeApp = async function rokuActiveApp () {
  const appXml = await this.rokuEcp('/query/active-app', 'GET');
  const parser = new xml2js.Parser();
  return (await parser.parseStringPromise(appXml))['active-app'].app.map((a) => {
    if (_.isString(a)) {
      return {name: a};
    }
    const {id, subtype, type, version} = a.$;
    return {id, subtype, type, version, name: a._};
  })[0];
};

extensions.roku_appUI = async function appUI (stripOuterTags = false) {
  const xml = await this.rokuEcp('/query/app-ui', 'GET');
  const parser = new xml2js.Parser();
  const parsed = await parser.parseStringPromise(xml);
  if (parsed['app-ui'].status[0] === 'FAILED') {
    const errMsg = parsed['app-ui'].error[0];
    throw new Error(`Could not retrieve app UI. Error was: ${errMsg}`);
  }

  if (stripOuterTags) {
    const doc = new DOMParser().parseFromString(xml);
    const nodes = xpath.select('//topscreen', doc);
    const serializer = new XMLSerializer();
    return serializer.serializeToString(nodes[0]);
  }
  return xml;
};

extensions.roku_activateApp = async function rokuActivateApp ({appId}) {
  return await this.activateApp(appId);
};

extensions.roku_installApp = async function rokuInstallApp ({appPath}) {
  return await this.installApp(appPath);
};

extensions.roku_removeApp = async function rokuRemoveApp () {
  return await this.removeApp();
};

export default extensions;
