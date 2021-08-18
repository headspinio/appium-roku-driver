import { remote as wdio } from 'webdriverio';
import { startServer } from '../..';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.should();
chai.use(chaiAsPromised);

const HOST = '127.0.0.1';
const PORT = 8765;
const CAPS = require('./caps');

describe('RokuDriver', function () {
  let server, driver;
  before(async function () {
    server = await startServer(PORT, HOST);
    driver = await wdio({
      hostname: HOST,
      port: PORT,
      isW3C: true,
      isMobile: true,
      connectionRetryCount: 0,
      capabilities: CAPS,
    });
  });
  after(async function () {
    try {
      await driver.deleteSession();
    } catch (ign) {}
    try {
      await server.close();
    } catch (ign) {}
  });
  it('should be able to press various remote keys', async function () {
    await driver.executeScript('roku: pressKey', [{key: 'Home'}]);
    await driver.executeScript('roku: pressKey', [{key: 'Right'}]);
    await driver.executeScript('roku: pressKey', [{key: 'Left'}]);
  });
  it('should be able to get device info', async function () {
    const info = await driver.executeScript('roku: deviceInfo', []);
    info['vendor-name'].should.eql('Roku');
  });
  it('should be able to get apps', async function () {
    const apps = await driver.executeScript('roku: getApps', []);
    apps.should.have.length.above(10);
    apps.map((a) => a.name).should.include('YouTube');
  });
  it.skip('should be able to launch an app', async function () {
    // TODO wait for fix from wdio on appium proto
    const apps = await driver.executeScript('roku: getApps', []);
    const youTubeId = apps.filter((a) => a.name === 'YouTube')[0].id;
    await driver.activateApp(youTubeId);
    await driver.executeScript('roku: activeApp', []).should.eventually.eql(youTubeId);
  });
});
