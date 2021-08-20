import { errors } from '@appium/base-driver';
import { W3C_ELEMENT_KEY } from '@appium/base-driver/build/lib/constants';
import xpath from 'xpath';
import { util } from '@appium/support';
import { DOMParser } from 'xmldom';

const exts = {};

exts._getElementFromNode = function _getElementFromNode (node) {
  const elId = util.uuidV4();
  this.elCache.set(elId, node);
  return {[W3C_ELEMENT_KEY]: elId};
};

exts.findElOrEls = async function (strategy, selector, mult, context) {
  // here we are assuming that strategy is xpath
  if (strategy !== 'xpath') {
    throw new Error('Invalid locator strategy; only xpath supported');
  }

  if (context) {
    throw new Error('This driver can only find elements from the root; not from other elements');
  }

  const source = await this.getPageSource();
  const doc = new DOMParser().parseFromString(source, 'text/xml');
  const nodes = xpath.select(selector, doc);

  if (mult) {
    return nodes.map((n) => this._getElementFromNode(n));
  }

  if (nodes.length < 1) {
    throw new errors.NoSuchElementError();
  }

  return this._getElementFromNode(nodes[0]);
};

export default exts;
