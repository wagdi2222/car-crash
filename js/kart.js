// السيارات: الشكل والفيزياء
import * as THREE from '../lib/three.module.min.js';

export const CHARS = [
  { name: 'صقر', color: 0xd62828, trim: 0xf2c14e, wear: 'ghutra', cloth: 0xffffff, desc: 'سريع كالصقر' },
  { name: 'ليلى', color: 0x7b2cbf, trim: 0xffd166, wear: 'hijab', cloth: 0xff70a6, desc: 'ملكة الانجراف' },
  { name: 'جحا', color: 0x2a9d8f, trim: 0xf4e285, wear: 'turban', cloth: 0xf4e285, desc: 'ماكر وظريف' },
  { name: 'شهرزاد', color: 0xe9a23b, trim: 0x9b2226, wear: 'hijab', cloth: 0x9b2226, desc: 'ألف حكاية وحكاية' },
  { name: 'سندباد', color: 0x1d70b8, trim: 0xffffff, wear: 'turban', cloth: 0xffffff, desc: 'بحّار الصحراء' },
  { name: 'عنترة', color: 0x333333, trim: 0xf77f00, wear: 'ghutra', cloth: 0xd62828, desc: 'فارس لا يُهزم' },
];

export const MAX_SPEED = 46;
const ACC = 26, BRAKE = 55, REV = -14;

export const F = { DRIFT: 1, DLEFT: 2, SPIN: 4, SHIELD: 8, BOOST: 16, GENIE: 32, CARPET: 64, STORM: 128, FIN: 256, AIR: 512, OUT: 1024 };

function buildModel(ch) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const paint = new THREE.MeshLambertMaterial({ color: ch.color });
  const trim = new THREE.MeshLambertMaterial({ color: ch.trim, emissive: new THREE.Color(ch.trim).multiplyScalar(0.15) });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1b1b1b });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
  const cloth = new THREE.MeshLambertMaterial({ color: ch.cloth });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 3.4), paint);
  base.position.y = 0.6; body.add(base);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.4), paint);
  nose.position.set(0, 0.62, 2.2); body.add(nose);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 0.3), trim);
  bumper.position.set(0, 0.5, 2.95); body.add(bumper);
  const side1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 2.6), trim);
  side1.position.set(1.12, 0.75, 0); body.add(side1);
  const side2 = side1.clone(); side2.position.x = -1.12; body.add(side2);
  // جناح خلفي على شكل قوس
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.6), trim);
  wing.position.set(0, 1.55, -1.6); body.add(wing);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.3), dark);
    post.position.set(s * 0.8, 1.15, -1.6); body.add(post);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), trim);
  star.position.set(0, 0.95, 2.4); star.scale.set(1, 0.4, 1); body.add(star);
  // عوادم
  for (const s of [-1, 1]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8), trim);
    ex.rotation.x = Math.PI / 2; ex.position.set(s * 0.5, 0.75, -1.9); body.add(ex);
  }
  // السائق
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 10), new THREE.MeshLambertMaterial({ color: 0xf5f0e6 }));
  torso.position.set(0, 1.25, -0.4); body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), skin);
  head.position.set(0, 2.0, -0.4); body.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    eye.position.set(s * 0.15, 2.05, -0.02); body.add(eye);
  }
  if (ch.wear === 'ghutra') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cloth);
    cap.position.set(0, 2.02, -0.42); body.add(cap);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 0.9, 12, 1, true, Math.PI * 0.35, Math.PI * 1.3), cloth);
    drape.position.set(0, 1.65, -0.45); drape.rotation.y = Math.PI; body.add(drape);
    const agal = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 18), dark);
    agal.rotation.x = Math.PI / 2; agal.position.set(0, 2.32, -0.42); body.add(agal);
  } else if (ch.wear === 'turban') {
    for (let k = 0; k < 3; k++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.38 - k * 0.08, 0.15, 8, 16), cloth);
      t.rotation.x = Math.PI / 2; t.position.set(0, 2.25 + k * 0.17, -0.4); body.add(t);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), trim);
    gem.position.set(0, 2.32, -0.02); body.add(gem);
  } else {
    const hij = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth);
    hij.position.set(0, 1.98, -0.45); hij.rotation.x = -0.25; body.add(hij);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 0.8, 12, 1, true, Math.PI * 0.4, Math.PI * 1.2), cloth);
    back.position.set(0, 1.62, -0.48); back.rotation.y = Math.PI; body.add(back);
  }
  // المقود
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 6, 12), dark);
  sw.position.set(0, 1.35, 0.35); sw.rotation.x = -0.6; body.add(sw);

  // العجلات
  const wheels = [];
  const wGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 14);
  const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.52, 8);
  for (const [x, z, s] of [[-1.25, 1.3, 0.85], [1.25, 1.3, 0.85], [-1.3, -1.25, 1], [1.3, -1.25, 1]]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wGeo, dark);
    tire.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(rimGeo, trim);
    rim.rotation.z = Math.PI / 2;
    w.add(tire, rim);
    w.position.set(x, 0.55 * s, z);
    w.scale.setScalar(s);
    g.add(w);
    wheels.push(w);
  }

  // بساط الريح (يظهر عند استخدامه)
  const carpetTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#9b2226'; x.fillRect(0, 0, 64, 128);
    x.strokeStyle = '#f2c14e'; x.lineWidth = 5; x.strokeRect(5, 5, 54, 118);
    x.fillStyle = '#1aa39a';
    for (let y = 24; y < 120; y += 30) { x.beginPath(); x.moveTo(32, y - 12); x.lineTo(46, y); x.lineTo(32, y + 12); x.lineTo(18, y); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.6, 1, 6), new THREE.MeshLambertMaterial({ map: carpetTex, side: THREE.DoubleSide }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.y = 0.15;
  carpet.visible = false;
  g.add(carpet);

  // درع
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0x5ce1e6, transparent: true, opacity: 0.25, depthWrite: false }));
  shield.position.y = 1.1;
  shield.visible = false;
  g.add(shield);

  // ظل
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1.9, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.scale.set(1, 1.5, 1);

  return { g, body, wheels, carpet, shield, shadow: sh, paint };
}

