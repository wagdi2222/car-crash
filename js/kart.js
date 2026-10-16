// السيارات: الشكل والفيزياء
import * as THREE from '../lib/three.module.min.js';

// st = [السرعة، التسارع، التحكم] من ١ إلى ٥
export const CHARS = [
  { name: 'صقر', color: 0xd62828, trim: 0xf2c14e, wear: 'ghutra', cloth: 0xffffff, desc: 'سريع كالصقر', st: [5, 3, 2] },
  { name: 'ليلى', color: 0x7b2cbf, trim: 0xffd166, wear: 'hijab', cloth: 0xff70a6, desc: 'ملكة الانجراف', st: [3, 3, 5] },
  { name: 'جحا', color: 0x2a9d8f, trim: 0xf4e285, wear: 'turban', cloth: 0xf4e285, desc: 'ماكر وظريف', st: [2, 5, 4] },
  { name: 'شهرزاد', color: 0xe9a23b, trim: 0x9b2226, wear: 'hijab', cloth: 0x9b2226, desc: 'ألف حكاية وحكاية', st: [3, 4, 3] },
  { name: 'سندباد', color: 0x1d70b8, trim: 0xffffff, wear: 'turban', cloth: 0xffffff, desc: 'بحّار الصحراء', st: [4, 3, 3] },
  { name: 'عنترة', color: 0x333333, trim: 0xf77f00, wear: 'ghutra', cloth: 0xd62828, desc: 'فارس لا يُهزم', st: [4, 4, 2] },
  { name: 'علاء الدين', color: 0xff006e, trim: 0xffd166, wear: 'fez', cloth: 0xc1121f, shirt: 0x7b2cbf, desc: 'صاحب المصباح', st: [3, 5, 3] },
  { name: 'ياسمين', color: 0x00b4d8, trim: 0xf2c14e, wear: 'tiara', cloth: 0x48cae4, shirt: 0x48cae4, desc: 'أميرة سريعة البديهة', st: [2, 4, 5] },
  { name: 'المارد', color: 0x3a0ca3, trim: 0xf2c14e, wear: 'genie', cloth: 0xf2c14e, skin: 0x4ea8de, shirt: 0x3a0ca3, desc: 'قوة خارقة وسرعة هائلة', st: [5, 2, 3] },
  { name: 'حمدان', color: 0x80b918, trim: 0x111111, wear: 'shemagh', cloth: 0xd62828, desc: 'صقّار من البادية', st: [4, 2, 4] },
];

export const MAX_SPEED = 46;
const ACC = 26, BRAKE = 55, REV = -14;

export const F = { DRIFT: 1, DLEFT: 2, SPIN: 4, SHIELD: 8, BOOST: 16, GENIE: 32, CARPET: 64, STORM: 128, FIN: 256, AIR: 512, OUT: 1024, CLOAK: 2048, AMULET: 4096 };

// هل الظلال الحقيقية مفعّلة؟ (تُضبط من إعداد الجودة)
export const KART_GFX = { realShadows: false };

const STD = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0, ...o });

function checkerTex(a, b) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = b; g.lineWidth = 3;
  for (let i = -64; i < 128; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return t;
}

// جسم الكارت: مقطع جانبي منحني يُمدّ بالعرض
function bodyGeometry() {
  const sh = new THREE.Shape();
  sh.moveTo(-1.9, 0.3);
  sh.lineTo(-1.9, 0.95);
  sh.quadraticCurveTo(-1.6, 1.18, -1.1, 1.08);
  sh.lineTo(-0.85, 0.82);
  sh.lineTo(0.45, 0.82);
  sh.quadraticCurveTo(1.0, 1.12, 1.6, 0.98);
  sh.lineTo(2.85, 0.62);
  sh.quadraticCurveTo(3.15, 0.48, 2.85, 0.33);
  sh.lineTo(-1.9, 0.3);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.16, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -0.8);
  geo.rotateY(-Math.PI / 2);
  return geo;
}
let BODY_GEO = null;

