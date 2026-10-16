// رالي الرمال — الملف الرئيسي: الحلقة، الواجهة، والشبكة
import * as THREE from '../lib/three.module.min.js';
import { Track } from './track.js';
import { Kart, CHARS, F } from './kart.js';
import { FX } from './fx.js';
import { Boxes, Projectiles, ITEMS, ITEM_KEYS, rollItem } from './items.js';
import { Bot } from './ai.js';
import { Input, CONTROL_TIPS } from './input.js';
import { Audio, localStorageGet, localStorageSet } from './audio.js';
import { Net } from './net.js';

const LAPS = 3;
const MAX_PLAYERS = 8;
const $ = (id) => document.getElementById(id);
const AR = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];
const fmtTime = (t) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return AR(`${m}:${String(s).padStart(2, '0')}٫${String(c).padStart(2, '0')}`);
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14) || 'متسابق';

// ---------- المشهد ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: $('game'), powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf3b780, 140, 950);
const camera = new THREE.PerspectiveCamera(72, 1, 0.5, 3000);
scene.add(new THREE.HemisphereLight(0xffe6c2, 0x9a6a3a, 1.2));
const sun = new THREE.DirectionalLight(0xffd4a0, 1.8);
sun.position.set(-300, 200, -400);
scene.add(sun);

const track = new Track(scene);
const fx = new FX(scene);
const boxes = new Boxes(scene, track.boxSpots);
const projs = new Projectiles(scene, track, fx);
const input = new Input();
const audio = new Audio();
const net = new Net();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fx.setScale(h * Math.min(devicePixelRatio, 1.5));
}
addEventListener('resize', resize);
resize();

// ---------- الحالة ----------
const S = {
  mode: 'menu', // menu | lobby | race
  demo: true,
  solo: true,
  name: cleanName(localStorageGet('rimal-name') || ''),
  char: +(localStorageGet('rimal-char') || 0) % CHARS.length,
  lobby: [],
  botCount: 5,
  racing: false, // هل يجري سباق في الغرفة (للمضيف)
  karts: new Map(),
  ais: new Map(),
  me: null,
  countdown: 0, started: false, raceT: 0,
  projN: 0, sendT: 0, revT: 0,
  lastLap: 1, resultsShown: false, resultsT: 0,
  camShake: 0, demoCamT: 0, demoFocus: 0,
};
const myId = () => (S.solo ? 'me' : net.id);
// رسائل السباق لا تُرسل في وضع العرض التجريبي أو اللعب الفردي
const rsend = (msg) => { if (!S.solo && !S.demo) net.send(msg); };

// ---------- السباق ----------
function clearRace() {
  for (const k of S.karts.values()) k.dispose(scene);
  S.karts.clear(); S.ais.clear(); S.me = null;
  for (const id of [...projs.list.keys()]) projs.remove(id, false);
  boxes.list.forEach((b) => { b.active = true; b.m.visible = true; b.m.scale.setScalar(1); });
}

function startRace(roster, demo = false) {
  clearRace();
  S.demo = demo;
  const mine = myId();
  roster.forEach((r, slot) => {
    const isMe = !demo && r.id === mine;
    const owned = isMe || (r.bot && (S.solo || net.isHost));
    const k = new Kart(scene, { id: r.id, name: r.name, char: r.char, owned, bot: !!r.bot });
    k.place(track, slot);
    if (!owned) k.target = { x: k.pos.x, y: 0, z: k.pos.z, h: k.heading, sp: 0 };
    S.karts.set(r.id, k);
    if (r.bot && owned) S.ais.set(r.id, new Bot(k, 0.9 + Math.random() * 0.08));
    if (isMe) { S.me = k; if (k.label) { k.mesh.remove(k.label); k.label = null; } }
  });
  S.countdown = demo ? 0.01 : 3.9;
  S.started = false; S.raceT = 0; S.revT = 0; S.lastLap = 1;
  S.resultsShown = false;
  S.mode = demo ? S.mode : 'race';
  if (!demo) {
    showScreen(null);
    $('hud').classList.remove('hidden');
    document.body.classList.add('racing');
    $('touch').classList.toggle('hidden', !input.isTouch);
    if (input.isTouch) {
      input.resetTouch();
      const h = $('tc-hint');
      h.textContent = CONTROL_TIPS[input.mode];
      h.classList.add('show');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => h.classList.remove('show'), 5000);
    }
    $('results').classList.add('hidden');
    audio.startMusic();
  }
}

