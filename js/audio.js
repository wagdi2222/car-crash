// أصوات مُولّدة: محرك، مؤثرات، وموسيقى على مقام الحجاز مع إيقاع الدربكة
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = localStorageGet('rimal-mute') === '1';
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.6; this.sfx.connect(this.master);
    this.musicGain = c.createGain(); this.musicGain.gain.value = 0.28; this.musicGain.connect(this.master);
    // ضوضاء
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // المحرك
    this.eng = c.createOscillator(); this.eng.type = 'sawtooth';
    this.eng2 = c.createOscillator(); this.eng2.type = 'square';
    this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 600;
    this.engG = c.createGain(); this.engG.gain.value = 0;
    this.eng.connect(this.engF); this.eng2.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.sfx);
    this.eng.start(); this.eng2.start();
    this.beat = 0; this.nextT = 0; this.musicOn = false;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorageSet('rimal-mute', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    return this.muted;
  }

  engine(speed, on) {
    if (!this.ctx) return;
    const s = Math.abs(speed);
    const f = 45 + s * 2.6;
    this.eng.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.eng2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.05);
    this.engG.gain.setTargetAtTime(on ? 0.05 + s * 0.0012 : 0, this.ctx.currentTime, 0.1);
  }

  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, when = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noiseHit(dur, freq, vol = 0.4, out) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out || this.sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  play(name) {
    switch (name) {
      case 'beep': this.tone(520, 0.25, 'square', 0.2); break;
      case 'go': this.tone(1040, 0.6, 'square', 0.2); break;
      case 'pickup': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.2, 0, i * 0.06)); break;
      case 'item': this.tone(880, 0.2, 'triangle', 0.25, 400); break;
      case 'fire': this.noiseHit(0.4, 3000, 0.4); this.tone(300, 0.3, 'sawtooth', 0.15, -200); break;
      case 'boom': this.noiseHit(0.9, 1500, 0.8); this.tone(90, 0.6, 'sine', 0.5, -50); break;
      case 'boost': this.tone(200, 0.5, 'sawtooth', 0.15, 600); this.noiseHit(0.5, 4000, 0.2); break;
      case 'hop': this.tone(300, 0.08, 'sine', 0.15, 200); break;
      case 'spark': this.tone(1200 + Math.random() * 400, 0.05, 'square', 0.04); break;
      case 'lvl': this.tone(900, 0.12, 'triangle', 0.2, 300); break;
      case 'hit': this.tone(400, 0.5, 'square', 0.2, -320); this.noiseHit(0.5, 2000, 0.4); break;
      case 'shield': this.tone(600, 0.4, 'sine', 0.25, 600); break;
      case 'storm': this.noiseHit(2.5, 1200, 0.5); break;
      case 'genie': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.18, 0, i * 0.08)); break;
      case 'lap': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.2, 'square', 0.15, 0, i * 0.1)); break;
      case 'win': [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.25, 0, i * 0.15)); break;
      case 'wall': this.noiseHit(0.15, 800, 0.15); break;
    }
  }

  // ---------- الموسيقى ----------
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextT = this.ctx.currentTime + 0.1;
    this.beat = 0;
    this.phrase = this.makePhrase();
    this.timer = setInterval(() => this.schedule(), 50);
  }
  stopMusic() { this.musicOn = false; clearInterval(this.timer); }

  makePhrase() {
    // مقام الحجاز على ري: ري، مي♭، فا#، صول، لا، سي♭، دو، ري
    const scale = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16];
    const ph = [];
    let deg = 4;
    for (let i = 0; i < 32; i++) {
      if (Math.random() < 0.3) { ph.push(null); continue; }
      deg = Math.max(0, Math.min(scale.length - 1, deg + Math.floor(Math.random() * 5) - 2));
      if (i % 8 === 7) deg = [0, 4, 7][Math.floor(Math.random() * 3)];
      ph.push(scale[deg]);
    }
    return ph;
  }

  schedule() {
    const c = this.ctx;
    const step = 60 / 112 / 4; // نوتة سادسة عشرية
    while (this.nextT < c.currentTime + 0.2) {
      const b = this.beat % 16;
      // إيقاع المقسوم: دم تك - تك دم - تك -
      const doum = [0, 6, 8], tek = [3, 4, 10, 12, 14];
      if (doum.includes(b)) this.drum(this.nextT, true);
      else if (tek.includes(b)) this.drum(this.nextT, false);
      else if (b % 2 === 1 && Math.random() < 0.25) this.drum(this.nextT, false, 0.3);
      // اللحن (عود)
      if (this.beat % 2 === 0) {
        const n = this.phrase[(this.beat / 2) % 32];
        if (n !== null && n !== undefined) this.oud(this.nextT, 146.83 * Math.pow(2, n / 12));
      }
      // باص
      if (b === 0 || b === 8) this.oud(this.nextT, 73.4, 0.5, 0.25);
      this.beat++;
      if (this.beat % 128 === 0) this.phrase = this.makePhrase();
      this.nextT += step;
    }
  }

  oud(t, f, dur = 0.35, vol = 0.18) {
    const c = this.ctx;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sawtooth';
    o.frequency.value = f; o2.frequency.value = f * 1.003;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 6, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(this.musicGain);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  drum(t, low, vol = 1) {
    const c = this.ctx;
    if (low) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
      g.gain.setValueAtTime(0.7 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.35);
    } else {
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
      const g = c.createGain(); g.gain.setValueAtTime(0.35 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      s.connect(f); f.connect(g); g.connect(this.musicGain); s.start(t, Math.random() * 0.5); s.stop(t + 0.1);
    }
  }
}

export function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
export function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } }
