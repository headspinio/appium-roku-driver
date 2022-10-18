import {remote as wdio} from 'webdriverio';
import {main as startAppium} from 'appium';
import {util} from 'appium/support';
import path from 'path';

const {W3C_WEB_ELEMENT_IDENTIFIER} = util;

const HOST = '127.0.0.1';
const PORT = 8765;
const CAPS = require('./caps');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');

const APP_ZIP = path.resolve(FIXTURES, 'hello-world.zip');
const APP_NAME = 'Hello World';

const VBUZZ_APP_ZIP = path.resolve(FIXTURES, 'myvideobuzz.zip');
const VBUZZ_APP_NAME = 'MyVideoBuzz';

async function startSession(capabilities) {
  return await wdio({
    hostname: HOST,
    port: PORT,
    connectionRetryCount: 0,
    logLevel: 'silent',
    capabilities,
  });
}

describe('RokuDriver', function () {
  let server, driver;

  before(async function () {
    server = await startAppium({address: HOST, port: PORT});
    driver = await startSession(CAPS);
  });

  after(async function () {
    try {
      await driver.deleteSession();
    } catch (ign) {}
    try {
      await server.close();
    } catch (ign) {}
  });

  async function home() {
    await driver.executeScript('roku: pressKey', [{key: 'Home'}]);
  }

  async function activateByName(appName) {
    const apps = await driver.executeScript('roku: getApps', []);
    const appId = apps.filter((a) => a.name === appName)[0].id;
    // TODO replace with activateApp once wdio is fixed
    //await driver.activateApp(appId);
    await driver.executeScript('roku: activateApp', [{appId}]);
    return appId;
  }

  describe('sessions', function () {
    it('should start a session with no app', async function () {
      // relying on the before block above to have done this
      await driver.executeScript('roku: activeApp', []).should.eventually.eql({name: 'Roku'});
    });
    it('should start a session with an app', async function () {
      // kill the existing session first
      await driver.deleteSession();
      driver = await startSession({...CAPS, 'appium:app': APP_ZIP});
      const app = await driver.executeScript('roku: activeApp', []);
      app.name.should.eql(APP_NAME);
    });
  });

  // this describe block should come first so we know the dev app is sideloaded for the rest of the
  // blocks
  describe('app management', function () {
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
  });

  describe('general', function () {
    it('should be able to get page source if app is active', async function () {
      await activateByName(APP_NAME);
      const source = await driver.getPageSource();
      source.should.match(/^<\?xml version="1.0"\?>\n<AppiumAUT>\n<topscreen>/);
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

  describe('roku features', function () {
    it('should be able to press various remote keys', async function () {
      await home();
      await driver.executeScript('roku: pressKey', [{key: 'Right'}]);
      await driver.executeScript('roku: pressKey', [{key: 'Left'}]);
    });
    it('should be able to get device info', async function () {
      const info = await driver.executeScript('roku: deviceInfo', []);
      info['vendor-name'].should.eql('Roku');
    });
    it('should be able to get app ui', async function () {
      await activateByName(APP_NAME);
      await driver
        .executeScript('roku: appUI', [])
        .should.eventually.include('<plugin id="dev" name="Hello World"/>');
    });
    it('should not be able to get app ui for non-dev apps', async function () {
      await activateByName('YouTube');
      await driver
        .executeScript('roku: appUI', [])
        .should.eventually.be.rejectedWith(/Not authorized/);
    });
    it('should not get app UI if no active app', async function () {
      await home();
      await driver
        .executeScript('roku: appUI', [])
        .should.eventually.be.rejectedWith(/No active app/);
    });
  });

  describe('elements', function () {
    // in this section we don't want to use the typical webdriverio method for finding elements
    // because we want access to the return value from the server, especially in case of an error,
    // which we can only get by actually inspecting the returned message
    async function find(query, strategy = 'xpath') {
      const el = await driver.findElement(strategy, query);
      if (el.error) {
        throw new Error(el.message);
      }
      return el;
    }

    describe('finding', function () {
      it('should not be able to find elements if dev app not active', async function () {
        await home();
        await driver.findElement('xpath', '//*').should.eventually.be.rejectedWith(/No active app/);
        await activateByName('YouTube');
        await driver
          .findElement('xpath', '//*')
          .should.eventually.be.rejectedWith(/Not authorized/);
      });
      it('should be able to find a single element by xpath', async function () {
        await activateByName(APP_NAME);
        await find('//Label[@name="myLabel"]');
      });
      it('should throw not found if an element cannot be found', async function () {
        await find('//Label[@name="doesntexist"]').should.eventually.be.rejectedWith(
          /could not be located/
        );
      });
      it('should not be able to find via a non-xpath strategy', async function () {
        await find('#id', 'css selector').should.eventually.be.rejectedWith(/xpath/);
      });
      it('should find multiple elements', async function () {
        const els = await driver.$$('//*');
        els.should.have.length(7);
      });
      it('should not be able to find an element from another element', async function () {
        const parent = await find('//topscreen');
        await driver
          .findElementFromElement(parent[W3C_WEB_ELEMENT_IDENTIFIER], 'xpath', '//Label')
          .should.eventually.be.rejectedWith(/only find elements from the root/);
      });
    });

    describe('interactions', function () {
      it('should find and auto-navigate to an element when a click is requested', async function () {
        // TODO replace with installApp once wdio is fixed
        await driver.executeScript('roku: installApp', [{appPath: VBUZZ_APP_ZIP}]);
        await activateByName(VBUZZ_APP_NAME);
        let el = await driver.$('//item[@name="Top Channels"]');
        await el.click();
        el = await driver.$('//menuItem[@name="Done"]');
        await el.isExisting();
      });
    });
  });
});
