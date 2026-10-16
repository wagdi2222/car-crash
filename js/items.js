// الأسلحة والقدرات وصناديق الفوانيس
import * as THREE from '../lib/three.module.min.js';

export const ITEMS = {
  missile: { name: 'صاروخ الصقر', icon: '🦅', tip: 'صاروخ يلاحق المنافس الذي أمامك' },
  jar: { name: 'الجرّة النارية', icon: '🏺', tip: 'جرّة متدحرجة تنفجر عند الاصطدام' },
  oil: { name: 'فخ الزيت', icon: '🛢️', tip: 'بقعة زيت خلفك تُدير الخصوم' },
  carpet: { name: 'بساط الريح', icon: '🧞', tip: 'طيران سريع فوق الرمال' },
  storm: { name: 'العاصفة الرملية', icon: '🌪️', tip: 'تُبطئ وتُعمي كل من أمامك' },
  shield: { name: 'درع الصحراء', icon: '🛡️', tip: 'يصدّ ضربة واحدة' },
  lamp: { name: 'مصباح علاء الدين', icon: '🪔', tip: 'المارد يجعلك لا تُقهر!' },
  meteor: { name: 'الشهاب', icon: '☄️', tip: 'يطير فوق الجميع ويسقط على المتصدر' },
  dagger: { name: 'الخنجر الطائر', icon: '🗡️', tip: 'ينطلق للأمام ثم يعود إليك ويصيب من في طريقه' },
  locust: { name: 'سرب الجراد', icon: '🦗', tip: 'يهاجم كل من حولك' },
  fake: { name: 'الصندوق المزيف', icon: '🎁', tip: 'فخ يشبه صندوق ؟ تتركه خلفك' },
  amulet: { name: 'العين الزرقاء', icon: '🧿', tip: 'تردّ أول ضربة إلى من أطلقها' },
  cloak: { name: 'عباءة الإخفاء', icon: '👻', tip: 'تختفي فتمرّ الأسلحة من خلالك' },
  orbit: { name: 'الحرس الدوّار', icon: '🏮', tip: 'ثلاثة فوانيس تحميك من ٣ ضربات' },
};
// الأدوات الدفاعية (للعرض في الواجهة)
export const DEFENSE = new Set(['shield', 'amulet', 'cloak', 'orbit']);
export const ITEM_KEYS = Object.keys(ITEMS);

// اختيار سلاح حسب المركز: المتأخرون يحصلون على أسلحة أقوى
export function rollItem(rank, total) {
  const f = total > 1 ? rank / (total - 1) : 0;
  const w = {
    missile: 3,
    jar: 2 + 1.5 * f,
    oil: 4 - 3 * f,
    shield: 3 - 2 * f,
    carpet: 1 + 3 * f,
    storm: f > 0.3 ? 2.2 * f : 0,
    lamp: f > 0.6 ? 2.5 * f : 0,
    meteor: f > 0.4 ? 2 * f : 0,
    dagger: 2,
    locust: 1 + 1.5 * f,
    fake: 2.5 - 1.5 * f,
    amulet: 1.5,
    cloak: 0.5 + 1.5 * f,
    orbit: 1 + f,
  };
  let sum = 0;
  for (const k in w) sum += w[k];
  let r = Math.random() * sum;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'missile';
}