function buildModel(ch) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const paint = STD(ch.color, { roughness: 0.28, metalness: 0.35 });
  const trim = STD(ch.trim, { roughness: 0.3, metalness: 0.8 });
  const dark = STD(0x1b1b1b, { roughness: 0.85 });
  const chrome = STD(0xdddddd, { roughness: 0.2, metalness: 1 });
  const skin = STD(ch.skin || 0xc68642, { roughness: 0.7 });
  const cloth = ch.wear === 'shemagh' ? STD(0xffffff, { map: checkerTex('#ffffff', '#c1121f'), roughness: 0.9 }) : STD(ch.cloth, { roughness: 0.9 });
  const shirt = STD(ch.shirt || 0xf5f0e6, { roughness: 0.9 });
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  BODY_GEO = BODY_GEO || bodyGeometry();
  add(BODY_GEO, paint, 0, 0, 0);
  // جوانب انسيابية
  for (const s of [-1, 1]) {
    const pod = add(new THREE.CapsuleGeometry(0.3, 1.7, 4, 10), paint, s * 1.12, 0.52, 0.1);
    pod.rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.08, 0.12, 1.9), trim, s * 1.43, 0.55, 0.1);
  }
  // الجناح الأمامي
  add(new THREE.BoxGeometry(2.7, 0.08, 0.55), trim, 0, 0.32, 3.0);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.35, 0.6), dark, s * 1.35, 0.42, 3.0);
  // الجناح الخلفي
  const wing = add(new THREE.BoxGeometry(2.5, 0.1, 0.75), trim, 0, 1.78, -1.75);
  wing.rotation.x = -0.12;
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.08, 0.6, 0.9), paint, s * 1.25, 1.62, -1.75);
    add(new THREE.BoxGeometry(0.1, 0.75, 0.18), dark, s * 0.6, 1.3, -1.7);
  }
  // المحرك والعوادم
  add(new THREE.CylinderGeometry(0.45, 0.5, 0.6, 12), chrome, 0, 1.05, -1.55);
  for (const s of [-1, 1]) {
    const ex = add(new THREE.CylinderGeometry(0.13, 0.18, 0.7, 10), chrome, s * 0.45, 0.8, -2.05);
    ex.rotation.x = Math.PI / 2 + 0.25;
  }
  // أضواء أمامية وخلفية (تتوهج مع تأثير الإضاءة)
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2c0).multiplyScalar(2.5) });
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a2a).multiplyScalar(2) });
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.13, 10, 8), head, s * 0.55, 0.62, 2.95);
    add(new THREE.BoxGeometry(0.35, 0.12, 0.05), tail, s * 0.55, 0.85, -2.08);
  }
  // نجمة على المقدمة
  const star = add(new THREE.OctahedronGeometry(0.32, 0), trim, 0, 0.98, 1.75);
  star.scale.set(1, 0.35, 1);
  // المقعد
  add(new THREE.BoxGeometry(1.1, 0.9, 0.25), dark, 0, 1.2, -0.95);

  // السائق
  const torso = add(new THREE.CapsuleGeometry(0.4, 0.45, 4, 10), shirt, 0, 1.4, -0.45);
  torso.scale.z = 0.85;
  for (const s of [-1, 1]) {
    const arm = add(new THREE.CapsuleGeometry(0.11, 0.65, 3, 6), shirt, s * 0.42, 1.45, -0.05);
    arm.rotation.x = 1.1; arm.rotation.z = -s * 0.25;
    add(new THREE.SphereGeometry(0.12, 8, 6), skin, s * 0.3, 1.3, 0.35);
  }
  const hy = 2.08, hz = -0.42;
  add(new THREE.SphereGeometry(0.42, 18, 14), skin, 0, hy, hz);
  const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff }), eyeB = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.085, 8, 6), eyeW, s * 0.15, hy + 0.06, hz + 0.36);
    add(new THREE.SphereGeometry(0.045, 6, 6), eyeB, s * 0.15, hy + 0.06, hz + 0.43);
  }
  add(new THREE.SphereGeometry(0.07, 6, 6), skin, 0, hy - 0.05, hz + 0.42);
  if (ch.wear === 'ghutra' || ch.wear === 'shemagh') {
    add(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cloth, 0, hy + 0.02, hz - 0.02);
    const drape = add(new THREE.CylinderGeometry(0.5, 0.78, 0.95, 14, 1, true, Math.PI * 0.35, Math.PI * 1.3), cloth, 0, hy - 0.38, hz - 0.05);
    drape.rotation.y = Math.PI; drape.material = cloth.clone(); drape.material.side = THREE.DoubleSide;
    const agal = add(new THREE.TorusGeometry(0.42, 0.07, 8, 20), dark, 0, hy + 0.3, hz - 0.02);
    agal.rotation.x = Math.PI / 2;
  } else if (ch.wear === 'turban') {
    for (let k = 0; k < 3; k++) {
      const t = add(new THREE.TorusGeometry(0.38 - k * 0.08, 0.15, 10, 18), cloth, 0, hy + 0.25 + k * 0.17, hz);
      t.rotation.x = Math.PI / 2;
    }
    add(new THREE.OctahedronGeometry(0.12, 0), trim, 0, hy + 0.32, hz + 0.4);
  } else if (ch.wear === 'fez') {
    add(new THREE.CylinderGeometry(0.28, 0.36, 0.42, 16), cloth, 0, hy + 0.48, hz);
    const tas = add(new THREE.CylinderGeometry(0.03, 0.05, 0.35, 5), dark, 0.18, hy + 0.55, hz - 0.2);
    tas.rotation.z = 0.5;
    // شارب
    const ms = add(new THREE.TorusGeometry(0.12, 0.035, 5, 10, Math.PI), dark, 0, hy - 0.14, hz + 0.39);
    ms.rotation.z = Math.PI;
  } else if (ch.wear === 'genie') {
    // المارد: قمة شعر مربوطة وأقراط ذهبية
    add(new THREE.SphereGeometry(0.16, 8, 6), dark, 0, hy + 0.42, hz - 0.05);
    const tail = add(new THREE.ConeGeometry(0.12, 0.7, 8), dark, 0, hy + 0.35, hz - 0.45);
    tail.rotation.x = -2.2;
    for (const s of [-1, 1]) { const e = add(new THREE.TorusGeometry(0.09, 0.025, 6, 12), trim, s * 0.42, hy - 0.15, hz); e.rotation.y = Math.PI / 2; }
  } else {
    // حجاب (ومع تاج لياسمين)
    const hij = add(new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth, 0, hy - 0.02, hz - 0.05);
    hij.rotation.x = -0.25;
    const back = add(new THREE.CylinderGeometry(0.48, 0.64, 0.82, 14, 1, true, Math.PI * 0.4, Math.PI * 1.2), cloth, 0, hy - 0.42, hz - 0.08);
    back.rotation.y = Math.PI; back.material = cloth.clone(); back.material.side = THREE.DoubleSide;
    if (ch.wear === 'tiara') {
      const crown = add(new THREE.TorusGeometry(0.4, 0.05, 6, 20), trim, 0, hy + 0.32, hz - 0.05);
      crown.rotation.x = Math.PI / 2 - 0.3;
      add(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0xff4d8d }), 0, hy + 0.42, hz + 0.32);
    }
  }
  // المقود
  const sw = add(new THREE.TorusGeometry(0.27, 0.05, 6, 14), dark, 0, 1.38, 0.38);
  sw.rotation.x = -0.6;

  // العجلات
  const wheels = [];
  const tireGeo = new THREE.TorusGeometry(0.4, 0.2, 10, 22);
  const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.32, 12);
  const capGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.36, 8);
  for (const [x, z, s] of [[-1.3, 2.0, 0.85], [1.3, 2.0, 0.85], [-1.38, -1.25, 1.05], [1.38, -1.25, 1.05]]) {
    const w = new THREE.Group();
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, dark); tire.rotation.y = Math.PI / 2;
    const rim = new THREE.Mesh(rimGeo, trim); rim.rotation.z = Math.PI / 2;
    const cap = new THREE.Mesh(capGeo, chrome); cap.rotation.z = Math.PI / 2;
    spin.add(tire, rim, cap);
    w.add(spin);
    w.position.set(x, 0.6 * s, z);
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

  // درع الصحراء
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.7, 24, 16), new THREE.MeshBasicMaterial({ color: 0x5ce1e6, transparent: true, opacity: 0.25, depthWrite: false }));
  shield.position.y = 1.1;
  shield.visible = false;
  g.add(shield);

  // الحرس الدوّار: ثلاثة فوانيس تدور حول السيارة
  const orbit = new THREE.Group();
  const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc85a).multiplyScalar(2.5) });
  for (let k = 0; k < 3; k++) {
    const l = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), orbMat);
    l.scale.y = 1.5;
    l.position.set(Math.cos(k * 2.09) * 2.8, 1.3, Math.sin(k * 2.09) * 2.8);
    orbit.add(l);
  }
  orbit.visible = false;
  g.add(orbit);

  // تعويذة العين الزرقاء
  const amulet = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 20), new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }));
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.33, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), new THREE.MeshBasicMaterial({ color: 0x5ce1e6, side: THREE.DoubleSide }));
  pupil.position.z = 0.01;
  amulet.add(ring, iris, pupil);
  amulet.position.y = 3.3;
  amulet.visible = false;
  g.add(amulet);

  g.traverse((o) => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial) { o.castShadow = true; } });

  // ظل دائري بسيط (حين تكون الظلال الحقيقية مطفأة)
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1.9, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.scale.set(1, 1.5, 1);

  // جمع المواد لتأثير عباءة الإخفاء
  const mats = new Set();
  body.traverse((o) => { if (o.isMesh) mats.add(o.material); });
  g.children.forEach((c) => { if (wheels.includes(c)) c.traverse((o) => { if (o.isMesh) mats.add(o.material); }); });
  return { g, body, wheels, carpet, shield, orbit, amulet, shadow: sh, paint, mats: [...mats] };
}

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
    Object.assign(this, { mesh: m.g, body: m.body, wheels: m.wheels, carpetMesh: m.carpet, shieldMesh: m.shield, orbitMesh: m.orbit, amuletMesh: m.amulet, shadow: m.shadow, paint: m.paint, mats: m.mats });
    this.st = ch.st;
    scene.add(this.mesh); scene.add(this.shadow);
    if (!owned || bot) { this.label = nameSprite(name, 0xffffff); this.mesh.add(this.label); }
    this.pos = new THREE.Vector3();
    this.heading = 0; this.speed = 0; this.y = 0; this.vy = 0;
    this.drifting = false; this.driftDir = 0; this.driftT = 0; this.driftLvl = 0;
    this.boostT = 0; this.spinT = 0; this.spinAng = 0; this.shieldT = 0; this.genieT = 0; this.carpetT = 0; this.stormT = 0;
    this.cloakT = 0; this.amuletT = 0; this.orbit = 0; this.cloakVis = 1;
    this.steerS = 0; this.driftArm = false;
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
    if (this.cloakT > 0) f |= F.CLOAK;
    if (this.amuletT > 0) f |= F.AMULET;
    return f;
  }

  boost(t) { this.boostT = Math.max(this.boostT, t); }

  // يرجع true إذا أصابت الضربة السيارة فعلاً
  hit(kind) {
    if (this.genieT > 0 || this.cloakT > 0) return false;
    if (this.shieldT > 0) { this.shieldT = 0; return false; }
    if (this.orbit > 0) { this.orbit--; return false; }
    this.spinT = kind === 'oil' ? 1.0 : 1.4;
    if (kind !== 'oil') this.vy = 8;
    this.drifting = false; this.driftT = 0; this.boostT = 0; this.carpetT = 0;
    return true;
  }

  update(dt, inp, track, fx) {
    const ev = {};
    // العدادات
    for (const k of ['boostT', 'shieldT', 'genieT', 'carpetT', 'stormT', 'cloakT', 'amuletT']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);

    this.offroad = track.surface(this.pos, this.idx).offroad;

    // صفات المتسابق: السرعة والتسارع والتحكم
    const [stS, stA, stT] = this.st;
    const acc = ACC * (1 + (stA - 3) * 0.07), turn = 1 + (stT - 3) * 0.06;
    let max = MAX_SPEED * this.botSpeed * (1 + (stS - 3) * 0.022);
    if (this.offroad && this.genieT <= 0 && this.carpetT <= 0) max *= 0.62;
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
        if (this.speed < max) this.speed = Math.min(max, this.speed + acc * dt * (this.speed < 0 ? 2 : 1));
      } else if (inp.down) {
        if (this.speed > 0) this.speed = Math.max(0, this.speed - BRAKE * dt);
        else this.speed = Math.max(REV, this.speed - ACC * 0.6 * dt);
      } else {
        const c = 14 * dt;
        this.speed = Math.abs(this.speed) < c ? 0 : this.speed - Math.sign(this.speed) * c;
      }
      if (this.speed > max) this.speed = Math.max(max, this.speed - (this.speed - max) * 2.5 * dt);

      // توجيه ناعم: يصل المقود لأقصاه خلال ~٠٫١٥ ثانية بدل القفز فوراً (أزرار ولوحة مفاتيح)
      const st = inp.steer;
      const rate = (Math.abs(st) < Math.abs(this.steerS) || Math.sign(st) !== Math.sign(this.steerS) ? 11 : 7) * dt;
      this.steerS += Math.max(-rate, Math.min(rate, st - this.steerS));
      const steer = this.steerS;
      // القفزة والانجراف: اضغط الانجراف ثم وجّه في أي لحظة وأنت ممسك به
      if (inp.driftPressed && grounded && this.speed > 5) { this.vy = 5.5; ev.hop = true; this.driftArm = true; }
      if (!inp.drift) this.driftArm = false;
      if (!this.drifting && this.driftArm && inp.drift && Math.abs(st) > 0.3 && this.speed > 16) {
        this.drifting = true; this.driftDir = Math.sign(st); this.driftT = 0; this.driftLvl = 0; this.driftArm = false;
      }
      const sf = Math.min(1, Math.abs(this.speed) / 9) * Math.sign(this.speed || 1);
      if (this.drifting) {
        const into = st * this.driftDir; // -1..1
        this.heading += this.driftDir * (1.35 + 0.8 * into) * turn * sf * dt;
        this.driftT += dt * (1 + Math.max(0, into) * 0.5) * (this.offroad ? 0.5 : 1);
        const lvl = this.driftT > 2.6 ? 3 : this.driftT > 1.6 ? 2 : this.driftT > 0.7 ? 1 : 0;
        if (lvl > this.driftLvl) { this.driftLvl = lvl; ev.driftLvl = lvl; }
        if (!inp.drift || this.speed < 12) {
          if (this.driftLvl > 0) { this.boost([0, 0.8, 1.3, 1.9][this.driftLvl]); ev.driftBoost = this.driftLvl; }
          this.drifting = false; this.driftT = 0; this.driftLvl = 0;
        }
      } else {
        const hiSpeed = 1 - 0.22 * Math.min(1, Math.abs(this.speed) / MAX_SPEED);
        this.heading += steer * 2.35 * turn * hiSpeed * sf * dt;
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

    // منحدرات القفز
    if (this.y <= 0.001 && this.speed > 12) {
      for (const j of track.jumpSpots || []) {
        const dx = this.pos.x - j.x, dz = this.pos.z - j.z;
        const along = dx * j.tx + dz * j.tz, side = dx * j.tz - dz * j.tx;
        if (Math.abs(along) < j.hl && Math.abs(side) < j.hw) {
          this.vy = 8 + this.speed * 0.12;
          this.y = 0.05;
          this.drifting = false;
          ev.jump = true;
          break;
        }
      }
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
    this.syncMesh(dt, this.steerS);
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
    this.cloakT = fl & F.CLOAK ? 1 : 0;
    this.amuletT = fl & F.AMULET ? 1 : 0;
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
      w.children[0].rotation.x = this.wheelRot;
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
    const now = performance.now();
    if (this.genieT > 0) this.paint.emissive.setHex(Math.sin(now / 70) > 0 ? 0x7a5a00 : 0x2a0a4a);
    else this.paint.emissive.setHex(0x000000);
    // الحرس الدوّار
    this.orbitMesh.visible = this.orbit > 0;
    if (this.orbit > 0) {
      this.orbitMesh.rotation.y = now / 300;
      this.orbitMesh.children.forEach((c, i) => { c.visible = i < this.orbit; c.rotation.y = now / 200; });
    }
    // تعويذة العين
    this.amuletMesh.visible = this.amuletT > 0;
    if (this.amuletT > 0) { this.amuletMesh.rotation.y = now / 400; this.amuletMesh.position.y = 3.3 + Math.sin(now / 250) * 0.15; }
    // عباءة الإخفاء: شفافية (أشد عند الخصوم)
    const vis = this.cloakT > 0 ? (this.owned && !this.bot ? 0.35 : 0.12) : 1;
    if (vis !== this.cloakVis) {
      this.cloakVis = vis;
      for (const m of this.mats) { m.transparent = vis < 1; m.opacity = vis; m.depthWrite = vis === 1; m.needsUpdate = true; }
      if (this.label) this.label.visible = vis === 1;
    }
    this.shadow.visible = !KART_GFX.realShadows && this.mesh.visible && vis === 1;
    this.shadow.position.set(this.pos.x, 0.1, this.pos.z);
    this.shadow.rotation.z = this.heading;
    this.shadow.material.opacity = 0.3 / (1 + (this.y + lift) * 0.5);
  }

  dispose(scene) {
    scene.remove(this.mesh); scene.remove(this.shadow);
  }
}
