import _ from 'lodash';
import log from '../logger';
import { errors } from '@appium/base-driver';

const MAX_FOCUS_STEPS = 10;

const IGNORE_ATTRS_FOR_EQUALITY = ['current', 'focused'];

export async function _elementInteractionGuard (elId) {
  log.info(`Ensuring element ${elId} is not stale`);
  if (!this.elCache.has(elId)) {
    throw new errors.NoSuchElementError();
  }

  const {node, selector, mult} = this.elCache.get(elId);

  // ensure the element is still connected and valid
  const testNodes = await this._getXPathNodes('xpath', selector, mult, null);
  const matchingNodes = testNodes.filter((testNode) => elementNodesAreEqual(testNode, node));
  // if we couldn't find a matching node in current dom, we have a stale element
  if (matchingNodes.length < 1) {
    throw new errors.StaleElementReferenceError();
  }
  if (matchingNodes.length > 1) {
    throw new Error(`Could not uniquely determine element in hierarchy; please use another selector`);
  }

  return matchingNodes[0];
}

function elementNodesAreEqual (node1, node2, examineRelatives = true) {
  log.info(`Testing whether two nodes are equal`);
  if (node1 === node2) {
    return true;
  }
  if (node1.nodeName !== node2.nodeName) {
    log.debug(`Nodes differed in nodeName: '${node1.nodeName}' vs '${node2.nodeName}'`);
    return false;
  }
  if (node1.value !== node2.value) {
    log.debug(`Nodes differed in value: '${node1.value}' vs '${node2.value}'`);
    return false;
  }
  if (!_nodeAttrsAreEqual(node1, node2)) {
    log.debug(`Nodes differed in attributes`);
    return false;
  }
  if (examineRelatives && !_nodeChildrenAreEqual(node1, node2)) {
    log.debug(`Nodes differed in children`);
    return false;
  }
  if (examineRelatives && !_nodeParentsAreEqual(node1, node2)) {
    log.debug(`Nodes differed in parents`);
    return false;
  }
  if (examineRelatives && !_nodeSurroundingSiblingsAreEqual(node1, node2)) {
    log.debug(`Nodes differed in siblings`);
    return false;
  }
  return true;
}

function _nodeAttrsAreEqual (n1, n2) {
  const [n1Attrs, n2Attrs] = [n1.attributes, n2.attributes];
  if (_.size(n1Attrs) !== _.size(n2Attrs)) {
    return false;
  }
  for (let i = 0; i < _.size(n1Attrs); i++) {
    // treat the 'focused' and similar attributes specially since we are OK with it changing and
    // element equality being the same
    if (IGNORE_ATTRS_FOR_EQUALITY.includes(n1Attrs[i].name)) {
      continue;
    }
    if (n1Attrs[i].name !== n2Attrs[i].name) {
      return false;
    }
    if (n1Attrs[i].value !== n2Attrs[i].value) {
      return false;
    }
  }
  return true;
}

function _nodeChildrenAreEqual (n1, n2) {
  if (_.size(n1.childNodes) !== _.size(n2.childNodes)) {
    return false;
  }
  if (_.size(n1.childNodes) === 0) {
    return true;
  }
  for (let i = 0; i < _.size(n1.childNodes); i++) {
    const [c1, c2] = [n1.childNodes[i], n2.childNodes[i]];
    if (!elementNodesAreEqual(c1, c2, false)) {
      return false;
    }
  }
  return true;
}

function _nodeParentsAreEqual (n1, n2) {
  return elementNodesAreEqual(n1.parentNode, n2.parentNode, false);
}

function _nodeSurroundingSiblingsAreEqual (n1, n2) {
  if (!elementNodesAreEqual(n1.previousSibling, n2.previousSibling, false)) {
    return false;
  }
  if (!elementNodesAreEqual(n1.nextSibling, n2.nextSibling, false)) {
    return false;
  }
  return true;
}

export async function click (elId) {
  const elNode = await this._elementInteractionGuard(elId);

  await this.focusElement(elNode, elId);
  await this.roku_pressKey({key: 'Select'});
}

export async function focusElement (elNode, elId, steps = 0) {
  if (steps >= MAX_FOCUS_STEPS) {
    throw new Error(`Could not focus element for click in ${MAX_FOCUS_STEPS}; focus manually instead`);
  }
  log.info(`Attempting focus element ${elId}: step ${steps + 1}`);
  // base case: the current node is focused
  if (nodeIsFocused(elNode)) {
    return;
  }

  await this.makeNextFocusMove(elNode);
  log.info(`Refinding element to check for focus state`);
  const newNode = await this._elementInteractionGuard(elId);
  await this.focusElement(newNode, elId, steps + 1);
}

export async function makeNextFocusMove (elNode) {
  // look to see if a focused element is in a following sibling
  let nextSibling = elNode.nextSibling;
  while (nextSibling) {
    log.debug(`Examining next sibling <${nextSibling.nodeName}>`);
    if (nodeIsFocused(nextSibling)) {
      log.info(`Found a following sibling that is focused; pressing Left`);
      await this.roku_pressKey({key: 'Left'});
      return;
    }
    nextSibling = nextSibling.nextSibling;
  }

  // next try preceding
  let previousSibling = elNode.previousSibling;
  while (previousSibling) {
    log.debug(`Examining previous sibling <${previousSibling.nodeName}>`);
    if (nodeIsFocused(previousSibling)) {
      log.info(`Found a previous sibling that is focused; pressing Right`);
      await this.roku_pressKey({key: 'Right'});
      return;
    }
    previousSibling = previousSibling.previousSibling;
  }

  log.info(`Couldn't find any focused siblings; pressing Down`);
  await this.roku_pressKey({key: 'Down'});
}

function nodeIsFocused (n) {
  if (!n.attributes) {
    return false;
  }
  for (const attr of Object.values(n.attributes)) {
    if (attr.name === 'focused' && attr.value === 'true') {
      return true;
    }
  }
  return false;
}
