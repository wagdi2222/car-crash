// نظام الجزيئات: شرر، غبار، لهب، انفجارات، عاصفة رملية
import * as THREE from '../lib/three.module.min.js';

class Pool {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float uScale;
        varying vec3 vC; varying float vA;
        void main(){ vC = pcolor; vA = palpha; vec4 mv = modelViewMatrix * vec4(position,1.);
          gl_PointSize = psize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
          gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.15, r)); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tmp = new THREE.Color();
  }

  add(p, v, color, life, size, grow = 0, grav = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.tmp.set(color);
    this.col.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
    this.size[i] = size; this.alpha[i] = 1;
    this.life[i] = life; this.maxLife[i] = life;
    this.grow[i] = grow; this.grav[i] = grav;
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // نقل آخر عنصر مكانه
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) {
            this.pos[i * 3 + k] = this.pos[j * 3 + k];
            this.vel[i * 3 + k] = this.vel[j * 3 + k];
            this.col[i * 3 + k] = this.col[j * 3 + k];
          }
          this.size[i] = this.size[j]; this.alpha[i] = this.alpha[j];
          this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
          this.grow[i] = this.grow[j]; this.grav[i] = this.grav[j];
        }
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = Math.min(1, this.life[i] / this.maxLife[i] * 1.5);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'pcolor', 'psize', 'palpha']) this.geo.attributes[k].needsUpdate = true;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (a) => (Math.random() - 0.5) * a;

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.add = new Pool(scene, 2500, true);
    this.norm = new Pool(scene, 1500, false);
    this.flashes = [];
    this.stormOn = false;
  }
  setScale(h) { this.add.mat.uniforms.uScale.value = h * 0.6; this.norm.mat.uniforms.uScale.value = h * 0.6; }

  spark(p, color) { this.add.add(p, V(rnd(4), 2 + Math.random() * 3, rnd(4)), color, 0.3, 0.35, 0, 15); }
  dust(p) { this.norm.add(p, V(rnd(3), 1 + Math.random() * 2, rnd(3)), 0xd9b07a, 0.9, 1.0, 2.5, 0); }
  flame(p, f) {
    this.add.add(p.clone().add(V(rnd(0.5), rnd(0.3), rnd(0.5))), V(-f.x * 8 + rnd(2), 1, -f.z * 8 + rnd(2)), Math.random() > 0.5 ? 0xff7a1a : 0x5ce1e6, 0.25, 0.9, -2, 0);
  }
  sparkle(p) { this.add.add(p.clone().add(V(rnd(3), 0, rnd(3))), V(rnd(1), 1.5, rnd(1)), Math.random() > 0.5 ? 0xffd166 : 0xc77dff, 0.6, 0.4, 0, 0); }
  trail(p, color) { this.add.add(p, V(rnd(1), rnd(1), rnd(1)), color, 0.4, 0.8, 1.5, 0); this.norm.add(p, V(rnd(1), 1, rnd(1)), 0x777777, 0.8, 0.7, 2.5, 0); }

  explode(p, color = 0xff8c1a) {
    for (let i = 0; i < 70; i++) {
      const d = V(rnd(2), Math.random(), rnd(2)).normalize().multiplyScalar(6 + Math.random() * 14);
      this.add.add(p, d, Math.random() > 0.3 ? color : 0xffe08a, 0.6 + Math.random() * 0.4, 1.2, -1, 8);
    }
    for (let i = 0; i < 12; i++) this.norm.add(p.clone().add(V(rnd(2), 1, rnd(2))), V(rnd(5), 3 + Math.random() * 3, rnd(5)), 0x9a8268, 1.1, 1.2, 1.6, 0);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(p);
    this.scene.add(m);
    this.flashes.push({ m, t: 0 });
  }

  // سحابة جراد تنتشر حول نقطة
  swarm(p) {
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 22;
      this.norm.add(p.clone().add(V(rnd(3), Math.random() * 3, rnd(3))), V(Math.cos(a) * sp, 1 + Math.random() * 4, Math.sin(a) * sp), Math.random() > 0.5 ? 0x4a5a1a : 0x6b4a1a, 1.2, 0.45, 0, 0);
    }
  }
  pickup(p) { for (let i = 0; i < 25; i++) this.add.add(p, V(rnd(10), Math.random() * 8, rnd(10)), Math.random() > 0.5 ? 0xf2c14e : 0x5ce1e6, 0.5, 0.6, 0, 10); }
  splash(p) { for (let i = 0; i < 30; i++) this.norm.add(p, V(rnd(8), Math.random() * 5, rnd(8)), 0x1d1208, 0.8, 0.8, 0, 12); }

  // عاصفة رملية حول الكاميرا
  storm(camPos) {
    for (let i = 0; i < 12; i++) {
      this.norm.add(V(camPos.x + rnd(50), camPos.y + rnd(10), camPos.z + rnd(50)), V(18 + rnd(6), rnd(2), 8 + rnd(6)), Math.random() > 0.5 ? 0xd9a35f : 0xc48b4a, 1.2, 2.5 + Math.random() * 2, 2, 0);
    }
  }

  update(dt) {
    this.add.update(dt);
    this.norm.update(dt);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      f.m.scale.setScalar(1 + f.t * 18);
      f.m.material.opacity = Math.max(0, 0.9 - f.t * 3);
      if (f.t > 0.3) { this.scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); this.flashes.splice(i, 1); }
    }
  }
}