let nameCanvasCache = new Map();
function nameSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px Cairo, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(text, 128, 32);
  g.fillStyle = '#' + new THREE.Color(color).getHexString(); g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(5, 1.25, 1);
  s.position.y = 3.6;
  s.renderOrder = 10;
  return s;
}

export class Kart {
  constructor(scene, { id, name, char, owned, bot }) {
    this.id = id; this.name = name; this.char = char % CHARS.length;
    this.owned = owned; this.bot = bot;
    const ch = CHARS[this.char];
    this.color = ch.color;
    const m = buildModel(ch);
    Object.assign(this, { mesh: m.g, body: m.body, wheels: m.wheels, carpetMesh: m.carpet, shieldMesh: m.shield, shadow: m.shadow });
    scene.add(this.mesh); scene.add(this.shadow);
    if (!owned || bot) { this.label = nameSprite(name, 0xffffff); this.mesh.add(this.label); }
    this.pos = new THREE.Vector3();
    this.heading = 0; this.speed = 0; this.y = 0; this.vy = 0;
    this.drifting = false; this.driftDir = 0; this.driftT = 0; this.driftLvl = 0;
    this.boostT = 0; this.spinT = 0; this.spinAng = 0; this.shieldT = 0; this.genieT = 0; this.carpetT = 0; this.stormT = 0;
    this.item = null; this.itemCount = 0; this.rolling = 0;
    this.idx = 0; this.prog = 0; this.lastLat = 0; this.offroad = false;
    this.finished = false; this.finishTime = 0;
    this.lives = 3; this.hits = 0; this.out = false; this.outTime = 0;
    this.wrongT = 0;
    this.botSpeed = 1;
    // للسيارات البعيدة
    this.target = null; this.flags = 0;
    this.wheelRot = 0;
  }

  get fwd() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  get right() { return new THREE.Vector3(-Math.cos(this.heading), 0, Math.sin(this.heading)); }

  place(track, slot, total) {
    // موضع الانطلاق تحدده الحلبة (صفوف خلف الخط، أو دائرة في ساحة المعركة)
    const s = track.spawn(slot, total);
    this.pos.set(s.x, 0, s.z);
    this.heading = s.h;
    this.idx = s.i;
    this.prog = track.kind === 'race' ? s.i - track.N : 0;
    this.speed = 0;
    this.syncMesh(0);
  }

  get flagsNow() {
    let f = 0;
    if (this.drifting) f |= F.DRIFT;
    if (this.driftDir > 0) f |= F.DLEFT;
    if (this.spinT > 0) f |= F.SPIN;
    if (this.shieldT > 0) f |= F.SHIELD;
    if (this.boostT > 0) f |= F.BOOST;
    if (this.genieT > 0) f |= F.GENIE;
    if (this.carpetT > 0) f |= F.CARPET;
    if (this.stormT > 0) f |= F.STORM;
    if (this.finished) f |= F.FIN;
    if (this.out) f |= F.OUT;
    return f;
  }

  boost(t) { this.boostT = Math.max(this.boostT, t); }

  // يرجع true إذا أصابت الضربة السيارة فعلاً
  hit(kind) {
    if (this.genieT > 0) return false;
    if (this.shieldT > 0) { this.shieldT = 0; return false; }
    this.spinT = kind === 'oil' ? 1.0 : 1.4;
    if (kind !== 'oil') this.vy = 8;
    this.drifting = false; this.driftT = 0; this.boostT = 0; this.carpetT = 0;
    return true;
  }

