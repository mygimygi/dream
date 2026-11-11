// Unified input: keyboard + mouse, with a virtual layer the touch controls write into.
export type Action = 'attack' | 'jump' | 'roll' | 'guard' | 'interact' | 'tool' | 'run' | 'pause' | 'inventory' | 'map' | 'cycle' | 'mount';

const KEYMAP: Record<string, Action> = {
  KeyJ: 'attack', KeyK: 'roll', Space: 'jump', KeyL: 'guard', KeyE: 'interact', KeyF: 'interact', KeyQ: 'tool',
  ShiftLeft: 'run', ShiftRight: 'run', Escape: 'pause',  KeyP: 'pause', KeyI: 'inventory', Tab: 'inventory', KeyM: 'map',
  Enter: 'interact', KeyR: 'cycle', KeyG: 'mount',
};

export class Input {
  keys = new Set<string>();
  held = new Set<Action>();
  pressed = new Set<Action>();
  private queue = new Set<Action>();
  // virtual stick from touch (-1..1)
  stick = { x: 0, y: 0, active: false };
  touchHeld = new Set<Action>();
  // camera deltas accumulated this frame
  look = { dx: 0, dy: 0, zoom: 0 };
  mouseDown = false; mouseLeft = false;
  pointerLockWanted = false;
  usingTouch = false;

  constructor(private el: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) {
        const a = KEYMAP[e.code];
        if (a) this.queue.add(a);
      }
      this.keys.add(e.code);
      this.usingTouch = false;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.queue.add('attack'); this.mouseLeft = true; }
      if (e.button === 2) { this.mouseDown = true; }
      this.usingTouch = false;
    });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.mouseDown = false; if (e.button === 0) this.mouseLeft = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.mouseDown || document.pointerLockElement === el) { this.look.dx += e.movementX; this.look.dy += e.movementY; }
    });
    el.addEventListener('wheel', (e) => { this.look.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }
  press(a: Action) { this.queue.add(a); }
  /** call once per frame before gameplay update */
  poll() {
    this.pressed = this.queue; this.queue = new Set();
    this.held.clear();
    for (const k of this.keys) { const a = KEYMAP[k]; if (a) this.held.add(a); }
    this.touchHeld.forEach((a) => this.held.add(a));
    if (this.mouseLeft) this.held.add('attack');
  }
  endFrame() { this.look.dx = 0; this.look.dy = 0; this.look.zoom = 0; }
  move(): { x: number; y: number } {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (this.stick.active) { x = this.stick.x; y = this.stick.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  isDown(a: Action) { return this.held.has(a); }
  wasPressed(a: Action) { return this.pressed.has(a); }
  consume(a: Action) { this.pressed.delete(a); }
}