function boxTexture(fake) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 128, 128);
  // الصندوق المزيف يميل قليلاً إلى الأحمر: يلاحظه المنتبه فقط
  grd.addColorStop(0, fake ? '#f2a14e' : '#f2c14e'); grd.addColorStop(1, fake ? '#c9501a' : '#c97d10');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#1aa39a'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
  g.fillStyle = '#fff8e0';
  g.font = 'bold 92px Cairo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('؟', 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Boxes {
  constructor(scene, spots) {
    this.scene = scene;
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshLambertMaterial({ map: boxTexture(), emissive: 0x3a2400, transparent: true, opacity: 0.92 });
    this.list = spots.map((p, i) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(p);
      m.rotation.set(0.5, i, 0.5);
      scene.add(m);
      return { m, p, active: true, t: 0 };
    });
  }
  dispose() {
    for (const b of this.list) this.scene.remove(b.m);
    this.list = [];
  }
  update(dt) {
    for (const b of this.list) {
      if (!b.active) { b.t -= dt; if (b.t <= 0) { b.active = true; b.m.visible = true; b.m.scale.setScalar(0.01); } continue; }
      b.m.rotation.y += dt * 1.5;
      b.m.position.y = b.p.y + Math.sin(performance.now() / 400 + b.p.x) * 0.3;
      if (b.m.scale.x < 1) b.m.scale.setScalar(Math.min(1, b.m.scale.x + dt * 3));
    }
  }
  take(i) {
    const b = this.list[i];
    if (!b || !b.active) return false;
    b.active = false; b.m.visible = false; b.t = 3;
    return true;
  }
  check(pos) {
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      if (b.active && (b.p.x - pos.x) ** 2 + (b.p.z - pos.z) ** 2 < 7.5) return i;
    }
    return -1;
  }
}

// المقذوفات
const geoCache = {};
function projMesh(type) {
  const g = new THREE.Group();
  if (type === 'missile') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
    body.rotation.x = Math.PI / 2; g.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 8), new THREE.MeshLambertMaterial({ color: 0xd62828 }));
    tip.rotation.x = Math.PI / 2; tip.position.z = 1.3; g.add(tip);
    // أجنحة الصقر
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.6), new THREE.MeshLambertMaterial({ color: 0x8a5a2b }));
    wing.position.z = 0.1; g.add(wing);
  } else if (type === 'jar') {
    const jar = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshLambertMaterial({ color: 0xb5562b }));
    jar.scale.y = 1.15; g.add(jar);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 10), new THREE.MeshLambertMaterial({ color: 0x8f3f1c }));
    neck.position.y = 1; g.add(neck);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 6, 20), new THREE.MeshLambertMaterial({ color: 0xf2c14e }));
    band.rotation.x = Math.PI / 2; g.add(band);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
    fire.position.y = 1.6; g.add(fire);
  } else if (type === 'meteor') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.45, depthWrite: false }));
    g.add(rock, core);
  } else if (type === 'dagger') {
    const blade = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 1, roughness: 0.2 });
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.3), steel);
      b.position.x = s * 0.75; b.rotation.y = s * 0.35; blade.add(b);
    }
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.8, roughness: 0.3 }));
    blade.add(hilt);
    blade.position.y = 0.2;
    g.add(blade);
  } else if (type === 'fake') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshLambertMaterial({ map: boxTexture(true), emissive: 0x3a1400, transparent: true, opacity: 0.92 }));
    m.position.y = 0.4; m.rotation.set(0.5, 0, 0.5);
    g.add(m);
  } else if (type === 'oil') {
    if (!geoCache.oil) geoCache.oil = new THREE.CircleGeometry(2.4, 20);
    const s = new THREE.Mesh(geoCache.oil, new THREE.MeshBasicMaterial({ color: 0x140c05, transparent: true, opacity: 0.85 }));
    s.rotation.x = -Math.PI / 2; s.position.y = 0.12; g.add(s);
    const s2 = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), new THREE.MeshBasicMaterial({ color: 0x5b3a8f, transparent: true, opacity: 0.6 }));
    s2.rotation.x = -Math.PI / 2; s2.position.set(0.6, 0.13, 0.3); g.add(s2);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.9, 10), new THREE.MeshLambertMaterial({ color: 0x6b4423 }));
    jar.rotation.z = Math.PI / 2; jar.position.set(-0.8, 0.4, 0); g.add(jar);
  }
  return g;
}

