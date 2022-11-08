import _ from 'lodash';
import {Env} from '@humanwhocodes/env';

const env = new Env();

const rokuHost = env.get('RK_HOST', 'localhost');
const rokuEcpPort = _.parseInt(env.get('RK_PORT', '8060'));
const rokuWebPort = _.parseInt(env.get('RK_WEB_PORT', '80'));
const rokuUser = env.get('RK_USER', 'rokudev');
const rokuPass = env.get('RK_PASS', '');
const rokuHeaderHost = env.get('RK_READER_HOST', rokuHost);

const baseCaps = {
  rokuHost,
  rokuEcpPort,
  rokuWebPort,
  rokuUser,
  rokuPass,
  rokuHeaderHost,
  keyCooldown: 1250,
  automationName: 'Roku',
};

export const CAPS = {
  ..._.mapKeys(baseCaps, (value, key) => `appium:${key}`),
  platformName: 'Roku',
};
