const rokuHost = process.env.RK_HOST || 'localhost';
const rokuEcpPort = (process.env.RK_PORT && parseInt(process.env.RK_PORT, 10)) || 8060;
const rokuWebPort = (process.env.RK_WEB_PORT && parseInt(process.env.RK_PORT, 10)) || 80;
const rokuUser = process.env.RK_USER || 'rokudev';
const rokuPass = process.env.RK_PASS || '';
const rokuHeaderHost = process.env.RK_HEADER_HOST || rokuHost;

const caps = {
  rokuHost,
  rokuEcpPort,
  rokuWebPort,
  rokuUser,
  rokuPass,
  rokuHeaderHost,
  keyCooldown: 2000,
  automationName: 'Roku',
  platformName: 'Roku'
};

const prefixedCaps = Object.keys(caps).reduce((newCaps, key) => {
  newCaps[`appium:${key}`] = caps[key];
  return newCaps;
}, {});

module.exports = prefixedCaps;
