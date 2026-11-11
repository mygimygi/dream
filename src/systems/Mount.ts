import * as THREE from 'three';
import type { Game } from '../core/Game';
import { toy } from '../render/Materials';
import { at, blob, colorize, gradient, merge, sphere, taperTube } from '../world/Geo';
import { blobShadow } from '../render/BlobShadow';
import { WOLF_SPOT } from '../data/places';
import { damp, dampAngle, angleDiff } from '../core/math';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Original design: a fluffy grey-and-cream island wolf with a teal bandana. */
function wolfModel() {
  const mat = toy({ vertexColors: true, roughness: 0.6 }, { rim: 0.35, gloss: 0.35 });
  const M = (g: THREE.BufferGeometry) => { const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 0.85;
  body.add(M(gradient(at(blob(0.55, 3, 0.08, 3), 0, 0, 0, 0, 0, 0, [0.85, 0.75, 1.6]), 0x8a8e98, 0xd8dce4, -0.4, 0.4)));
  body.add(M(gradient(at(blob(0.42, 5, 0.1, 2), 0, -0.12, 0.35, 0, 0, 0, [0.85, 0.7, 1.0]), 0xf2e8d8, 0xffffff, -0.5, 0.2)));
  const head = new THREE.Group(); head.position.set(0, 0.35, 0.85); body.add(head);
  head.add(M(gradient(at(blob(0.36, 7, 0.06, 3), 0, 0, 0, 0, 0, 0, [1, 0.9, 1.05]), 0x8a8e98, 0xdfe2ea, -0.3, 0.3)));
  head.add(M(colorize(at(sphere(0.2, 14, 10), 0, -0.08, 0.3, 0, 0, 0, [0.9, 0.75, 1.2]), 0xf6eee0)));
  head.add(M(colorize(at(sphere(0.07, 10, 8), 0, -0.02, 0.53), 0x2a2228)));
  for (const s of [-1, 1]) {
    head.add(M(colorize(at(new THREE.ConeGeometry(0.13, 0.3, 8), s * 0.2, 0.32, -0.05, -0.15, 0, s * -0.25), 0x7a7e88)));
    head.add(M(colorize(at(sphere(0.07, 12, 10), s * 0.13, 0.08, 0.27, 0, 0, 0, [0.9, 1.1, 0.5]), 0x2a3a2a)));
    head.add(M(colorize(at(sphere(0.022, 6, 5), s * 0.13 + 0.02, 0.11, 0.3), 0xffffff)));
  }
  body.add(M(colorize(at(new THREE.TorusGeometry(0.33, 0.07, 8, 18), 0, 0.15, 0.62, Math.PI / 2 - 0.3, 0, 0), 0x2f9e94)));
  const tail = new THREE.Group(); tail.position.set(0, 0.15, -0.85); body.add(tail);
  tail.add(M(gradient(taperTube([V(0, 0, 0), V(0, 0.25, -0.3), V(0, 0.45, -0.45)], 0.15, 0.06, 8, 8), 0x8a8e98, 0xffffff, 0, 0.5)));
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.25, 0.5], [0.25, 0.5], [-0.25, -0.5], [0.25, -0.5]]) {
    const l = new THREE.Group(); l.position.set(x, -0.2, z); body.add(l);
    l.add(M(gradient(merge([at(taperTube([V(0, 0, 0), V(0, -0.35, 0.02), V(0, -0.62, 0)], 0.11, 0.07, 6, 7), 0, 0, 0), at(sphere(0.1, 10, 8), 0, -0.64, 0.05, 0, 0, 0, [1, 0.6, 1.3])]), 0xe8e2d8, 0x8a8e98, -0.7, 0)));
    legs.push(l);
  }
  return { root, body, head, tail, legs };
}

