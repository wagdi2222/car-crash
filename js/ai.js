// ذكاء المنافسين الآليين
export class Bot {
  constructor(kart, skill = 0.95) {
    this.k = kart;
    this.skill = skill;
    this.lane = (Math.random() - 0.5) * 12;
    this.laneT = 0;
    this.itemDelay = 1 + Math.random() * 3;
    this.driftHold = false;
    this.prevDrift = false;
  }

  // يُرجع مدخلات تحكم مثل اللاعب
  think(dt, track, karts, leaderProg, boxes) {
    if (track.kind === 'arena') return this.thinkArena(dt, track, karts, boxes);
    const k = this.k;
    this.laneT -= dt;
    if (this.laneT <= 0) { this.lane = (Math.random() - 0.5) * 12; this.laneT = 2 + Math.random() * 3; }
    const ahead = 14 + Math.floor(k.speed / 6);
    const i = (k.idx + ahead) % track.N;
    const p = track.points[i], r = track.rights[i];
    const tx = p.x + r.x * this.lane, tz = p.z + r.z * this.lane;
    const want = Math.atan2(tx - k.pos.x, tz - k.pos.z);
    let d = want - k.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    const steer = Math.max(-1, Math.min(1, d * 2.8));

    // تقدير حدة المنعطف القادم للانجراف
    const t1 = track.tangents[k.idx], t2 = track.tangents[(k.idx + 25) % track.N];
    const bend = Math.atan2(t1.x * t2.z - t1.z * t2.x, t1.x * t2.x + t1.z * t2.z); // سالب = يسار؟
    let drift = false;
    if (Math.abs(bend) > 0.55 && k.speed > 26) drift = true;
    if (k.drifting && Math.abs(bend) < 0.2 && k.driftLvl >= 1) drift = false;
    const driftPressed = drift && !this.prevDrift;
    this.prevDrift = drift;

    // موازنة الصعوبة: الآلي المتأخر جداً يسرع قليلاً
    const gap = leaderProg - k.prog;
    k.botSpeed = this.skill * (gap > 80 ? 1.06 : gap < -60 ? 0.94 : 1);

    // استخدام الأسلحة
    let fire = false, back = false;
    if (k.item && !k.rolling) {
      this.itemDelay -= dt;
      if (this.itemDelay <= 0) {
        const it = k.item;
        if (it === 'missile' || it === 'jar' || it === 'dagger') {
          for (const o of karts.values()) {
            if (o === k) continue;
            const dp = o.prog - k.prog;
            if (dp > 3 && dp < 40) { fire = true; break; }
          }
          if (this.itemDelay < -6) fire = true;
        } else if (it === 'oil' || it === 'fake') {
          for (const o of karts.values()) {
            const dp = k.prog - o.prog;
            if (o !== k && dp > 2 && dp < 25) { fire = true; break; }
          }
          if (this.itemDelay < -5) fire = true;
          back = true;
        } else if (it === 'locust') {
          for (const o of karts.values()) if (o !== k && Math.hypot(o.pos.x - k.pos.x, o.pos.z - k.pos.z) < 22) fire = true;
          if (this.itemDelay < -6) fire = true;
        } else if (it === 'shield' || it === 'amulet' || it === 'orbit' || it === 'cloak') {
          fire = this.itemDelay < -1;
        } else fire = true;
        if (fire) this.itemDelay = 1 + Math.random() * 3;
      }
    }
    return { up: true, down: false, steer, drift, driftPressed, fire, back };
  }

