import _ from 'lodash';
import log from '../logger';
import B from 'bluebird';
import { errors } from 'appium/driver';
import { W3C_ELEMENT_KEY } from '@appium/base-driver/build/lib/constants';

const MAX_FOCUS_STEPS = 20;

const ATTRS_FOR_EQUALITY = ['extends', 'name', 'rcid', 'text', 'uiElementId'];
const PREV_SIBLING = 'previousSibling';
const NEXT_SIBLING = 'nextSibling';

const KB_STATE_ABC = 'abc123';
const KB_STATE_CAPS = 'capslock';
const KB_STATE_SYMBOLS = 'symbols';
const KB_STATE_ACCENTS = 'accents';

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
  log.debug(`Testing whether two nodes (${node1.nodeName} and ${node2.nodeName}) are equal`);
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
    log.debug(`Node 1 (${node1.nodeName}) attributes:`);
    log.debug(JSON.stringify(nodeAttrsToMap(node1)));
    log.debug(`Node 1 (${node2.nodeName}) attributes:`);
    log.debug(JSON.stringify(nodeAttrsToMap(node2)));
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

function _nodeAttrsToMap (n, onlyEqualityAttrs = false) {
  const attrMap = {};
  const attrs = n.attributes;
  for (let i = 0; i < _.size(attrs); i++) {
    if (!onlyEqualityAttrs || _.includes(ATTRS_FOR_EQUALITY, attrs[i].name)) {
      attrMap[attrs[i].name] = attrs[i].value;
    }
  }
  return attrMap;
}

function nodeAttrsToMap (n) {
  return _nodeAttrsToMap(n, false);
}

function nodeEqualityAttrsToMap (n) {
  return _nodeAttrsToMap(n, true);
}

