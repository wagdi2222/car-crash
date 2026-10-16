// عناصر الديكور المشتركة بين الحلبات
import * as THREE from '../lib/three.module.min.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

// نجمة ثمانية (نقش إسلامي)
export function star8(g, cx, cy, r, fill, stroke) {
  g.save();
  g.translate(cx, cy);
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.62;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = r * 0.12; g.stroke(); }
  g.restore();
}

export function textTexture(text, opts = {}) {
  const w = opts.w || 1024, h = opts.h || 256;
  return canvasTex(w, h, (g) => {
    g.fillStyle = opts.bg || '#7a1f1f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = opts.border || '#f2c14e';
    g.lineWidth = 14;
    g.strokeRect(10, 10, w - 20, h - 20);
    for (let x = 60; x < w; x += 140) star8(g, x, h / 2, 26, null, opts.border || '#f2c14e');
    g.fillStyle = opts.color || '#ffe8a3';
    g.font = `bold ${opts.size || 130}px Lalezar, "Reem Kufi", Cairo, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = 12;
    g.fillText(text, w / 2, h / 2 + 8);
  });
}

// تحرير ذاكرة مجموعة كاملة عند تغيير الحلبة
export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].dispose();
      m.dispose();
    }
  });
}

const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

export class Builder {
  constructor(group, r) {
    this.g = group; this.r = r;
    this.m = {
      trunk: L(0x8a5a2b), leaf: L(0x3f8f3a, { side: THREE.DoubleSide }), date: L(0xb5651d),
      wall: L(0xf1e2c4), wall2: L(0xd8b98a), door: L(0x5a2d0c),
      teal: L(0x1aa39a), gold: L(0xf2c14e, { emissive: 0x3a2500 }), blue: L(0x2e5aa8),
      camel: L(0xc08a4f), rug: L(0xb02e2e), pole: L(0x3b2a1a),
      lamp: new THREE.MeshBasicMaterial({ color: 0xffc85a }), cap: L(0xc9962c),
      rock: L(0xa8683a, { flatShading: true }), dark: L(0x222222), white: L(0xffffff),
    };
    const lg = new THREE.PlaneGeometry(1.6, 7, 1, 4);
    const a = lg.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const y = a.getY(i) + 3.5;
      a.setX(i, a.getX(i) * Math.sin((y / 7) * Math.PI) * 1.2);
      a.setZ(i, -(y * y) * 0.06);
      a.setY(i, y);
    }
    lg.computeVertexNormals();
    this.leafGeo = lg;
  }

  add(o, x, z, rotY) {
    o.position.set(x, o.position.y, z);
    if (rotY !== undefined) o.rotation.y = rotY;
    this.g.add(o);
    return o;
  }

  palm(x, z, h = 9, leafMat) {
    const r = this.r, g = new THREE.Group();
    const segs = 6, lean = (r() - 0.5) * 0.3;
    for (let k = 0; k < segs; k++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.45 - k * 0.03, 0.55 - k * 0.03, h / segs, 7), this.m.trunk);
      s.position.set(Math.sin(lean) * k * h / segs * 0.5, (k + 0.5) * h / segs, 0);
      g.add(s);
    }
    const top = new THREE.Group();
    top.position.set(Math.sin(lean) * h * 0.5, h, 0);
    for (let k = 0; k < 8; k++) {
      const l = new THREE.Mesh(this.leafGeo, leafMat || this.m.leaf);
      l.rotation.set(-0.6 - r() * 0.4, (k / 8) * Math.PI * 2, 0, 'YXZ');
      top.add(l);
    }
    for (let k = 0; k < 4; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), this.m.date);
      d.position.set(Math.cos(k * 1.6) * 0.5, -0.4, Math.sin(k * 1.6) * 0.5);
      top.add(d);
    }
    g.add(top);
    return this.add(g, x, z, r() * Math.PI * 2);
  }

  house(x, z, opts = {}) {
    const r = this.r, g = new THREE.Group();
    const w = opts.w || 8 + r() * 8, d = opts.d || 8 + r() * 8, h = opts.h || 5 + r() * 6;
    const wm = opts.mat || (r() > 0.5 ? this.m.wall : this.m.wall2);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wm);
    b.position.y = h / 2; g.add(b);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.2, 0.3), this.m.door);
    door.position.set(0, 1.6, d / 2); g.add(door);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 12, 1, false, 0, Math.PI), this.m.door);
    arch.rotation.set(Math.PI / 2, 0, Math.PI / 2); arch.position.set(0, 3.2, d / 2); g.add(arch);
    if (opts.windows) {
      // مشربيات خشبية
      const mm = opts.windowMat || this.m.door;
      for (let y = 5; y < h - 1.5; y += 4) {
        for (const s of [-1, 1]) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.8), mm);
          win.position.set(s * w * 0.27, y, d / 2 + 0.3); g.add(win);
        }
      }
    }
    if (opts.dome !== false && r() > 0.35) {
      const dr = Math.min(w, d) * 0.38;
      const dm = [this.m.teal, this.m.gold, this.m.blue][Math.floor(r() * 3)];
      const dome = new THREE.Mesh(new THREE.SphereGeometry(dr, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), dm);
      dome.position.y = h; dome.scale.y = 1.25; g.add(dome);
    }
    return this.add(g, x, z, opts.rot !== undefined ? opts.rot : r() * Math.PI * 2);
  }

  minaret(x, z, h) {
    const r = this.r, g = new THREE.Group();
    h = h || 24 + r() * 10;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, h, 10), this.m.wall); t.position.y = h / 2; g.add(t);
    const bal = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.4, 1, 10), this.m.teal); bal.position.y = h * 0.72; g.add(bal);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 4, 10), this.m.wall); top.position.y = h + 2; g.add(top);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 10), this.m.gold); cone.position.y = h + 6.5; g.add(cone);
    const cres = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.18, 6, 16, Math.PI * 1.4), this.m.gold);
    cres.position.y = h + 10; cres.rotation.z = Math.PI * 0.3; g.add(cres);
    return this.add(g, x, z);
  }

  mosque(x, z, rot = 0) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 30), this.m.wall); b.position.y = 6; g.add(b);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 4, 20), this.m.wall); drum.position.y = 14; g.add(drum);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.m.gold);
    dome.position.y = 16; dome.scale.y = 1.3; g.add(dome);
    this.g.add(g);
    g.position.set(x, 0, z); g.rotation.y = rot;
    for (const [dx, dz] of [[-16, -16], [16, 16]]) {
      const c = Math.cos(rot), s = Math.sin(rot);
      this.minaret(x + dx * c + dz * s, z - dx * s + dz * c, 38);
    }
    return g;
  }

  camel(x, z) {
    const g = new THREE.Group(), m = this.m.camel;
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), m); body.scale.set(1.1, 0.9, 2); body.position.y = 3.2; g.add(body);
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), m); hump.position.set(0, 4, 0); hump.scale.y = 1.1; g.add(hump);
    const rug = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 1.6), this.m.rug); rug.position.set(0, 3.95, 0.9); g.add(rug);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.4, 8), m); neck.position.set(0, 4.1, 2.2); neck.rotation.x = 0.6; g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.3), m); head.position.set(0, 5.2, 2.9); g.add(head);
    for (const [lx, lz] of [[-0.5, 1.2], [0.5, 1.2], [-0.5, -1.2], [0.5, -1.2]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 2.6, 6), m); leg.position.set(lx, 1.3, lz); g.add(leg);
    }
    return this.add(g, x, z, this.r() * Math.PI * 2);
  }

  lantern(x, z, h = 5) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 6), this.m.pole); pole.position.y = h / 2; g.add(pole);
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), this.m.lamp); lamp.position.y = h + 0.5; lamp.scale.y = 1.4; g.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 8), this.m.cap); cap.position.y = h + 1.6; g.add(cap);
    return this.add(g, x, z);
  }

  rock(x, z, size, mat) {
    const r = this.r;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(size || 1.5 + r() * 3, 0), mat || this.m.rock);
    m.position.y = 0.5; m.scale.y = 0.6 + r() * 0.6; m.rotation.set(r(), r(), r());
    return this.add(m, x, z);
  }

  // كتلة صخرية مسطحة القمة (وادي رم)
  mesa(x, z, rad, h, mat) {
    const r = this.r, g = new THREE.Group();
    const layers = 3;
    for (let k = 0; k < layers; k++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * (0.85 - k * 0.12), rad * (1 - k * 0.1), h / layers, 7 + k, 1), mat);
      m.position.y = h / layers * (k + 0.5);
      m.rotation.y = r() * 3;
      m.scale.x = 0.8 + r() * 0.5;
      g.add(m);
    }
    return this.add(g, x, z, r() * Math.PI);
  }

  tent(x, z) {
    const g = new THREE.Group();
    const cloth = L(0x2b2420, { side: THREE.DoubleSide });
    const geo = new THREE.CylinderGeometry(0.01, 5, 3.5, 4, 1, true);
    const t = new THREE.Mesh(geo, cloth); t.scale.set(1.6, 1, 1); t.position.y = 1.75; t.rotation.y = Math.PI / 4; g.add(t);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), L(0xb02e2e)); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.05, 5); g.add(rug);
    return this.add(g, x, z, this.r() * Math.PI * 2);
  }

  acacia(x, z) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 4, 6), this.m.trunk); t.position.y = 2; t.rotation.z = 0.15; g.add(t);
    const c = new THREE.Mesh(new THREE.SphereGeometry(3.5, 10, 6), L(0x6b7d2a, { flatShading: true })); c.scale.y = 0.3; c.position.y = 4.3; g.add(c);
    return this.add(g, x, z, this.r() * 6);
  }

  stall(x, z, rot) {
    const r = this.r, g = new THREE.Group();
    const cols = [0xd62828, 0x1aa39a, 0xf2c14e, 0x7b2cbf, 0xf77f00];
    const table = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 2.5), this.m.door); table.position.y = 0.6; g.add(table);
    const aw = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.15, 3.2), L(cols[Math.floor(r() * cols.length)]));
    aw.position.set(0, 3.6, 0.3); aw.rotation.x = 0.2; g.add(aw);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 5), this.m.pole); p.position.set(s * 2.6, 1.8, 1.5); g.add(p);
    }
    for (let k = 0; k < 4; k++) {
      const jar = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), L(cols[Math.floor(r() * cols.length)]));
      jar.position.set(-1.8 + k * 1.2, 1.5, 0); g.add(jar);
    }
    return this.add(g, x, z, rot);
  }

  dhow(x, z, rot) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.2, 12, 8, 1, false, 0, Math.PI), L(0x7a4a22, { side: THREE.DoubleSide }));
    // نصف أسطوانة مقلوبة: محورها على x وجانبها المفتوح للأعلى
    hull.rotation.set(0, 0, -Math.PI / 2);
    hull.position.y = 1.2;
    g.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 11, 6), this.m.pole); mast.position.set(0, 6, 0); g.add(mast);
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([1, 11, 0, -5, 2.5, 0, 5, 3, 0], 3));
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, L(0xfff3d6, { side: THREE.DoubleSide })); g.add(sail);
    return this.add(g, x, z, rot);
  }

  tower(x, z, h, w, mat) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat); b.position.y = h / 2; g.add(b);
    return this.add(g, x, z, this.r() * 3);
  }

  // برج حلزوني متدرج يشبه أبراج الخليج الشاهقة
  spire(x, z, mat) {
    const g = new THREE.Group();
    let y = 0;
    for (let k = 0; k < 7; k++) {
      const h = 40 - k * 3, rad = 14 - k * 1.8;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.85, rad, h, 6), mat); m.position.y = y + h / 2; g.add(m);
      y += h;
    }
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 60, 6), mat); tip.position.y = y + 30; g.add(tip);
    return this.add(g, x, z);
  }

  // برج على شكل شراع
  sailTower(x, z, mat) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.quadraticCurveTo(38, 90, 0, 180); shape.lineTo(-6, 180); shape.lineTo(-6, 0); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 22, bevelEnabled: false });
    geo.translate(0, 0, -11);
    g.add(new THREE.Mesh(geo, mat));
    return this.add(g, x, z, this.r() * 6);
  }

  lighthouse(x, z) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - k * 0.3, 3 - k * 0.3, 6, 12), k % 2 ? this.m.white : L(0xd62828));
      s.position.y = 3 + k * 6; g.add(s);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), this.m.lamp); lamp.position.y = 32; g.add(lamp);
    return this.add(g, x, z);
  }

  umbrella(x, z) {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 5), this.m.white); p.position.y = 1.5; g.add(p);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 10), L(this.r() > 0.5 ? 0xd62828 : 0x1aa39a)); top.position.y = 3.2; g.add(top);
    return this.add(g, x, z);
  }

  // سلسلة فوانيس معلّقة فوق الطريق
  stringLights(a, b, h = 9) {
    const n = 14;
    const mats = [new THREE.MeshBasicMaterial({ color: 0xffc85a }), new THREE.MeshBasicMaterial({ color: 0xff6b4a }), new THREE.MeshBasicMaterial({ color: 0x7ff7e8 })];
    const geo = new THREE.OctahedronGeometry(0.4, 0);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const m = new THREE.Mesh(geo, mats[k % 3]);
      m.position.set(a.x + (b.x - a.x) * t, h - Math.sin(t * Math.PI) * 2.2, a.z + (b.z - a.z) * t);
      m.scale.y = 1.5;
      this.g.add(m);
    }
    for (const p of [a, b]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, h, 6), this.m.pole);
      pole.position.set(p.x, h / 2, p.z); this.g.add(pole);
    }
  }
}
