import rokuExts from './roku';
import findExts from './find';
import actionExts from './actions';
import generalExts from './general';

const extensions = {};

Object.assign(
  extensions,
  rokuExts,
  findExts,
  actionExts,
  generalExts,
);

export default extensions;