function startDemo() {
  const roster = CHARS.map((c, i) => ({ id: 'demo' + i, name: c.name, char: i, bot: true }));
  const wasSolo = S.solo;
  S.solo = true;
  startRace(roster, true);
  S.solo = wasSolo;
}

function botRoster(humans, count) {
  const used = new Set(humans.map((h) => h.char));
  const free = CHARS.map((_, i) => i).filter((i) => !used.has(i));
  const out = [];
  for (let i = 0; i < count; i++) {
    const ch = free.length ? free.shift() : Math.floor(Math.random() * CHARS.length);
    out.push({ id: 'bot' + i, name: CHARS[ch].name, char: ch, bot: true });
  }
  return out;
}

function ranking() {
  return [...S.karts.values()].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.prog - a.prog;
  });
}

const NOINPUT = { up: false, down: false, steer: 0, drift: false, driftPressed: false, fire: false, back: false };

function updateRace(dt) {
  const me = S.me;
  let inp = me ? input.read() : NOINPUT;

  if (!S.started) {
    const prev = Math.ceil(S.countdown);
    S.countdown -= dt;
    const c = Math.ceil(S.countdown);
    if (!S.demo && c !== prev && c > 0 && c <= 3) { showMsg(AR(c), 'count'); audio.play('beep'); }
    // انطلاقة توربو: اضغط البنزين قبل الانطلاق بقليل
    if (me && inp.up) S.revT += dt; else S.revT = 0;
    if (S.countdown <= 0) {
      S.started = true;
      if (!S.demo) { showMsg('انطلق!', 'go'); audio.play('go'); }
      if (me && S.revT > 0 && S.revT < 0.9) { me.boost(1.3); audio.play('boost'); }
    }
    inp = NOINPUT;
  } else S.raceT += dt;

  let leaderProg = -Infinity;
  for (const k of S.karts.values()) leaderProg = Math.max(leaderProg, k.prog);
  const rank = ranking();

  for (const k of S.karts.values()) {
    if (k.owned) {
      let ki;
      if (k !== me || k.finished || S.autopilot) {
        let ai = S.ais.get(k.id);
        if (!ai) { ai = new Bot(k, 0.9); S.ais.set(k.id, ai); }
        ki = S.started ? ai.think(dt, track, S.karts, leaderProg) : NOINPUT;
      } else ki = inp;
      const ev = k.update(dt, ki, track, fx);
      if (k === me) onMyEvents(ev);
      handleItems(k, ki, rank, dt);
      checkLap(k);
    } else k.updateRemote(dt, fx);
  }

  // تصادم السيارات
  const arr = [...S.karts.values()];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 5.76 || d2 < 1e-4) continue;
      const d = Math.sqrt(d2), push = 2.4 - d, nx = dx / d, nz = dz / d;
      const wa = a.owned ? (b.owned ? 0.5 : 1) : 0, wb = b.owned ? (a.owned ? 0.5 : 1) : 0;
      a.pos.x -= nx * push * wa; a.pos.z -= nz * push * wa;
      b.pos.x += nx * push * wb; b.pos.z += nz * push * wb;
      // المارد يطيح بمن يلمسه
      if (a.genieT > 0 && b.owned && b.genieT <= 0 && b.spinT <= 0 && b.hit('genie')) onHitLocal(b);
      if (b.genieT > 0 && a.owned && a.genieT <= 0 && a.spinT <= 0 && a.hit('genie')) onHitLocal(a);
    }
  }

  projs.update(dt, S.karts);
  // الإصابات تُحسب على السيارات التي نملكها فقط
  for (const k of S.karts.values()) {
    if (!k.owned) continue;
    const p = projs.collide(k);
    if (!p) continue;
    const real = k.hit(p.type);
    projs.remove(p.id, true);
    rsend({ t: 'ev', k: 'hit', pid: p.id, v: k.id, real });
    if (real) onHitLocal(k); else if (k === me) audio.play('shield');
    soundAt(p.pos, 'boom');
  }

  // الإرسال للشبكة
  if (!S.solo && !S.demo) {
    S.sendT -= dt;
    if (S.sendT <= 0) {
      S.sendT = 1 / 15;
      const list = [];
      for (const k of S.karts.values()) {
        if (!k.owned) continue;
        list.push([k.id, +k.pos.x.toFixed(2), +k.y.toFixed(2), +k.pos.z.toFixed(2), +k.heading.toFixed(3), +k.speed.toFixed(1), k.flagsNow, k.prog]);
      }
      net.send({ t: 's', k: list });
    }
  }

  if (S.demo) demoCam(dt, rank); else chaseCam(me, dt);
  if (!S.demo) updateHUD(rank, dt);
  if (me) audio.engine(me.speed, true);
  // أسماء السيارات القريبة جداً تُخفى حتى لا تغطي الشاشة
  // والسيارات الملاصقة للكاميرا تُخفى حتى لا تحجب الرؤية
  for (const k of S.karts.values()) {
    const d = Math.hypot(k.pos.x - camera.position.x, k.pos.z - camera.position.z);
    if (k.label) k.label.visible = d > 16;
    k.mesh.visible = k.shadow.visible = k === me || S.demo || d > 6;
  }
  if (me && me.stormT > 0) fx.storm(camera.position);
}

