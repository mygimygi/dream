import * as THREE from 'three';

/** Pooled soft-sprite particles (dust, leaves, sparks, sparkles, splashes) in a single draw call. */
interface P { alive: boolean; pos: THREE.Vector3; vel: THREE.Vector3; life: number; max: number; size: number; grow: number; color: THREE.Color; grav: number; drag: number; spin: number; rot: number; additive: boolean; }
const MAX = 900;

function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}

export class Particles {
  private ps: P[] = [];
  private geo = new THREE.BufferGeometry();
  private posA = new Float32Array(MAX * 3); private colA = new Float32Array(MAX * 4); private sizeA = new Float32Array(MAX);
  points: THREE.Points; glow: THREE.Points;
  private gpos = new Float32Array(MAX * 3); private gcol = new Float32Array(MAX * 4); private gsize = new Float32Array(MAX); private ggeo = new THREE.BufferGeometry();
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < MAX; i++) this.ps.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, max: 1, size: 1, grow: 0, color: new THREE.Color(), grav: 0, drag: 0, spin: 0, rot: 0, additive: false });
    const tex = softTex();
    const mk = (geo: THREE.BufferGeometry, p: Float32Array, c: Float32Array, s: Float32Array, additive: boolean) => {
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('color', new THREE.BufferAttribute(c, 4).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('size', new THREE.BufferAttribute(s, 1).setUsage(THREE.DynamicDrawUsage));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uTex: { value: tex }, uScale: { value: 600 } },
        vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale;
          void main(){ vC=color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*uScale/-mv.z; gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform sampler2D uTex; varying vec4 vC; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a*t.a); if(gl_FragColor.a<0.01) discard; }`,
      });
      const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
      return pts;
    };
    this.points = mk(this.geo, this.posA, this.colA, this.sizeA, false);
    this.glow = mk(this.ggeo, this.gpos, this.gcol, this.gsize, true);
  }
  setScale(h: number) { for (const p of [this.points, this.glow]) (p.material as THREE.ShaderMaterial).uniforms.uScale.value = h * 0.9; }
  emit(o: { pos: THREE.Vector3; vel?: THREE.Vector3; spread?: number; count?: number; life?: number; size?: number; grow?: number; color?: THREE.ColorRepresentation; grav?: number; drag?: number; additive?: boolean; up?: number; }) {
    const n = o.count ?? 1;
    for (let k = 0; k < n; k++) {
      const p = this.ps.find((q) => !q.alive); if (!p) return;
      p.alive = true; p.pos.copy(o.pos);
      const s = o.spread ?? 1;
      p.vel.set((Math.random() - 0.5) * 2 * s, (Math.random() * 0.8 + 0.2) * s * (o.up ?? 1), (Math.random() - 0.5) * 2 * s);
      if (o.vel) p.vel.add(o.vel);
      p.max = p.life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      p.size = (o.size ?? 0.3) * (0.7 + Math.random() * 0.6); p.grow = o.grow ?? 0;
      p.color.set(o.color ?? 0xffffff); p.grav = o.grav ?? 0; p.drag = o.drag ?? 2; p.additive = !!o.additive;
    }
  }
  dust(pos: THREE.Vector3, n = 6) { this.emit({ pos, count: n, spread: 1.2, up: 0.4, life: 0.55, size: 0.45, grow: 1.2, color: 0xe8d7b0, grav: -0.5, drag: 4 }); }
  leaves(pos: THREE.Vector3, n = 14) { this.emit({ pos, count: n, spread: 3, up: 1.4, life: 0.9, size: 0.22, color: 0x6fbf3c, grav: 6, drag: 2 }); this.emit({ pos, count: n / 2, spread: 3, up: 1.2, life: 0.9, size: 0.2, color: 0x3f8f2f, grav: 6, drag: 2 }); }
  hit(pos: THREE.Vector3) {
    this.emit({ pos, count: 10, spread: 5, up: 0.8, life: 0.25, size: 0.35, color: 0xfff3c0, additive: true, drag: 6 });
    this.emit({ pos, count: 1, life: 0.16, size: 1.8, grow: 3, color: 0xffffff, additive: true, spread: 0 });
  }
  sparkle(pos: THREE.Vector3, color: THREE.ColorRepresentation = 0xfff2a0, n = 12) { this.emit({ pos, count: n, spread: 1.5, up: 1, life: 1.0, size: 0.25, color, additive: true, grav: -0.5, drag: 1.5 }); }
  poof(pos: THREE.Vector3, color: THREE.ColorRepresentation = 0xf4f0ff) { this.emit({ pos, count: 16, spread: 2.2, up: 0.6, life: 0.7, size: 0.8, grow: 1.5, color, drag: 3.5, grav: -1 }); }
  splash(pos: THREE.Vector3) { this.emit({ pos, count: 14, spread: 2, up: 2.5, life: 0.6, size: 0.25, color: 0xd8f6ff, grav: 9, drag: 1 }); }
  update(dt: number) {
    let n = 0, g = 0;
    for (const p of this.ps) {
      if (!p.alive) continue;
      p.life -= dt; if (p.life <= 0) { p.alive = false; continue; }
      p.vel.multiplyScalar(Math.exp(-p.drag * dt)); p.vel.y -= p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      const t = 1 - p.life / p.max;
      const a = Math.min(1, (1 - t) * 2.2) * Math.min(1, t * 12 + 0.3);
      const size = p.size * (1 + p.grow * t);
      if (p.additive) {
        this.gpos.set([p.pos.x, p.pos.y, p.pos.z], g * 3); this.gcol.set([p.color.r * 1.6, p.color.g * 1.6, p.color.b * 1.6, a], g * 4); this.gsize[g] = size; g++;
      } else {
        this.posA.set([p.pos.x, p.pos.y, p.pos.z], n * 3); this.colA.set([p.color.r, p.color.g, p.color.b, a * 0.9], n * 4); this.sizeA[n] = size; n++;
      }
    }
    this.geo.setDrawRange(0, n); this.ggeo.setDrawRange(0, g);
    for (const geo of [this.geo, this.ggeo]) { geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.size.needsUpdate = true; }
  }
}
