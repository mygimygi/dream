import * as THREE from 'three';
import type { Game } from '../core/Game';
import { CRACKED, DIG_SPOTS, FORAGE, HEAVY_ROCKS, LEGEND_CHEST, PILLAR_HILL, POTS_COOK, TOY_BOAT, GULL_ROCK } from '../data/places';
import { at, blob, colorize, cyl, gradient, lathe, merge, rbox, sphere } from '../world/Geo';
import { MAT, chest as chestModel, pillar, statue } from '../world/Props';
import { roundTree } from '../world/PlantModels';
import { STATUES } from '../world/Layout';
import { ITEMS } from '../item/Items';

function mesh(g: THREE.BufferGeometry, m: THREE.Material = MAT.vc) { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; }
export function crackedBoulder(size: number): THREE.Group {
  const g = new THREE.Group();
  const b = gradient(at(blob(size, size * 7, 0.18, 2), 0, size * 0.55, 0, 0, 0, 0, [1.1, 0.8, 0.9]), 0x8a8478, 0xc8c0b0, 0, size * 1.4);
  g.add(mesh(b, MAT.vcDetail));
  // dark crack lines across the face
  const cracks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) cracks.push(at(rbox(0.07, size * (0.5 + i * 0.1), 0.06, 0.02), (i - 2) * size * 0.18, size * 0.6, size * 0.86, 0, 0, (i % 2 ? 0.5 : -0.4)));
  g.add(mesh(colorize(merge(cracks), 0x3a3430)));
  return g;
}
export function heavyRock(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(gradient(at(blob(1.15, 31, 0.15, 2), 0, 1.0, 0, 0, 0, 0, [1, 0.9, 1]), 0x5a5a62, 0x9a9aa4, 0, 2), MAT.vcDetail));
  // grip notches so players can read "this can be lifted"
  for (const s of [-1, 1]) g.add(mesh(colorize(at(rbox(0.5, 0.18, 0.2, 0.08), s * 0.95, 1.05, 0, 0, Math.PI / 2, 0), 0xd8a24a)));
  return g;
}
function cookPot(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; g.add(mesh(gradient(at(blob(0.28, i, 0.2, 1), Math.cos(a) * 0.75, 0.15, Math.sin(a) * 0.75, 0, 0, 0, [1.2, 0.7, 1]), 0x7a7468, 0xb8b0a0, 0, 0.3), MAT.vcDetail)); }
  for (let i = 0; i < 4; i++) g.add(mesh(colorize(at(cyl(0.07, 0.08, 0.9, 6), 0, 0.12, 0, 0, i * 0.8, Math.PI / 2), 0x6e4426)));
  const pot = lathe([[0, 0], [0.45, 0.02], [0.58, 0.25], [0.6, 0.5], [0.52, 0.65], [0.56, 0.7], [0.46, 0.7], [0, 0.66]], 18);
  g.add(mesh(at(colorize(pot, 0x3a3a42), 0, 0.25, 0), MAT.metal));
  g.add(mesh(at(colorize(new THREE.CircleGeometry(0.5, 18), 0xd88a3a), 0, 0.93, 0, -Math.PI / 2, 0, 0)));
  for (const s of [-1, 1]) g.add(mesh(colorize(at(new THREE.TorusGeometry(0.14, 0.03, 6, 12), s * 0.6, 0.8, 0, 0, Math.PI / 2, 0), 0x3a3a42), MAT.metal));
  return g;
}
function forageModel(item: string): THREE.Object3D {
  const g = new THREE.Group();
  if (item === 'mushroom') for (let i = 0; i < 3; i++) {
    const s = 0.8 + i * 0.25;
    g.add(mesh(colorize(at(cyl(0.07 * s, 0.09 * s, 0.25 * s, 8), (i - 1) * 0.22, 0.12 * s, (i % 2) * 0.15), 0xf3e6c8)));
    g.add(mesh(gradient(at(sphere(0.2 * s, 12, 8, ), (i - 1) * 0.22, 0.27 * s, (i % 2) * 0.15, 0, 0, 0, [1, 0.55, 1]), 0xb87a3a, 0xe0a860, 0.2, 0.4)));
  }
  else if (item === 'herb') {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(mesh(gradient(at(blob(0.12, i, 0.3, 1), Math.cos(a) * 0.15, 0.25, Math.sin(a) * 0.15, 0, 0, 0, [0.6, 1.6, 0.6]), 0x6ab0a0, 0xd8f6f0, 0.1, 0.45))); }
    g.add(mesh(colorize(at(sphere(0.09, 8, 6), 0, 0.45, 0), 0xffffff)));
  } else if (item === 'vegetable') {
    for (let i = 0; i < 3; i++) g.add(mesh(gradient(at(blob(0.18, i + 4, 0.25, 1), (i - 1) * 0.35, 0.55, 0.9, 0, 0, 0, [1, 0.8, 1]), 0x4f9a35, 0x9ad850, 0.4, 0.7)));
  }
  return g;
}

