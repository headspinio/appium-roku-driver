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
    await driver.execute('roku: pressKey', {key: 'Home'});
    await driver.execute('roku: pressKey', {key: 'Right'});
    await driver.execute('roku: pressKey', {key: 'Left'});
  });
  it('should be able to get device info', async function () {
    const info = await driver.execute('roku: deviceInfo');
    info['vendor-name'].should.eql('Roku');
  });
  it('should be able to get apps', async function () {
    const apps = await driver.execute('roku: getApps');
    apps.should.have.length(15);
  });
});