function _nodeAttrsAreEqual (n1, n2) {
  const [n1Attrs, n2Attrs] = [n1, n2].map(nodeEqualityAttrsToMap);

  if (_.size(n1Attrs) !== _.size(n2Attrs)) {
    return false;
  }
  for (const key of Object.keys(n1Attrs)) {
    if (n1Attrs[key] !== n2Attrs[key]) {
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
  await this.focus(elId);
  await this.roku_pressKey({key: 'Select'});
}

export async function focus (elId) {
  const elNode = await this._elementInteractionGuard(elId);
  await this.focusElement(elNode, elId);
}

export async function focusElement (elNode, elId) {
  let steps = 0;
  while (steps < MAX_FOCUS_STEPS) {
    log.info(`Attempting to focus element ${elId}: step ${steps + 1}`);

    // if the node is already focused, we're done
    if (nodeIsFocused(elNode)) {
      return;
    }

    // otherwise, make the move we think is most likely to get us closer to what we weant
    await this.makeNextFocusMove(elNode);

    // then re-get the node afresh to see if it is now focused
    log.info(`Refinding element to check for focus state`);
    elNode = await this._elementInteractionGuard(elId);

    steps += 1;
  }
  throw new Error(`Could not focus element for click in ${MAX_FOCUS_STEPS}; focus manually instead`);
}

export async function makeNextFocusMove (elNode) {
  // if the node is not focused, check if the parent node is focused
  if (elNode.parentNode && !nodeIsFocused(elNode.parentNode)) {
    log.debug(`Node's parent is not focused, attempting to focus parent <${elNode.parentNode.nodeName}>`);
    // and if not, first attempt to focus the parent node recursively
    await this.makeNextFocusMove(elNode.parentNode);
    return;
  }

  // now that we assume the parent node is focused, look for the current sibling focused node and
  // attempt to move closer to it in an appropriate direction
  log.debug(`Examining node's siblings for focus state`);
  for (const siblingType of [PREV_SIBLING, NEXT_SIBLING]) {
    let sibling = elNode[siblingType];
    while (sibling) {
      if (sibling.nodeName !== '#text') {
        if (nodeIsFocused(sibling)) {
          const key = getRokuKeyForBoundsBasedMove(sibling, elNode, siblingType);
          log.info(`Found a ${siblingType} that is focused; pressing ${key}`);
          await this.roku_pressKey({key});
          return;
        }
      }
      sibling = sibling[siblingType];
    }
  }

  throw new Error(`Could not focus on target node!`);
}

function getRokuKeyForBoundsBasedMove (fromNode, toNode, siblingType) {
  const [fromAttrs, toAttrs] = [fromNode, toNode].map(nodeAttrsToMap);
  log.debug(`Getting roku key for bounds based focus`);
  if (fromAttrs.bounds && toAttrs.bounds) {
    const [fromPos, toPos] = [fromAttrs.bounds, toAttrs.bounds].map(getPositionFromBounds);
    log.debug(`From element at position: ${JSON.stringify(fromPos)}, to element at position: ` +
              `${JSON.stringify(toPos)}`);
    const vertMagnitude = Math.abs(toPos.y - fromPos.y);
    const horizMagnitude = Math.abs(toPos.x - fromPos.x);

    // if we have a difference in position
    if (vertMagnitude !== 0 || horizMagnitude !== 0) {

      // and if that difference is bigger on the y-axis
      if (vertMagnitude >= horizMagnitude) {

        // and the target element is below the source element
        if (toPos.y > fromPos.y) {
          return 'Down';
        }
        // but if the target element is above the source element
        return 'Up';
      }

      // or if the target element is primarily to the right of the source element
      if (toPos.x > fromPos.x) {
        return 'Right';
      }

      // finally, if it's primarily to the left
      return 'Left';
    }
  }

  log.debug(`Could not get bounds from both from and to elements`);
  log.debug(`Attrs for from node: ${JSON.stringify(fromAttrs)}`);
  log.debug(`Attrs for to node: ${JSON.stringify(toAttrs)}`);

  // if for whatever reason we couldn't determine bounds or the bounds were the same, just do
  // left/right based on whether we had a previous or next sibling. default to left/right here, but
  // maybe should have a setting whether it should default to up/down.
  if (siblingType === PREV_SIBLING) {
    return 'Right';
  }
  return 'Left';
}

function getPositionFromBounds (boundsStr) {
  const [x, y, , ] = boundsStr.replace(/[^-.0-9,]/g, '').split(','); // eslint-disable-line array-bracket-spacing
  return {x: parseInt(x, 10), y: parseInt(y, 10)};
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

export async function setValue (text, elId) {
  let action = this.setValueByEcp.bind(this);

  let chars = text;
  // if we got a string rather than an array of chars, split it up
  if (chars.split) {
    chars = chars.split('');
  }

  if (this.opts.typeIndividualKeys) {
    action = this.setValueByKeyboard.bind(this);
  }

  const oldCooldown = this.opts.keyCooldown;
  this.opts.keyCooldown = 0;
  try {
    await this.performActionWithKeyboard(async () => await action(chars), elId);
  } finally {
    this.opts.keyCooldown = oldCooldown;
  }
}

export async function performActionWithKeyboard (action, elId) {
  const kbSelector = '//StdDlgKeyboardItem[@focused="true"]';
  try {
    await this.findElOrEls('xpath', kbSelector, false);
  } catch (ign) {
    log.debug('Could not find keyboard, attempting to click element to see if it comes up');
    await this.click(elId);
    try {
      await this.findElOrEls('xpath', kbSelector, false);
    } catch (ign) {
      throw new Error(`Tried to type text but could not find a focused 'StdDlgKeyboardItem'`);
    }
  }

  await action();

  const okBtn = await this.findElOrEls('xpath', '//Label[@text="OK"]/ancestor::StdDlgButton', false);
  await this.click(okBtn[W3C_ELEMENT_KEY]);
}

export async function setValueByEcp (chars) {
  for (const char of chars) {
    await this.roku_pressKey({key: `Lit_${encodeURIComponent(char)}`});
  }
}

export async function setValueByKeyboard (chars) {
  let kbState = KB_STATE_ABC;
  const presses = [];
  for (const char of chars) {
    const nextState = getKbStateChange(kbState, char);
    if (nextState !== null) {
      presses.push(nextState);
      kbState = nextState;
    }
    presses.push(char);
  }
  log.debug(`Will attempt to type keyboard sequence: ${JSON.stringify(presses)}`);

  for (const press of presses) {
    const key = await this.findElOrEls('xpath', `//VKBKey[@uiElementId="vkey:${press}"]`, false);
    if (press === '@') {
      // the @ key has a little popup we want to wait for before pressing, so just focus it and
      // make sure it's all loaded
      await this.focus(key[W3C_ELEMENT_KEY]);
      await B.delay(750);
    }
    await this.click(key[W3C_ELEMENT_KEY]);
  }

}

function getKbStateChange (curState, nextChar) {
  let nextState = null;
  if (/[a-z0-9.@_-]/.test(nextChar)) {
    nextState = KB_STATE_ABC;
  } else if (/[A-Z]/.test(nextChar)) {
    nextState = KB_STATE_CAPS;
  } else if (nextChar.charCodeAt(0) < 192) {
    nextState = KB_STATE_ACCENTS;
  } else {
    nextState = KB_STATE_SYMBOLS;
  }

  if (nextState === curState) {
    nextState = null;
  }
  return nextState;
}
