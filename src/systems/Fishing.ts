import * as THREE from 'three';
import type { Game } from '../core/Game';
import { FISH, FishDef } from '../data/itemsData';
import { events } from '../core/Events';
import { at, colorize, cyl, sphere } from '../world/Geo';

type St = 'idle' | 'cast' | 'wait' | 'bite' | 'reel';
const RARITY_W = { 1: 40, 2: 24, 3: 11, 4: 4.5, 5: 1.2 } as Record<number, number>;
export const RARITY_NAMES = ['', '흔함', '보통', '드묾', '희귀', '전설'];

/** Fishing: cast → wait → bite window → reeling gauge minigame. Records sizes; runs the contest. */
export class Fishing {
  st: St = 'idle'; private t = 0; private fish: FishDef | null = null;
  private bobber: THREE.Mesh; private line: THREE.Line; private rod: THREE.Object3D;
  private zone = 0.3; private zoneV = 0; private fishY = 0.5; private fishV = 0; private prog = 0.35;
  records: Record<string, { count: number; max: number }> = {};
  rodLevel = 1;
  contest: { left: number; score: number; catches: number } | null = null;
  bestContest = 0;
  private water = new THREE.Vector3(); private kind: 'beach' | 'lake' | 'coast' = 'beach';
  constructor(private g: Game) {
    this.bobber = new THREE.Mesh(sphere(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8483a, roughness: 0.4 }));
    const top = new THREE.Mesh(sphere(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); top.position.y = 0.1; this.bobber.add(top);
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf6f0e0 }));
    this.line.frustumCulled = false;
    this.rod = new THREE.Mesh(colorize(at(cyl(0.015, 0.03, 1.6, 6), 0, 0.8, 0), 0xc8a060), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    this.bobber.visible = this.line.visible = false;
    g.scene.add(this.bobber, this.line);
  }
  /** returns the water point ahead and its kind, or null */
  private waterAhead() {
    const g = this.g, P = g.player, f = P.facing();
    if (g.area !== 'island') return null;
    for (let d = 2.5; d <= 6; d += 0.5) {
      const x = P.pos.x + f.x * d, z = P.pos.z + f.z * d;
      if (g.world.hf.height(x, z) < -0.5) {
        const r = g.world.hf.regionAt(x, z);
        this.kind = r === 'lake' ? 'lake' : z > 45 ? 'beach' : 'coast';
        return this.water.set(x, 0.02, z);
      }
    }
    return null;
  }
  canFish() { return !!this.waterAhead(); }
  start() {
    const g = this.g;
    if (this.st !== 'idle') { this.stop(false); return; }
    if (!this.waterAhead()) { g.ui.toast('물가에서 물을 바라보고 써야 해요'); return; }
    this.st = 'cast'; this.t = 0;
    g.player.frozen = true;
    g.player.rig.handR.add(this.rod); this.rod.rotation.set(-0.6, 0, 0);
    g.audio.play('swing');
  }
  private pickFish(): FishDef {
    const night = this.g.time_.isNight;
    const pool = FISH.filter((f) => f.where.includes(this.kind) && (!f.time || (f.time === 'night') === night));
    const w = pool.map((f) => RARITY_W[f.rarity] * (f.rarity >= 4 ? 1 + (this.rodLevel - 1) * 0.5 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[0];
  }
  stop(msg = true) {
    this.st = 'idle'; this.bobber.visible = this.line.visible = false; this.rod.removeFromParent();
    this.g.player.frozen = false; this.g.ui.fishing(null);
    if (msg) this.g.ui.toast('낚싯줄을 거뒀다');
  }
  update(dt: number) {
    if (this.st === 'idle') return;
    const g = this.g, P = g.player, inp = g.input;
    this.t += dt;
    const tip = new THREE.Vector3(); this.rod.localToWorld(tip.set(0, 1.6, 0));
    const bob = this.bobber.position;
    if (this.st === 'cast') {
      const k = Math.min(1, this.t / 0.6);
      bob.copy(tip).lerp(this.water, k); bob.y += Math.sin(k * Math.PI) * 1.5;
      this.bobber.visible = this.line.visible = true;
      this.rod.rotation.x = -0.6 - Math.sin(k * Math.PI) * 0.6;
      if (k >= 1) { this.st = 'wait'; this.t = 0; this.fish = this.pickFish(); this.waitFor = 1.6 + Math.random() * 4; g.particles.splash(this.water.clone()); g.audio.play('splash'); }
    } else if (this.st === 'wait') {
      bob.y = 0.05 + Math.sin(this.t * 2.5) * 0.03;
      if (this.t > this.waitFor) { this.st = 'bite'; this.t = 0; g.audio.play('alert'); g.ui.fishing({ phase: 'bite' }); }
      if (inp.wasPressed('attack') || inp.wasPressed('tool') || inp.wasPressed('interact')) { inp.consume('attack'); inp.consume('tool'); this.stop(true); }
    } else if (this.st === 'bite') {
      bob.y = -0.12 + Math.sin(this.t * 30) * 0.05;
      if (Math.random() < 0.3) g.particles.splash(bob.clone());
      if (inp.wasPressed('attack') || inp.wasPressed('tool') || inp.wasPressed('jump')) { inp.consume('attack'); inp.consume('tool'); this.st = 'reel'; this.t = 0; this.prog = 0.3; this.zone = 0.3; this.zoneV = 0; this.fishY = 0.5; this.fishV = 0; g.audio.play('charge'); }
      else if (this.t > 1.0) { g.ui.toast('놓쳤다! 찌가 흔들리면 바로 눌러요'); this.stop(false); }
    } else if (this.st === 'reel') {
      const f = this.fish!;
      const hold = inp.isDown('attack') || inp.isDown('jump') || inp.isDown('tool');
      this.zoneV += (hold ? 2.6 : -2.2) * dt; this.zoneV *= Math.exp(-2.5 * dt);
      const zs = 0.24 + this.rodLevel * 0.04;
      this.zone = Math.max(0, Math.min(1 - zs, this.zone + this.zoneV * dt));
      if (this.zone <= 0 || this.zone >= 1 - zs) this.zoneV *= -0.3;
      // fish darts around with species-specific speed and jumpiness
      if (Math.random() < f.jumpy * dt * 2.2) this.fishV = (Math.random() - 0.5) * f.speed * 2.2;
      this.fishV += (Math.random() - 0.5) * f.speed * dt * 3; this.fishV *= Math.exp(-1.2 * dt);
      this.fishY = Math.max(0.03, Math.min(0.97, this.fishY + this.fishV * dt));
      if (this.fishY <= 0.03 || this.fishY >= 0.97) this.fishV *= -0.7;
      const inZone = this.fishY >= this.zone && this.fishY <= this.zone + zs;
      this.prog += (inZone ? 0.28 : -0.17 - f.rarity * 0.015) * dt;
      bob.set(this.water.x + Math.sin(this.t * 7) * 0.3, -0.05, this.water.z + Math.cos(this.t * 5) * 0.3);
      this.rod.rotation.x = -0.8 - (inZone ? 0.2 : 0) + Math.sin(this.t * 20) * 0.04;
      g.ui.fishing({ phase: 'reel', zone: this.zone, zoneSize: zs, fish: this.fishY, prog: this.prog, inZone });
      if (this.prog >= 1) this.landFish(f);
      else if (this.prog <= 0) { g.ui.toast(`${f.rarity >= 4 ? '커다란 그림자가' : '물고기가'} 도망쳤다…`); this.stop(false); }
    }
    this.line.geometry.setFromPoints([tip, bob.clone()]);
    P.rig.root.rotation.y = P.yaw;
  }
  private waitFor = 3;
  private landFish(f: FishDef) {
    const g = this.g;
    const size = +(f.size[0] + Math.pow(Math.random(), 1.6) * (f.size[1] - f.size[0])).toFixed(1);
    const rec = this.records[f.id] ?? { count: 0, max: 0 };
    const newRecord = size > rec.max;
    rec.count++; rec.max = Math.max(rec.max, size); this.records[f.id] = rec;
    g.inv.add(f.id); g.codex.see('fish', f.id);
    events.emit('fishCaught', f.id);
    this.stop(false);
    g.audio.play(f.rarity >= 4 ? 'itemGet' : 'smallGet');
    g.particles.splash(this.water.clone()); g.particles.sparkle(g.player.pos.clone().setY(g.player.pos.y + 2), 0xbfe8ff, 14);
    if (this.contest) { const pts = Math.round(f.price * (size / f.size[1]) * 2); this.contest.score += pts; this.contest.catches++; g.ui.toast(`+${pts}점 (${f.name} ${size}cm)`); }
    g.ui.fishResult(f, size, newRecord);
  }
  startContest() { this.contest = { left: 120, score: 0, catches: 0 }; this.g.ui.toast('낚시 대회 시작! 2분 동안 점수를 모아요'); this.g.minigames.hud('낚시 대회', () => `남은 시간 ${Math.ceil(this.contest!.left)}초 · ${this.contest!.score}점`); }
  updateContest(dt: number) {
    if (!this.contest) return;
    this.contest.left -= dt;
    if (this.contest.left > 0) return;
    const c = this.contest; this.contest = null; if (this.st !== 'idle') this.stop(false);
    const rank = c.score >= 120 ? 1 : c.score >= 60 ? 2 : c.score >= 25 ? 3 : 0;
    const reward: [string, number][] = rank === 1 ? [['shell', 100], ['goldShell', 1]] : rank === 2 ? [['shell', 50]] : rank === 3 ? [['shell', 20]] : [];
    for (const [id, n] of reward) this.g.inv.add(id, n);
    if (rank === 1 && this.rodLevel < 2) { this.rodLevel = 2; }
    this.bestContest = Math.max(this.bestContest, c.score);
    this.g.minigames.result('낚시 대회', rank ? `${rank}등!` : '입상 실패', `${c.catches}마리 · ${c.score}점 (최고 ${this.bestContest}점)`, reward, rank > 0);
  }
  toJSON() { return { records: this.records, rod: this.rodLevel, best: this.bestContest }; }
  load(d: any) { this.records = d?.records ?? {}; this.rodLevel = d?.rod ?? 1; this.bestContest = d?.best ?? 0; }
}
