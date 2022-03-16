import _ from 'lodash';
import log from '../logger';
import { errors } from '@appium/base-driver';

const MAX_FOCUS_STEPS = 20;

const ATTRS_FOR_EQUALITY = ['bounds', 'extends', 'name', 'rcid', 'text'];
const PREV_SIBLING = 'previousSibling';
const NEXT_SIBLING = 'nextSibling';

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
    log.debug(_nodeAttrsToMap(node1));
    log.debug(_nodeAttrsToMap(node2));
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

function _nodeAttrsToMap (n) {
  const attrMap = {};
  const attrs = n.attributes;
  for (let i = 0; i < _.size(attrs); i++) {
    if (_.includes(ATTRS_FOR_EQUALITY, attrs[i].name)) {
      attrMap[attrs[i].name] = attrs[i].value;
    }
  }
  return attrMap;
}

function _nodeAttrsAreEqual (n1, n2) {
  const [n1Attrs, n2Attrs] = [n1, n2].map(_nodeAttrsToMap);

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
  const elNode = await this._elementInteractionGuard(elId);

  await this.focusElement(elNode, elId);
  await this.roku_pressKey({key: 'Select'});
}

export async function focusElement (elNode, elId) {
  let steps = 0;
  while (steps < MAX_FOCUS_STEPS) {
    log.info(`Attempting to focus element ${elId}: step ${steps + 1}`);

    // if the node is already focused, we're good
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
  // look to see if a focused element is in a preceding or following sibling
  for (const siblingType of [PREV_SIBLING, NEXT_SIBLING]) {
    let sibling = elNode[siblingType];
    while (sibling) {
      log.debug(`Examining next sibling: <${sibling.nodeName}>`);
      if (nodeIsFocused(sibling)) {
        const key = getRokuKeyForBoundsBasedMove(sibling, elNode, siblingType);
        log.info(`Found a ${siblingType} that is focused; pressing ${key}`);
        await this.roku_pressKey({key});
        return;
      }
      sibling = sibling[siblingType];
    }
  }

  // otherwise YOLO for now and press down, assuming that might get us into another branch of
  // possibilities. TODO make this part smarter
  log.info(`Couldn't find any focused siblings; pressing Down`);
  await this.roku_pressKey({key: 'Down'});
}

function getRokuKeyForBoundsBasedMove (fromNode, toNode, siblingType) {
  const [fromAttrs, toAttrs] = [fromNode, toNode].map(_nodeAttrsToMap);
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

  // if for whatever reason we couldn't determine bounds or the bounds were the same, just do
  // left/right based on whether we had a previous or next sibling. default to left/right here, but
  // maybe should have a setting whether it should default to up/down.
  if (siblingType === PREV_SIBLING) {
    return 'Right';
  }
  return 'Left';
}

function getPositionFromBounds (boundsStr) {
  const [x, y, , ] = boundsStr.replace(/[^0-9,]/g, '').split(','); // eslint-disable-line array-bracket-spacing
  return {x: parseInt(x, 10), y: parseInt(y, 10)};
}

function nodeIsFocused (n) {
  if (!n.attributes) {
    return false;
  }
  for (const attr of Object.values(n.attributes)) {
    log.debug(attr);
    if (attr.name === 'focused' && attr.value === 'true') {
      return true;
    }
  }
  return false;
}
