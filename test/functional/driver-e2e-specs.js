import { remote as wdio } from 'webdriverio';
import { startServer } from '../..';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
chai.should();
chai.use(chaiAsPromised);

const HOST = '127.0.0.1';
const PORT = 8765;
const CAPS = require('./caps');

const APP_ZIP = path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'hello-world.zip');
const APP_NAME = 'Hello World';

describe('RokuDriver', function () {
  let server, driver;
  before(async function () {
    server = await startServer(PORT, HOST);
    driver = await wdio({
      hostname: HOST,
      port: PORT,
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
  it.skip('should be able to sideload an app', async function () {
    // TODO wait for fix from wdio on appium proto
    await driver.removeApp();
    let apps = await driver.executeScript('roku: getApps', []);
    apps.filter((a) => a.name === APP_NAME).should.have.length(0);
    await driver.installApp(APP_ZIP);
    apps = await driver.executeScript('roku: getApps', []);
    apps.filter((a) => a.name === APP_NAME).should.have.length(1);
  });
});
