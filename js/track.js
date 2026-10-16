// حلبة السباق: منحنى مغلق + الطريق + بيئة المكان وديكوره
import * as THREE from '../lib/three.module.min.js';
import { rng, canvasTex, textTexture, Builder } from './scenery.js';

export const ROAD_W = 24;
export const LIMIT = ROAD_W / 2 + 13; // حدود الحلبة الجانبية

// السماء والإضاءة والأرض: مشتركة بين حلبات السباق وساحات المعركة
export function buildEnvironment(group, scene, theme, seed) {
  const s = theme.sky;
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: v3(s.top) }, mid: { value: v3(s.mid) }, hor: { value: v3(s.hor) },
      sd: { value: v3(s.sun).normalize() }, sc: { value: v3(s.sunCol) },
      moon: { value: s.moon ? 1 : 0 }, stars: { value: s.stars ? 1 : 0 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top, mid, hor, sd, sc; uniform float moon, stars;
      float h21(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){
        float h = vP.y;
        vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(hor, mid, smoothstep(-0.05, 0.12, h));
        float s = max(dot(vP, sd), 0.0);
        if (moon > 0.5) {
          c += sc * smoothstep(0.9993, 0.9996, s) * 1.2 + vec3(0.4,0.45,0.7) * pow(s, 40.0) * 0.3;
        } else {
          c += sc * pow(s, 400.0) * 2.0 + vec3(1.0,0.6,0.3) * pow(s, 12.0) * 0.35;
        }
        if (stars > 0.5 && h > 0.05) {
          vec3 q = floor(vP * 260.0);
          float st = step(0.9965, h21(q));
          c += vec3(st) * smoothstep(0.05, 0.3, h) * 0.9;
        }
        gl_FragColor = vec4(c,1.);
      }`,
  }));
  group.add(sky);

  scene.fog = new THREE.Fog(theme.fog[0], theme.fog[1], theme.fog[2]);
  group.add(new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], theme.hemi[2]));
  const sun = new THREE.DirectionalLight(theme.sun[0], theme.sun[1]);
  sun.position.copy(v3(s.sun)).multiplyScalar(500);
  // ظلال تتبع اللاعب (تُفعَّل حسب إعداد الجودة)
  sun.castShadow = true;
  sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  sun.userData.dir = v3(s.sun).normalize();
  group.add(sun, sun.target);

  const r = rng(seed);
  const gd = theme.ground;
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = gd.base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() > 0.5 ? gd.a : gd.b;
      g.fillRect(r() * w, r() * h, 2 + r() * 3, 1 + r() * 2);
    }
    g.strokeStyle = gd.ripple; g.lineWidth = 3;
    for (let y = 0; y < h; y += 22) {
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / 30 + y) * 5);
      g.stroke();
    }
  }, [60, 60]);
  let groundMat = new THREE.MeshLambertMaterial({ map: tex });
  if (theme.water) groundMat = new THREE.MeshLambertMaterial({ color: theme.water, emissive: 0x05303f });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  if (theme.dunes) {
    const duneMat = new THREE.MeshLambertMaterial({ color: theme.dunes, flatShading: theme.scenery === 'canyon' });
    const duneGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + r() * 0.1;
      const d = 520 + r() * 380;
      const m = new THREE.Mesh(duneGeo, duneMat);
      m.position.set(Math.cos(a) * d, -2, Math.sin(a) * d);
      const tall = theme.scenery === 'canyon' ? 2.2 : 1;
      m.scale.set(90 + r() * 120, (25 + r() * 55) * tall, 60 + r() * 90);
      m.rotation.y = r() * Math.PI;
      group.add(m);
    }
  }
  return { sky, sun };
}

export class Track {
  constructor(scene, course) {
    this.kind = 'race';
    this.course = course;
    this.theme = course.theme;
    this.scene = scene;
    this.curve = new THREE.CatmullRomCurve3(course.ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
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
    const seed = course.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    this.env = buildEnvironment(this.group, scene, this.theme, seed);
    if (this.theme.water) this.buildIsland();
    this.buildRoad();
    this.buildStartGate();
    this.buildPads();
    this.jumpSpots = [];
    this.buildJumps();
    this.b = new Builder(this.group, rng(seed + 1));
    ({ desert: () => this.sceneryDesert(), souq: () => this.scenerySouq(), coast: () => this.sceneryCoast(), canyon: () => this.sceneryCanyon(), mountain: () => this.sceneryMountain() })[this.theme.scenery]();
    for (const i of course.boxes) {
      const p = this.points[i], r = this.rights[i];
      for (const lat of [-8, -2.7, 2.7, 8]) this.boxSpots.push(new THREE.Vector3(p.x + r.x * lat, 1.4, p.z + r.z * lat));
    }
  }

  // ---------- واجهة موحّدة يستخدمها الكارت والمقذوفات ----------
  nearest(pos, hint = -1) {
    const N = this.N;
    let best = 0, bd = Infinity;
    const from = hint < 0 ? 0 : -30, to = hint < 0 ? N - 1 : 30;
    for (let k = from; k <= to; k++) {
      const i = hint < 0 ? k : (hint + k + N) % N;
      const p = this.points[i];
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    const p = this.points[best], r = this.rights[best];
    const lat = (pos.x - p.x) * r.x + (pos.z - p.z) * r.z;
    return { i: best, lat, dist: Math.sqrt(bd) };
  }

  surface(pos, hint) {
    const n = this.nearest(pos, hint);
    return { i: n.i, offroad: Math.abs(n.lat) > ROAD_W / 2 + 2.2 };
  }

  // إبقاء السيارة داخل الحدود
  bound(k) {
    const n = this.nearest(k.pos, k.idx);
    let wall = false;
    if (Math.abs(n.lat) > LIMIT) {
      const r = this.rights[n.i];
      const over = n.lat - Math.sign(n.lat) * LIMIT;
      k.pos.x -= r.x * over; k.pos.z -= r.z * over;
      const t = this.tangents[n.i];
      const ta = Math.atan2(t.x, t.z);
      let d = ta - k.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < Math.PI / 2) k.heading += d * 0.12; else k.heading += (d - Math.sign(d) * Math.PI) * 0.12;
      wall = true;
    }
    return { i: n.i, wall };
  }

  blocked(pos, obj) {
    const n = this.nearest(pos, obj.idx);
    obj.idx = n.i;
    return Math.abs(n.lat) > LIMIT + 1;
  }

  spawn(slot) {
    const row = Math.floor(slot / 2), col = slot % 2;
    const i = (this.N - 6 - row * 4) % this.N;
    const p = this.points[i], r = this.rights[i], t = this.tangents[i];
    const lat = col ? 4.5 : -4.5;
    return { x: p.x + r.x * lat, z: p.z + r.z * lat, h: Math.atan2(t.x, t.z), i };
  }

  distToRoad(x, z) {
    let bd = Infinity;
    for (let i = 0; i < this.N; i += 3) {
      const p = this.points[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) bd = d;
    }
    return Math.sqrt(bd);
  }

  // موضع عشوائي بجانب الطريق (للديكور)
  place(minD, maxD, tries = 40) {
    const r = this.b.r;
    for (let k = 0; k < tries; k++) {
      const i = Math.floor(r() * this.N);
      const p = this.points[i], rt = this.rights[i];
      const s = r() > 0.5 ? 1 : -1;
      const d = minD + r() * (maxD - minD);
      const x = p.x + rt.x * d * s, z = p.z + rt.z * d * s;
      if (this.distToRoad(x, z) > minD - 1) return [x, z, i, s];
    }
    return null;
  }

  // شريط على طول المسار بين إزاحتين جانبيتين
  ribbon(a, b, y, mat, colorsFn) {
    const N = this.N, pos = [], idx = [], col = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N, p = this.points[k], r = this.rights[k];
      pos.push(p.x + r.x * a, y, p.z + r.z * a, p.x + r.x * b, y, p.z + r.z * b);
      if (colorsFn) { const c = colorsFn(i); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
      if (i < N) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (colorsFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    this.group.add(m);
    return m;
  }

  buildIsland() {
    const sand = this.theme.ground;
    const tex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = sand.base; g.fillRect(0, 0, w, h);
      const r = rng(5);
      for (let i = 0; i < 3000; i++) { g.fillStyle = r() > 0.5 ? sand.a : sand.b; g.fillRect(r() * w, r() * h, 2, 2); }
    }, [1, 1]);
    const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
    this.ribbon(-(LIMIT + 45), LIMIT + 45, 0.0, mat);
    // خط الشاطئ الفاتح
    const foam = new THREE.MeshBasicMaterial({ color: 0xbfeaf5, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    this.ribbon(LIMIT + 45, LIMIT + 49, -0.02, foam);
    this.ribbon(-(LIMIT + 49), -(LIMIT + 45), -0.02, foam);
  }

  buildRoad() {
    const N = this.N, th = this.theme;
    const roadTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = th.road.base; g.fillRect(0, 0, w, h);
      const r = rng(3);
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
        g.fillRect(r() * w, r() * h, 2, 2);
      }
      g.strokeStyle = 'rgba(30,20,10,0.3)'; g.lineWidth = 2;
      for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let x = 0; x < w; x += 64) {
        for (let y = 0; y < h; y += 64) {
          const off = (y / 64) % 2 ? 32 : 0;
          g.beginPath(); g.moveTo(x + off, y); g.lineTo(x + off, y + 64); g.stroke();
        }
      }
      g.fillStyle = th.road.line;
      g.fillRect(w / 2 - 3, 0, 6, h / 2);
    });
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;

    const pos = [], uv = [], idx = [];
    let v = 0;
    const hw = ROAD_W / 2;
    for (let i = 0; i <= N; i++) {
      const k = i % N, p = this.points[k], r = this.rights[k];
      if (i > 0) v += this.points[(i - 1) % N].distanceTo(p) / 24;
      pos.push(p.x - r.x * hw, 0.02, p.z - r.z * hw, p.x + r.x * hw, 0.02, p.z + r.z * hw);
      uv.push(0, v, 1, v);
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide })));

    // حواف ملونة
    const c1 = new THREE.Color(th.curb[0]), c2 = new THREE.Color(th.curb[1]);
    const curbMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const cf = (i) => (Math.floor(i / 4) % 2 ? c1 : c2);
    this.ribbon(-hw - 2.2, -hw, 0.06, curbMat, cf);
    this.ribbon(hw, hw + 2.2, 0.06, curbMat, cf);

    // جدران منخفضة على حدود الحلبة
    const wallTex = canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = th.wall.base; g.fillRect(0, 0, w, h);
      g.strokeStyle = th.wall.line; g.lineWidth = 2;
      for (let y = 0; y < h; y += 16) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let x = (y / 16) % 2 ? 16 : 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
      }
      g.fillStyle = th.wall.top; g.fillRect(0, 0, w, 6);
    });
    wallTex.wrapS = THREE.RepeatWrapping;
    for (const s of [-1, 1]) {
      const wp = [], wu = [], wi = [];
      let u = 0;
      for (let i = 0; i <= N; i++) {
        const k = i % N, p = this.points[k], r = this.rights[k];
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
    const p = this.points[0], t = this.tangents[0], gt = this.theme.gate;
    const chk = canvasTex(256, 32, (g) => {
      for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
    });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 3), new THREE.MeshLambertMaterial({ map: chk }));
    line.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group();
    holder.position.set(p.x, 0.08, p.z);
    holder.rotation.y = Math.atan2(t.x, t.z);
    holder.add(line);
    this.group.add(holder);

    const gate = new THREE.Group();
    gate.position.set(p.x, 0, p.z);
    gate.rotation.y = Math.atan2(t.x, t.z);
    const stone = new THREE.MeshLambertMaterial({ color: 0xe8cfa0 });
    const teal = new THREE.MeshLambertMaterial({ color: 0x1aa39a });
    const gold = new THREE.MeshLambertMaterial({ color: 0xf2c14e, emissive: 0x4a3000 });
    for (const s of [-1, 1]) {
      const x = s * (ROAD_W / 2 + 3);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 16, 12), stone); tower.position.set(x, 8, 0); gate.add(tower);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 1, 12), teal); band.position.set(x, 12, 0); gate.add(band);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
      dome.position.set(x, 16, 0); dome.scale.y = 1.5; gate.add(dome);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.5, 8), gold); spike.position.set(x, 20.5, 0); gate.add(spike);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 6, 5, 1), [stone, stone, stone, stone,
      new THREE.MeshBasicMaterial({ map: textTexture(gt[0], { bg: gt[1] }) }),
      new THREE.MeshBasicMaterial({ map: textTexture(gt[2], { bg: gt[3] }) })]);
    banner.position.set(0, 13, 0);
    gate.add(banner);
    this.group.add(gate);
  }

  buildPads() {
    const mat = new THREE.MeshBasicMaterial({ map: padTexture() });
    for (const [i, lat] of this.course.pads) {
      const p = this.points[i], r = this.rights[i], t = this.tangents[i];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), mat);
      const holder = new THREE.Group();
      holder.position.set(p.x + r.x * lat, 0.1, p.z + r.z * lat);
      holder.rotation.y = Math.atan2(t.x, t.z);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.PI;
      holder.add(m);
      this.group.add(holder);
      this.padSpots.push({ x: holder.position.x, z: holder.position.z });
    }
  }

  // منحدرات قفز بعرض الطريق
  buildJumps() {
    const geo = rampGeometry(ROAD_W, 6, 1.3);
    const mat = new THREE.MeshLambertMaterial({ map: rampTexture() });
    for (const i of this.course.jumps || []) {
      const p = this.points[i], t = this.tangents[i];
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p.x, 0.02, p.z);
      m.rotation.y = Math.atan2(t.x, t.z);
      this.group.add(m);
      this.jumpSpots.push({ x: p.x, z: p.z, tx: t.x, tz: t.z, hw: ROAD_W / 2 + 2, hl: 3 });
    }
  }

  // ---------- ديكور كل مكان ----------
  edgeLanterns(step = 24, h = 5) {
    for (let i = 10; i < this.N; i += step) {
      const p = this.points[i], rt = this.rights[i];
      const s = Math.floor(i / step) % 2 ? 1 : -1;
      this.b.lantern(p.x + rt.x * (ROAD_W / 2 + 4) * s, p.z + rt.z * (ROAD_W / 2 + 4) * s, h);
    }
  }

  sceneryDesert() {
    const b = this.b, r = b.r;
    for (let k = 0; k < 70; k++) { const pt = this.place(LIMIT + 4, LIMIT + 30); if (pt) b.palm(pt[0], pt[1], 7 + r() * 6); }
    // الواحة: أبعد نقطة عن الطريق داخل الحلبة
    let ox = 0, oz = 0, od = 0;
    for (let x = -200; x <= 200; x += 20) for (let z = -150; z <= 250; z += 20) { const d = this.distToRoad(x, z); if (d > od && d < 120) { od = d; ox = x; oz = z; } }
    const orad = Math.min(30, od - LIMIT - 8);
    if (orad > 10) {
      const oasis = new THREE.Mesh(new THREE.CircleGeometry(orad, 32), new THREE.MeshLambertMaterial({ color: 0x2bb3c0, emissive: 0x062a33 }));
      oasis.rotation.x = -Math.PI / 2; oasis.position.set(ox, 0.05, oz); this.group.add(oasis);
      const shore = new THREE.Mesh(new THREE.RingGeometry(orad, orad + 6, 32), new THREE.MeshLambertMaterial({ color: 0x9cbf5a }));
      shore.rotation.x = -Math.PI / 2; shore.position.set(ox, 0.04, oz); this.group.add(shore);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; b.palm(ox + Math.cos(a) * (orad + 4), oz + Math.sin(a) * (orad + 4), 8 + r() * 5); }
    }
    for (let k = 0; k < 26; k++) { const pt = this.place(LIMIT + 14, LIMIT + 60); if (pt) b.house(pt[0], pt[1]); }
    for (let k = 0; k < 6; k++) { const pt = this.place(LIMIT + 22, LIMIT + 70); if (pt) b.minaret(pt[0], pt[1]); }
    for (let k = 0; k < 9; k++) { const pt = this.place(LIMIT + 6, LIMIT + 25); if (pt) b.camel(pt[0], pt[1]); }
    this.edgeLanterns(this.theme.night ? 14 : 24);
    for (let k = 0; k < 40; k++) { const pt = this.place(LIMIT + 3, LIMIT + 45); if (pt) b.rock(pt[0], pt[1]); }
    if (this.theme.night) {
      // نار مخيم وأضواء دافئة في الليل
      for (const i of [0, 120, 240, 360, 480]) {
        const p = this.points[i];
        const l = new THREE.PointLight(0xffa040, 700, 110, 1.6);
        l.position.set(p.x, 10, p.z);
        this.group.add(l);
      }
      for (let k = 0; k < 6; k++) { const pt = this.place(LIMIT + 10, LIMIT + 30); if (pt) b.tent(pt[0], pt[1]); }
    }
  }

  sceneryMountain() {
    const b = this.b, r = b.r;
    const greys = [new THREE.MeshLambertMaterial({ color: 0x7d7a72, flatShading: true }), new THREE.MeshLambertMaterial({ color: 0x6a6f68, flatShading: true }), new THREE.MeshLambertMaterial({ color: 0x8f8778, flatShading: true })];
    for (let k = 0; k < 30; k++) { const pt = this.place(LIMIT + 35, LIMIT + 130); if (pt) b.mesa(pt[0], pt[1], 16 + r() * 26, 40 + r() * 80, greys[k % 3]); }
    for (let k = 0; k < 45; k++) { const pt = this.place(LIMIT + 3, LIMIT + 40); if (pt) b.rock(pt[0], pt[1], 1.5 + r() * 3.5, greys[k % 3]); }
    // بساتين نخيل وقرى طينية بأبراج مراقبة
    for (let k = 0; k < 50; k++) { const pt = this.place(LIMIT + 4, LIMIT + 28); if (pt) b.palm(pt[0], pt[1], 7 + r() * 5); }
    const mud = new THREE.MeshLambertMaterial({ color: 0xb08a5e });
    for (let k = 0; k < 18; k++) { const pt = this.place(LIMIT + 14, LIMIT + 45); if (pt) b.house(pt[0], pt[1], { mat: mud, dome: false }); }
    for (let k = 0; k < 5; k++) {
      const pt = this.place(LIMIT + 20, LIMIT + 50);
      if (!pt) continue;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 14, 12), mud); t.position.set(pt[0], 7, pt[1]); this.group.add(t);
      for (let c = 0; c < 8; c++) { const a = c / 8 * Math.PI * 2; const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.2), mud); m.position.set(pt[0] + Math.cos(a) * 3.8, 14.6, pt[1] + Math.sin(a) * 3.8); this.group.add(m); }
    }
    for (let k = 0; k < 15; k++) { const pt = this.place(LIMIT + 4, LIMIT + 40); if (pt) b.acacia(pt[0], pt[1]); }
    for (let k = 0; k < 6; k++) { const pt = this.place(LIMIT + 6, LIMIT + 25); if (pt) b.camel(pt[0], pt[1]); }
    this.edgeLanterns(30, 5);
  }

  scenerySouq() {
    const b = this.b, r = b.r;
    const walls = [new THREE.MeshLambertMaterial({ color: 0xd8c2a0 }), new THREE.MeshLambertMaterial({ color: 0xc4a27a }), new THREE.MeshLambertMaterial({ color: 0xe6d5b8 })];
    const win = new THREE.MeshLambertMaterial({ color: 0x3a1f0c, emissive: 0x3a2000 });
    // صفوف متلاصقة من البيوت على جانبي الطريق
    for (let i = 0; i < this.N; i += 7) {
      for (const s of [-1, 1]) {
        if (r() < 0.15) continue;
        const p = this.points[i], rt = this.rights[i];
        const d = LIMIT + 9 + r() * 4;
        const x = p.x + rt.x * d * s, z = p.z + rt.z * d * s;
        if (this.distToRoad(x, z) < LIMIT + 5) continue;
        b.house(x, z, { w: 13, d: 10, h: 8 + r() * 12, mat: walls[Math.floor(r() * 3)], windows: true, windowMat: win, dome: r() > 0.7, rot: Math.atan2(-rt.x * s, -rt.z * s) });
      }
    }
    for (let k = 0; k < 24; k++) {
      const pt = this.place(LIMIT + 3, LIMIT + 4);
      if (pt) { const rt = this.rights[pt[2]]; b.stall(pt[0], pt[1], Math.atan2(-rt.x * pt[3], -rt.z * pt[3])); }
    }
    b.mosque(-20, 70, 0.3);
    this.edgeLanterns(12, 4.5);
    // فوانيس معلقة فوق الطريق
    for (const i of [30, 140, 260, 380, 480, 570]) {
      const p = this.points[i], rt = this.rights[i];
      const w = LIMIT + 2;
      b.stringLights({ x: p.x - rt.x * w, z: p.z - rt.z * w }, { x: p.x + rt.x * w, z: p.z + rt.z * w }, 10);
    }
    // أضواء دافئة حقيقية قليلة
    for (const i of [0, 150, 300, 450]) {
      const p = this.points[i];
      const l = new THREE.PointLight(0xffb050, 900, 120, 1.6);
      l.position.set(p.x, 12, p.z);
      this.group.add(l);
    }
  }

  sceneryCoast() {
    const b = this.b, r = b.r;
    for (let k = 0; k < 60; k++) { const pt = this.place(LIMIT + 4, LIMIT + 30); if (pt) b.palm(pt[0], pt[1], 8 + r() * 6); }
    for (let k = 0; k < 20; k++) { const pt = this.place(LIMIT + 6, LIMIT + 38); if (pt) b.umbrella(pt[0], pt[1]); }
    // سفن شراعية في البحر
    for (let k = 0; k < 14; k++) {
      const pt = this.place(LIMIT + 70, LIMIT + 160);
      if (pt) b.dhow(pt[0], pt[1], r() * 6);
    }
    for (let k = 0; k < 5; k++) { const a = r() * 6; b.dhow(60 + Math.cos(a) * 60, 40 + Math.sin(a) * 60, r() * 6); }
    // أبراج المدينة في الأفق
    const glass = [new THREE.MeshLambertMaterial({ color: 0x9fc9e0, emissive: 0x0a2030 }), new THREE.MeshLambertMaterial({ color: 0xd8e4ec }), new THREE.MeshLambertMaterial({ color: 0x6f9fc0 })];
    for (let k = 0; k < 30; k++) {
      const x = 420 + r() * 260, z = -250 + r() * 500;
      b.tower(x, z, 40 + r() * 120, 12 + r() * 14, glass[k % 3]);
    }
    b.spire(520, 50, glass[1]);
    b.sailTower(400, -330, glass[1]);
    b.lighthouse(-330, 150);
    this.edgeLanterns(30, 6);
  }

  sceneryCanyon() {
    const b = this.b, r = b.r;
    const reds = [new THREE.MeshLambertMaterial({ color: 0xb4502a, flatShading: true }), new THREE.MeshLambertMaterial({ color: 0x9c4024, flatShading: true }), new THREE.MeshLambertMaterial({ color: 0xc8683a, flatShading: true })];
    for (let k = 0; k < 34; k++) {
      const pt = this.place(LIMIT + 30, LIMIT + 120);
      if (pt) b.mesa(pt[0], pt[1], 14 + r() * 22, 30 + r() * 60, reds[k % 3]);
    }
    for (let k = 0; k < 50; k++) { const pt = this.place(LIMIT + 3, LIMIT + 40); if (pt) b.rock(pt[0], pt[1], 1.5 + r() * 4, reds[k % 3]); }
    for (let k = 0; k < 8; k++) { const pt = this.place(LIMIT + 8, LIMIT + 30); if (pt) b.tent(pt[0], pt[1]); }
    for (let k = 0; k < 8; k++) { const pt = this.place(LIMIT + 6, LIMIT + 30); if (pt) b.camel(pt[0], pt[1]); }
    for (let k = 0; k < 25; k++) { const pt = this.place(LIMIT + 4, LIMIT + 50); if (pt) b.acacia(pt[0], pt[1]); }
    // أقواس صخرية فوق الطريق
    for (const i of [110, 400]) {
      const p = this.points[i], t = this.tangents[i];
      const arch = new THREE.Mesh(new THREE.TorusGeometry(LIMIT + 3, 4.5, 6, 18, Math.PI), reds[1]);
      arch.position.set(p.x, 0, p.z);
      arch.rotation.y = Math.atan2(t.x, t.z); // مستوى القوس عمودي على اتجاه الطريق
      arch.scale.y = 0.8;
      this.group.add(arch);
    }
    this.edgeLanterns(30, 5);
  }
}

// منحدر على شكل إسفين: يرتفع من ٠ إلى h على طول len
export function rampGeometry(width, len, h) {
  const sh = new THREE.Shape();
  sh.moveTo(-len / 2, 0); sh.lineTo(len / 2, h); sh.lineTo(len / 2, 0); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

export function rampTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f2c14e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7a1f1f';
    for (let k = -w; k < w * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 16, 0); g.lineTo(k + 16 - h, h); g.lineTo(k - h, h); g.fill(); }
  });
}

export function padTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#0e7c74'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7ff7e8';
    for (let k = 0; k < 2; k++) {
      const y = 20 + k * 56;
      g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w - 18, y + 36); g.lineTo(w - 38, y + 36); g.lineTo(w / 2, y + 16); g.lineTo(38, y + 36); g.lineTo(18, y + 36); g.closePath(); g.fill();
    }
    g.strokeStyle = '#f2c14e'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
}
