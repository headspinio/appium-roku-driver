import { URL } from 'url';
import blessed from 'blessed';
import yargs from 'yargs';
import { asyncify } from 'asyncbox';
import { remote as wdio } from 'webdriverio';

const KEYS = [
  ['Home', 'Up', 'Play'],
  ['Left', 'Select', 'Right'],
  ['Rev', 'Down', 'Fwd'],
  ['Back', 'Enter', 'Backspace'],
  ['Info', 'Search', 'InstantReplay'],
];

class RokuRemote {

  constructor (driver) {
    this.driver = driver;
    this.screen = blessed.screen({smartCSR: true, title: 'Roku Remote'});
    this.handleMainKeys();
    this.makeRemote();
    this.makeLogBox();
  }

  render () {
    this.screen.render();
  }

  makeRemote () {
    this.remote = blessed.box({
      parent: this.screen,
      top: 0,
      left: 'center',
      width: '100%',
      height: '100%-1',
    });
    this.makeButtons();
    this.buttons[0].focus();
    this.handleButtons();
  }

  makeLogBox () {
    this.logBox = blessed.box({
      parent: this.screen,
      top: '100%-1',
      left: 'center',
      width: '100%',
      height: 4,
      content: '',
    });
  }

  makeButtons () {
    const keyHeight = 100 / KEYS.length;
    this.buttons = [];
    for (let rowNum = 0; rowNum < KEYS.length; rowNum++) {
      const row = KEYS[rowNum];
      const keyWidth = 100 / row.length;
      for (let colNum = 0; colNum < row.length; colNum++) {
        const key = KEYS[rowNum][colNum];
        const box = blessed.box({
          parent: this.remote,
          top: `${keyHeight * rowNum}%`,
          left: `${keyWidth * colNum}%`,
          width: `${keyWidth}%`,
          height: `${keyHeight}%`,
          content: key,
          align: 'center',
          valign: 'middle',
          border: {type: 'line'},
          style: {
            border: {
              fg: '#f0f0f0'
            },
            focus: {
              bg: 'green',
              color: 'black'
            }
          }
        });
        this.buttons.push(box);
      }
    }
  }

  handleButtons () {
    this.screen.key(['left', 'right', 'up', 'down'], (ch, key) => {
      const curButton = this.screen.focused;
      const w = curButton.width, h = curButton.height;
      const curMidPoint = {x: curButton.left + w / 2, y: curButton.top + h / 2};
      let desiredPoint;
      key = key.name;
      if (key === 'left') {
        desiredPoint = {x: curMidPoint.x - w, y: curMidPoint.y};
      } else if (key === 'right') {
        desiredPoint = {x: curMidPoint.x + w, y: curMidPoint.y};
      } else if (key === 'up') {
        desiredPoint = {x: curMidPoint.x, y: curMidPoint.y - h};
      } else if (key === 'down') {
        desiredPoint = {x: curMidPoint.x, y: curMidPoint.y + h};
      } else {
        throw new Error(`Bad key ${key}`);
      }
      const nextButton = this.findBoxForPos(desiredPoint);
      if (nextButton) {
        nextButton.focus();
        this.log(`Hit enter to send ${nextButton.content} event`);
      }
    });

    this.screen.key(['enter'], async () => {
      const key = this.screen.focused.content;
      this.log(`Sending ${key} keypress to device`);
      try {
        await this.driver.execute('roku: pressKey', {key});
        this.log(`Sent ${key} keypress to device`);
      } catch (err) {
        this.log(err);
      }
    });
  }

  handleMainKeys () {
    this.screen.key(['escape', 'q', 'C-c'], async () => {
      try {
        await this.driver.deleteSession();
      } catch (ign) {}
      return process.exit(0);
    });
  }

  findBoxForPos ({x, y}) {
    if (x < 0 || y < 0) {
      return null;
    }
    for (const box of this.buttons) {
      if (box.left < x && (box.left + box.width) > x &&
          box.top < y && (box.top + box.height) > y) {
        return box;
      }
    }
    return null;
  }

  log (msg) {
    this.logBox.setContent(`DEBUG: ${msg}`);
    this.screen.render();
  }
}

function getSessionArgs () {
  const args = yargs
    .option('server', {
      alias: 's',
      type: 'string',
      description: 'URL of running Roku driver',
      required: true,
    })
    .option('caps-file', {
      alias: 'c',
      type: 'string',
      description: 'path to JSON file containing capabilities',
      required: true,
    })
    .argv;
  const caps = require(args.capsFile);
  return [args.server, caps];
}

async function main () {
  const [server, capabilities] = getSessionArgs();
  const serverUrl = new URL(server);
  capabilities['appium:newCommandTimeout'] = 0; // always disable command timeout since this is interactive
  const driver = await wdio({
    protocol: serverUrl.protocol.replace(':', ''),
    hostname: serverUrl.hostname,
    port: parseInt(serverUrl.port, 10),
    path: serverUrl.pathname,
    connectionRetryCount: 0,
    capabilities
  });
  const remote = new RokuRemote(driver);
  remote.render();
}

if (require.main === module) {
  asyncify(main);
}