  update(dt, inp, track, fx) {
    const ev = {};
    // العدادات
    for (const k of ['boostT', 'shieldT', 'genieT', 'carpetT', 'stormT']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);

    this.offroad = track.surface(this.pos, this.idx).offroad;

    let max = MAX_SPEED * this.botSpeed;
    if (this.offroad && this.genieT <= 0 && this.carpetT <= 0) max *= 0.55;
    if (this.boostT > 0) max *= 1.38;
    if (this.genieT > 0) max *= 1.22;
    if (this.stormT > 0) max *= 0.72;

    const grounded = this.y <= 0.001;
    if (this.spinT > 0) {
      this.spinT -= dt;
      this.spinAng += dt * 14;
      this.speed *= Math.pow(0.2, dt);
      if (this.spinT <= 0) this.spinAng = 0;
    } else {
      // التسارع والكبح
      if (this.boostT > 0 && this.speed < max) this.speed = Math.min(max, this.speed + 90 * dt);
      if (inp.up) {
        if (this.speed < max) this.speed = Math.min(max, this.speed + ACC * dt * (this.speed < 0 ? 2 : 1));
      } else if (inp.down) {
        if (this.speed > 0) this.speed = Math.max(0, this.speed - BRAKE * dt);
        else this.speed = Math.max(REV, this.speed - ACC * 0.6 * dt);
      } else {
        const c = 14 * dt;
        this.speed = Math.abs(this.speed) < c ? 0 : this.speed - Math.sign(this.speed) * c;
      }
      if (this.speed > max) this.speed = Math.max(max, this.speed - (this.speed - max) * 2.5 * dt);

      // القفزة والانجراف
      if (inp.driftPressed && grounded && this.speed > 5) { this.vy = 5.5; ev.hop = true; }
      if (!this.drifting && inp.drift && this.y > 0 && this.y < 0.6 && this.vy < 0 && Math.abs(inp.steer) > 0.3 && this.speed > 18) {
        this.drifting = true; this.driftDir = Math.sign(inp.steer); this.driftT = 0; this.driftLvl = 0;
      }
      const sf = Math.min(1, Math.abs(this.speed) / 14) * Math.sign(this.speed || 1);
      if (this.drifting) {
        const into = inp.steer * this.driftDir; // -1..1
        this.heading += this.driftDir * (1.25 + 0.75 * into) * sf * dt;
        this.driftT += dt * (1 + Math.max(0, into) * 0.5);
        const lvl = this.driftT > 2.6 ? 3 : this.driftT > 1.6 ? 2 : this.driftT > 0.7 ? 1 : 0;
        if (lvl > this.driftLvl) { this.driftLvl = lvl; ev.driftLvl = lvl; }
        if (!inp.drift || this.speed < 12 || this.offroad && this.genieT <= 0) {
          if (this.driftLvl > 0) { this.boost([0, 0.8, 1.3, 1.9][this.driftLvl]); ev.driftBoost = this.driftLvl; }
          this.drifting = false; this.driftT = 0; this.driftLvl = 0;
        }
      } else {
        const hiSpeed = 1 - 0.3 * Math.min(1, Math.abs(this.speed) / MAX_SPEED);
        this.heading += inp.steer * 2.1 * hiSpeed * sf * dt;
      }
    }

    // الحركة
    const f = this.fwd;
    this.pos.addScaledVector(f, this.speed * dt);
    if (this.drifting) this.pos.addScaledVector(this.right, this.driftDir * this.speed * 0.12 * dt);
    this.vy -= 22 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y <= 0) this.vy = 0;

    // منصات التسارع
    for (const p of track.padSpots) {
      if ((p.x - this.pos.x) ** 2 + (p.z - this.pos.z) ** 2 < 14 && this.boostT < 0.9) { this.boost(1.1); ev.pad = true; }
    }

    // حدود الحلبة والعوائق
    const b = track.bound(this);
    if (b.wall) { this.speed *= Math.pow(0.35, dt); ev.wall = true; }

    // التقدّم في السباق
    if (track.kind === 'race') {
      let delta = b.i - this.idx;
      if (delta < -track.N / 2) delta += track.N;
      if (delta > track.N / 2) delta -= track.N;
      this.prog += delta;
      this.idx = b.i;
      const td = track.tangents[b.i];
      if (f.x * td.x + f.z * td.z < -0.3 && this.speed > 5) this.wrongT += dt; else this.wrongT = 0;
    }

