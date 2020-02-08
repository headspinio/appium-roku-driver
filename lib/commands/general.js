import { imageUtil } from '@appium/support';

const exts = {};

exts.getWindowSize = async function getWindowSize () {
  if (!this._cachedWindowSize) {
    const screen = await this.getScreenshot();
    const data = Buffer.from(screen, 'base64');
    const img = await imageUtil.getJimpImage(data);
    const {width, height} = img.bitmap;
    this._cachedWindowSize = {width, height};
  }
  return this._cachedWindowSize;
};

export default exts;
