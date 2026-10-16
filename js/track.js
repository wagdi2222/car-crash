// المسار: منحنى مغلق في الصحراء + الطريق + الديكور العربي
import * as THREE from '../lib/three.module.min.js';

export const ROAD_W = 24;          // عرض الطريق
export const LIMIT = ROAD_W / 2 + 13; // حدود الحلبة الجانبية

const CTRL = [[0, -150], [120, -160], [220, -120], [260, -30], [220, 50], [140, 60], [100, 120], [150, 200], [120, 280], [20, 300], [-80, 260], [-120, 180], [-200, 150], [-260, 60], [-230, -50], [-140, -110], [-60, -150]];

// مولّد أرقام عشوائية ثابت حتى يرى جميع اللاعبين نفس الحلبة
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

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

// نقش هندسي (نجمة ثمانية) يستخدم في عدة أماكن
function star8(g, cx, cy, r, fill, stroke) {
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
    for (let x = 60; x < w; x += 140) { star8(g, x, h / 2, 26, null, '#f2c14e'); }
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

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    this.N = 600;
    this.length = this.curve.getLength();
    this.points = []; this.tangents = []; this.rights = [];
    for (let i = 0; i < this.N; i++) {
      const t = i / this.N;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t).setY(0).normalize();
      this.points.push(p);
      this.tangents.push(tan);
      this.rights.push(new THREE.Vector3(-tan.z, 0, tan.x));
    }
    this.boxSpots = [];
    this.padSpots = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildSky();
    this.buildGround();
    this.buildRoad();
    this.buildStartGate();
    this.buildPads();
    this.buildScenery();
    this.buildBoxSpots();
  }

  // أقرب نقطة على المسار. hint = آخر فهرس معروف لتسريع البحث
  nearest(pos, hint = -1) {
    const N = this.N;
    let best = 0, bd = Infinity;
    if (hint < 0) {
      for (let i = 0; i < N; i++) {
        const p = this.points[i];
        const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    } else {
      for (let k = -30; k <= 30; k++) {
        const i = (hint + k + N) % N;
        const p = this.points[i];
        const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    const p = this.points[best], r = this.rights[best];
    const lat = (pos.x - p.x) * r.x + (pos.z - p.z) * r.z;
    return { i: best, lat, dist: Math.sqrt(bd) };
  }

  // المسافة إلى أقرب جزء من الطريق (للديكور)
  distToRoad(x, z) {
    let bd = Infinity;
    for (let i = 0; i < this.N; i += 3) {
      const p = this.points[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) bd = d;
    }
    return Math.sqrt(bd);
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(1400, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 top = vec3(0.16,0.12,0.38);
          vec3 mid = vec3(0.93,0.45,0.32);
          vec3 hor = vec3(1.0,0.78,0.48);
          vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(hor, mid, smoothstep(-0.05, 0.12, h));
          vec3 sd = normalize(vec3(-0.6,0.18,-0.78));
          float s = max(dot(vP, sd), 0.0);
          c += vec3(1.0,0.85,0.5) * pow(s, 400.0) * 2.0 + vec3(1.0,0.6,0.3) * pow(s, 12.0) * 0.35;
          gl_FragColor = vec4(c,1.);
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.group.add(this.sky);
  }

  buildGround() {
    const r = rng(7);
    const tex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#e2b574'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = r();
        g.fillStyle = v > 0.5 ? 'rgba(255,230,180,0.18)' : 'rgba(150,95,40,0.14)';
        g.fillRect(r() * w, r() * h, 2 + r() * 3, 1 + r() * 2);
      }
      // تموجات الرمل
      g.strokeStyle = 'rgba(170,110,50,0.12)'; g.lineWidth = 3;
      for (let y = 0; y < h; y += 22) {
        g.beginPath();
        for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / 30 + y) * 5);
        g.stroke();
      }
    }, [60, 60]);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    this.group.add(ground);

    // كثبان بعيدة
    const duneMat = new THREE.MeshLambertMaterial({ color: 0xd9a35f });
    const duneGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + r() * 0.1;
      const d = 520 + r() * 380;
      const m = new THREE.Mesh(duneGeo, duneMat);
      m.position.set(Math.cos(a) * d, -2, Math.sin(a) * d);
      m.scale.set(90 + r() * 120, 25 + r() * 55, 60 + r() * 90);
      m.rotation.y = r() * Math.PI;
      this.group.add(m);
    }
  }

  buildRoad() {
    const N = this.N;
    // نسيج الطريق: حجر رملي مع خطوط ذهبية
    const roadTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#8c6b4f'; g.fillRect(0, 0, w, h);
      const r = rng(3);
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
        g.fillRect(r() * w, r() * h, 2, 2);
      }
      g.strokeStyle = 'rgba(60,35,20,0.35)'; g.lineWidth = 2;
      for (let y = 0; y < h; y += 64) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      }
      for (let x = 0; x < w; x += 64) {
        for (let y = 0; y < h; y += 64) {
          const off = (y / 64) % 2 ? 32 : 0;
          g.beginPath(); g.moveTo(x + off, y); g.lineTo(x + off, y + 64); g.stroke();
        }
      }
      // خط المنتصف المتقطع
      g.fillStyle = 'rgba(255,214,120,0.75)';
      g.fillRect(w / 2 - 3, 0, 6, h / 2);
    }, null);
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;

    const pos = [], uv = [], idx = [];
    const curbPos = [], curbCol = [], curbIdx = [];
    const c1 = new THREE.Color(0x1aa39a), c2 = new THREE.Color(0xfff3d6);
    let v = 0;
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      const p = this.points[k], r = this.rights[k];
      if (i > 0) v += this.points[(i - 1) % N].distanceTo(p) / 24;
      const hw = ROAD_W / 2;
      pos.push(p.x - r.x * hw, 0.02, p.z - r.z * hw, p.x + r.x * hw, 0.02, p.z + r.z * hw);
      uv.push(0, v, 1, v);
      // حواف ملونة (يسار ويمين)
      const col = Math.floor(i / 4) % 2 ? c1 : c2;
      for (const s of [-1, 1]) {
        const a = hw * s, b = (hw + 2.2) * s;
        curbPos.push(p.x + r.x * a, 0.06, p.z + r.z * a, p.x + r.x * b, 0.06, p.z + r.z * b);
        curbCol.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        const c = i * 4;
        // يسار: (c, c+1) ، يمين: (c+2, c+3)
        curbIdx.push(c, c + 4, c + 1, c + 1, c + 4, c + 5);
        curbIdx.push(c + 2, c + 6, c + 3, c + 3, c + 6, c + 7);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide }));
    this.group.add(road);

    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
    cg.setAttribute('color', new THREE.Float32BufferAttribute(curbCol, 3));
    cg.setIndex(curbIdx);
    cg.computeVertexNormals();
    this.group.add(new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));

    // جدران طينية منخفضة على حدود الحلبة
    const wallTex = canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = '#b9824a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(90,50,20,0.45)'; g.lineWidth = 2;
      for (let y = 0; y < h; y += 16) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let x = (y / 16) % 2 ? 16 : 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
      }
      g.fillStyle = '#1aa39a'; g.fillRect(0, 0, w, 6);
    }, null);
    wallTex.wrapS = THREE.RepeatWrapping;
    for (const s of [-1, 1]) {
      const wp = [], wu = [], wi = [];
      let u = 0;
      for (let i = 0; i <= N; i++) {
        const k = i % N;
        const p = this.points[k], r = this.rights[k];
        if (i > 0) u += this.points[(i - 1) % N].distanceTo(p) / 16;
        const x = p.x + r.x * (LIMIT + 1) * s, z = p.z + r.z * (LIMIT + 1) * s;
        wp.push(x, 0, z, x, 1.8, z);
        wu.push(u, 0, u, 1);
        if (i < N) { const a = i * 2; wi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      wg.setAttribute('uv', new THREE.Float32BufferAttribute(wu, 2));
      wg.setIndex(wi);
      wg.computeVertexNormals();
      this.group.add(new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.DoubleSide })));
    }
  }

  buildStartGate() {
    const p = this.points[0], r = this.rights[0], t = this.tangents[0];
    // خط البداية (مربعات)
    const chk = canvasTex(256, 32, (g, w, h) => {
      for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        g.fillRect(x * 16, y * 16, 16, 16);
      }
    });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 3), new THREE.MeshLambertMaterial({ map: chk }));
    line.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group();
    holder.position.set(p.x, 0.08, p.z);
    holder.rotation.y = Math.atan2(t.x, t.z);
    holder.add(line);
    this.group.add(holder);

    // بوابة على شكل قوس مع برجين
    const gate = new THREE.Group();
    gate.position.set(p.x, 0, p.z);
    gate.rotation.y = Math.atan2(t.x, t.z);
    const stone = new THREE.MeshLambertMaterial({ color: 0xe8cfa0 });
    const teal = new THREE.MeshLambertMaterial({ color: 0x1aa39a });
    const gold = new THREE.MeshLambertMaterial({ color: 0xf2c14e, emissive: 0x4a3000 });
    for (const s of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 16, 12), stone);
      tower.position.set(s * (ROAD_W / 2 + 3), 8, 0);
      gate.add(tower);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 1, 12), teal);
      band.position.set(s * (ROAD_W / 2 + 3), 12, 0);
      gate.add(band);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
      dome.position.set(s * (ROAD_W / 2 + 3), 16, 0);
      dome.scale.y = 1.5;
      gate.add(dome);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.5, 8), gold);
      spike.position.set(s * (ROAD_W / 2 + 3), 20.5, 0);
      gate.add(spike);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 6, 5, 1), [stone, stone, stone, stone,
      new THREE.MeshBasicMaterial({ map: textTexture('رالي الرمال') }),
      new THREE.MeshBasicMaterial({ map: textTexture('خط النهاية', { bg: '#14514d' }) })]);
    banner.position.set(0, 13, 0);
    gate.add(banner);
    this.group.add(gate);
  }

  buildPads() {
    // منصات التسارع (نقش فيروزي بأسهم)
    const tex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#0e7c74'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7ff7e8';
      for (let k = 0; k < 2; k++) {
        const y = 20 + k * 56;
        g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w - 18, y + 36); g.lineTo(w - 38, y + 36); g.lineTo(w / 2, y + 16); g.lineTo(38, y + 36); g.lineTo(18, y + 36); g.closePath(); g.fill();
      }
      g.strokeStyle = '#f2c14e'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const spots = [[120, -5], [300, 6], [445, 0], [540, -6]];
    for (const [i, lat] of spots) {
      const p = this.points[i], r = this.rights[i], t = this.tangents[i];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), mat);
      const holder = new THREE.Group();
      holder.position.set(p.x + r.x * lat, 0.1, p.z + r.z * lat);
      holder.rotation.y = Math.atan2(t.x, t.z);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.PI;
      holder.add(m);
      this.group.add(holder);
      this.padSpots.push({ x: holder.position.x, z: holder.position.z, i });
    }
  }

  buildBoxSpots() {
    for (const i of [70, 215, 360, 470, 560]) {
      const p = this.points[i], r = this.rights[i];
      for (const lat of [-8, -2.7, 2.7, 8]) {
        this.boxSpots.push(new THREE.Vector3(p.x + r.x * lat, 1.4, p.z + r.z * lat));
      }
    }
  }

  buildScenery() {
    const r = rng(42);
    const place = (minD, maxD, tries = 40) => {
      for (let k = 0; k < tries; k++) {
        const i = Math.floor(r() * this.N);
        const p = this.points[i], rt = this.rights[i];
        const s = r() > 0.5 ? 1 : -1;
        const d = minD + r() * (maxD - minD);
        const x = p.x + rt.x * d * s, z = p.z + rt.z * d * s;
        if (this.distToRoad(x, z) > minD - 1) return [x, z];
      }
      return null;
    };

    // نخيل
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a, side: THREE.DoubleSide });
    const dateMat = new THREE.MeshLambertMaterial({ color: 0xb5651d });
    const leafGeo = new THREE.PlaneGeometry(1.6, 7, 1, 4);
    {
      const a = leafGeo.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const y = a.getY(i) + 3.5; // 0..7
        a.setX(i, a.getX(i) * Math.sin((y / 7) * Math.PI) * 1.2);
        a.setZ(i, -(y * y) * 0.06);
        a.setY(i, y);
      }
      leafGeo.computeVertexNormals();
    }
    const makePalm = (x, z, h) => {
      const g = new THREE.Group();
      const segs = 6;
      let lean = (r() - 0.5) * 0.3;
      for (let k = 0; k < segs; k++) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.45 - k * 0.03, 0.55 - k * 0.03, h / segs, 7), trunkMat);
        s.position.set(Math.sin(lean) * k * h / segs * 0.5, (k + 0.5) * h / segs, 0);
        g.add(s);
      }
      const top = new THREE.Group();
      top.position.set(Math.sin(lean) * h * 0.5, h, 0);
      for (let k = 0; k < 8; k++) {
        const l = new THREE.Mesh(leafGeo, leafMat);
        l.rotation.set(-0.6 - r() * 0.4, (k / 8) * Math.PI * 2, 0, 'YXZ');
        top.add(l);
      }
      for (let k = 0; k < 4; k++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), dateMat);
        d.position.set(Math.cos(k * 1.6) * 0.5, -0.4, Math.sin(k * 1.6) * 0.5);
        top.add(d);
      }
      g.add(top);
      g.position.set(x, 0, z);
      g.rotation.y = r() * Math.PI * 2;
      this.group.add(g);
    };
    for (let k = 0; k < 70; k++) {
      const pt = place(LIMIT + 4, LIMIT + 30);
      if (pt) makePalm(pt[0], pt[1], 7 + r() * 6);
    }

    // واحة في وسط الحلبة
    const oasis = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshLambertMaterial({ color: 0x2bb3c0, emissive: 0x062a33 }));
    oasis.rotation.x = -Math.PI / 2;
    oasis.position.set(-40, 0.05, 80);
    this.group.add(oasis);
    const shore = new THREE.Mesh(new THREE.RingGeometry(30, 36, 32), new THREE.MeshLambertMaterial({ color: 0x9cbf5a }));
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(-40, 0.04, 80);
    this.group.add(shore);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      makePalm(-40 + Math.cos(a) * 34, 80 + Math.sin(a) * 34, 8 + r() * 5);
    }

    // بيوت بقباب ومآذن
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xf1e2c4 });
    const wall2 = new THREE.MeshLambertMaterial({ color: 0xd8b98a });
    const domeMats = [
      new THREE.MeshLambertMaterial({ color: 0x1aa39a }),
      new THREE.MeshLambertMaterial({ color: 0xf2c14e, emissive: 0x3a2500 }),
      new THREE.MeshLambertMaterial({ color: 0x2e5aa8 }),
    ];
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x5a2d0c });
    const makeHouse = (x, z) => {
      const g = new THREE.Group();
      const w = 8 + r() * 8, d = 8 + r() * 8, h = 5 + r() * 6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), r() > 0.5 ? wallMat : wall2);
      b.position.y = h / 2;
      g.add(b);
      const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.2, 0.3), doorMat);
      door.position.set(0, 1.6, d / 2);
      g.add(door);
      const archTop = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 12, 1, false, 0, Math.PI), doorMat);
      archTop.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      archTop.position.set(0, 3.2, d / 2);
      g.add(archTop);
      if (r() > 0.35) {
        const dr = Math.min(w, d) * 0.38;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(dr, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMats[Math.floor(r() * 3)]);
        dome.position.y = h;
        dome.scale.y = 1.25;
        g.add(dome);
      }
      g.position.set(x, 0, z);
      g.rotation.y = r() * Math.PI * 2;
      this.group.add(g);
    };
    const makeMinaret = (x, z) => {
      const g = new THREE.Group();
      const h = 24 + r() * 10;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, h, 10), wallMat);
      t.position.y = h / 2; g.add(t);
      const bal = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.4, 1, 10), domeMats[0]);
      bal.position.y = h * 0.72; g.add(bal);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 4, 10), wallMat);
      top.position.y = h + 2; g.add(top);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 10), domeMats[1]);
      cone.position.y = h + 6.5; g.add(cone);
      const cres = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.18, 6, 16, Math.PI * 1.4), domeMats[1]);
      cres.position.y = h + 10; cres.rotation.z = Math.PI * 0.3; g.add(cres);
      g.position.set(x, 0, z);
      this.group.add(g);
    };
    for (let k = 0; k < 26; k++) {
      const pt = place(LIMIT + 14, LIMIT + 60);
      if (pt) makeHouse(pt[0], pt[1]);
    }
    for (let k = 0; k < 6; k++) {
      const pt = place(LIMIT + 22, LIMIT + 70);
      if (pt) makeMinaret(pt[0], pt[1]);
    }

    // جِمال
    const camelMat = new THREE.MeshLambertMaterial({ color: 0xc08a4f });
    const rugMat = new THREE.MeshLambertMaterial({ color: 0xb02e2e });
    const makeCamel = (x, z) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), camelMat);
      body.scale.set(1.1, 0.9, 2); body.position.y = 3.2; g.add(body);
      const hump = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), camelMat);
      hump.position.set(0, 4, 0); hump.scale.y = 1.1; g.add(hump);
      const rug = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 1.6), rugMat);
      rug.position.set(0, 3.95, 0.9); g.add(rug);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.4, 8), camelMat);
      neck.position.set(0, 4.1, 2.2); neck.rotation.x = 0.6; g.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.3), camelMat);
      head.position.set(0, 5.2, 2.9); g.add(head);
      for (const [lx, lz] of [[-0.5, 1.2], [0.5, 1.2], [-0.5, -1.2], [0.5, -1.2]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 2.6, 6), camelMat);
        leg.position.set(lx, 1.3, lz); g.add(leg);
      }
      g.position.set(x, 0, z);
      g.rotation.y = r() * Math.PI * 2;
      this.group.add(g);
    };
    for (let k = 0; k < 9; k++) {
      const pt = place(LIMIT + 6, LIMIT + 25);
      if (pt) makeCamel(pt[0], pt[1]);
    }

    // فوانيس على أطراف الطريق
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3b2a1a });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc85a });
    const capMat = new THREE.MeshLambertMaterial({ color: 0xc9962c });
    for (let i = 10; i < this.N; i += 24) {
      const p = this.points[i], rt = this.rights[i];
      const s = (i / 24) % 2 ? 1 : -1;
      const x = p.x + rt.x * (ROAD_W / 2 + 4) * s, z = p.z + rt.z * (ROAD_W / 2 + 4) * s;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 6), poleMat);
      pole.position.y = 2.5; g.add(pole);
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), lampMat);
      lamp.position.y = 5.5; lamp.scale.y = 1.4; g.add(lamp);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 8), capMat);
      cap.position.y = 6.6; g.add(cap);
      g.position.set(x, 0, z);
      this.group.add(g);
    }

    // صبار وصخور
    const rockMat = new THREE.MeshLambertMaterial({ color: 0xa8683a, flatShading: true });
    for (let k = 0; k < 40; k++) {
      const pt = place(LIMIT + 3, LIMIT + 45);
      if (!pt) continue;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + r() * 3, 0), rockMat);
      m.position.set(pt[0], 0.5, pt[1]);
      m.scale.y = 0.6 + r() * 0.6;
      m.rotation.set(r(), r(), r());
      this.group.add(m);
    }
  }
}
