import log from '../logger';
import request from 'request-promise';
import B from 'bluebird';
import _ from 'lodash';
import { errors } from '@appium/base-driver';
import xml2js from 'xml2js';
import { DOMParser, XMLSerializer } from 'xmldom';
import xpath from 'xpath';

export async function execute (script, args) {
  if (script.match(/^roku:/)) {
    log.info(`Executing Roku command '${script}'`);
    script = script.replace(/^roku:/, '').trim();
    return await this.executeRoku(script, _.isArray(args) ? args[0] : args);
  }

  throw new errors.NotImplementedError();
}

export async function rokuEcp (urlStr, method = 'POST', body = '') {
  const {rokuHost, rokuEcpPort, rokuUser, rokuPass, rokuHeaderHost} = this.opts;
  const url = `http://${rokuHost}:${rokuEcpPort}${urlStr}`;
  log.info(`Running ECP command: ${url}`);
  return await request({
    method,
    url,
    headers: {HOST: rokuHeaderHost},
    auth: {user: rokuUser, pass: rokuPass},
    body
  });
}

export async function executeRoku (rokuCommand, opts = {}) {
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
}

export async function roku_pressKey ({key}) {
  await this.rokuEcp(`/keypress/${key}`);
  if (this.opts.keyCooldown) {
    await B.delay(this.opts.keyCooldown);
  }
  this.cachedSourceDirty = true;
}

export async function roku_deviceInfo () {
  const deviceXml = await this.rokuEcp('/query/device-info', 'GET');
  const parser = new xml2js.Parser();
  const info = (await parser.parseStringPromise(deviceXml))['device-info'];
  const niceInfo = {};
  for (const key of Object.keys(info)) {
    niceInfo[key] = info[key][0];
  }
  return niceInfo;
}

export async function roku_getApps () {
  const appXml = await this.rokuEcp('/query/apps', 'GET');
  const parser = new xml2js.Parser();
  return (await parser.parseStringPromise(appXml)).apps.app.map((a) => {
    const {id, subtype, type, version} = a.$;
    return {id, subtype, type, version, name: a._};
  });
}

export async function roku_activeApp () {
  const appXml = await this.rokuEcp('/query/active-app', 'GET');
  const parser = new xml2js.Parser();
  return (await parser.parseStringPromise(appXml))['active-app'].app.map((a) => {
    if (_.isString(a)) {
      return {name: a};
    }
    const {id, subtype, type, version} = a.$;
    return {id, subtype, type, version, name: a._};
  })[0];
}

export async function roku_appUI (stripOuterTags = false) {
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
}

export async function roku_activateApp ({appId}) {
  return await this.activateApp(appId);
}

export async function roku_installApp ({appPath}) {
  return await this.installApp(appPath);
}

export async function roku_removeApp () {
  return await this.removeApp();
}
