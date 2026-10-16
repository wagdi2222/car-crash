// لوحة المفاتيح + التحكم باللمس (أزرار، عصا توجيه، إيماءات، إمالة)
import { localStorageGet, localStorageSet } from './audio.js';

export const CONTROL_TIPS = {
  buttons: 'أزرار ◀ ▶ للتوجيه، وأزرار للانجراف والسلاح والفرامل.',
  stick: 'المس يسار الشاشة في أي مكان واسحب للتوجيه، واسحب للأسفل للفرامل.',
  gesture: 'اسحب إصبعك يميناً ويساراً للتوجيه. ضع إصبعاً ثانياً للانجراف، واسحب بسرعة للأعلى لإطلاق السلاح (أو للأسفل للخلف).',
  tilt: 'أمِل الجوال يميناً ويساراً للتوجيه كأنه مقود.',
};
const MODES = Object.keys(CONTROL_TIPS);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* غير مدعوم */ } };

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, drift: false, fire: false };
    this.prevDrift = false;
    this.firePressed = false;
    this.fireBack = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const saved = localStorageGet('rimal-ctl');
    this.mode = MODES.includes(saved) ? saved : 'buttons';
    // حالة التوجيه التناظري (عصا/إيماءات/إمالة)
    this.analog = 0;
    this.analogBrake = false;
    this.gDrift = false;
    this.ptr = new Map(); // معرف اللمسة -> بيانات
    this.tilt = 0;
    this.tiltSeen = false;

    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat && ['KeyF', 'Enter', 'KeyX', 'ControlLeft', 'ControlRight'].includes(e.code)) this.firePressed = true;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.resetTouch(); });
    this.bindButtons();
    this.bindZone();
    addEventListener('deviceorientation', (e) => this.onTilt(e));
    this.applyMode();
  }

  setMode(m) {
    if (!MODES.includes(m)) return;
    this.mode = m;
    localStorageSet('rimal-ctl', m);
    this.resetTouch();
    this.applyMode();
    // iOS يطلب إذناً لمستشعر الحركة، ويجب أن يُطلب من ضغطة المستخدم
    if (m === 'tilt' && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  }

  applyMode() {
    const el = document.getElementById('touch');
    if (el) el.dataset.mode = this.mode;
  }

  resetTouch() {
    for (const k in this.touch) this.touch[k] = false;
    this.analog = 0; this.analogBrake = false; this.gDrift = false;
    this.ptr.clear();
    this.showStick(false);
    document.querySelectorAll('.tbtn.on').forEach((b) => b.classList.remove('on'));
  }

  bindButtons() {
    const map = { 'tc-left': 'left', 'tc-right': 'right', 'tc-brake': 'brake', 'tc-drift': 'drift', 'tc-fire': 'fire' };
    for (const id in map) {
      const el = document.getElementById(id);
      if (!el) continue;
      const k = map[id];
      const on = (e) => { e.preventDefault(); e.stopPropagation(); this.touch[k] = true; if (k === 'fire') this.firePressed = true; el.classList.add('on'); };
      const off = (e) => { e.preventDefault(); e.stopPropagation(); this.touch[k] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', (e) => { capture(el, e); on(e); });
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  // منطقة اللمس الكبيرة لعصا التوجيه والإيماءات
  bindZone() {
    const z = document.getElementById('tc-zone');
    if (!z) return;
    this.stickEl = document.getElementById('tc-stick');
    this.knobEl = this.stickEl && this.stickEl.firstElementChild;
    z.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(z, e);
      const now = performance.now();
      const p = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, hist: [[now, e.clientX, e.clientY]], role: null };
      if (this.mode === 'stick') {
        if ([...this.ptr.values()].some((q) => q.role === 'stick')) return;
        p.role = 'stick';
        this.showStick(true, e.clientX, e.clientY);
      } else if (this.mode === 'gesture') {
        const hasSteer = [...this.ptr.values()].some((q) => q.role === 'steer');
        p.role = hasSteer ? 'drift' : 'steer';
        if (p.role === 'drift') this.gDrift = true;
      } else return;
      this.ptr.set(e.pointerId, p);
    });
    z.addEventListener('pointermove', (e) => {
      const p = this.ptr.get(e.pointerId);
      if (!p) return;
      e.preventDefault();
      p.x = e.clientX; p.y = e.clientY;
      const now = performance.now();
      p.hist.push([now, p.x, p.y]);
      while (p.hist.length > 2 && now - p.hist[0][0] > 160) p.hist.shift();
      const dx = p.x - p.x0, dy = p.y - p.y0;
      if (p.role === 'stick') {
        const R = 60;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, R / d);
        if (this.knobEl) this.knobEl.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        this.analog = clamp(-dx / 50, -1, 1);
        this.analogBrake = dy > 42;
      } else if (p.role === 'steer') {
        this.analog = clamp(-dx / 70, -1, 1);
        // سحبة سريعة عمودية = إطلاق السلاح
        const [t0, , y0] = p.hist[0];
        const vy = (p.y - y0) / Math.max(1, now - t0);
        if (!p.flicked && Math.abs(vy) > 1.1 && Math.abs(p.y - y0) > 45) {
          p.flicked = true;
          this.firePressed = true;
          this.fireBack = vy > 0;
        }
        if (p.flicked && Math.abs(vy) < 0.3) { p.flicked = false; }
      }
    });
    const end = (e) => {
      const p = this.ptr.get(e.pointerId);
      if (!p) return;
      this.ptr.delete(e.pointerId);
      if (p.role === 'stick') { this.analog = 0; this.analogBrake = false; this.showStick(false); }
      if (p.role === 'steer') {
        this.analog = 0;
        // إذا رُفع إصبع التوجيه وبقي إصبع الانجراف، يصبح هو إصبع التوجيه
        for (const q of this.ptr.values()) if (q.role === 'drift') { q.role = 'steer'; q.x0 = q.x; this.gDrift = false; break; }
      }
      if (p.role === 'drift') this.gDrift = [...this.ptr.values()].some((q) => q.role === 'drift');
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
    z.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  showStick(on, x, y) {
    if (!this.stickEl) return;
    this.stickEl.classList.toggle('show', on);
    if (on) { this.stickEl.style.left = x + 'px'; this.stickEl.style.top = y + 'px'; }
    if (this.knobEl) this.knobEl.style.transform = 'translate(0,0)';
  }

  onTilt(e) {
    if (e.gamma == null) return;
    this.tiltSeen = true;
    const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    // في الوضع الأفقي نستخدم beta، وفي العمودي gamma
    let t;
    if (ang === 90) t = e.beta;
    else if (ang === -90 || ang === 270) t = -e.beta;
    else t = e.gamma;
    this.tilt = t || 0;
  }

  read() {
    const k = this.keys, t = this.touch;
    const left = k.has('ArrowLeft') || k.has('KeyA') || t.left;
    const right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    let steer = (left ? 1 : 0) - (right ? 1 : 0);
    if (this.isTouch && steer === 0) {
      if (this.mode === 'stick' || this.mode === 'gesture') steer = this.analog;
      else if (this.mode === 'tilt') {
        const v = this.tilt;
        steer = Math.abs(v) < 3 ? 0 : clamp(-(v - Math.sign(v) * 3) / 22, -1, 1);
      }
    }
    const down = k.has('ArrowDown') || k.has('KeyS') || t.brake || this.analogBrake;
    const up = k.has('ArrowUp') || k.has('KeyW') || t.gas || (this.isTouch && !down);
    const drift = k.has('Space') || k.has('ShiftLeft') || k.has('ShiftRight') || t.drift || this.gDrift;
    const driftPressed = drift && !this.prevDrift;
    this.prevDrift = drift;
    const fire = this.firePressed;
    const back = down || (fire && this.fireBack);
    this.firePressed = false;
    if (fire) this.fireBack = false;
    return { up, down, steer, drift, driftPressed, fire, back };
  }
}