function onMyEvents(ev) {
  if (ev.hop) audio.play('hop');
  if (ev.driftLvl) audio.play('lvl');
  if (ev.driftBoost || ev.pad) { audio.play('boost'); S.camShake = 0.15; }
  if (ev.wall && Math.random() < 0.1) audio.play('wall');
}

function onHitLocal(k) {
  if (k === S.me) { audio.play('hit'); S.camShake = 0.5; showMsg('آخ!', 'hit'); }
}

function soundAt(pos, name) {
  if (!S.me || S.demo) return;
  if (pos.distanceTo(S.me.pos) < 80) audio.play(name);
}

function handleItems(k, ki, rank, dt) {
  // صناديق الفوانيس
  const bi = boxes.check(k.pos);
  if (bi >= 0 && boxes.take(bi)) {
    fx.pickup(boxes.list[bi].p);
    rsend({ t: 'ev', k: 'box', i: bi });
    if (!k.item && !k.rolling) {
      k.rolling = 1.1;
      if (k === S.me) audio.play('pickup');
    }
  }
  if (k.rolling > 0) {
    k.rolling -= dt;
    if (k.rolling <= 0) {
      k.rolling = 0;
      k.item = rollItem(rank.indexOf(k), rank.length);
      if (k === S.me) audio.play('item');
    }
  }
  if (ki.fire && k.item && !k.rolling && S.started && k.spinT <= 0) useItem(k, ki.back, rank);
}

function spawnProj(d) {
  d.id = myId() + ':' + (++S.projN);
  projs.spawn(d);
  rsend({ t: 'ev', k: 'proj', d });
}

function useItem(k, back, rank) {
  const it = k.item;
  k.item = null;
  const f = k.fwd;
  const isMe = k === S.me;
  switch (it) {
    case 'missile': {
      let target = null;
      if (!back) {
        const r = rank.indexOf(k);
        if (r > 0) target = rank[r - 1].id;
      }
      const s = back ? -3.5 : 3.5;
      spawnProj({ type: 'missile', owner: k.id, x: k.pos.x + f.x * s, z: k.pos.z + f.z * s, h: k.heading + (back ? Math.PI : 0), target, back: !!back });
      if (isMe) audio.play('fire');
      break;
    }
    case 'jar': {
      const s = back ? -3.5 : 3.5;
      spawnProj({ type: 'jar', owner: k.id, x: k.pos.x + f.x * s, z: k.pos.z + f.z * s, h: k.heading + (back ? Math.PI : 0) });
      if (isMe) audio.play('fire');
      break;
    }
    case 'oil':
      spawnProj({ type: 'oil', owner: k.id, x: k.pos.x - f.x * 3.8, z: k.pos.z - f.z * 3.8, h: 0 });
      if (isMe) audio.play('hop');
      break;
    case 'carpet':
      k.carpetT = 2.6; k.boost(2.6);
      if (isMe) { audio.play('boost'); showMsg('بساط الريح!', 'item'); }
      break;
    case 'shield':
      k.shieldT = 9;
      if (isMe) audio.play('shield');
      break;
    case 'lamp':
      k.genieT = 6; k.boost(1);
      if (isMe) { audio.play('genie'); showMsg('شُبّيك لُبّيك!', 'item'); }
      break;
    case 'storm':
      applyStorm(k.id, k.prog);
      rsend({ t: 'ev', k: 'storm', from: k.id, prog: k.prog });
      if (isMe) showMsg('عاصفة رملية!', 'item');
      break;
  }
}

