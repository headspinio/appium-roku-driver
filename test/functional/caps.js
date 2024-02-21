const rokuHost = process.env.RK_HOST || 'localhost';
const rokuEcpPort = (process.env.RK_PORT && parseInt(process.env.RK_PORT, 10)) || 8060;
const rokuWebPort = parseInt(process.env.RK_WEB_PORT || '80', 10);
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
  keyCooldown: 1250,
  rokuWebCooldown: 1000,
  automationName: 'Roku',
  platformName: 'Roku'
};

export default Object.keys(caps).reduce((newCaps, key) => {
  newCaps[`appium:${key}`] = caps[key];
  return newCaps;
}, {});

