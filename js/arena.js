// ساحات المعركة: مساحات واسعة بممرات وأسوار وعوائق ومنحدرات قفز
import * as THREE from '../lib/three.module.min.js';
import { rng, canvasTex, star8, textTexture, Builder } from './scenery.js';
import { buildEnvironment, padTexture, rampGeometry, rampTexture } from './track.js';

const KR = 1.4; // نصف قطر السيارة للتصادم
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

export class Arena {
  constructor(scene, course) {
    this.kind = 'arena';
    this.course = course;
    this.theme = course.theme;
    this.shape = course.shape;
    this.R = course.R || 0;
    this.hw = course.hw || this.R;
    this.hd = course.hd || this.R;
    // العوائق: دوائر، مستطيلات محاذية للمحاور، وجدران (قطع مستقيمة)
    this.circles = []; this.rects = []; this.segs = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    const seed = course.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    this.env = buildEnvironment(this.group, scene, this.theme, seed);
    this.b = new Builder(this.group, rng(seed + 1));
    this.r = rng(seed + 2);
    this.boxSpots = []; this.padSpots = []; this.jumpSpots = [];
    this.padMat = new THREE.MeshBasicMaterial({ map: padTexture() });
    this.rampGeo = rampGeometry(10, 6, 1.4);
    this.rampMat = new THREE.MeshLambertMaterial({ map: rampTexture() });
    LAYOUTS[course.layout](this);
    this.autoBoxes();
    this.mapBounds = { minX: -this.hw, maxX: this.hw, minZ: -this.hd, maxZ: this.hd };
  }

  // ---------- تسجيل العوائق ----------
  circle(x, z, r) { this.circles.push({ x, z, r }); }
  rect(x, z, hw, hd) { this.rects.push({ x, z, hw, hd }); }
  seg(ax, az, bx, bz, r) { this.segs.push({ ax, az, bx, bz, r }); }

  inside(x, z, m = 0) {
    if (this.shape === 'circle') return Math.hypot(x, z) < this.R - m;
    return Math.abs(x) < this.hw - m && Math.abs(z) < this.hd - m;
  }

