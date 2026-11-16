// Keyboard + mouse, read once per frame. Movement is a thrust vector (WASD / arrows),
// the mouse aims the nose, holding click or Space fires. Enter/Space/click confirms on
// the title, win and game-over screens; P pauses, M mutes, R restarts from game over.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

export function createInput(canvas) {
  const keys = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;
  let actions = 0;

  function keyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    if (event.key === ' ' || event.key === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
    else if (event.key === 'm' || event.key === 'M') actions |= ACTION_MUTE;
    else if (event.key === 'r' || event.key === 'R') actions |= ACTION_RESTART;
  }
  function keyUp(event) {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  }
  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  }
  function pointerDown(event) {
    pointer(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointermove', pointer);
  canvas.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  /** Thrust vector, -1..1 on each axis, from WASD or the arrow keys. */
  function move() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) x += 1;
    if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  function firing() {
    return mouseDown || keys.has(' ');
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { move, firing, takeActions, mouse: () => ({ x: mouseX, y: mouseY, seen: mouseSeen }) };
}
