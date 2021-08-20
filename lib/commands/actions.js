export async function performActions (actions) {
  const action = actions[0]; // just get first action, all we do is tap
  const [move, down, pause, up] = action.actions;
  if (move?.type !== 'pointerMove' ||
      down?.type !== 'pointerDown' ||
      pause?.type !== 'pause' ||
      up?.type !== 'pointerUp') {
    throw new Error('Did not get correct action type for simple tap');
  }

  let {x, y} = move;
  // appium's origin is top left, but roku's origin is bottom left, so need to
  // invert the y-coordinate
  y = (await this.getWindowSize()).height - y;
  //x = x * 2;
  //y = y * 2;

  await this.rokuEcp(`/input?` +
                     `touch.0.x=${parseInt(x, 10)}.0&` +
                     `touch.0.y=${parseInt(y, 10)}.0&` +
                     `touch.0.op=press`);
}