  solidAt(x, z, m = 0) {
    if (!this.inside(x, z, m)) return true;
    for (const c of this.circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + m) ** 2) return true;
    for (const q of this.rects) if (Math.abs(x - q.x) < q.hw + m && Math.abs(z - q.z) < q.hd + m) return true;
    for (const s of this.segs) if (segDist(x, z, s) < s.r + m) return true;
    return false;
  }

  surface() { return { i: 0, offroad: false }; }

  // ارتداد عن الجدار: n = الاتجاه من الساحة نحو العائق
  reflect(k, nx, nz) {
    const fx = Math.sin(k.heading) * k.speed, fz = Math.cos(k.heading) * k.speed;
    const d = fx * nx + fz * nz;
    if (d <= 0) return;
    const vx = fx - 2 * d * nx, vz = fz - 2 * d * nz;
    const sp = Math.hypot(vx, vz) * 0.55;
    if (k.speed >= 0) { k.heading = Math.atan2(vx, vz); k.speed = sp; } else { k.heading = Math.atan2(-vx, -vz); k.speed = -sp; }
    k.drifting = false;
  }

  bound(k) {
    let wall = false;
    const p = k.pos;
    const hit = (px, pz, nx, nz) => { p.x = px; p.z = pz; this.reflect(k, nx, nz); wall = true; };
    if (this.shape === 'circle') {
      const lim = this.R - 1.6, d = Math.hypot(p.x, p.z);
      if (d > lim) hit(p.x / d * lim, p.z / d * lim, p.x / d, p.z / d);
    } else {
      const lx = this.hw - 1.6, lz = this.hd - 1.6;
      if (p.x > lx) hit(lx, p.z, 1, 0); else if (p.x < -lx) hit(-lx, p.z, -1, 0);
      if (p.z > lz) hit(p.x, lz, 0, 1); else if (p.z < -lz) hit(p.x, -lz, 0, -1);
    }
    for (const c of this.circles) {
      const dx = p.x - c.x, dz = p.z - c.z, dd = Math.hypot(dx, dz), min = c.r + KR;
      if (dd < min && dd > 1e-4) hit(c.x + dx / dd * min, c.z + dz / dd * min, -dx / dd, -dz / dd);
    }
    for (const q of this.rects) {
      const cx = Math.max(q.x - q.hw, Math.min(p.x, q.x + q.hw)), cz = Math.max(q.z - q.hd, Math.min(p.z, q.z + q.hd));
      let dx = p.x - cx, dz = p.z - cz, dd = Math.hypot(dx, dz);
      if (dd < KR) {
        if (dd < 1e-4) {
          // داخل المستطيل: ادفع عبر أقرب حافة
          const ex = q.hw - Math.abs(p.x - q.x), ez = q.hd - Math.abs(p.z - q.z);
          if (ex < ez) { dx = Math.sign(p.x - q.x) || 1; dz = 0; } else { dz = Math.sign(p.z - q.z) || 1; dx = 0; }
          hit(dx ? q.x + dx * (q.hw + KR) : p.x, dz ? q.z + dz * (q.hd + KR) : p.z, -dx, -dz);
        } else hit(cx + dx / dd * KR, cz + dz / dd * KR, -dx / dd, -dz / dd);
      }
    }
    for (const s of this.segs) {
      const [cx, cz] = segClosest(p.x, p.z, s);
      const dx = p.x - cx, dz = p.z - cz, dd = Math.hypot(dx, dz), min = s.r + KR;
      if (dd < min && dd > 1e-4) hit(cx + dx / dd * min, cz + dz / dd * min, -dx / dd, -dz / dd);
    }
    return { i: 0, wall };
  }

  blocked(pos) { return this.solidAt(pos.x, pos.z, 0.3); }

  spawn(slot, total) {
    const n = Math.max(2, total);
    const a = (slot / n) * Math.PI * 2 + 0.3;
    for (let f = 0.82; f > 0.1; f -= 0.04) {
      const x = Math.cos(a) * this.hw * f, z = Math.sin(a) * this.hd * f;
      if (!this.solidAt(x, z, 5)) return { x, z, h: this.openHeading(x, z), i: 0 };
    }
    return { x: 0, z: 0, h: 0, i: 0 };
  }

  // أوسع اتجاه مفتوح من نقطة (مع تفضيل التوجه نحو الوسط)
  openHeading(x, z) {
    const toC = Math.atan2(-x, -z);
    let best = toC, bs = -Infinity;
    for (let k = 0; k < 24; k++) {
      const ang = k / 24 * Math.PI * 2;
      let d = 4;
      while (d < 90 && !this.solidAt(x + Math.sin(ang) * d, z + Math.cos(ang) * d, 2.5)) d += 4;
      const score = d + 25 * Math.cos(ang - toC);
      if (score > bs) { bs = score; best = ang; }
    }
    return best;
  }

  // صناديق ؟ موزعة على شبكة في الأماكن الفارغة
  autoBoxes() {
    const pts = [];
    const step = 26;
    for (let x = -this.hw + 18; x < this.hw - 18; x += step) {
      for (let z = -this.hd + 18; z < this.hd - 18; z += step) {
        const jx = x + (this.r() - 0.5) * 8, jz = z + (this.r() - 0.5) * 8;
        if (!this.solidAt(jx, jz, 5)) pts.push([jx, jz]);
      }
    }
    // اختيار متباعد: كل صندوق يبعد ٤٠ وحدة على الأقل عن غيره
    const chosen = [];
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    for (const p of pts) {
      if (chosen.length >= 30) break;
      if (chosen.every((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) > 40)) chosen.push(p);
    }
    // صناديق متجاورة (صف من ثلاثة) في بعض النقاط مثل كراش
    for (const [x, z] of chosen) {
      this.boxSpots.push(new THREE.Vector3(x, 1.4, z));
      if (this.r() < 0.3 && !this.solidAt(x + 4, z, 3) && !this.solidAt(x - 4, z, 3)) {
        this.boxSpots.push(new THREE.Vector3(x + 4, 1.4, z), new THREE.Vector3(x - 4, 1.4, z));
      }
    }
  }

  pad(x, z, rot) {
    const holder = new THREE.Group();
    holder.position.set(x, 0.12, z);
    holder.rotation.y = rot;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), this.padMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI;
    holder.add(m);
    this.group.add(holder);
    this.padSpots.push({ x, z });
  }

  jump(x, z, rot) {
    const m = new THREE.Mesh(this.rampGeo, this.rampMat);
    m.position.set(x, 0.02, z);
    m.rotation.y = rot;
    this.group.add(m);
    this.jumpSpots.push({ x, z, tx: Math.sin(rot), tz: Math.cos(rot), hw: 6, hl: 3 });
  }

  floor(tex, rep) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rep, rep);
    const geo = this.shape === 'circle' ? new THREE.CircleGeometry(this.R + 2, 96) : new THREE.PlaneGeometry(this.hw * 2 + 4, this.hd * 2 + 4);
    // نسخ إحداثيات UV بحيث يتكرر النسيج بشكل متساوٍ
    const f = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
    f.rotation.x = -Math.PI / 2; f.position.y = 0.02;
    this.group.add(f);
    return f;
  }

  // ---------- الخريطة المصغرة ----------
  drawMap(g, T, s) {
    g.fillStyle = 'rgba(242,216,167,.55)'; g.strokeStyle = 'rgba(40,20,5,.75)'; g.lineWidth = 3;
    g.beginPath();
    if (this.shape === 'circle') { const [cx, cy] = T(0, 0); g.arc(cx, cy, this.R * s, 0, Math.PI * 2); }
    else { const [x0, y0] = T(this.hw, -this.hd); g.rect(x0, y0, this.hw * 2 * s, this.hd * 2 * s); }
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(60,35,15,.85)';
    for (const c of this.circles) { const [x, y] = T(c.x, c.z); g.beginPath(); g.arc(x, y, Math.max(1.5, c.r * s), 0, Math.PI * 2); g.fill(); }
    for (const q of this.rects) { const [x, y] = T(q.x + q.hw, q.z - q.hd); g.fillRect(x, y, q.hw * 2 * s, q.hd * 2 * s); }
    g.strokeStyle = 'rgba(60,35,15,.85)'; g.lineCap = 'round';
    for (const q of this.segs) { const [x1, y1] = T(q.ax, q.az), [x2, y2] = T(q.bx, q.bz); g.lineWidth = Math.max(2, q.r * 2 * s); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    g.fillStyle = '#5ce1e6';
    for (const j of this.jumpSpots) { const [x, y] = T(j.x, j.z); g.fillRect(x - 2, y - 2, 4, 4); }
  }
}