    // مؤثرات
    if (fx) {
      const back = this.pos.clone().addScaledVector(f, -1.6);
      if (this.drifting && grounded) {
        const col = [0xffffff, 0x4cc9f0, 0xff9f1c, 0xc77dff][this.driftLvl];
        for (const s of [-1, 1]) fx.spark(back.clone().addScaledVector(this.right, s * 1.2).setY(0.3), col);
      }
      if (this.offroad && Math.abs(this.speed) > 10 && grounded && Math.random() < 0.6) fx.dust(back.clone().setY(0.4));
      if (this.boostT > 0) fx.flame(back.clone().setY(0.8), f);
      if (this.carpetT > 0 && Math.random() < 0.5) fx.sparkle(this.pos.clone().setY(0.4));
      if (this.genieT > 0) fx.sparkle(this.pos.clone().setY(1 + Math.random() * 2));
    }
    this.syncMesh(dt, inp.steer);
    return ev;
  }

  // تحديث سيارة لاعب آخر من الشبكة (استيفاء)
  updateRemote(dt, fx) {
    const t = this.target;
    if (!t) return;
    // توقع الموقع وفق السرعة
    t.x += Math.sin(t.h) * t.sp * dt; t.z += Math.cos(t.h) * t.sp * dt;
    const a = 1 - Math.exp(-10 * dt);
    if ((t.x - this.pos.x) ** 2 + (t.z - this.pos.z) ** 2 > 400) { this.pos.set(t.x, 0, t.z); }
    this.pos.x += (t.x - this.pos.x) * a;
    this.pos.z += (t.z - this.pos.z) * a;
    this.y += (t.y - this.y) * a;
    let d = t.h - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * a;
    this.speed = t.sp;
    const fl = this.flags;
    this.drifting = !!(fl & F.DRIFT); this.driftDir = fl & F.DLEFT ? 1 : -1;
    this.shieldT = fl & F.SHIELD ? 1 : 0;
    this.boostT = fl & F.BOOST ? 1 : 0;
    this.genieT = fl & F.GENIE ? 1 : 0;
    this.carpetT = fl & F.CARPET ? 1 : 0;
    this.stormT = fl & F.STORM ? 1 : 0;
    if (fl & F.SPIN) this.spinAng += dt * 14; else this.spinAng = 0;
    if (fx) {
      const f = this.fwd;
      const back = this.pos.clone().addScaledVector(f, -1.6);
      if (this.drifting) for (const s of [-1, 1]) fx.spark(back.clone().addScaledVector(this.right, s * 1.2).setY(0.3), 0xffffff);
      if (this.boostT > 0) fx.flame(back.clone().setY(0.8), f);
      if (this.genieT > 0) fx.sparkle(this.pos.clone().setY(1 + Math.random() * 2));
    }
    this.syncMesh(dt, this.drifting ? this.driftDir : 0);
  }

  syncMesh(dt, steer = 0) {
    const lift = this.carpetT > 0 ? 0.8 + Math.sin(performance.now() / 150) * 0.15 : 0;
    this.mesh.position.set(this.pos.x, this.y + lift, this.pos.z);
    this.mesh.rotation.y = this.heading + (this.drifting ? this.driftDir * 0.45 : 0) + this.spinAng;
    this.body.rotation.z = -steer * 0.06 * Math.min(1, Math.abs(this.speed) / 20) + (this.drifting ? -this.driftDir * 0.06 : 0);
    this.body.rotation.x = this.spinT > 0 && this.y > 0 ? -this.y * 0.25 : 0;
    this.wheelRot += this.speed * dt / 0.55;
    this.wheels.forEach((w, i) => {
      w.children[0].rotation.x = this.wheelRot; w.children[1].rotation.x = this.wheelRot;
      if (i < 2) w.rotation.y = steer * 0.35;
    });
    this.carpetMesh.visible = this.carpetT > 0;
    if (this.carpetMesh.visible) {
      const a = this.carpetMesh.geometry.attributes.position;
      const tt = performance.now() / 120;
      for (let i = 0; i < a.count; i++) a.setZ(i, Math.sin(tt + a.getY(i) * 1.4) * 0.15);
      a.needsUpdate = true;
    }
    this.shieldMesh.visible = this.shieldT > 0;
    this.shieldMesh.material.opacity = 0.22 + Math.sin(performance.now() / 120) * 0.06;
    if (this.genieT > 0) {
      this.body.children[0].material.emissive.setHex(Math.sin(performance.now() / 70) > 0 ? 0x7a5a00 : 0x2a0a4a);
    } else this.body.children[0].material.emissive.setHex(0x000000);
    this.shadow.position.set(this.pos.x, 0.1, this.pos.z);
    this.shadow.rotation.z = this.heading;
    this.shadow.material.opacity = 0.3 / (1 + (this.y + lift) * 0.5);
  }

  dispose(scene) {
    scene.remove(this.mesh); scene.remove(this.shadow);
  }
}