// أقرب مركبة لنقطة (مع استثناء صاحب السلاح، ومن خرج أو اختفى). fwd: إن وُجد، فقط من هم خلفه
export function nearestKart(karts, pos, ownerId, back, friend) {
  let best = null, bd = Infinity;
  for (const o of karts.values()) {
    if (o.id === ownerId || o.out || o.cloakT > 0) continue;
    if (friend && friend(ownerId, o)) continue;
    const dx = o.pos.x - pos.x, dz = o.pos.z - pos.z;
    if (back && dx * back.x + dz * back.z <= 0) continue;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

export class Projectiles {
  constructor(scene, track, fx) {
    this.scene = scene; this.track = track; this.fx = fx;
    this.list = new Map();
  }

  spawn(d) {
    if (this.list.has(d.id)) return;
    const m = projMesh(d.type);
    const p = { ...d, pos: new THREE.Vector3(d.x, d.type === 'oil' ? 0 : d.type === 'meteor' ? 14 : 1, d.z), age: 0, idx: -1, mesh: m };
    m.position.copy(p.pos);
    this.scene.add(m);
    this.list.set(d.id, p);
  }

  remove(id, boom) {
    const p = this.list.get(id);
    if (!p) return;
    if (boom) {
      if (p.type === 'oil') this.fx.splash(p.pos);
      else this.fx.explode(p.pos.clone().setY(1), p.type === 'jar' ? 0xff5a1a : 0xff8c1a);
    }
    this.scene.remove(p.mesh);
    this.list.delete(id);
  }

  update(dt, karts) {
    const gone = [];
    for (const p of this.list.values()) {
      p.age += dt;
      if (p.type === 'missile') {
        let t = p.target && karts.get(p.target);
        // إن خرج الهدف أو اختفى: يلاحق الصقر أقرب مركبة أخرى
        if (p.target && (!t || t.out || t.cloakT > 0)) {
          t = nearestKart(karts, p.pos, p.owner, null, this.friend);
          p.target = t ? t.id : null;
        }
        let sp = 78;
        if (t && p.age > 0.1) {
          const want = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
          let d = want - p.h; d = Math.atan2(Math.sin(d), Math.cos(d));
          // توجيه قوي حتى لا يفلت الهدف، وسرعة أعلى دائماً من سرعته
          const dist = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
          // قريباً من الهدف: توجيه مباشر حتى لا يدور حوله
          if (dist < 15) p.h = want; else p.h += Math.max(-6.5 * dt, Math.min(6.5 * dt, d));
          sp = Math.max(78, Math.abs(t.speed) + 24);
          // يتبع ارتفاع الهدف حتى لو قفز من منحدر
          p.pos.y += (t.y + 1 - p.pos.y) * Math.min(1, dt * 8);
        } else if (this.track.kind === 'race') {
          // اتبع الطريق إن لم يكن هناك هدف
          const n = this.track.nearest(p.pos, p.idx);
          p.idx = n.i;
          if (!p.back && p.age > 0.2) {
            const pt = this.track.points[(n.i + 8) % this.track.N];
            const want = Math.atan2(pt.x - p.pos.x, pt.z - p.pos.z);
            let d = want - p.h; d = Math.atan2(Math.sin(d), Math.cos(d));
            p.h += Math.max(-1.5 * dt, Math.min(1.5 * dt, d));
          }
        }
        p.pos.x += Math.sin(p.h) * sp * dt; p.pos.z += Math.cos(p.h) * sp * dt;
        p.mesh.rotation.y = p.h;
        if (Math.random() < 0.8) this.fx.trail(p.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(p.h), 0, Math.cos(p.h)), -1.2), 0xffa733);
        if (p.age > 7) gone.push(p.id);
      } else if (p.type === 'jar') {
        const sp = 55;
        p.pos.x += Math.sin(p.h) * sp * dt; p.pos.z += Math.cos(p.h) * sp * dt;
        p.mesh.rotation.y = p.h;
        p.mesh.children[0].rotation.x += dt * 10;
        if (Math.random() < 0.5) this.fx.trail(p.pos.clone().setY(2.4), 0xff5a1a);
        if (p.age > 5) gone.push(p.id);
      } else if (p.type === 'oil') {
        if (p.age > 45) gone.push(p.id);
      } else if (p.type === 'fake') {
        p.mesh.children[0].rotation.y += dt * 1.5;
        p.pos.y = 1 + Math.sin(performance.now() / 400) * 0.3;
        if (p.age > 60) gone.push(p.id);
      } else if (p.type === 'meteor') {
        // يحلّق عالياً ويلاحق الهدف بقوة، ثم يهبط عليه
        const t = p.target && karts.get(p.target);
        let dist = 60;
        if (t && !t.out) {
          const want = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
          let d = want - p.h; d = Math.atan2(Math.sin(d), Math.cos(d));
          p.h += Math.max(-5 * dt, Math.min(5 * dt, d));
          dist = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
        }
        const sp = 92;
        p.pos.x += Math.sin(p.h) * sp * dt; p.pos.z += Math.cos(p.h) * sp * dt;
        p.pos.y = 1 + Math.min(14, dist * 0.3);
        p.mesh.rotation.x += dt * 6;
        this.fx.trail(p.pos.clone(), 0xff7a1a);
        this.fx.trail(p.pos.clone(), 0xffd166);
        if (p.age > 9) gone.push(p.id);
      } else if (p.type === 'dagger') {
        // ينطلق ثم يعود إلى صاحبه
        const o = karts.get(p.owner);
        if (p.age > 0.9 || p.ret) {
          p.ret = true;
          if (o) {
            const want = Math.atan2(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
            let d = want - p.h; d = Math.atan2(Math.sin(d), Math.cos(d));
            p.h += Math.max(-8 * dt, Math.min(8 * dt, d));
            if (Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < 3) { this.remove(p.id, false); continue; }
          }
        }
        const sp = 72;
        p.pos.x += Math.sin(p.h) * sp * dt; p.pos.z += Math.cos(p.h) * sp * dt;
        p.mesh.children[0].rotation.y += dt * 25;
        if (Math.random() < 0.5) this.fx.spark(p.pos.clone(), 0xdfe7ff);
        if (p.age > 4) gone.push(p.id);
      }
      if (p.type === 'dagger') {
        if (!p.ret && this.track.blocked(p.pos, p)) p.ret = true;
      } else if (p.type === 'missile' && p.target) {
        // الصقر الملاحق يطير فوق الجدران حتى يصل إلى هدفه
      } else if (p.type !== 'oil' && p.type !== 'meteor' && p.type !== 'fake') {
        if (this.track.blocked(p.pos, p)) gone.push(p.id);
      }
      p.mesh.position.copy(p.pos);
    }
    for (const id of gone) this.remove(id, true);
  }

  // هل أصاب مقذوف هذه السيارة؟
  collide(kart) {
    for (const p of this.list.values()) {
      if (kart.out || kart.cloakT > 0) return null;
      if (this.friend && this.friend(p.owner, kart)) continue;
      if (p.owner === kart.id && (p.type === 'dagger' || p.age < (p.type === 'oil' || p.type === 'fake' ? 1.2 : 0.8))) continue;
      if (p.type === 'meteor' && p.pos.y > 3) continue;
      const r = p.type === 'meteor' ? 4.5 : p.type === 'oil' || p.type === 'jar' || p.type === 'fake' ? 2.6 : 2.2;
      const dx = p.pos.x - kart.pos.x, dz = p.pos.z - kart.pos.z;
      const dy = p.type === 'missile' ? Math.abs(kart.y + 1 - p.pos.y) : kart.y;
      if (dx * dx + dz * dz < r * r && dy < 3) return p;
    }
    return null;
  }
}