function segClosest(x, z, s) {
  const vx = s.bx - s.ax, vz = s.bz - s.az;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * vx + (z - s.az) * vz) / (vx * vx + vz * vz)));
  return [s.ax + vx * t, s.az + vz * t];
}
function segDist(x, z, s) { const [cx, cz] = segClosest(x, z, s); return Math.hypot(x - cx, z - cz); }

// جدار مرئي على قطعة مستقيمة
function wallMesh(a, ax, az, bx, bz, thick, h, mat) {
  const len = Math.hypot(bx - ax, bz - az);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thick, h, len), mat);
  m.position.set((ax + bx) / 2, h / 2, (az + bz) / 2);
  m.rotation.y = Math.atan2(bx - ax, bz - az);
  a.group.add(m);
  a.seg(ax, az, bx, bz, thick / 2);
  return m;
}

function stoneTex(base, line, size = 48) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = rng(9);
    g.strokeStyle = line; g.lineWidth = 3;
    for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) {
      g.fillStyle = r() > 0.5 ? 'rgba(255,240,210,0.08)' : 'rgba(90,60,30,0.08)';
      g.fillRect(x, y, size, size); g.strokeRect(x, y, size, size);
    }
  });
}

function sandTex(base) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 4000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,245,210,0.18)' : 'rgba(120,80,30,0.12)'; g.fillRect(r() * w, r() * h, 3, 2); }
  });
}