function applyStorm(from, prog) {
  const src = S.karts.get(from);
  if (S.me && !S.demo) audio.play('storm');
  for (const k of S.karts.values()) {
    if (!k.owned || k.id === from || k.prog <= prog || k.genieT > 0 || k.finished) continue;
    if (k.shieldT > 0) { k.shieldT = 0; continue; }
    k.stormT = 3.5;
    if (k === S.me) showMsg(`عاصفة من ${src ? src.name : '؟'}!`, 'hit');
  }
}

function checkLap(k) {
  if (k.finished) return;
  const lap = Math.floor(k.prog / track.N) + 1;
  if (k === S.me && lap > S.lastLap && lap <= LAPS) {
    S.lastLap = lap;
    showMsg(lap === LAPS ? 'اللفة الأخيرة!' : `اللفة ${AR(lap)}`, 'lap');
    audio.play('lap');
  }
  if (k.prog >= LAPS * track.N) {
    k.finished = true;
    k.finishTime = S.raceT;
    rsend({ t: 'ev', k: 'fin', id: k.id, time: k.finishTime });
    if (k === S.me) {
      const pos = ranking().indexOf(k);
      showMsg(pos === 0 ? 'مبروك! المركز الأول 🏆' : `المركز ${ORD[pos]}`, 'go');
      audio.play('win');
      S.resultsT = 2.5;
    }
  }
}

// ---------- الكاميرا ----------
const camLook = new THREE.Vector3();
function chaseCam(k, dt) {
  if (!k) return;
  const f = k.fwd;
  const portrait = camera.aspect < 0.9;
  const want = k.pos.clone().addScaledVector(f, portrait ? -10.5 : -8.8).setY((portrait ? 5.2 : 3.9) + k.y * 0.5);
  const a = S.started ? 1 - Math.exp(-7 * dt) : 1;
  camera.position.lerp(want, a);
  camLook.copy(k.pos).addScaledVector(f, 5).setY(1.6 + k.y * 0.5);
  if (S.camShake > 0) {
    S.camShake -= dt;
    camera.position.x += (Math.random() - 0.5) * S.camShake;
    camera.position.y += (Math.random() - 0.5) * S.camShake;
  }
  camera.lookAt(camLook);
  const fov = (portrait ? 88 : 72) + (k.boostT > 0 ? 10 : 0) + Math.min(6, Math.max(0, k.speed - 30) * 0.3);
  camera.fov += (fov - camera.fov) * (1 - Math.exp(-5 * dt));
  camera.updateProjectionMatrix();
}

function demoCam(dt, rank) {
  S.demoCamT -= dt;
  if (S.demoCamT <= 0) { S.demoCamT = 7; S.demoFocus = Math.floor(Math.random() * rank.length); }
  const k = rank[S.demoFocus % rank.length];
  if (!k) return;
  const t = performance.now() / 4000;
  const side = k.right.multiplyScalar(Math.sin(t) * 9);
  const want = k.pos.clone().addScaledVector(k.fwd, -11).add(side).setY(6);
  camera.position.lerp(want, 1 - Math.exp(-2 * dt));
  camLook.lerp(k.pos.clone().setY(1.5), 1 - Math.exp(-6 * dt));
  camera.lookAt(camLook);
  camera.fov = 65; camera.updateProjectionMatrix();
}

// ---------- الواجهة ----------
let msgTimer = 0, hintTimer = 0;
function showMsg(text, cls = '') {
  const el = $('msg');
  el.textContent = text;
  el.className = 'msg show' + (cls ? ' m-' + cls : '');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => el.classList.remove('show'), 1100);
}

