// ساحة المعركة: أرض دائرية مسوّرة مع عوائق
import * as THREE from '../lib/three.module.min.js';
import { rng, canvasTex, star8, textTexture, Builder } from './scenery.js';
import { buildEnvironment, padTexture } from './track.js';

export class Arena {
  constructor(scene, course) {
    this.kind = 'arena';
    this.course = course;
    this.theme = course.theme;
    this.R = course.radius;
    this.obstacles = course.obstacles.map(([x, z, r]) => ({ x, z, r }));
    this.group = new THREE.Group();
    scene.add(this.group);
    const seed = course.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    buildEnvironment(this.group, scene, this.theme, seed);
    this.b = new Builder(this.group, rng(seed + 1));
    this.boxSpots = [];
    this.padSpots = [];
    if (this.theme.scenery === 'fort') this.buildFort(); else this.buildOasis();
    this.buildPads();
  }

  surface() { return { i: 0, offroad: false }; }

  // ارتداد عن الجدار: n = اتجاه الجدار (من الساحة نحو العائق)
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
    const lim = this.R - 1.6;
    const d = Math.hypot(p.x, p.z);
    if (d > lim) {
      const nx = p.x / d, nz = p.z / d;
      p.x = nx * lim; p.z = nz * lim;
      this.reflect(k, nx, nz);
      wall = true;
    }
    for (const o of this.obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const dd = Math.hypot(dx, dz), min = o.r + 1.4;
      if (dd < min && dd > 1e-3) {
        const nx = dx / dd, nz = dz / dd;
        p.x = o.x + nx * min; p.z = o.z + nz * min;
        this.reflect(k, -nx, -nz);
        wall = true;
      }
    }
    return { i: 0, wall };
  }

  blocked(pos) {
    if (Math.hypot(pos.x, pos.z) > this.R - 0.5) return true;
    for (const o of this.obstacles) if ((pos.x - o.x) ** 2 + (pos.z - o.z) ** 2 < (o.r + 0.3) ** 2) return true;
    return false;
  }

  spawn(slot, total) {
    const a = (slot / Math.max(2, total)) * Math.PI * 2 + 0.3;
    const rad = this.R - 9;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    return { x, z, h: Math.atan2(-x, -z), i: 0 };
  }

  ringBoxes(n, rad, off = 0) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + off;
      this.boxSpots.push(new THREE.Vector3(Math.cos(a) * rad, 1.4, Math.sin(a) * rad));
    }
  }

  buildPads() {
    const mat = new THREE.MeshBasicMaterial({ map: padTexture() });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const rad = this.R - 20;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const holder = new THREE.Group();
      holder.position.set(x, 0.12, z);
      // باتجاه الدوران حول الساحة
      holder.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), mat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI;
      holder.add(m);
      this.group.add(holder);
      this.padSpots.push({ x, z });
    }
  }

  floor(tex) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(this.R + 1, 64), new THREE.MeshLambertMaterial({ map: tex }));
    f.rotation.x = -Math.PI / 2; f.position.y = 0.02;
    this.group.add(f);
  }

  buildFort() {
    const R = this.R, b = this.b;
    // أرضية حجرية بنقش نجمي في الوسط
    const tex = canvasTex(1024, 1024, (g, w, h) => {
      g.fillStyle = '#c9a77a'; g.fillRect(0, 0, w, h);
      const r = rng(9);
      g.strokeStyle = 'rgba(80,50,25,0.35)'; g.lineWidth = 3;
      for (let y = 0; y < h; y += 48) for (let x = 0; x < w; x += 48) {
        g.fillStyle = r() > 0.5 ? 'rgba(255,240,210,0.08)' : 'rgba(90,60,30,0.08)';
        g.fillRect(x, y, 48, 48); g.strokeRect(x, y, 48, 48);
      }
      g.lineWidth = 10;
      for (let k = 0; k < 4; k++) star8(g, w / 2, h / 2, 420 - k * 90, null, k % 2 ? '#1aa39a' : '#8a5a2b');
      g.beginPath(); g.arc(w / 2, h / 2, 500, 0, Math.PI * 2); g.strokeStyle = '#8a5a2b'; g.stroke();
    });
    this.floor(tex);

    // السور الدائري
    const wallTex = canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = '#b9935f'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(70,40,15,0.45)'; g.lineWidth = 3;
      for (let y = 0; y < h; y += 24) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let x = (y / 24) % 2 ? 24 : 0; x < w; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 24); g.stroke(); }
      }
      g.fillStyle = '#1aa39a'; g.fillRect(0, h - 14, w, 6);
    }, [12, 1]);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 9, 72, 1, true), new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.DoubleSide }));
    wall.position.y = 4.5; this.group.add(wall);
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0xb9935f });
    const cren = new THREE.BoxGeometry(2.4, 2, 1.6);
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      const m = new THREE.Mesh(cren, stoneMat);
      m.position.set(Math.cos(a) * R, 10, Math.sin(a) * R); m.rotation.y = -a;
      this.group.add(m);
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * (R + 3), z = Math.sin(a) * (R + 3);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 20, 14), stoneMat); t.position.set(x, 10, z); this.group.add(t);
      const d = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), b.m.teal); d.position.set(x, 20, z); d.scale.y = 1.3; this.group.add(d);
    }
    // لافتة فوق السور
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(28, 7), new THREE.MeshBasicMaterial({ map: textTexture('ساحة القلعة', { bg: '#4a2c1a' }), side: THREE.DoubleSide }));
    banner.position.set(0, 14, -R + 0.5);
    this.group.add(banner);

    // النافورة
    const [fx, fz, fr] = [this.obstacles[0].x, this.obstacles[0].z, this.obstacles[0].r];
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(fr, fr + 0.4, 1.6, 32), b.m.wall); basin.position.set(fx, 0.8, fz); this.group.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(fr - 0.6, 32), new THREE.MeshLambertMaterial({ color: 0x2bb3c0, emissive: 0x08404a }));
    water.rotation.x = -Math.PI / 2; water.position.set(fx, 1.5, fz); this.group.add(water);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5, 12), b.m.wall); col.position.set(fx, 3, fz); this.group.add(col);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), b.m.gold); bowl.position.set(fx, 5.8, fz); this.group.add(bowl);
    // الأعمدة
    for (const o of this.obstacles.slice(1)) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.8, o.r, 9, 12), b.m.wall); p.position.set(o.x, 4.5, o.z); this.group.add(p);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(o.r * 2.4, 1, o.r * 2.4), b.m.teal); cap.position.set(o.x, 9.4, o.z); this.group.add(cap);
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), b.m.lamp); lamp.position.set(o.x, 10.8, o.z); lamp.scale.y = 1.4; this.group.add(lamp);
    }
    // نخيل خارج السور
    const r = b.r;
    for (let k = 0; k < 30; k++) { const a = r() * Math.PI * 2, d = R + 12 + r() * 50; b.palm(Math.cos(a) * d, Math.sin(a) * d, 9 + r() * 6); }
    for (let k = 0; k < 6; k++) { const a = r() * Math.PI * 2, d = R + 40 + r() * 60; b.minaret(Math.cos(a) * d, Math.sin(a) * d); }
    this.ringBoxes(8, 22, Math.PI / 8);
    this.ringBoxes(6, 56, 0);
  }

  buildOasis() {
    const R = this.R, b = this.b, r = b.r;
    const tex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#e8c17c'; g.fillRect(0, 0, w, h);
      const rr = rng(11);
      for (let i = 0; i < 6000; i++) { g.fillStyle = rr() > 0.5 ? 'rgba(255,245,210,0.2)' : 'rgba(150,100,40,0.12)'; g.fillRect(rr() * w, rr() * h, 3, 2); }
      g.strokeStyle = 'rgba(140,95,40,0.18)'; g.lineWidth = 4;
      for (let k = 1; k < 9; k++) { g.beginPath(); g.arc(w / 2, h / 2, k * 28, 0, Math.PI * 2); g.stroke(); }
    });
    this.floor(tex);
    const o0 = this.obstacles[0];
    const pond = new THREE.Mesh(new THREE.CircleGeometry(o0.r - 1, 40), new THREE.MeshLambertMaterial({ color: 0x2bb3c0, emissive: 0x08404a }));
    pond.rotation.x = -Math.PI / 2; pond.position.set(o0.x, 0.08, o0.z); this.group.add(pond);
    const shore = new THREE.Mesh(new THREE.RingGeometry(o0.r - 1, o0.r + 2, 40), new THREE.MeshLambertMaterial({ color: 0x9cbf5a }));
    shore.rotation.x = -Math.PI / 2; shore.position.set(o0.x, 0.06, o0.z); this.group.add(shore);
    for (const o of this.obstacles.slice(1)) b.palm(o.x, o.z, 9 + r() * 5);
    // سور طيني منخفض مع نخيل خارجه
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xb9824a, side: THREE.DoubleSide });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 2.6, 72, 1, true), wallMat); wall.position.y = 1.3; this.group.add(wall);
    const top = new THREE.Mesh(new THREE.TorusGeometry(R, 0.4, 6, 72), b.m.teal); top.rotation.x = Math.PI / 2; top.position.y = 2.6; this.group.add(top);
    for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2 + r() * 0.1, d = R + 6 + r() * 30; b.palm(Math.cos(a) * d, Math.sin(a) * d, 8 + r() * 7); }
    for (let k = 0; k < 6; k++) { const a = r() * Math.PI * 2, d = R + 20 + r() * 30; b.camel(Math.cos(a) * d, Math.sin(a) * d); }
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; b.lantern(Math.cos(a) * (R + 2.5), Math.sin(a) * (R + 2.5), 4); }
    this.ringBoxes(8, 23, Math.PI / 8);
    this.ringBoxes(8, 58, Math.PI / 8);
  }
}
