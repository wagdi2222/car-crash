// لوحة المفاتيح + أزرار اللمس للجوال
export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, drift: false, fire: false };
    this.prevDrift = false;
    this.firePressed = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat && ['KeyF', 'Enter', 'KeyX', 'ControlLeft', 'ControlRight'].includes(e.code)) this.firePressed = true;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.bindTouch();
  }

  bindTouch() {
    const map = { 'tc-left': 'left', 'tc-right': 'right', 'tc-gas': 'gas', 'tc-brake': 'brake', 'tc-drift': 'drift', 'tc-fire': 'fire' };
    for (const id in map) {
      const el = document.getElementById(id);
      if (!el) continue;
      const k = map[id];
      const on = (e) => { e.preventDefault(); this.touch[k] = true; if (k === 'fire') this.firePressed = true; el.classList.add('on'); };
      const off = (e) => { e.preventDefault(); this.touch[k] = false; el.classList.remove('on'); };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('touchcancel', off, { passive: false });
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
    }
  }

  read() {
    const k = this.keys, t = this.touch;
    const left = k.has('ArrowLeft') || k.has('KeyA') || t.left;
    const right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    const down = k.has('ArrowDown') || k.has('KeyS') || t.brake;
    const up = k.has('ArrowUp') || k.has('KeyW') || t.gas || (this.isTouch && !down);
    const drift = k.has('Space') || k.has('ShiftLeft') || k.has('ShiftRight') || t.drift;
    const driftPressed = drift && !this.prevDrift;
    this.prevDrift = drift;
    const fire = this.firePressed;
    this.firePressed = false;
    return { up, down, steer: (left ? 1 : 0) - (right ? 1 : 0), drift, driftPressed, fire, back: down };
  }
}
