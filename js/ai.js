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
        if (it === 'missile' || it === 'jar') {
          for (const o of karts.values()) {
            if (o === k) continue;
            const dp = o.prog - k.prog;
            if (dp > 3 && dp < 40) { fire = true; break; }
          }
          if (this.itemDelay < -6) fire = true;
        } else if (it === 'oil') {
          for (const o of karts.values()) {
            const dp = k.prog - o.prog;
            if (o !== k && dp > 2 && dp < 25) { fire = true; break; }
          }
          if (this.itemDelay < -5) fire = true;
          back = true;
        } else if (it === 'shield') {
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
    const fx = Math.sin(k.heading), fz = Math.cos(k.heading);
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
    // تجنّب العوائق القريبة أمامنا
    for (const o of arena.obstacles) {
      const ox = o.x - k.pos.x, oz = o.z - k.pos.z;
      const ahead = ox * fx + oz * fz;
      const side = ox * fz - oz * fx;
      if (ahead > 0 && ahead < o.r + 12 && Math.abs(side) < o.r + 3) {
        tx = k.pos.x + fx * 10 + (side > 0 ? -fz : fz) * 14;
        tz = k.pos.z + fz * 10 + (side > 0 ? fx : -fx) * 14;
      }
    }
    // ابتعد عن السور
    const dc = Math.hypot(k.pos.x, k.pos.z);
    if (dc > arena.R - 14 && (k.pos.x * fx + k.pos.z * fz) > 0) { tx = 0; tz = 0; }
    const want = Math.atan2(tx - k.pos.x, tz - k.pos.z);
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
      if (it === 'missile') fire = fd < 70 && aim < 0.5;
      else if (it === 'jar') fire = fd < 40 && aim < 0.25;
      else if (it === 'oil') { fire = fd < 25 && aim > 2.4; back = true; }
      else if (it === 'shield') fire = this.itemDelay < -1;
      else fire = this.itemDelay < 0;
      if (this.itemDelay < -8) fire = true;
      if (fire) this.itemDelay = 1 + Math.random() * 2;
    }
    return { up: !down, down, steer, drift: false, driftPressed: false, fire, back };
  }
}
