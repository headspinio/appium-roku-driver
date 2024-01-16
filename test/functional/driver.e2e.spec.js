import B from 'bluebird';
import {remote as wdio} from 'webdriverio';
import {main as startAppium} from 'appium';
import path from 'path';
import CAPS from './caps';

const HOST = '127.0.0.1';
const PORT = 8765;

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');

const APP_ZIP = path.resolve(FIXTURES, 'hello-world.zip');
const APP_NAME = 'Hello World';

const HERO_GRID_APP = path.resolve(FIXTURES, 'hero-grid-channel-master.zip');
const HERO_GRID_NAME = 'HeroGridChannel';

async function startSession(capabilities) {
  return await wdio({
    hostname: HOST,
    port: PORT,
    connectionRetryCount: 0,
    capabilities,
  });
}

describe('RokuDriver', function () {
  let server;
  /** @type {import('webdriverio').Browser} */
  let driver;

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
    const app = apps.filter((a) => a.name === appName)[0];
    if (!app) {
      throw new Error(`App ${appName} was not installed`);
    }
    const appId = app.id;
    // TODO replace with activateApp once wdio is fixed
    //await driver.activateApp(appId);
    await driver.executeScript('roku: activateApp', [{appId}]);
    await B.delay(1000); // wait for app to activate
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
      apps.should.have.length.above(5);
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
    it('should be able to get player state', async function () {
      const state = await driver.executeScript('roku: playerState', []);
      state.player.error.should.eql('false');
      state.plugin.name.should.exist;
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
      await B.delay(750);
      await driver
        .executeScript('roku: appUI', [])
        .should.eventually.be.rejectedWith(/No active app/);
    });
  });

  describe('elements', function () {
    // in this section we don't want to use the typical webdriverio method for finding elements
    // because we want access to the return value from the server, especially in case of an error,
    // which we can only get by actually inspecting the returned message
    async function find(selector) {
      const el = await driver.$(selector);
      if (!await el.isExisting()) {
        throw new Error('Element could not be located');
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
        await find('#id').should.eventually.be.rejectedWith(/xpath/);
      });
      it('should find multiple elements', async function () {
        const els = await driver.$$('//*');
        els.should.have.length(7);
      });
      it('should not be able to find an element from another element', async function () {
        const parent = await find('//topscreen');
        let errMsg = null;
        try {
          await parent.$('//Label');
        } catch (err) {
          errMsg = err.message;
        }
        errMsg.should.include('only find elements from the root');
      });
      it('should get element attributes', async function () {
        const el = await find('//Label[@name="myLabel"]');
        await el.getAttribute('name').should.eventually.eql('myLabel');
      });
      it('should get element text', async function () {
        const el = await find('//Label[@name="myLabel"]');
        await el.getText().should.eventually.eql('Hello World!');
      });
    });

    describe('interactions', function () {
      it('should find and auto-navigate to an element when a click is requested', async function () {
        // TODO replace with installApp once wdio is fixed
        await driver.executeScript('roku: installApp', [{appPath: HERO_GRID_APP}]);
        await activateByName(HERO_GRID_NAME);
        let el = await driver.$('(//MarkupGrid)[2]/customItem[3]');
        await el.waitForExist({timeout: 5000});
        await el.click();
        el = await driver.$('//Label[contains(@text, "TEDTalks")]');
        await el.waitForExist({timeout: 5000});
      });
    });
  });
});