// ---------- المخططات ----------
const LAYOUTS = {
  // ساحة القلعة: سور خارجي، حلقة أسوار داخلية ببوابات، نافورة، أبراج وأعمدة
  fort(a) {
    const R = a.R, b = a.b;
    a.floor(stoneTex('#c9a77a', 'rgba(80,50,25,0.35)'), R / 12);
    // نقش نجمي في الوسط
    const deco = new THREE.Mesh(new THREE.CircleGeometry(48, 64), new THREE.MeshLambertMaterial({
      map: canvasTex(512, 512, (g, w, h) => {
        g.fillStyle = '#d8b88a'; g.fillRect(0, 0, w, h);
        g.lineWidth = 8;
        for (let k = 0; k < 4; k++) star8(g, w / 2, h / 2, 240 - k * 55, null, k % 2 ? '#1aa39a' : '#8a5a2b');
      }), transparent: true,
    }));
    deco.rotation.x = -Math.PI / 2; deco.position.y = 0.04; a.group.add(deco);
    const stone = L(0xb9935f), teal = b.m.teal, wallM = L(0xc9a273);
    // السور الخارجي
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(R + 1, R + 1, 12, 96, 1, true), L(0xb9935f, { side: THREE.DoubleSide }));
    outer.position.y = 6; a.group.add(outer);
    const cren = new THREE.BoxGeometry(3, 2.2, 2);
    for (let k = 0; k < 120; k++) { const t = k / 120 * Math.PI * 2; const m = new THREE.Mesh(cren, stone); m.position.set(Math.cos(t) * (R + 1), 13, Math.sin(t) * (R + 1)); m.rotation.y = -t; a.group.add(m); }
    for (let k = 0; k < 8; k++) {
      const t = k / 8 * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(t) * (R + 4), z = Math.sin(t) * (R + 4);
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 26, 16), stone); tw.position.set(x, 13, z); a.group.add(tw);
      const d = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), teal); d.position.set(x, 26, z); d.scale.y = 1.3; a.group.add(d);
    }
    // حلقة الأسوار الداخلية (نصف قطر ٧٠) بثماني بوابات
    const ir = 70, n = 8, gap = 0.16;
    for (let k = 0; k < n; k++) {
      const t0 = k / n * Math.PI * 2 + gap, t1 = (k + 1) / n * Math.PI * 2 - gap;
      const steps = 3;
      for (let j = 0; j < steps; j++) {
        const u0 = t0 + (t1 - t0) * j / steps, u1 = t0 + (t1 - t0) * (j + 1) / steps;
        wallMesh(a, Math.cos(u0) * ir, Math.sin(u0) * ir, Math.cos(u1) * ir, Math.sin(u1) * ir, 3, 6, wallM);
      }
      // برج صغير عند كل بوابة
      const tg = (k + 1) / n * Math.PI * 2;
      for (const s of [-1, 1]) {
        const u = tg + s * gap * 0.9;
        const x = Math.cos(u) * ir, z = Math.sin(u) * ir;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 9, 10), stone); p.position.set(x, 4.5, z); a.group.add(p);
        const c = new THREE.Mesh(new THREE.ConeGeometry(3.6, 3, 10), teal); c.position.set(x, 10.5, z); a.group.add(c);
        a.circle(x, z, 3.2);
      }
    }
    // النافورة
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(12, 12.5, 1.8, 40), b.m.wall); basin.position.y = 0.9; a.group.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(11.3, 40), L(0x2bb3c0, { emissive: 0x08404a })); water.rotation.x = -Math.PI / 2; water.position.y = 1.7; a.group.add(water);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 6, 12), b.m.wall); col.position.y = 3.5; a.group.add(col);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), b.m.gold); bowl.position.y = 6.8; a.group.add(bowl);
    a.circle(0, 0, 12.5);
    // أعمدة حول النافورة
    for (let k = 0; k < 8; k++) {
      const t = k / 8 * Math.PI * 2;
      const x = Math.cos(t) * 36, z = Math.sin(t) * 36;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 10, 12), b.m.wall); p.position.set(x, 5, z); a.group.add(p);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 6), teal); cap.position.set(x, 10.4, z); a.group.add(cap);
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), b.m.lamp); lamp.position.set(x, 12, z); lamp.scale.y = 1.4; a.group.add(lamp);
      a.circle(x, z, 2.6);
    }
    // الفناء الخارجي: جدران قصيرة مستقيمة وأكوام صناديق
    for (let k = 0; k < 4; k++) {
      const t = k / 4 * Math.PI * 2 + Math.PI / 4;
      const cx = Math.cos(t) * 110, cz = Math.sin(t) * 110;
      const px = -Math.sin(t) * 18, pz = Math.cos(t) * 18;
      wallMesh(a, cx - px, cz - pz, cx + px, cz + pz, 3, 5, wallM);
      const u = t + Math.PI / 4;
      a.jump(Math.cos(u) * 105, Math.sin(u) * 105, Math.atan2(-Math.sin(u), Math.cos(u)));
      a.pad(Math.cos(u) * 92, Math.sin(u) * 92, Math.atan2(-Math.sin(u), Math.cos(u)));
    }
    const crate = L(0x8a5a2b);
    for (let k = 0; k < 10; k++) {
      const t = k / 10 * Math.PI * 2 + 0.2, d = 128;
      const x = Math.cos(t) * d, z = Math.sin(t) * d;
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 6), crate); m.position.set(x, 2.5, z); a.group.add(m);
      a.rect(x, z, 3, 3);
    }
    for (const t of [0.4, 2.0, 3.6, 5.2]) a.jump(Math.cos(t) * 50, Math.sin(t) * 50, t);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(40, 9), new THREE.MeshBasicMaterial({ map: textTexture('ساحة القلعة', { bg: '#4a2c1a' }), side: THREE.DoubleSide }));
    banner.position.set(0, 18, -R + 1); a.group.add(banner);
    const r = b.r;
    for (let k = 0; k < 30; k++) { const t = r() * Math.PI * 2, d = R + 20 + r() * 60; b.palm(Math.cos(t) * d, Math.sin(t) * d, 10 + r() * 6); }
  },

  // واحة المعركة: بِرك وبساتين نخيل وكثبان قفز
  oasis(a) {
    const R = a.R, b = a.b, r = b.r;
    a.floor(sandTex('#e8c17c'), R / 10);
    const pond = (x, z, rad) => {
      const w = new THREE.Mesh(new THREE.CircleGeometry(rad - 1, 40), L(0x2bb3c0, { emissive: 0x08404a })); w.rotation.x = -Math.PI / 2; w.position.set(x, 0.08, z); a.group.add(w);
      const sh = new THREE.Mesh(new THREE.RingGeometry(rad - 1, rad + 3, 40), L(0x9cbf5a)); sh.rotation.x = -Math.PI / 2; sh.position.set(x, 0.06, z); a.group.add(sh);
      a.circle(x, z, rad);
    };
    pond(0, 0, 26);
    for (const t of [0.5, 2.6, 4.7]) pond(Math.cos(t) * 100, Math.sin(t) * 100, 13);
    // بساتين نخيل (كل بستان ٤-٦ نخلات)
    for (let k = 0; k < 14; k++) {
      const t = k / 14 * Math.PI * 2 + 0.25, d = k % 2 ? 60 : 130;
      const cx = Math.cos(t) * d, cz = Math.sin(t) * d;
      const n = 4 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) {
        const x = cx + (r() - 0.5) * 16, z = cz + (r() - 0.5) * 16;
        if (a.solidAt(x, z, 4)) continue;
        b.palm(x, z, 9 + r() * 5);
        a.circle(x, z, 1.4);
      }
    }
    // كثبان صغيرة (عوائق منخفضة) ومنحدرات
    const dune = L(0xdcae6a);
    for (let k = 0; k < 6; k++) {
      const t = k / 6 * Math.PI * 2 + 1.1, d = 88;
      const x = Math.cos(t) * d, z = Math.sin(t) * d;
      const m = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dune); m.position.set(x, 0, z); m.scale.y = 0.6; a.group.add(m);
      a.circle(x, z, 7.5);
      a.jump(Math.cos(t + 0.25) * d, Math.sin(t + 0.25) * d, Math.atan2(-Math.sin(t), Math.cos(t)));
    }
    for (let k = 0; k < 4; k++) { const t = k / 4 * Math.PI * 2; a.pad(Math.cos(t) * 45, Math.sin(t) * 45, Math.atan2(-Math.sin(t), Math.cos(t))); }
    // سور طيني منخفض
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 3, 96, 1, true), L(0xb9824a, { side: THREE.DoubleSide })); wall.position.y = 1.5; a.group.add(wall);
    const top = new THREE.Mesh(new THREE.TorusGeometry(R, 0.5, 6, 96), b.m.teal); top.rotation.x = Math.PI / 2; top.position.y = 3; a.group.add(top);
    for (let k = 0; k < 50; k++) { const t = k / 50 * Math.PI * 2 + r() * 0.1, d = R + 8 + r() * 40; b.palm(Math.cos(t) * d, Math.sin(t) * d, 8 + r() * 7); }
    for (let k = 0; k < 6; k++) { const t = r() * Math.PI * 2, d = R + 25 + r() * 30; b.camel(Math.cos(t) * d, Math.sin(t) * d); }
    for (let k = 0; k < 16; k++) { const t = k / 16 * Math.PI * 2; b.lantern(Math.cos(t) * (R + 3), Math.sin(t) * (R + 3), 4); }
  },

  // متاهة البازار: شبكة شوارع بين كتل البيوت وساحة في الوسط
  bazaar(a) {
    const b = a.b, r = b.r;
    a.floor(stoneTex('#6e6258', 'rgba(20,10,5,0.35)', 32), 30);
    const walls = [L(0xd8c2a0), L(0xc4a27a), L(0xe6d5b8)];
    const win = L(0x3a1f0c, { emissive: 0x3a2000 });
    const centers = [-100, -34, 34, 100];
    const B = 23; // نصف عرض الكتلة
    for (const cx of centers) {
      for (const cz of centers) {
        if (Math.abs(cx) < 50 && Math.abs(cz) < 50) continue; // الساحة الوسطى
        const h = 9 + r() * 12;
        b.house(cx, cz, { w: B * 2, d: B * 2, h, mat: walls[Math.floor(r() * 3)], windows: true, windowMat: win, dome: r() > 0.6, rot: 0 });
        a.rect(cx, cz, B, B);
        // بسطات أمام البيوت
        if (r() < 0.6) { b.stall(cx, cz + B + 2.5, 0); }
      }
    }
    // الساحة: نافورة وأربعة أعمدة فوانيس
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.5, 1.6, 32), b.m.wall); basin.position.y = 0.8; a.group.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(7.3, 32), L(0x2bb3c0, { emissive: 0x08404a })); water.rotation.x = -Math.PI / 2; water.position.y = 1.55; a.group.add(water);
    a.circle(0, 0, 8.5);
    for (const [x, z] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) { b.lantern(x, z, 6); a.circle(x, z, 0.8); }
    // فوانيس معلّقة فوق الشوارع
    for (const s of [-67, 0, 67]) {
      for (const c of [-100, -34, 34, 100]) {
        if (s === 0 && Math.abs(c) < 50) continue;
        b.stringLights({ x: c - 18, z: s }, { x: c + 18, z: s }, 11);
        b.stringLights({ x: s, z: c - 18 }, { x: s, z: c + 18 }, 11);
      }
    }
    for (const [x, z] of [[0, 67], [0, -67], [67, 0], [-67, 0]]) {
      const l = new THREE.PointLight(0xffb050, 900, 140, 1.6); l.position.set(x, 14, z); a.group.add(l);
    }
    // منحدرات في الشوارع الطويلة
    a.jump(0, 120, 0); a.jump(0, -120, Math.PI); a.jump(120, 0, Math.PI / 2); a.jump(-120, 0, -Math.PI / 2);
    a.pad(67, 100, 0); a.pad(-67, -100, Math.PI); a.pad(100, -67, Math.PI / 2); a.pad(-100, 67, -Math.PI / 2);
    // صف بيوت عالية حول الحدود (للمنظر)
    for (let t = -150; t <= 150; t += 22) {
      for (const [x, z, rot] of [[t, a.hd + 12, Math.PI], [t, -a.hd - 12, 0], [a.hw + 12, t, -Math.PI / 2], [-a.hw - 12, t, Math.PI / 2]]) {
        b.house(x, z, { w: 22, d: 20, h: 14 + r() * 16, mat: walls[Math.floor(r() * 3)], windows: true, windowMat: win, dome: r() > 0.8, rot });
      }
    }
    b.mosque(0, -a.hd - 60, 0);
  },

  // ميناء الداو: رصيف ومخازن وأكوام صناديق والبحر شمالاً
  harbor(a) {
    const b = a.b, r = b.r, hw = a.hw, hd = a.hd;
    // ألواح خشبية للرصيف
    a.floor(canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#b89a6a'; g.fillRect(0, 0, w, h);
      const rr = rng(4);
      for (let y = 0; y < h; y += 32) { g.fillStyle = rr() > 0.5 ? 'rgba(90,60,30,0.15)' : 'rgba(255,240,200,0.1)'; g.fillRect(0, y, w, 30); g.fillStyle = 'rgba(50,30,15,0.5)'; g.fillRect(0, y + 30, w, 2); }
    }), 28);
    // يابسة تحت المخازن (البحر يبدأ بعد حافة الرصيف شمالاً)
    const D = hd * 2 + 220;
    const land = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 220, D), L(0xc9b68e));
    land.rotation.x = -Math.PI / 2; land.position.set(0, 0, hd + 0.5 - D / 2); a.group.add(land);
    // حافة الرصيف مع البحر (جهة z الموجبة)
    const edge = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 4, 1.2, 2), L(0x6a5a48)); edge.position.set(0, 0.6, hd + 1); a.group.add(edge);
    for (let x = -hw + 10; x < hw; x += 20) { const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 1.6, 10), L(0x222222)); bl.position.set(x, 0.8, hd - 1.5); a.group.add(bl); }
    // جدار مخازن على الجوانب الثلاثة الأخرى
    const ware = [L(0xd8d2c4), L(0xb8a48a), L(0x9fb3c0)];
    for (let x = -hw; x <= hw; x += 34) b.house(x, -hd - 14, { w: 32, d: 24, h: 14 + r() * 6, mat: ware[Math.floor(r() * 3)], dome: false, rot: 0 });
    for (const s of [-1, 1]) for (let z = -hd; z <= hd; z += 34) b.house(s * (hw + 14), z, { w: 24, d: 32, h: 12 + r() * 6, mat: ware[Math.floor(r() * 3)], dome: false, rot: -s * Math.PI / 2 });
    // مخازن داخلية كبيرة
    for (const [x, z, w2, d2] of [[-90, -60, 22, 14], [90, -60, 22, 14], [0, 20, 30, 12]]) {
      b.house(x, z, { w: w2 * 2, d: d2 * 2, h: 12, mat: ware[Math.floor(r() * 3)], dome: false, rot: 0 });
      a.rect(x, z, w2, d2);
    }
    // أكوام صناديق شحن ملونة
    const cols = [0xd62828, 0x1d70b8, 0x2a9d8f, 0xf2c14e, 0xf77f00];
    for (let k = 0; k < 22; k++) {
      const x = (r() - 0.5) * (hw * 2 - 40), z = (r() - 0.5) * (hd * 2 - 40);
      const big = r() > 0.5;
      const w2 = big ? 7 : 4, d2 = big ? 3.5 : 4;
      if (a.solidAt(x, z, Math.max(w2, d2) + 10)) continue;
      const hgt = big ? 6 : 4 + Math.floor(r() * 2) * 4;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w2 * 2, hgt, d2 * 2), L(cols[k % cols.length]));
      m.position.set(x, hgt / 2, z); a.group.add(m);
      a.rect(x, z, w2, d2);
    }
    // سفن داو راسية في البحر وأخرى على الرصيف
    for (let k = 0; k < 6; k++) b.dhow(-140 + k * 55, hd + 22 + r() * 30, Math.PI / 2 + (r() - 0.5) * 0.3);
    b.lighthouse(hw - 20, hd - 20); a.circle(hw - 20, hd - 20, 3.5);
    a.jump(-40, 80, Math.PI / 2); a.jump(60, 80, -Math.PI / 2); a.jump(-130, -10, 0); a.jump(130, -10, Math.PI);
    a.pad(0, -100, Math.PI / 2); a.pad(0, 90, -Math.PI / 2); a.pad(-140, 60, 0); a.pad(140, 60, Math.PI);
    for (let k = 0; k < 10; k++) b.lantern(-hw + 20 + k * 34, hd - 4, 6);
  },

  // وادي الأعمدة: أعمدة صخرية وهضاب داخل جرف دائري
  rocks(a) {
    const R = a.R, b = a.b, r = b.r;
    a.floor(sandTex('#c96a3c'), R / 10);
    const reds = [L(0xb4502a, { flatShading: true }), L(0x9c4024, { flatShading: true }), L(0xc8683a, { flatShading: true })];
    // جرف عالٍ يحيط بالوادي
    const cliffGeo = new THREE.CylinderGeometry(R + 6, R + 20, 45, 64, 3, true);
    const pos = cliffGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const f = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.04; pos.setX(i, pos.getX(i) * f); pos.setZ(i, pos.getZ(i) * f); }
    cliffGeo.computeVertexNormals();
    const cliff = new THREE.Mesh(cliffGeo, L(0xa84a28, { flatShading: true, side: THREE.DoubleSide })); cliff.position.y = 22; a.group.add(cliff);
    // هضاب كبيرة
    for (const [x, z, rad] of [[60, 40, 22], [-70, -50, 26], [-40, 90, 18], [90, -80, 20]]) {
      b.mesa(x, z, rad, 30 + r() * 20, reds[Math.floor(r() * 3)]);
      a.circle(x, z, rad * 0.95);
    }
    // أعمدة صخرية
    for (let k = 0; k < 26; k++) {
      const x = (r() - 0.5) * R * 1.7, z = (r() - 0.5) * R * 1.7;
      const rad = 3 + r() * 5;
      if (a.solidAt(x, z, rad + 12) || Math.hypot(x, z) < 20) continue;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.7, rad, 14 + r() * 22, 7), reds[k % 3]);
      m.position.set(x, m.geometry.parameters.height / 2, z); m.rotation.y = r() * 3; a.group.add(m);
      a.circle(x, z, rad);
    }
    // قوس صخري في الوسط تمرّ من تحته
    const arch = new THREE.Mesh(new THREE.TorusGeometry(16, 3.5, 6, 18, Math.PI), reds[1]);
    arch.scale.y = 1.1; a.group.add(arch);
    a.circle(-16, 0, 3.5); a.circle(16, 0, 3.5);
    for (let k = 0; k < 6; k++) { const t = k / 6 * Math.PI * 2 + 0.3; a.jump(Math.cos(t) * 120, Math.sin(t) * 120, Math.atan2(-Math.sin(t), Math.cos(t))); }
    for (let k = 0; k < 4; k++) { const t = k / 4 * Math.PI * 2 + 0.8; a.pad(Math.cos(t) * 75, Math.sin(t) * 75, Math.atan2(-Math.sin(t), Math.cos(t))); }
    for (let k = 0; k < 5; k++) { const t = r() * Math.PI * 2, d = R - 25; const x = Math.cos(t) * d, z = Math.sin(t) * d; if (!a.solidAt(x, z, 8)) { b.tent(x, z); a.circle(x, z, 4.5); } }
    for (let k = 0; k < 10; k++) { const t = r() * Math.PI * 2, d = 30 + r() * (R - 50); const x = Math.cos(t) * d, z = Math.sin(t) * d; if (!a.solidAt(x, z, 6)) { b.acacia(x, z); a.circle(x, z, 0.6); } }
  },
};
