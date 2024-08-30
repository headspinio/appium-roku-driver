import {errors} from 'appium/driver';
import {util} from 'appium/support';
import xpath from 'xpath';
import {DOMParser, MIME_TYPE} from '@xmldom/xmldom';

const {W3C_WEB_ELEMENT_IDENTIFIER} = util;

/**
 * @this {RokuDriver}
 * @param {SelectedValue} node
 * @param {string} selector
 * @param {boolean} mult
 * @returns {Element}
 */
export function _getElementFromNode(node, selector, mult) {
  const elId = util.uuidV4();
  // in our element cache, save the xml node, and the selector used to retrieve the node(s), so we
  // can do some stale element checking using these bits later on
  this.elCache.set(elId, {node, selector, mult});
  return {[W3C_WEB_ELEMENT_IDENTIFIER]: elId};
}

/**
 * @template [Ctx=any]
 * @this RokuDriver
 * @param {string} strategy
 * @param {string} selector
 * @param {any} mult - ignored
 * @param {Ctx} [context]
 * @returns {Promise<SelectedValue[]>}
 */
export async function _getXPathNodes(strategy, selector, mult, context) {
  // here we are assuming that strategy is xpath
  if (strategy !== 'xpath') {
    throw new Error('Invalid locator strategy; only xpath supported');
  }

  if (context) {
    throw new Error('This driver can only find elements from the root; not from other elements');
  }

  // we always want to get a fresh source when calling this method
  this._cachedSourceDirty = true;
  const source = await this.getPageSource();
  const doc = new DOMParser().parseFromString(source, MIME_TYPE.XML_TEXT);
  return xpath.select(selector, doc);
}

/**
 * @template [Ctx=any]
 * @this RokuDriver
 * @param {string} strategy
 * @param {string} selector
 * @param {boolean} mult
 * @param {Ctx} [context]
 * @returns {Promise<Element[] | Element>}
 */
export async function findElOrEls(strategy, selector, mult, context) {
  const nodes = await this._getXPathNodes(strategy, selector, mult, context);

  if (mult) {
    return /** @type {Element[]} */ (
      nodes.map((n) => this._getElementFromNode(n, selector, mult))
    );
  }

  if (nodes.length < 1) {
    throw new errors.NoSuchElementError();
  }

  return /** @type {Element} */ (
    this._getElementFromNode(nodes[0], selector, mult)
  );
}

/**
 * @typedef {import('../driver').RokuDriver} RokuDriver
 * @typedef {import('@appium/types').Element} Element
 * @typedef {import('xpath').SelectedValue} SelectedValue
 */
