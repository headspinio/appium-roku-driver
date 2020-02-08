import log from '../logger';
import _ from 'lodash';
import { errors } from '@appium/base-driver';
import xml2js from 'xml2js';

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
    'launchApp',
    'activeApp',
  ];

  if (!_.includes(rokuCommands, rokuCommand)) {
    throw new errors.UnknownCommandError(`Unknown roku command "${rokuCommand}". ` +
      `Only ${rokuCommands} commands are supported.`);
  }
  return await this[`roku_${rokuCommand}`](opts);
};

extensions.roku_pressKey = async function ({key}) {
  await this.rokuEcp(`/keypress/${key}`);
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

extensions.roku_launchApp = async function rokuLaunchApp ({appId}) {
  await this.rokuEcp(`/launch/${appId}`);
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

export default extensions;