/** Wolf companion: lies injured until befriended, then follows, sits, and can be ridden. */
export class Mount {
  m = wolfModel(); pos = new THREE.Vector3(); yaw = 0; riding = false; private phase = 0; private shadow = blobShadow(0.9); private t = 0;
  constructor(private g: Game) {
    g.scene.add(this.m.root); g.scene.add(this.shadow);
    this.pos.set(WOLF_SPOT.x, g.world.hf.height(WOLF_SPOT.x, WOLF_SPOT.z), WOLF_SPOT.z);
  }
  get friend() { return this.g.quest.has('wolfFriend'); }
  interact(p: THREE.Vector3): { label: string; act: () => void } | null {
    if (this.g.area !== 'island' || this.riding) return null;
    if (Math.hypot(this.pos.x - p.x, this.pos.z - p.z) > 2.6) return null;
    if (!this.friend) return { label: '다친 늑대 살펴보기', act: () => this.g.talkTo('wolf', '다친 늑대') };
    return { label: '늑대에 올라타기', act: () => this.toggle() };
  }
  toggle() {
    const g = this.g;
    if (!this.friend) return;
    if (this.riding) { this.riding = false; g.player.riding = false; g.ui.toast('늑대에서 내렸다'); return; }
    if (g.area !== 'island') { g.ui.toast('여기서는 늑대를 부를 수 없어요'); return; }
    if (Math.hypot(this.pos.x - g.player.pos.x, this.pos.z - g.player.pos.z) > 6) { // whistle: the wolf comes running
      this.pos.copy(g.player.pos).add(new THREE.Vector3(-1.5, 0, -1.5)); g.particles.dust(this.pos.clone(), 8);
    }
    this.riding = true; g.player.riding = true; g.audio.play('jump'); g.ui.toast('늑대를 타고 달린다! (다시 누르면 내리기)');
  }
  update(dt: number) {
    const g = this.g, P = g.player; this.t += dt;
    const visible = g.area === 'island';
    this.m.root.visible = visible; this.shadow.visible = visible;
    if (!visible) { if (this.riding) { this.riding = false; P.riding = false; } return; }
    let speed = 0;
    if (this.riding) {
      const prev = this.pos.clone();
      this.pos.copy(P.pos); this.yaw = P.yaw;
      speed = prev.distanceTo(this.pos) / Math.max(dt, 1e-3);
    } else if (this.friend) {
      const d = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
      if (d > 3.2) {
        const dir = new THREE.Vector3(P.pos.x - this.pos.x, 0, P.pos.z - this.pos.z).normalize();
        speed = Math.min(9, (d - 2.5) * 2.4);
        const nx = this.pos.x + dir.x * speed * dt, nz = this.pos.z + dir.z * speed * dt;
        const r = g.world.col.resolve(nx, nz, 0.5, this.pos.y, 1);
        this.pos.x = r.x; this.pos.z = r.z;
        this.yaw = dampAngle(this.yaw, Math.atan2(dir.x, dir.z), 8, dt);
        if (d > 30) this.pos.set(P.pos.x - dir.x * 3, 0, P.pos.z - dir.z * 3); // never get lost
      }
      this.pos.y = damp(this.pos.y, g.groundAt(this.pos.x, this.pos.z), 20, dt);
    } else this.pos.y = g.groundAt(this.pos.x, this.pos.z);
    // animation: trot/gallop by speed, sitting when idle, lying when injured
    const W = this.m;
    this.phase += speed * dt * 1.6;
    const run = Math.min(1, speed / 6);
    W.legs.forEach((l, i) => { const off = i === 0 || i === 3 ? 0 : Math.PI; l.rotation.x = Math.sin(this.phase + off) * (0.3 + run * 0.6) * Math.min(1, speed); });
    W.body.position.y = 0.85 + Math.abs(Math.sin(this.phase)) * 0.08 * run;
    W.body.rotation.x = Math.sin(this.phase * 2) * 0.05 * run;
    W.tail.rotation.x = -0.3 + Math.sin(this.t * (this.friend ? 9 : 2)) * 0.25;
    W.tail.rotation.y = Math.sin(this.t * (this.friend ? 7 : 1.5)) * 0.4;
    W.head.rotation.x = this.friend ? Math.sin(this.t * 1.3) * 0.08 : 0.35;
    const lying = !this.friend;
    W.body.position.y -= lying ? 0.45 : (speed < 0.2 ? 0.12 : 0);
    W.legs.forEach((l) => { if (lying) l.rotation.x = -1.4; });
    W.root.position.copy(this.pos); W.root.rotation.y = this.yaw;
    if (this.riding) W.root.rotation.z = -angleDiff(this.yaw, P.yaw) * 0.2;
    this.shadow.position.set(this.pos.x, g.groundAt(this.pos.x, this.pos.z) + 0.04, this.pos.z);
  }
  toJSON() { return { x: this.pos.x, z: this.pos.z }; }
  load(d: any) { if (d) { this.pos.set(d.x, 0, d.z); this.pos.y = this.g.world.hf.height(d.x, d.z); } this.riding = false; this.g.player.riding = false; }
}
