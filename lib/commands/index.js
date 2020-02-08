import rokuExts from './roku';
import actionExts from './actions';
import generalExts from './general';

const extensions = {};

Object.assign(
  extensions,
  rokuExts,
  actionExts,
  generalExts,
);

export default extensions;
