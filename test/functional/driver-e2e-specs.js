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
      logLevel: 'silent',
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

  async function home () {
    await driver.executeScript('roku: pressKey', [{key: 'Home'}]);
  }

  async function activateByName (appName) {
    const apps = await driver.executeScript('roku: getApps', []);
    const appId = apps.filter((a) => a.name === appName)[0].id;
    // TODO replace with activateApp once wdio is fixed
    //await driver.activateApp(appId);
    await driver.executeScript('roku: activateApp', [{appId}]);
    return appId;
  }

  it('should be able to press various remote keys', async function () {
    await home();
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
  it('should be able to launch an app', async function () {
    const youTubeId = await activateByName('YouTube');
    const app = await driver.executeScript('roku: activeApp', []);
    app.id.should.eql(youTubeId);
  });
  it('should be able to sideload an app', async function () {
    // TODO replace with removeApp once wdio is fixed
    await driver.executeScript('roku: removeApp', []);
    let apps = await driver.executeScript('roku: getApps', []);
    apps.filter((a) => a.name === APP_NAME).should.have.length(0);
    // TODO replace with installApp once wdio is fixed
    await driver.executeScript('roku: installApp', [{appPath: APP_ZIP}]);
    apps = await driver.executeScript('roku: getApps', []);
    apps.filter((a) => a.name === APP_NAME).should.have.length(1);
  });
  it('should be able to get app ui', async function () {
    await activateByName(APP_NAME);
    await driver.executeScript('roku: appUI', []).should.eventually.include('<plugin id="dev" name="Hello World"/>');
  });
  it('should not be able to get app ui for non-dev apps', async function () {
    await activateByName('YouTube');
    await driver.executeScript('roku: appUI', []).should.eventually.be.rejectedWith(
      /Not authorized/);
  });
  it('should not get app UI if no active app', async function () {
    await home();
    await driver.executeScript('roku: appUI', []).should.eventually.be.rejectedWith(
      /No active app/);
  });
  it('should be able to get page source if app is active', async function () {
    await activateByName(APP_NAME);
    const source = await driver.getPageSource();
    source.should.match(/^<topscreen/);
    source.should.include('<plugin id="dev" name="Hello World"/>');
  });
  it('should be able to take screenshot if dev app is active', async function () {
    await activateByName(APP_NAME);
    const img = await driver.takeScreenshot();
    img.should.match(/^iVBOR/);
    img.length.should.be.above(1000);
  });
  it('should not be able to take screenshot if dev app is not active', async function () {
    await home();
    await driver.takeScreenshot().should.eventually.be.rejectedWith(/not collect screenshot/);
  });
});