const mm = $('minimap'), mmc = mm.getContext('2d');
const mmBase = document.createElement('canvas');
let mmT = null;
function buildMinimap() {
  const W = mm.width, H = mm.height;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of track.points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const s = Math.min((W - 24) / (maxX - minX), (H - 24) / (maxZ - minZ));
  // نقلب X حتى تطابق الخريطة اتجاه الكاميرا المعتاد من الأعلى
  mmT = (x, z) => [W - (12 + (x - minX) * s + (W - 24 - (maxX - minX) * s) / 2), 12 + (z - minZ) * s + (H - 24 - (maxZ - minZ) * s) / 2];
  mmBase.width = W; mmBase.height = H;
  const g = mmBase.getContext('2d');
  g.lineJoin = 'round';
  const path = () => { g.beginPath(); track.points.forEach((p, i) => { const [x, y] = mmT(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
  g.strokeStyle = 'rgba(40,20,5,.65)'; g.lineWidth = 11; path(); g.stroke();
  g.strokeStyle = '#f2d8a7'; g.lineWidth = 6; path(); g.stroke();
  const [sx, sy] = mmT(track.points[0].x, track.points[0].z);
  g.fillStyle = '#fff'; g.fillRect(sx - 4, sy - 4, 8, 8);
}
buildMinimap();

function drawMinimap() {
  mmc.clearRect(0, 0, mm.width, mm.height);
  mmc.drawImage(mmBase, 0, 0);
  for (const k of S.karts.values()) {
    const [x, y] = mmT(k.pos.x, k.pos.z);
    mmc.beginPath();
    mmc.arc(x, y, k === S.me ? 6 : 4.5, 0, Math.PI * 2);
    mmc.fillStyle = '#' + new THREE.Color(k.color).getHexString();
    mmc.fill();
    mmc.lineWidth = k === S.me ? 2.5 : 1.2;
    mmc.strokeStyle = k === S.me ? '#fff' : '#000';
    mmc.stroke();
  }
  for (const p of projs.list.values()) {
    if (p.type === 'oil') continue;
    const [x, y] = mmT(p.pos.x, p.pos.z);
    mmc.fillStyle = '#ff3b1a'; mmc.fillRect(x - 2, y - 2, 4, 4);
  }
}

let rouletteT = 0, standT = 0, itemKey = null;
function updateHUD(rank, dt) {
  const me = S.me;
  if (!me) return;
  const lap = Math.min(LAPS, Math.max(1, Math.floor(me.prog / track.N) + 1));
  $('lap').innerHTML = `اللفة <b>${AR(lap)}</b>/${AR(LAPS)}`;
  const pos = rank.indexOf(me);
  $('pos').innerHTML = `<b>${AR(pos + 1)}</b><small>/${AR(rank.length)}</small>`;
  $('time').textContent = fmtTime(S.raceT);
  // السلاح
  const box = $('item');
  let key = '';
  if (me.rolling > 0) { rouletteT += dt; key = 'r' + ITEM_KEYS[Math.floor(rouletteT * 14) % ITEM_KEYS.length]; } else if (me.item) key = me.item;
  if (key !== itemKey) {
    itemKey = key;
    if (key[0] === 'r') {
      box.innerHTML = `<span class="ico">${ITEMS[key.slice(1)].icon}</span>`;
      box.className = 'item rolling';
    } else if (key) {
      box.innerHTML = `<span class="ico">${ITEMS[key].icon}</span><span class="nm">${ITEMS[key].name}</span>`;
      box.className = 'item ready';
    } else { box.innerHTML = ''; box.className = 'item'; }
  }
  // شحنة الانجراف
  const dl = $('drift');
  if (me.drifting) {
    dl.className = 'drift on lvl' + me.driftLvl;
    dl.style.setProperty('--p', Math.min(1, me.driftT / 2.6));
  } else dl.className = 'drift';
  $('wrong').classList.toggle('show', me.wrongT > 1.2 && !me.finished);
  $('storm').classList.toggle('show', me.stormT > 0);
  $('boostfx').classList.toggle('show', me.boostT > 0);
  // الترتيب المختصر
  standT -= dt;
  if (standT <= 0) {
    standT = 0.3;
    $('standings').innerHTML = rank.map((k, i) => `<li class="${k === me ? 'me' : ''}"><i style="background:#${new THREE.Color(k.color).getHexString()}"></i>${AR(i + 1)}. ${esc(k.name)}${k.finished ? ' 🏁' : ''}</li>`).join('');
  }
  drawMinimap();
  // النتائج
  if (S.resultsT > 0) {
    S.resultsT -= dt;
    if (S.resultsT <= 0) showResults();
  }
  if (S.resultsShown) renderResults(rank);
}

function showResults() {
  S.resultsShown = true;
  $('results').classList.remove('hidden');
  const host = S.solo || net.isHost;
  $('res-again').classList.toggle('hidden', !host);
  $('res-again').textContent = S.solo ? 'سباق جديد' : 'العودة إلى الغرفة';
  $('res-wait').classList.toggle('hidden', host);
}

let resT = 0;
function renderResults(rank) {
  resT -= 1 / 60;
  if (resT > 0) return;
  resT = 0.5;
  $('res-list').innerHTML = rank.map((k, i) => `<tr class="${k === S.me ? 'me' : ''}">
    <td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : AR(i + 1)}</td>
    <td><span class="nm"><i style="background:#${new THREE.Color(k.color).getHexString()}"></i>${esc(k.name)}${k.bot ? ' <small>(آلي)</small>' : ''}</span></td>
    <td>${k.finished ? fmtTime(k.finishTime) : '<small>في السباق…</small>'}</td></tr>`).join('');
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
  if (id) { document.body.classList.remove('racing'); $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('results').classList.add('hidden'); }
}

// ---------- القائمة ----------
function buildCharPicker() {
  const wrap = $('chars');
  wrap.innerHTML = CHARS.map((c, i) => `<button class="char ${i === S.char ? 'sel' : ''}" data-i="${i}" style="--c:#${new THREE.Color(c.color).getHexString()};--t:#${new THREE.Color(c.trim).getHexString()}">
    <span class="av">${c.wear === 'hijab' ? '🧕' : c.wear === 'turban' ? '👳' : '🧔'}</span><b>${c.name}</b><small>${c.desc}</small></button>`).join('');
  wrap.querySelectorAll('.char').forEach((b) => b.addEventListener('click', () => {
    S.char = +b.dataset.i;
    localStorageSet('rimal-char', S.char);
    wrap.querySelectorAll('.char').forEach((x) => x.classList.toggle('sel', x === b));
    audio.init(); audio.play('pickup');
  }));
}

function readName() {
  S.name = cleanName($('name').value);
  $('name').value = S.name;
  localStorageSet('rimal-name', S.name);
}

const params = new URLSearchParams(location.search);
const roomParam = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

function initMenu() {
  document.body.classList.toggle('touchmode', input.isTouch);
  $('ctl-box').classList.toggle('hidden', !input.isTouch);
  const showCtl = () => {
    document.querySelectorAll('.ctl-opt').forEach((b) => b.classList.toggle('sel', b.dataset.m === input.mode));
    $('ctl-tip').textContent = CONTROL_TIPS[input.mode];
  };
  document.querySelectorAll('.ctl-opt').forEach((b) => b.addEventListener('click', () => { input.setMode(b.dataset.m); showCtl(); audio.init(); audio.play('pickup'); }));
  showCtl();
  $('name').value = S.name === 'متسابق' ? '' : S.name;
  buildCharPicker();
  if (roomParam) {
    $('join-box').classList.remove('hidden');
    $('join-code').textContent = roomParam;
    $('btn-host').classList.add('hidden');
  }
  $('btn-solo').onclick = () => {
    readName(); audio.init();
    S.solo = true; S.mode = 'race';
    const humans = [{ id: 'me', name: S.name, char: S.char }];
    startRace([...humans, ...botRoster(humans, 5)]);
  };
  $('btn-host').onclick = hostRoom;
  $('btn-join').onclick = () => joinRoom(roomParam);
  $('btn-join-manual').onclick = () => {
    const c = prompt('أدخل رمز الغرفة:');
    if (c) joinRoom(c.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  };
  $('btn-help').onclick = () => showScreen('help');
  $('help-back').onclick = () => showScreen('menu');
  $('mute').onclick = () => { audio.init(); $('mute').textContent = audio.toggleMute() ? '🔇' : '🔊'; };
  $('mute').textContent = audio.muted ? '🔇' : '🔊';
  // ضغطتان للخروج بدل نافذة التأكيد (لا تعمل في كل المتصفحات المضمّنة)
  let quitAt = 0;
  $('quit').onclick = () => {
    if (performance.now() - quitAt < 2500) { quitAt = 0; leaveToMenu(); return; }
    quitAt = performance.now();
    showMsg('اضغط ✕ مرة أخرى للخروج', 'hit');
  };
  $('res-menu').onclick = leaveToMenu;
  $('res-again').onclick = () => {
    if (S.solo) $('btn-solo').onclick();
    else { S.racing = false; enterLobby(); broadcastLobby(); }
  };
  $('lobby-leave').onclick = leaveToMenu;
  $('lobby-start').onclick = hostStart;
  $('bots').oninput = () => { S.botCount = +$('bots').value; $('bots-n').textContent = AR(S.botCount); broadcastLobby(); };
  $('copy').onclick = async () => {
    const link = $('link').value;
    try { await navigator.clipboard.writeText(link); } catch { $('link').select(); document.execCommand('copy'); }
    $('copy').textContent = 'تم النسخ ✓';
    setTimeout(() => ($('copy').textContent = 'نسخ الرابط'), 1500);
  };
  $('share').onclick = () => {
    const link = $('link').value;
    if (navigator.share) navigator.share({ title: 'رالي الرمال', text: 'تعال سابقني في رالي الرمال! 🏎️🐪', url: link }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent('تعال سابقني في رالي الرمال! 🏎️🐪 ' + link));
  };
  $('whatsapp').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent('تعال سابقني في رالي الرمال! 🏎️🐪 ' + $('link').value));
}

function leaveToMenu() {
  if (net.online) net.close();
  S.solo = true; S.racing = false; S.mode = 'menu'; S.lobby = [];
  audio.engine(0, false);
  showScreen('menu');
  startDemo();
}

// ---------- الغرفة (اللعب الجماعي) ----------
function setStatus(t) { $('status').textContent = t; }

async function hostRoom() {
  readName(); audio.init();
  setStatus('جارٍ إنشاء الغرفة…');
  try {
    const code = await net.host();
    S.solo = false;
    S.lobby = [{ id: net.id, name: S.name, char: S.char }];
    S.racing = false;
    const base = location.origin + location.pathname;
    const extra = params.get('peerhost') ? `&peerhost=${params.get('peerhost')}&peerport=${params.get('peerport') || ''}&peersecure=${params.get('peersecure') || ''}` : '';
    $('link').value = `${base}?room=${code}${extra}`;
    $('room-code').textContent = code;
    setStatus('');
    enterLobby();
  } catch (e) {
    console.error(e);
    setStatus('تعذّر إنشاء الغرفة. تحقق من اتصالك بالإنترنت ثم حاول مجدداً.');
  }
}

async function joinRoom(code) {
  if (!code) return;
  readName(); audio.init();
  setStatus('جارٍ الاتصال بالغرفة ' + code + '…');
  try {
    await net.join(code);
    S.solo = false;
    net.send({ t: 'hello', name: S.name, char: S.char }, false);
    $('room-code').textContent = code;
    $('link').value = location.href;
    setStatus('');
    enterLobby();
  } catch (e) {
    console.error(e);
    net.close();
    setStatus('تعذّر الاتصال بالغرفة. تأكد من الرابط وأن صديقك ما زال في الغرفة.');
  }
}

function enterLobby() {
  S.mode = 'lobby';
  if (!S.demo) startDemo();
  showScreen('lobby');
  renderLobby();
}

function renderLobby(info = {}) {
  const host = net.isHost;
  $('lobby-host-ctrl').classList.toggle('hidden', !host);
  $('lobby-wait').classList.toggle('hidden', host);
  $('lobby-wait').textContent = info.racing ? 'السباق جارٍ الآن… ستنضم إلى السباق القادم.' : 'بانتظار المضيف ليبدأ السباق…';
  const max = Math.max(0, MAX_PLAYERS - S.lobby.length);
  $('bots').max = max;
  if (S.botCount > max) S.botCount = max;
  $('bots').value = S.botCount;
  $('bots-n').textContent = AR(S.botCount);
  $('players').innerHTML = S.lobby.map((p, i) => `<li><i style="background:#${new THREE.Color(CHARS[p.char % CHARS.length].color).getHexString()}"></i>
    <b>${esc(p.name)}</b> <small>${CHARS[p.char % CHARS.length].name}</small>${i === 0 ? ' <span class="tag">المضيف</span>' : ''}${p.id === net.id ? ' <span class="tag you">أنت</span>' : ''}</li>`).join('')
    + (S.botCount ? `<li class="botsline">🤖 + ${AR(S.botCount)} متسابقين آليين</li>` : '');
}

function broadcastLobby() {
  if (!net.isHost) return;
  net.send({ t: 'lobby', players: S.lobby, bots: S.botCount, racing: S.racing }, false);
  if (S.mode === 'lobby') renderLobby();
}

function hostStart() {
  if (!net.isHost) return;
  audio.init();
  const humans = S.lobby.slice(0, MAX_PLAYERS);
  const roster = [...humans, ...botRoster(humans, Math.min(S.botCount, MAX_PLAYERS - humans.length))];
  S.racing = true;
  net.send({ t: 'start', roster }, false);
  startRace(roster);
}

net.onJoin = () => { /* ننتظر رسالة hello */ };
net.onLeave = (id) => {
  S.lobby = S.lobby.filter((p) => p.id !== id);
  removeKart(id);
  net.send({ t: 'left', id }, false);
  broadcastLobby();
};
net.onDisconnect = () => {
  if (S.solo) return;
  alert('انقطع الاتصال بالمضيف.');
  leaveToMenu();
};

function removeKart(id) {
  const k = S.karts.get(id);
  if (k && !S.demo) { k.dispose(scene); S.karts.delete(id); }
}

net.onMessage = (m) => {
  switch (m.t) {
    case 'hello': {
      if (!net.isHost) return;
      if (S.lobby.length >= MAX_PLAYERS) { net.sendTo(m.from, { t: 'full' }); return; }
      if (!S.lobby.find((p) => p.id === m.from)) S.lobby.push({ id: m.from, name: cleanName(m.name), char: (+m.char || 0) % CHARS.length });
      broadcastLobby();
      break;
    }
    case 'full': alert('الغرفة ممتلئة.'); leaveToMenu(); break;
    case 'lobby': {
      if (net.isHost) return;
      S.lobby = Array.isArray(m.players) ? m.players : [];
      S.botCount = m.bots | 0;
      if (S.mode === 'race' && !m.racing) { S.mode = 'lobby'; enterLobby(); }
      if (S.mode === 'lobby') renderLobby(m);
      break;
    }
    case 'start':
      if (net.isHost || !Array.isArray(m.roster)) return;
      if (!m.roster.find((r) => r.id === net.id)) return; // لست في هذا السباق
      startRace(m.roster);
      break;
    case 'left': removeKart(m.id); break;
    case 's': {
      if (S.demo || !Array.isArray(m.k)) return;
      for (const e of m.k) {
        const k = S.karts.get(e[0]);
        if (!k || k.owned) continue;
        k.target = { x: e[1], y: e[2], z: e[3], h: e[4], sp: e[5] };
        k.flags = e[6];
        k.prog = e[7];
        if (e[6] & F.FIN && !k.finished) { k.finished = true; k.finishTime = k.finishTime || S.raceT; }
      }
      break;
    }
    case 'ev': {
      if (S.demo) return;
      if (m.k === 'proj' && m.d) projs.spawn(m.d);
      else if (m.k === 'hit') {
        const p = projs.list.get(m.pid);
        if (p) { soundAt(p.pos, 'boom'); projs.remove(m.pid, true); }
      } else if (m.k === 'box') boxes.take(m.i);
      else if (m.k === 'storm') applyStorm(m.from, m.prog);
      else if (m.k === 'fin') {
        const k = S.karts.get(m.id);
        if (k) { k.finished = true; k.finishTime = m.time; }
      }
      break;
    }
  }
};

// ---------- الحلقة الرئيسية ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateRace(dt);
  boxes.update(dt);
  fx.update(dt);
  renderer.render(scene, camera);
}

initMenu();
startDemo();
showScreen('menu');
requestAnimationFrame(frame);
// أداة للاختبار الآلي: تشغيل المحاكاة بسرعة دون رسم
window.__game = { S, net, track, projs, input, sim(n, dt = 1 / 30) { for (let i = 0; i < n; i++) { updateRace(dt); boxes.update(dt); fx.update(dt); } } };
