import * as THREE from 'three';
import type { Game } from '../core/Game';
import { toy } from '../render/Materials';
import { at, colorize, cyl, merge, sphere } from '../world/Geo';

interface Bomb { obj: THREE.Object3D; t: number; pos: THREE.Vector3; }
interface Arrow { obj: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; life: number; }
export const TOOL_ORDER = ['lantern', 'shovel', 'bomb', 'bow', 'rod'];
const bombMat = toy({ vertexColors: true, roughness: 0.4 }, { gloss: 0.6, rim: 0.3 });

/** Equipped-tool actions: shovel dig, bomb place/explode, bow shot, rod cast, lantern. */
export class Tools {
  bombs: Bomb[] = []; arrows: Arrow[] = []; targets: { pos: THREE.Vector3; r: number; hit: () => void }[] = [];
  constructor(private g: Game) {}
  cycle() {
    const inv = this.g.inv; const owned = TOOL_ORDER.filter((t) => inv.has(t));
    if (!owned.length) { this.g.ui.toast('가진 도구가 없어요'); return; }
    const i = owned.indexOf(inv.equipped.tool);
    inv.wear(owned[(i + 1) % owned.length]);
    this.g.audio.play('ui'); this.g.ui.toast(`도구: ${this.g.itemName(inv.equipped.tool)}`);
  }
  use() {
    const g = this.g, P = g.player, tool = g.inv.equipped.tool;
    if (!tool) { this.cycle(); return; }
    if (g.mount.riding && tool !== 'lantern') { g.ui.toast('늑대에서 내린 뒤 써야 해요'); return; }
    const f = P.facing();
    switch (tool) {
      case 'shovel':
        if (g.area !== 'island') { g.ui.toast('여기는 땅을 팔 수 없어요'); return; }
        P.action = 'interact'; P.actionT = 0; g.explore.dig(P.pos.clone().addScaledVector(f, 0.6)); break;
      case 'bomb': {
        if (!g.inv.take('bomb')) { g.ui.toast('폭탄이 없어요 (대장간에서 살 수 있어요)'); return; }
        const pos = P.pos.clone().addScaledVector(f, 1.1); pos.y = g.groundAt(pos.x, pos.z) + 0.35;
        const obj = new THREE.Group();
        obj.add(new THREE.Mesh(merge([colorize(at(sphere(0.32, 16, 12), 0, 0, 0), 0x3a4a6a), colorize(at(cyl(0.08, 0.1, 0.14, 8), 0, 0.33, 0), 0xc8a060), colorize(at(new THREE.TorusGeometry(0.33, 0.04, 6, 18), 0, 0, 0, Math.PI / 2, 0, 0), 0xf2c94c)]), bombMat));
        (obj.children[0] as THREE.Mesh).castShadow = true;
        obj.position.copy(pos); g.scene.add(obj);
        this.bombs.push({ obj, t: 1.8, pos }); g.audio.play('fuse'); break;
      }
      case 'bow': {
        if (!g.inv.take('arrow')) { g.ui.toast('화살이 없어요 (대장간에서 살 수 있어요)'); return; }
        P.action = 'interact'; P.actionT = 0.2;
        const pos = P.pos.clone().add(new THREE.Vector3(0, 1.15, 0)).addScaledVector(f, 0.6);
        const obj = new THREE.Mesh(merge([colorize(at(cyl(0.025, 0.025, 1.0, 5), 0, 0, 0, Math.PI / 2, 0, 0), 0xc89a58), colorize(at(new THREE.ConeGeometry(0.06, 0.18, 6), 0, 0, 0.55, Math.PI / 2, 0, 0), 0xb8c0c8), colorize(at(new THREE.BoxGeometry(0.12, 0.02, 0.18), 0, 0, -0.45), 0xffffff)]), bombMat);
        obj.position.copy(pos); obj.lookAt(pos.clone().add(f)); g.scene.add(obj);
        this.arrows.push({ obj, pos, vel: f.clone().multiplyScalar(30).setY(0.6), life: 1.6 }); g.audio.play('bow'); break;
      }
      case 'rod': g.fishing.start(); break;
      case 'lantern': g.useLantern(); break;
      default: g.ui.toast('지금은 쓸 수 없어요');
    }
    g.ui.equip(g.inv, g.touch.enabled);
  }
  update(dt: number) {
    const g = this.g;
    for (const b of this.bombs) {
      b.t -= dt;
      const s = 1 + Math.max(0, 0.6 - b.t) * 0.35 * Math.abs(Math.sin(b.t * 30));
      b.obj.scale.setScalar(s);
      if (Math.random() < 0.5) g.particles.emit({ pos: b.pos.clone().setY(b.pos.y + 0.45), count: 1, spread: 0.6, life: 0.3, size: 0.12, color: 0xffc860, additive: true });
      if (b.t <= 0) this.explode(b.pos);
    }
    this.bombs = this.bombs.filter((b) => { if (b.t <= 0) b.obj.removeFromParent(); return b.t > 0; });
    for (const a of this.arrows) {
      a.life -= dt; a.vel.y -= 4 * dt; a.pos.addScaledVector(a.vel, dt);
      a.obj.position.copy(a.pos); a.obj.lookAt(a.pos.clone().add(a.vel));
      if (a.pos.y < g.groundAt(a.pos.x, a.pos.z, a.pos.y + 1) + 0.05) a.life = 0;
      for (const e of g.enemies) if (!e.dead && a.life > 0) {
        const h = e.type === 'moth' ? 1.6 : e.type === 'storm' ? e.m.body.position.y + 0.8 : e.m.height * 0.45;
        if (Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z) < e.radius + 0.3 && Math.abs(e.pos.y + h - a.pos.y) < (e.type === 'storm' ? 3.2 : 1.4)) {
          a.life = 0; g.particles.hit(a.pos.clone()); g.audio.play('hit');
          if (e.type === 'storm') e.arrowHit?.(); else e.damage(1, a.pos.clone().sub(a.vel));
        }
      }
      for (const t of this.targets) if (a.life > 0 && a.pos.distanceTo(t.pos) < t.r) { a.life = 0; t.hit(); }
      if (a.life <= 0) a.obj.removeFromParent();
    }
    this.arrows = this.arrows.filter((a) => a.life > 0);
  }
  private explode(p: THREE.Vector3) {
    const g = this.g, R = 3.2;
    g.audio.play('boom'); g.shake(0.6);
    g.particles.emit({ pos: p.clone().setY(p.y + 0.5), count: 1, life: 0.3, size: 5, grow: 2, color: 0xfff0c0, additive: true, spread: 0 });
    g.particles.emit({ pos: p.clone().setY(p.y + 0.5), count: 26, spread: 6, up: 1, life: 0.5, size: 0.5, color: 0xffa040, additive: true, drag: 4 });
    for (let i = 0; i < 4; i++) g.particles.poof(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.8, (Math.random() - 0.5) * 2)), 0x9a9088);
    for (const e of g.enemies) if (!e.dead && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < R + e.radius) { if (e.bombHit) e.bombHit(); else e.damage(2, p, 10); }
    if (g.area === 'island') g.explore.blast(p, R);
    g.world.veg.cutBushAt(p.x, p.z, R - 1).forEach((b) => g.particles.leaves(new THREE.Vector3(b.x, b.y + 0.6, b.z)));
    const P = g.player; if (P.pos.distanceTo(p) < R * 0.7) P.hurt(1, p, 8);
  }
}
