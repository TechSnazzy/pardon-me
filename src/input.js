// Keyboard (WASD/arrows), mouse (click-to-move, right-drag orbit, wheel zoom)
// and touch (left-side virtual stick, tap-to-move, right-side drag to orbit, hurry button).

export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.keys = new Set();
    this.clicks = [];
    this.yawDelta = 0;
    this.zoomDelta = 0;
    this.stick = { x: 0, y: 0, active: false, id: null, ox: 0, oy: 0 };
    this.touchHurry = false;
    this.handlers = {};
    this.lastClick = 0;
    this.enabled = false;
    this.usedTouch = false;
    this.ui = ui;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      this.keys.add(k);
      if (k === ' ' && this.enabled) this.jumpQueued = true;
      this.handlers.key?.(k, e);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    // ---- mouse ----
    let drag = null;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2 || e.button === 1) drag = { x: e.clientX };
      else if (e.button === 0) this._click(e.clientX, e.clientY);
    });
    addEventListener('mousemove', (e) => {
      if (drag) { this.yawDelta -= (e.clientX - drag.x) * 0.006; drag.x = e.clientX; }
    });
    addEventListener('mouseup', () => { drag = null; });
    canvas.addEventListener('wheel', (e) => { this.zoomDelta += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

    // ---- touch ----
    const touches = new Map();
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.usedTouch = true;
      this.handlers.touch?.();
      for (const t of e.changedTouches) {
        const left = t.clientX < innerWidth * 0.45;
        const rec = { sx: t.clientX, sy: t.clientY, x: t.clientX, y: t.clientY, t: performance.now(), moved: false, left };
        touches.set(t.identifier, rec);
        if (left && this.stick.id === null) {
          Object.assign(this.stick, { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0, active: false });
        }
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const rec = touches.get(t.identifier); if (!rec) continue;
        const dx = t.clientX - rec.x;
        rec.x = t.clientX; rec.y = t.clientY;
        if (Math.hypot(t.clientX - rec.sx, t.clientY - rec.sy) > 12) rec.moved = true;
        if (t.identifier === this.stick.id && rec.moved) {
          const R = 60;
          let sx = (t.clientX - this.stick.ox) / R, sy = -(t.clientY - this.stick.oy) / R;
          const m = Math.hypot(sx, sy); if (m > 1) { sx /= m; sy /= m; }
          this.stick.x = sx; this.stick.y = sy; this.stick.active = true;
          ui?.showStick(this.stick.ox, this.stick.oy, sx, sy);
        } else if (!rec.left && rec.moved) {
          this.yawDelta -= dx * 0.008;
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        const rec = touches.get(t.identifier); touches.delete(t.identifier);
        if (!rec) continue;
        if (t.identifier === this.stick.id) {
          this.stick.id = null; this.stick.active = false; this.stick.x = this.stick.y = 0; ui?.hideStick();
        }
        if (!rec.moved && performance.now() - rec.t < 350) this._click(rec.sx, rec.sy);
      }
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  }

  on(name, fn) { this.handlers[name] = fn; }

  _click(x, y) {
    if (!this.enabled) return;
    const now = performance.now();
    const double = now - this.lastClick < 320;
    this.lastClick = now;
    this.clicks.push({ x, y, double });
  }

  consumeClicks() { const c = this.clicks; this.clicks = []; return c; }

  // Movement intent relative to the camera: x = right, y = forward. Magnitude 0..1.
  move() {
    if (this.stick.active) return { x: this.stick.x, y: this.stick.y };
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('w') || k.has('arrowup')) y += 1;
    if (k.has('s') || k.has('arrowdown')) y -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    const m = Math.hypot(x, y);
    return m > 0 ? { x: x / m, y: y / m } : { x: 0, y: 0 };
  }

  get hurry() { return this.keys.has('shift') || this.touchHurry; }
  // Fortnite defaults: Space jumps, Shift sprints, Ctrl crouches. Ctrl+W closes the browser tab,
  // so the slow "crouch-walk" dawdle lives on C instead.
  get dawdle() { return this.keys.has('c'); }

  consumeJump() { const j = this.jumpQueued; this.jumpQueued = false; return j; }

  cameraKeys() {
    let r = 0;
    if (this.keys.has('q')) r += 1;
    if (this.keys.has('e')) r -= 1;
    return r;
  }

  consumeYaw() { const v = this.yawDelta; this.yawDelta = 0; return v; }
  consumeZoom() { const v = this.zoomDelta; this.zoomDelta = 0; return v; }
}