  // المعركة: اجمع سلاحاً، طارد أقرب خصم، وتجنّب الجدران والعوائق
  thinkArena(dt, arena, karts, boxes) {
    const k = this.k;
    let foe = null, fd = Infinity;
    for (const o of karts.values()) {
      if (o === k || o.out) continue;
      const d = Math.hypot(o.pos.x - k.pos.x, o.pos.z - k.pos.z);
      if (d < fd) { fd = d; foe = o; }
    }
    let tx, tz;
    if (!k.item && !k.rolling && boxes) {
      let bd = Infinity;
      for (const b of boxes.list) {
        if (!b.active) continue;
        const d = Math.hypot(b.p.x - k.pos.x, b.p.z - k.pos.z);
        if (d < bd) { bd = d; tx = b.p.x; tz = b.p.z; }
      }
    }
    if (tx === undefined && foe) { tx = foe.pos.x + Math.sin(foe.heading) * 8; tz = foe.pos.z + Math.cos(foe.heading) * 8; }
    if (tx === undefined) { tx = 0; tz = 0; }
    // بعد الانحشار: تجوّل نحو نقطة عشوائية قليلاً بدل الهدف نفسه
    if (this.wanderT > 0) { this.wanderT -= dt; tx = this.wx; tz = this.wz; }
    // ملاحة: إن كان الطريق المباشر مسدوداً نجرّب اتجاهات قريبة ونختار أوضحها
    const clear = (ang, maxD) => {
      const sx = Math.sin(ang), sz = Math.cos(ang);
      for (let d = 4; d <= maxD; d += 4) if (arena.solidAt(k.pos.x + sx * d, k.pos.z + sz * d, 2.4)) return d;
      return maxD + 4;
    };
    const direct = Math.atan2(tx - k.pos.x, tz - k.pos.z);
    const tdist = Math.min(40, Math.hypot(tx - k.pos.x, tz - k.pos.z));
    let want = direct;
    if (clear(direct, tdist) <= tdist) {
      let best = -Infinity;
      for (const off of [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.45, -1.45, 1.9, -1.9, 2.5, -2.5]) {
        const c = clear(direct + off, 40);
        const score = c - Math.abs(off) * 9;
        if (score > best) { best = score; want = direct + off; }
      }
    }
    // التخلص من الانحشار: رجوع للخلف قليلاً مع لفّ المقود
    if (this.revT > 0) {
      this.revT -= dt;
      return { up: false, down: true, steer: this.revSteer, drift: false, driftPressed: false, fire: false, back: false };
    }
    if (Math.abs(k.speed) < 4 && k.spinT <= 0) this.stuckT = (this.stuckT || 0) + dt; else this.stuckT = 0;
    if (this.stuckT > 1.0) {
      this.stuckT = 0; this.revT = 0.9; this.revSteer = Math.random() > 0.5 ? 1 : -1;
      const a = Math.random() * Math.PI * 2;
      this.wx = k.pos.x * 0.3 + Math.cos(a) * 60; this.wz = k.pos.z * 0.3 + Math.sin(a) * 60; this.wanderT = 3;
    }
    let d = want - k.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    const steer = Math.max(-1, Math.min(1, d * 2.5));
    const down = Math.abs(d) > 2.4 && k.speed < 10;
    k.botSpeed = this.skill * 0.92;

    let fire = false, back = false;
    if (k.item && !k.rolling && foe) {
      this.itemDelay -= dt;
      const ang = Math.atan2(foe.pos.x - k.pos.x, foe.pos.z - k.pos.z) - k.heading;
      const aim = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
      const it = k.item;
      if (it === 'missile') fire = fd < 90; // الصقر يلاحق أقرب مركبة بنفسه
      else if (it === 'jar' || it === 'dagger') fire = fd < 42 && aim < 0.3;
      else if (it === 'oil' || it === 'fake') { fire = fd < 25 && aim > 2.4; back = true; }
      else if (it === 'locust') fire = fd < 20;
      else if (it === 'shield' || it === 'amulet' || it === 'orbit' || it === 'cloak') fire = this.itemDelay < -1;
      else fire = this.itemDelay < 0;
      if (this.itemDelay < -8) fire = true;
      if (fire) this.itemDelay = 1 + Math.random() * 2;
    }
    return { up: !down, down, steer, drift: false, driftPressed: false, fire, back };
  }
}