interface Node { id: string; obj: THREE.Object3D; x: number; z: number; alive: boolean; }
/** All overworld exploration objects and their tool interactions. */
export class Exploration {
  dug = new Set<string>();
  cracked = new Set<string>();
  lifted = new Set<string>();
  picked: Record<string, number> = {};     // forage id -> day picked
  owls = new Set<number>();                // activated fast-travel statues
  boatFound = false;
  private crackObjs = new Map<string, { obj: THREE.Object3D; col: any }>();
  private heavyObjs = new Map<string, { obj: THREE.Object3D; col: any }>();
  private forage: Node[] = [];
  private sparkle: THREE.Points;
  private mounds: THREE.Mesh[] = [];
  legend: (THREE.Group & { lid: THREE.Object3D }) | null = null; legendOpen = false; private legendCol: any;
  private boat: THREE.Object3D;
  constructor(private g: Game) {
    const W = g.world, H = (x: number, z: number) => W.hf.height(x, z), scene = g.scene;
    for (const c of CRACKED) {
      const o = crackedBoulder(c.size); o.position.set(c.x, H(c.x, c.z) - 0.2, c.z); o.rotation.y = c.x; scene.add(o);
      this.crackObjs.set(c.id, { obj: o, col: W.col.circle(c.x, c.z, c.size * 1.05, -5, 6) });
    }
    for (const h of HEAVY_ROCKS) { const o = heavyRock(); o.position.set(h.x, H(h.x, h.z) - 0.1, h.z); scene.add(o); this.heavyObjs.set(h.id, { obj: o, col: W.col.circle(h.x, h.z, 1.15, -5, 4) }); }
    { const L = LEGEND_CHEST; const c = chestModel(true); c.position.set(L.x, H(L.x, L.z), L.z); c.rotation.y = Math.PI; scene.add(c); this.legend = c;
      c.traverse((m: any) => { if (m.isMesh && m.material === MAT.metal) m.material = new THREE.MeshStandardMaterial({ color: 0xf6d870, metalness: 0.8, roughness: 0.25, emissive: 0x6a4a10, emissiveIntensity: 0.4 }); });
      this.legendCol = W.col.box(L.x, L.z, 0.95, 0.65, 0, -5, 1.4); }
    for (const f of FORAGE) {
      if (f.item === 'apple') { const t = roundTree(200 + f.x, [0x2f6b2b, 0x5aa83a, 0x8fd04c], 0xe8483a); const grp = new THREE.Group(); grp.add(mesh(t.trunk, MAT.vc), mesh(t.leaves, MAT.vcOcc)); grp.position.set(f.x, H(f.x, f.z) - 0.15, f.z); grp.scale.setScalar(0.9); scene.add(grp); W.col.circle(f.x, f.z, 0.6, -5, 5); this.forage.push({ id: f.id, obj: grp, x: f.x, z: f.z, alive: true }); continue; }
      const o = forageModel(f.item); o.position.set(f.x, H(f.x, f.z), f.z); scene.add(o);
      this.forage.push({ id: f.id, obj: o, x: f.x, z: f.z, alive: true });
    }
    for (const p of POTS_COOK) { const o = cookPot(); o.position.set(p.x, H(p.x, p.z), p.z); scene.add(o); W.col.circle(p.x, p.z, 0.9, -5, 1.5); }
    // pillar hill & gull rock landmarks for the treasure maps
    for (const [x, z] of PILLAR_HILL) { const p = pillar(3, true, 900 + x); p.position.set(x, H(x, z) - 0.2, z); scene.add(p); W.col.circle(x, z, 0.75, -5, 5); }
    { const r = new THREE.Group(); r.add(mesh(gradient(at(blob(1.8, 12, 0.2, 2), 0, 1.4, 0, 0, 0, 0, [1, 1.1, 0.9]), 0x9a9084, 0xe0d8c8, 0, 3), MAT.vcDetail));
      const gull = merge([colorize(at(sphere(0.3, 10, 8), 0, 0, 0, 0, 0, 0, [0.8, 0.7, 1.4]), 0xffffff), colorize(at(sphere(0.18, 10, 8), 0, 0.2, 0.3), 0xffffff), colorize(at(new THREE.ConeGeometry(0.06, 0.2, 6), 0, 0.18, 0.5, Math.PI / 2, 0, 0), 0xf2a541)]);
      const gm = mesh(gull); gm.position.set(0, 3.2, 0); r.add(gm); r.position.set(GULL_ROCK.x, H(GULL_ROCK.x, GULL_ROCK.z) - 0.3, GULL_ROCK.z); scene.add(r); W.col.circle(GULL_ROCK.x, GULL_ROCK.z, 1.8, -5, 4); }
    // the kid's toy boat, half hidden behind a bush
    { const b = new THREE.Group(); b.add(mesh(colorize(at(lathe([[0, 0], [0.25, 0.02], [0.32, 0.15], [0, 0.15]], 10), 0, 0, 0, 0, 0, 0, [1, 1, 2.2]), 0xe0705a)), mesh(colorize(at(cyl(0.02, 0.02, 0.6, 5), 0, 0.4, 0), 0x6e4426)), mesh(colorize(at(new THREE.ConeGeometry(0.2, 0.4, 3), 0.05, 0.45, 0, 0, 0, -Math.PI / 2, [0.2, 1, 1]), 0xffffff)));
      b.position.set(TOY_BOAT.x, H(TOY_BOAT.x, TOY_BOAT.z) + 0.05, TOY_BOAT.z); b.rotation.y = 0.6; scene.add(b); this.boat = b; }
    // shared sparkle points for diggable soil (visible only with a shovel)
    const sp = new Float32Array(DIG_SPOTS.length * 3);
    DIG_SPOTS.forEach((d, i) => sp.set([d.x, H(d.x, d.z) + 0.25, d.z], i * 3));
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.sparkle = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff2a0, size: 0.45, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(this.sparkle);
  }
  /** interaction candidates near the player (prompt label + action) */
  interact(p: THREE.Vector3): { label: string; act: () => void } | null {
    const g = this.g, near = (x: number, z: number, r: number) => Math.hypot(x - p.x, z - p.z) < r;
    for (const f of this.forage) if (f.alive && near(f.x, f.z, f.id.startsWith('apple') ? 2.2 : 1.6)) {
      const def = FORAGE.find((d) => d.id === f.id)!;
      return { label: def.item === 'apple' ? '나무 흔들기' : `${ITEMS[def.item].name} 따기`, act: () => this.pick(f, def.item) };
    }
    if (!this.boatFound && near(TOY_BOAT.x, TOY_BOAT.z, 1.8)) return { label: '장난감 배 줍기', act: () => { this.boatFound = true; this.boat.visible = false; g.giveItem('toyBoat'); } };
    for (const pt of POTS_COOK) if (near(pt.x, pt.z, 2.2)) return { label: '요리하기', act: () => g.cooking.open() };
    for (const [i, s] of STATUES.entries()) if (near(s[0], s[1], 2.2)) return { label: this.owls.has(i) ? '부엉이 석상 (빠른 이동)' : '부엉이 석상 깨우기', act: () => this.owl(i) };
    for (const h of HEAVY_ROCKS) if (!this.lifted.has(h.id) && near(h.x, h.z, 2.4)) return { label: g.inv.has('gloves') ? '바위 들어 치우기' : '무거운 바위', act: () => this.lift(h.id) };
    if (this.legend && !this.legendOpen && near(LEGEND_CHEST.x, LEGEND_CHEST.z, 2.4)) return { label: '전설의 상자 열기', act: () => this.openLegend() };
    for (const c of CRACKED) if (!this.cracked.has(c.id) && near(c.x, c.z, c.size + 1.6)) return { label: '금 간 바위', act: () => g.say([{ who: '', text: '바위에 커다란 금이 가 있다. 폭탄이면 부술 수 있을 것 같다.' }]) };
    const grove = CRACKED[0];
    if (this.cracked.has(grove.id) && near(grove.x, grove.z, 3.6)) return { label: '숲의 틈새로 들어가기', act: () => g.enterGrove() };
    return null;
  }
  private pick(f: Node, item: string) {
    const g = this.g;
    if (item === 'apple') { g.particles.leaves(new THREE.Vector3(f.x, g.groundAt(f.x, f.z) + 3, f.z), 10); g.audio.play('cut'); f.obj.rotation.z = 0.05; setTimeout(() => (f.obj.rotation.z = 0), 200); }
    else { f.obj.visible = false; g.audio.play('smallGet'); }
    f.alive = false; this.picked[f.id] = g.time_.day;
    const n = item === 'vegetable' ? 2 : 1;
    g.inv.add(item, n); g.codex.seeItem(item); g.ui.toast(`${ITEMS[item].name} ×${n}`);
  }
  newDay(day: number) { for (const f of this.forage) if (!f.alive && (this.picked[f.id] ?? 0) < day) { f.alive = true; f.obj.visible = true; } }
  private owl(i: number) {
    const g = this.g;
    if (!this.owls.has(i)) { this.owls.add(i); g.audio.play('solve'); g.particles.sparkle(new THREE.Vector3(STATUES[i][0], g.groundAt(STATUES[i][0], STATUES[i][1]) + 2.2, STATUES[i][1]), 0xbfe0ff, 20); g.ui.toast('부엉이 석상이 깨어났다! 지도에서 이곳으로 빠르게 이동할 수 있다'); g.save(); return; }
    g.openMap();
  }
  private lift(id: string) {
    const g = this.g;
    if (!g.inv.has('gloves')) { g.say([{ who: g.playerName, text: '꿈쩍도 안 해. 힘을 키워 주는 무언가가 필요해.' }]); return; }
    const h = this.heavyObjs.get(id)!; this.lifted.add(id); h.col.active = false;
    g.audio.play('push'); g.particles.dust(h.obj.position.clone(), 14);
    const o = h.obj, start = o.position.clone(); let t = 0;
    const tick = () => { t += 0.04; o.position.set(start.x + t * 3, start.y + Math.sin(Math.min(1, t) * Math.PI) * 2.5, start.z); o.rotation.z = -t * 2; if (t < 1) requestAnimationFrame(tick); else { o.visible = false; g.particles.poof(o.position.clone()); } };
    tick(); g.save();
  }
  private openLegend() {
    const g = this.g; if (!this.legend) return;
    this.legendOpen = true; this.legendCol.active = true; g.audio.play('chest');
    let t = 0; const lid = this.legend.lid; const tick = () => { t = Math.min(1, t + 0.04); lid.rotation.x = -1.9 * (1 - Math.pow(1 - t, 3)); if (t < 1) requestAnimationFrame(tick); }; tick();
    g.particles.sparkle(this.legend.position.clone().setY(this.legend.position.y + 1.4), 0xffe080, 40);
    setTimeout(() => { const [first, ...rest] = LEGEND_CHEST.loot; for (const [id, n] of rest) g.inv.add(id, n); g.giveItem(first[0], first[1]); g.save(); }, 650);
  }
  /** shovel: dig at the player's feet */
  dig(p: THREE.Vector3) {
    const g = this.g;
    g.audio.play('dig'); g.particles.emit({ pos: p.clone().setY(p.y + 0.2), count: 12, spread: 2, up: 1.6, life: 0.6, size: 0.22, color: 0x8a6038, grav: 8 });
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, g.groundAt(p.x, p.z) + 0.03, p.z); g.scene.add(m); this.mounds.push(m);
    if (this.mounds.length > 12) this.mounds.shift()!.removeFromParent();
    const spot = DIG_SPOTS.find((d) => !this.dug.has(d.id) && Math.hypot(d.x - p.x, d.z - p.z) < 1.5);
    if (!spot) { if (Math.random() < 0.15) { g.inv.add('shell', 1); g.ui.toast('반짝 조개 ×1'); } else g.ui.toast('아무것도 없다'); return; }
    if (spot.night && !g.time_.isNight) { g.ui.toast('흙이 단단하다… 달이 뜬 뒤에 다시 파 보자'); return; }
    this.dug.add(spot.id);
    if (spot.place) g.codex.see('places', spot.place);
    if (spot.event === 'kingCrab') { g.startKingCrab(new THREE.Vector3(spot.x, 0, spot.z)); g.save(); return; }
    const [first, ...rest] = spot.loot;
    for (const [id, n] of rest) { g.inv.add(id, n); g.codex.seeItem(id); }
    g.audio.play('chest');
    g.giveItem(first[0], first[1]);
    g.save();
  }
  /** bomb exploded at p */
  blast(p: THREE.Vector3, r: number) {
    const g = this.g;
    for (const c of CRACKED) if (!this.cracked.has(c.id) && Math.hypot(c.x - p.x, c.z - p.z) < r + c.size) {
      this.cracked.add(c.id); const o = this.crackObjs.get(c.id)!; o.col.active = false; o.obj.visible = false;
      g.particles.poof(new THREE.Vector3(c.x, g.groundAt(c.x, c.z) + 1, c.z), 0xc8c0b0); g.audio.play('thud');
      for (let i = 0; i < 8; i++) g.particles.emit({ pos: new THREE.Vector3(c.x, g.groundAt(c.x, c.z) + 1, c.z), count: 2, spread: 5, up: 2, life: 0.9, size: 0.35, color: 0x9a9084, grav: 12 });
      if (c.opens === 'grove') { g.ui.toast('바위벽이 무너지고 숲 속 틈새가 드러났다!'); g.audio.play('solve'); }
      for (const [id, n] of c.loot ?? []) { g.dropPickup(id, new THREE.Vector3(c.x, g.groundAt(c.x, c.z) + 0.8, c.z), n); }
      g.save();
    }
  }
  update(dt: number) {
    const has = this.g.inv.has('shovel');
    this.sparkle.visible = has && this.g.area === 'island';
    if (has) {
      const night = this.g.time_.isNight;
      // hide sparkles for dug spots and for map spots whose map you don't have yet
      const pos = this.sparkle.geometry.attributes.position as THREE.BufferAttribute;
      DIG_SPOTS.forEach((d, i) => { const show = !this.dug.has(d.id) && (!d.requiresItem || this.g.inv.has(d.requiresItem)) && (!d.night || night) && d.id !== 'd_map2'; pos.setY(i, show ? this.g.world.hf.height(d.x, d.z) + 0.25 + Math.sin(this.g.time + i) * 0.08 : -100); });
      pos.needsUpdate = true;
      (this.sparkle.material as THREE.PointsMaterial).opacity = 0.45 + Math.sin(this.g.time * 4) * 0.25;
    }
  }
  toJSON() { return { dug: [...this.dug], cracked: [...this.cracked], lifted: [...this.lifted], picked: this.picked, owls: [...this.owls], boat: this.boatFound, legend: this.legendOpen }; }
  load(d: any) {
    this.dug = new Set(d?.dug ?? []); this.cracked = new Set(d?.cracked ?? []); this.lifted = new Set(d?.lifted ?? []); this.picked = d?.picked ?? {}; this.owls = new Set(d?.owls ?? []);
    this.boatFound = !!d?.boat; this.boat.visible = !this.boatFound;
    for (const [id, o] of this.crackObjs) { const c = this.cracked.has(id); o.obj.visible = !c; o.col.active = !c; }
    for (const [id, o] of this.heavyObjs) { const c = this.lifted.has(id); o.obj.visible = !c; o.col.active = !c; }
    this.legendOpen = !!d?.legend; if (this.legend) this.legend.lid.rotation.x = this.legendOpen ? -1.9 : 0;
    for (const f of this.forage) { f.alive = true; f.obj.visible = true; }
  }
}
export { statue };
