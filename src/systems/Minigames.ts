import * as THREE from 'three';
import type { Game } from '../core/Game';
import { ARCHERY, ARENA, RACE } from '../data/places';
import { at, colorize, cyl, merge } from '../world/Geo';
import { MAT, signpost } from '../world/Props';

type MG = 'archery' | 'race' | 'arena';
/** Archery range, ring race and monster challenge (+ HUD/result helpers shared with the fishing contest). */
export class Minigames {
  active: MG | null = null; private left = 0; private score = 0; private ringIdx = 0;
  records: Record<string, number> = {};
  private targets: { obj: THREE.Object3D; base: number; speed: number; phase: number; alive: boolean }[] = [];
  private rings: THREE.Mesh[] = [];
  private hudText: (() => string) | null = null;
  private spawned: any[] = [];
  constructor(private g: Game) {
    const W = g.world, H = (x: number, z: number) => W.hf.height(x, z);
    for (const s of [ARCHERY.sign, RACE.sign, ARENA.sign]) { const o = signpost(); o.position.set(s.x, H(s.x, s.z), s.z); g.scene.add(o); W.col.circle(s.x, s.z, 0.3, -5, 2); }
    // archery targets (rounded straw bosses on posts)
    for (let i = 0; i < 5; i++) {
      const x = ARCHERY.targets.x0 + (i / 4) * (ARCHERY.targets.x1 - ARCHERY.targets.x0), z = ARCHERY.targets.z;
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(colorize(at(cyl(0.08, 0.1, 1.4, 6), 0, 0.7, 0), 0x6e4426), MAT.vc));
      const rings = [0xffffff, 0xe8483a, 0xffffff, 0xe8483a, 0xf2c94c].map((c, k) => colorize(at(cyl(0.7 - k * 0.14, 0.7 - k * 0.14, 0.1 + k * 0.02, 20), 0, 1.6, 0, Math.PI / 2, 0, 0), c));
      grp.add(new THREE.Mesh(merge(rings), MAT.vc));
      grp.position.set(x, H(x, z), z); g.scene.add(grp);
      this.targets.push({ obj: grp, base: x, speed: 0.6 + i * 0.25, phase: i, alive: true });
    }
    // race rings (hidden until a race starts)
    for (const [x, z] of RACE.rings) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 10, 32), new THREE.MeshStandardMaterial({ color: 0xf2c94c, emissive: 0xf0a020, emissiveIntensity: 0.8, roughness: 0.4 }));
      m.position.set(x, H(x, z) + 1.7, z); m.visible = false; g.scene.add(m); this.rings.push(m);
    }
  }
  interact(p: THREE.Vector3): { label: string; act: () => void } | null {
    const near = (o: { x: number; z: number }) => Math.hypot(o.x - p.x, o.z - p.z) < 2;
    if (this.active) return null;
    if (near(ARCHERY.sign)) return { label: `활쏘기 도전 (최고 ${this.records.archery ?? 0}점)`, act: () => this.begin('archery') };
    if (near(RACE.sign)) return { label: `고리 달리기 (최고 ${this.records.race ? this.records.race.toFixed(1) + '초' : '-'})`, act: () => this.begin('race') };
    if (near(ARENA.sign)) return { label: `몬스터 퇴치 도전 (최고 ${this.records.arena ?? 0}마리)`, act: () => this.begin('arena') };
    return null;
  }
  private begin(m: MG) {
    const g = this.g;
    const rules: Record<MG, string> = {
      archery: '45초 안에 움직이는 표적을 바람 활로 맞혀요. 가운데 노란 원일수록 점수가 높아요. (도구: 활)',
      race: '노란 고리 8개를 순서대로 60초 안에 통과해요. 달리기(Shift / 스틱 끝까지)를 활용해요.',
      arena: '60초 동안 나타나는 도토리딱정이를 최대한 많이 물리쳐요.',
    };
    if (m === 'archery' && !g.inv.has('bow')) { g.say([{ who: '표지판', text: '활쏘기 연습장 · 바람 활이 있어야 도전할 수 있습니다.' }]); return; }
    if (m === 'arena' && !g.inv.has('sword')) { g.say([{ who: '표지판', text: '몬스터 퇴치 도전 · 무기가 필요합니다.' }]); return; }
    g.say([{ who: '규칙', text: rules[m], choices: [{ label: '시작!', value: 'go' }, { label: '그만두기', value: 'no' }] }], (v) => { if (v === 'go') this.start(m); });
  }
  private start(m: MG) {
    const g = this.g; this.active = m; this.score = 0;
    if (m === 'archery') {
      this.left = 45; g.inv.add('arrow', 20); g.inv.wear('bow');
      const P = g.player; P.place(ARCHERY.stand.x, ARCHERY.stand.z, 0); g.rig.targetYaw = Math.PI; g.rig.snap(P.pos);
      for (const t of this.targets) { t.alive = true; t.obj.visible = true; }
      g.tools.targets = this.targets.map((t) => ({ pos: new THREE.Vector3(), r: 0.75, hit: () => { if (!t.alive || this.active !== 'archery') return; t.alive = false; t.obj.visible = false; this.score += 10; g.audio.play('smallGet'); g.particles.sparkle(t.obj.position.clone().setY(t.obj.position.y + 1.6)); setTimeout(() => { t.alive = true; t.obj.visible = true; }, 1600); } }));
      this.hud('활쏘기', () => `남은 시간 ${Math.ceil(this.left)}초 · ${this.score}점`);
    } else if (m === 'race') {
      this.left = 60; this.ringIdx = 0; this.rings.forEach((r, i) => (r.visible = true, ((r.material as THREE.MeshStandardMaterial).color.set(i === 0 ? 0x6af06a : 0xf2c94c))));
      this.hud('고리 달리기', () => `남은 시간 ${this.left.toFixed(1)}초 · 고리 ${this.ringIdx}/${this.rings.length}`);
    } else {
      this.left = 60;
      for (let i = 0; i < 6; i++) this.spawned.push(g.spawnEnemy('acorn', ARENA.center.x + Math.cos(i) * 5, ARENA.center.z + Math.sin(i) * 5));
      this.hud('몬스터 퇴치', () => `남은 시간 ${Math.ceil(this.left)}초 · ${this.score}마리`);
    }
    g.audio.play('solve');
  }
  hud(title: string, text: () => string) { this.hudText = text; this.g.ui.minigameHud(title, text()); }
  onKill(type: string) { if (this.active === 'arena' && type === 'acorn') { this.score++; const a = 1.3 * this.score; this.spawned.push(this.g.spawnEnemy('acorn', ARENA.center.x + Math.cos(a) * 6, ARENA.center.z + Math.sin(a) * 6)); } }
  update(dt: number) {
    const g = this.g;
    // moving archery targets
    const t0 = g.time;
    this.targets.forEach((t, i) => { const x = t.base + Math.sin(t0 * t.speed + t.phase) * 1.8; t.obj.position.x = x; if (g.tools.targets[i]) g.tools.targets[i].pos.set(x, t.obj.position.y + 1.6, t.obj.position.z); });
    if (this.hudText) g.ui.minigameHud(null, this.hudText());
    if (!this.active) return;
    this.left -= dt;
    if (this.active === 'race') {
      const r = this.rings[this.ringIdx];
      r.rotation.y += dt * 2;
      if (r && r.position.distanceTo(g.player.pos.clone().setY(g.player.pos.y + 1)) < 2.2) {
        r.visible = false; this.ringIdx++; g.audio.play('smallGet'); g.particles.sparkle(r.position.clone(), 0xf2c94c);
        if (this.rings[this.ringIdx]) (this.rings[this.ringIdx].material as THREE.MeshStandardMaterial).color.set(0x6af06a);
        if (this.ringIdx >= this.rings.length) return this.finish(true);
      }
    }
    if (this.left <= 0) this.finish(false);
  }
  private finish(raceDone: boolean) {
    const g = this.g, m = this.active!; this.active = null;
    let title = '', detail = '', ok = false; let reward: [string, number][] = [];
    if (m === 'archery') {
      ok = this.score >= 50; const best = Math.max(this.records.archery ?? 0, this.score); const nb = this.score > (this.records.archery ?? 0); this.records.archery = best;
      reward = this.score >= 100 ? [['shell', 40], ['arrow', 10]] : ok ? [['shell', 15]] : [];
      title = ok ? '명사수!' : '조금 더 연습해요'; detail = `${this.score}점 (최고 ${best}점)${nb ? ' · 신기록!' : ''}`;
      g.tools.targets = [];
    } else if (m === 'race') {
      this.rings.forEach((r) => (r.visible = false));
      const time = 60 - Math.max(0, this.left);
      ok = raceDone;
      if (ok) { const nb = !this.records.race || time < this.records.race; if (nb) this.records.race = time; reward = time < 40 ? [['shell', 40]] : [['shell', 15]]; detail = `${time.toFixed(1)}초 (최고 ${this.records.race!.toFixed(1)}초)${nb ? ' · 신기록!' : ''}`; title = '완주!'; }
      else { title = '시간 초과'; detail = `고리 ${this.ringIdx}/${this.rings.length}`; }
    } else {
      for (const e of this.spawned) if (!e.dead) e.dispose(), (g.enemies = g.enemies.filter((x: any) => x !== e));
      this.spawned = [];
      ok = this.score >= 6; const nb = this.score > (this.records.arena ?? 0); this.records.arena = Math.max(this.records.arena ?? 0, this.score);
      reward = this.score >= 10 ? [['shell', 50], ['bomb', 3]] : ok ? [['shell', 20]] : [];
      title = ok ? '퇴치 성공!' : '아쉬워요'; detail = `${this.score}마리 (최고 ${this.records.arena}마리)${nb ? ' · 신기록!' : ''}`;
    }
    for (const [id, n] of reward) g.inv.add(id, n);
    this.result(m === 'archery' ? '활쏘기' : m === 'race' ? '고리 달리기' : '몬스터 퇴치', title, detail, reward, ok);
  }
  result(name: string, title: string, detail: string, reward: [string, number][], ok: boolean) {
    this.hudText = null; this.g.ui.minigameHud(null, null);
    this.g.audio.play(ok ? 'solve' : 'uiBack');
    this.g.ui.result(name, title, detail, reward.map(([id, n]) => `${this.g.itemName(id)} ×${n}`));
    this.g.save();
  }
  toJSON() { return { records: this.records }; }
  load(d: any) { this.records = d?.records ?? {}; }
}
