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
  think(dt, track, karts, leaderProg) {
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
}
