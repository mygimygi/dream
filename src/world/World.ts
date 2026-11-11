import * as THREE from 'three';
import { Heightfield, PATHS, VILLAGE, WORLD_HALF } from './Heightfield';
import { buildTerrain } from './Terrain';
import { buildSky, buildWater } from './Water';
import { CollisionWorld } from './Collision';
import { Vegetation, Zone } from './Vegetation';
import { buildCliffDecor } from './CliffDecor';
import { ChunkedInstances } from './Instancing';
import * as P from './Props';
import * as L from './Layout';
import { QualityProfile } from '../core/Quality';
import { at, blob, gradient, merge } from './Geo';
import { toy } from '../render/Materials';
import { mulberry32 } from '../core/math';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Interactable { id: string; pos: THREE.Vector3; radius: number; prompt: () => string | null; act: () => void; }
export interface ChestEnt { def: L.ChestDef; obj: THREE.Group & { lid: THREE.Object3D }; opened: boolean; openT: number; collider: any; visible: boolean; }
export interface PotEnt { obj: THREE.Group; x: number; z: number; y: number; alive: boolean; collider: any; id: number; }

export class World {
  scene: THREE.Scene;
  hf: Heightfield;
  col = new CollisionWorld();
  veg!: Vegetation;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  interactables: Interactable[] = [];
  chests = new Map<string, ChestEnt>();
  pots: PotEnt[] = [];
  torches: (THREE.Group & { flame: THREE.Sprite; lit: boolean })[] = [];
  sunDir = new THREE.Vector3(-0.55, 0.78, 0.42).normalize();
  private clouds: THREE.Group;
  private critters: { obj: THREE.Object3D; kind: 'butterfly' | 'gull'; t: number; c: THREE.Vector3; r: number; s: number; wings: THREE.Object3D[] }[] = [];
  water: THREE.Mesh;
  signs: { x: number; z: number; text: string }[] = [];
  templeRoof!: THREE.Object3D; private roofK = 1;

  chimneys: THREE.Vector3[] = [];
  envTex: THREE.Texture | null = null; cliffs: ChunkedInstances[] = [];
  constructor(scene: THREE.Scene, q: QualityProfile, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.hf = new Heightfield();
    scene.background = new THREE.Color(0xd6f0ff);
    scene.fog = new THREE.Fog(0xd6f0ff, 95, 260);
    scene.add(buildSky());
    if (renderer) {
      // a soft studio environment gives every toy surface a gentle highlight, like a photographed miniature
      const pm = new THREE.PMREMGenerator(renderer);
      this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = this.envTex;
      (scene as any).environmentIntensity = 0.2;
      pm.dispose();
    }

    // lighting: warm low sun + sky/ground bounce
    this.hemi = new THREE.HemisphereLight(0xcfe9ff, 0x7a9a4a, 1.05);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d6, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.035; this.sun.shadow.radius = 4; this.sun.shadow.intensity = 0.82; // softer, never pitch-black shadows
    scene.add(this.sun); scene.add(this.sun.target);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.45); fill.position.set(40, 30, -60); scene.add(fill);

    const terrain = buildTerrain(this.hf);
    scene.add(terrain);
    this.water = buildWater(this.hf, this.sunDir);
    scene.add(this.water);

    const props = new THREE.Group(); props.name = 'props'; scene.add(props);
    const exclude: Zone[] = [];
    const ex = (x: number, z: number, r: number) => exclude.push({ x, z, r });
    const H = (x: number, z: number) => this.hf.height(x, z);
    const place = (o: THREE.Object3D, x: number, z: number, yaw = 0, dy = 0) => { o.position.set(x, H(x, z) + dy, z); o.rotation.y = yaw; props.add(o); return o; };

    // ---------- village ----------
    for (const h of L.HOUSES) {
      const yaw = Math.atan2(L.WELL.x - h.x, L.WELL.z - h.z);
      const g = h.kind === 'plank' ? P.plankHouse(h.seed, h.roof) : P.cottage(h.seed, h.roof);
      place(g, h.x, h.z, yaw, -0.05);
      if (g.userData.chimney) { const c = (g.userData.chimney as THREE.Vector3).clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); this.chimneys.push(c.add(g.position)); }
      if (h.kind === 'plank') this.col.box(h.x, h.z, 2.7, 2.2, -yaw, -10, 8);
      else this.col.circle(h.x, h.z, 3.0, -10, 8, 'house');
      ex(h.x, h.z, 5.2);
      // path stones to door
      const dx = Math.sin(yaw), dz = Math.cos(yaw);
      for (let i = 0; i < 4; i++) {
        const sx = h.x + dx * (3.6 + i * 1.1), sz = h.z + dz * (3.6 + i * 1.1);
        const st = new THREE.Mesh(gradient(at(blob(0.42, i + h.seed, 0.15, 1), 0, 0, 0, 0, 0, 0, [1, 0.25, 0.85]), 0xb0a48c, 0xe0d6c0, -0.1, 0.1), P.MAT.vc);
        st.receiveShadow = true; place(st, sx, sz, i, 0.02);
      }
      // a lantern post beside each door
      place(P.lanternPost(), h.x + dx * 4 + dz * 1.5, h.z + dz * 4 - dx * 1.5, yaw + Math.PI / 2);
    }
    { const st = L.SMITH_STALL; place(P.smithStall(), st.x, st.z, Math.PI); this.col.box(st.x, st.z, 1.75, 0.55, 0, -5, 3); ex(st.x, st.z + 0.5, 3); }
    place(P.well(), L.WELL.x, L.WELL.z); this.col.circle(L.WELL.x, L.WELL.z, 1.5, -10, 5); ex(L.WELL.x, L.WELL.z, 3);
    // fences around the hero's garden and along the plaza
    const fences: [number, number, number, number][] = [[17, 9, 8, 0.9], [21, 14, 7, 1.57], [20, 20, 5, 0.2], [-24, 30, 7, 0.6], [-6, 42, 6, 0.1], [7, 41, 6, -0.1], [-19, 9, 6, -0.4]];
    fences.forEach(([x, z, len, yaw], i) => {
      place(P.fence(len, i + 3), x, z, yaw);
      this.col.box(x, z, len / 2, 0.2, -yaw, -10, 1.1);
      ex(x, z, len / 2 + 0.5);
    });
    // crates & barrels by the bakery/fisher
    [[-9, 35.5, 0.2], [-8, 36.5, 0.7], [17.5, 30, 0.1], [17.6, 31.2, 0.4]].forEach(([x, z, y]) => { place(P.crate(), x, z, y); this.col.box(x, z, 0.55, 0.55, -y, -5, 1); ex(x, z, 1.2); });
    // ---------- village life: garden, planters, benches, barrels ----------
    { const gp = P.gardenPlot(4.2, 3.2, 5); place(gp, 21, 11, -0.4); this.col.box(21, 11, 2.3, 1.8, 0.4, -5, 0.5); ex(21, 11, 3.5); }
    { const gp = P.gardenPlot(3.4, 2.6, 8); place(gp, -26, 15, 0.5); this.col.box(-26, 15, 1.9, 1.5, -0.5, -5, 0.5); ex(-26, 15, 3); }
    for (const h of L.HOUSES) {
      const yaw = Math.atan2(L.WELL.x - h.x, L.WELL.z - h.z), dx = Math.sin(yaw), dz = Math.cos(yaw);
      for (const sd of [-1, 1]) { const px = h.x + dx * 3.3 + dz * sd * 1.9, pz = h.z + dz * 3.3 - dx * sd * 1.9; place(P.planter(h.seed + sd), px, pz, yaw); this.col.box(px, pz, 0.6, 0.25, -yaw, -5, 0.7); }
    }
    for (const [x, z, yaw] of [[3.2, 24.8, -1.2], [-3.4, 19.2, 2.0]]) { place(P.bench(), x, z, yaw); this.col.box(x, z, 0.9, 0.3, -yaw, -5, 1); ex(x, z, 1.3); }
    L.HOUSES.forEach((h, i) => {
      const yaw = Math.atan2(L.WELL.x - h.x, L.WELL.z - h.z), dx = Math.sin(yaw), dz = Math.cos(yaw);
      const mx = h.x + dx * 5.4 - dz * 2.6, mz = h.z + dz * 5.4 + dx * 2.6;
      place(P.mailbox([0xd0503a, 0x3a8ac8, 0x5aa83a, 0xe8a23a, 0x8a5ab8][i % 5]), mx, mz, yaw); this.col.circle(mx, mz, 0.25, -5, 1.5);
    });
    { place(P.woodpile(), 8.5, 9.5, 0.9); this.col.box(8.5, 9.5, 0.7, 0.6, -0.9, -5, 1); ex(8.5, 9.5, 1.5); }
    for (const [x, z, c] of [[-10.6, 36.2, 0xe8483a], [-9.4, 36.6, 0xf2c94c], [16.8, 29.2, 0x6ab84a]]) { place(P.basket(c), x, z, x); this.col.circle(x, z, 0.35, -5, 0.6); ex(x, z, 0.8); }
    for (const [x, z] of [[-17.2, 30.2], [-16.4, 30.9], [9, 37.5], [-7.8, 39.5]]) { place(P.barrel(), x, z, x); this.col.circle(x, z, 0.45, -5, 1); ex(x, z, 1); }
    // ---------- signs ----------
    for (const s of L.SIGNS) {
      const yaw = Math.atan2(-s.x * 0.0, 1) + 0;
      place(P.signpost(), s.x, s.z, yaw); this.col.circle(s.x, s.z, 0.3, -5, 2);
      ex(s.x, s.z, 1.5);
      const pos = new THREE.Vector3(s.x, H(s.x, s.z) + 1, s.z + 0.6);
      this.signs.push(s);
      this.interactables.push({ id: 'sign' + s.x, pos, radius: 1.8, prompt: () => '읽기', act: () => this.onSign?.(s.text) });
    }
    // ---------- pots ----------
    L.POTS.forEach(([x, z], i) => {
      const o = place(P.pot(i), x, z, i) as THREE.Group;
      const y = H(x, z);
      const c = this.col.circle(x, z, 0.45, y - 1, y + 0.9, 'pot');
      const pe: PotEnt = { obj: o, x, z, y, alive: true, collider: c, id: i };
      c.data = pe; this.pots.push(pe); ex(x, z, 1);
    });
    // ---------- statues ----------
    for (const [x, z, yaw] of L.STATUES) { place(P.statue(), x, z, yaw); this.col.circle(x, z, 0.75, -5, 3); ex(x, z, 2); }
    // ---------- ruins ----------
    const rr = mulberry32(9);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 9 + rr() * 3;
      const x = 56 + Math.cos(a) * d, z = 48 + Math.sin(a) * d * 0.8;
      if (Math.hypot(x - 56, z - 56) < 4 || Math.hypot(x - 50, z - 47) < 3 || Math.hypot(x - 60, z - 47) < 3) continue;
      const h = 2 + rr() * 3;
      place(P.pillar(h, rr() < 0.7, 50 + i), x, z, 0, -0.2);
      this.col.circle(x, z, 0.75, -5, 6); ex(x, z, 2);
    }
    // ruined walls enclosing the treasure court behind the gate
    const wallDefs: [number, number, number, number, number][] = [[50.5, 58, 7, 2.6, Math.PI / 2], [61.5, 58, 7, 2.6, Math.PI / 2], [56, 62, 12, 2.6, 0], [51.8, 54.5, 3.8, 2.6, 0], [60.2, 54.5, 3.8, 2.6, 0]];
    wallDefs.forEach(([x, z, len, h, yaw], i) => {
      const m = new THREE.Mesh(P.stoneWall(len, h, 30 + i, i === 2), P.MAT.vcDetail); m.castShadow = true; m.receiveShadow = true;
      place(m, x, z, yaw, -0.25);
      this.col.box(x, z, len / 2, 0.5, -yaw, -5, 4);
      ex(x, z, len / 2 + 1);
    });
    ex(56, 58, 4); ex(50, 47, 4); ex(60, 47, 4); ex(55, 47, 3); ex(55, 50, 5);
    // ---------- lake bridge (walkable) ----------
    const B = L.BRIDGE, len = B.x1 - B.x0;
    const br = P.bridge(len); br.position.set((B.x0 + B.x1) / 2, B.y, B.z); props.add(br);
    this.col.box((B.x0 + B.x1) / 2, B.z, len / 2 + 0.6, 1.2, 0, B.y - 3, B.y, { solid: false, walkTop: true });
    for (const s of [-1, 1]) this.col.box((B.x0 + B.x1) / 2, B.z + s * 1.25, len / 2, 0.1, 0, B.y, B.y + 1.2);
    ex(B.x0 - 2, B.z, 3); ex(B.x1 + 2, B.z, 3);
    // ---------- temple on the summit ----------
    const tp = L.TEMPLE_POS;
    const tmp = P.temple(); place(tmp, tp.x, tp.z, 0, -0.1);
    this.templeRoof = tmp.getObjectByName('templeRoof')!;
    const ty = H(tp.x, tp.z);
    this.col.box(tp.x, tp.z, 7.5, 7.5, 0, ty - 5, ty + 1.15, { walkTop: true });
    // steps up onto the platform on the south side
    const stp = new THREE.Mesh(P.stairs(3, 3.4, 0.38, 0.6), P.MAT.vcDetail); stp.receiveShadow = true; stp.castShadow = true;
    stp.position.set(tp.x, ty - 0.05, tp.z + 9.3); props.add(stp);
    for (let i = 0; i < 3; i++) this.col.box(tp.x, tp.z + 9.3 - i * 0.6, 1.7, 0.3, 0, ty - 3, ty - 0.05 + 0.38 * (i + 1), { solid: false, walkTop: true });
    // temple columns block
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 10; if (Math.abs(Math.sin(a) - 1) < 0.05) continue; this.col.circle(tp.x + Math.cos(a) * 5.2, tp.z + Math.sin(a) * 5.2, 0.6, ty, ty + 8); }
    this.col.circle(tp.x, tp.z, 0.9, ty, ty + 3);
    ex(tp.x, tp.z, 11);
    // ---------- cave mouth ----------
    const cv = P.caveMouth(); place(cv, L.CAVE.x, L.CAVE.z, L.CAVE.yaw, -0.3);
    for (const s of [-1, 1]) {
      const cx = L.CAVE.x + Math.cos(L.CAVE.yaw) * s * 3.4, cz = L.CAVE.z - Math.sin(L.CAVE.yaw) * s * 3.4;
      this.col.circle(cx, cz, 1.6, -5, 10);
    }
    this.col.box(L.CAVE.x - Math.sin(L.CAVE.yaw) * 2.2, L.CAVE.z - Math.cos(L.CAVE.yaw) * 2.2, 3.4, 1.4, -L.CAVE.yaw, -5, 10);
    ex(L.CAVE.x, L.CAVE.z, 6);
    // torches at the cave and temple
    for (const [x, z] of [[-27.5, -42], [-34, -44.5], [-2.2, -71.5], [2.2, -71.5]]) { const t = P.torch(true); place(t, x, z); this.torches.push(t); this.col.circle(x, z, 0.3, -5, 3); ex(x, z, 1); }
    // ---------- chest positions ----------
    for (const c of L.CHESTS) if (!c.dungeon) ex(c.x, c.z, 2.5);
    // keep paths and puzzle areas clear
    for (const n of L.NPCS) ex(n.x, n.z, 1.5);
    ex(L.START.x, L.START.z, 2);
    ex(VILLAGE.x, VILLAGE.z, 7);

    this.veg = new Vegetation(this.hf, this.col, props, q, exclude);
    this.cliffs = buildCliffDecor(this.hf, props, exclude, q.level === 'low');

    // ---------- clouds ----------
    this.clouds = new THREE.Group();
    const cloudMat = toy({ vertexColors: true, roughness: 1, emissive: 0x9fb8d8, emissiveIntensity: 0.25 }, { rim: 0.4, rimColor: 0xffffff });
    const cr = mulberry32(3);
    for (let i = 0; i < 14; i++) {
      const parts: THREE.BufferGeometry[] = [];
      const n = 4 + Math.floor(cr() * 4);
      for (let k = 0; k < n; k++) parts.push(at(blob(3 + cr() * 3, i * 10 + k, 0.12, 2), (k - n / 2) * 3.4 + cr() * 2, cr() * 2, cr() * 4 - 2));
      const g = merge(parts); gradient(g, 0xdde8f5, 0xffffff, -2, 5);
      const m = new THREE.Mesh(g, cloudMat);
      m.position.set((cr() * 2 - 1) * 200, 48 + cr() * 18, (cr() * 2 - 1) * 200);
      m.scale.set(1, 0.6, 1);
      this.clouds.add(m);
    }
    scene.add(this.clouds);

    // ---------- ambient critters ----------
    const wingMat = toy({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6 }, { rim: 0.2 });
    const bcols = [0xffd34d, 0xff8fb0, 0x8fc8ff, 0xffffff];
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group(); const wings: THREE.Object3D[] = [];
      const m = wingMat.clone(); m.color.set(bcols[i % 4]);
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CircleGeometry(0.13, 8), m); w.position.x = s * 0.12; w.rotation.x = -Math.PI / 2;
        const piv = new THREE.Group(); piv.add(w); g.add(piv); wings.push(piv);
      }
      const ang = cr() * Math.PI * 2, d = 10 + cr() * 80;
      const c = new THREE.Vector3(Math.cos(ang) * d, 0, Math.sin(ang) * d * 0.8);
      scene.add(g);
      this.critters.push({ obj: g, kind: 'butterfly', t: cr() * 100, c, r: 1.5 + cr() * 3, s: 0.6 + cr() * 0.6, wings });
    }
    const gullMat = toy({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }, { rim: 0.3 });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group(); const wings: THREE.Object3D[] = [];
      const body = new THREE.Mesh(at(new THREE.SphereGeometry(0.22, 10, 8), 0, 0, 0, 0, 0, 0, [0.7, 0.6, 1.6]), gullMat); g.add(body);
      for (const s of [-1, 1]) {
        const shape = new THREE.Shape(); shape.moveTo(0, -0.2); shape.lineTo(s * 1.0, 0.05); shape.lineTo(s * 0.9, 0.25); shape.lineTo(0, 0.2);
        const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), gullMat); w.rotation.x = -Math.PI / 2;
        const piv = new THREE.Group(); piv.add(w); g.add(piv); wings.push(piv);
      }
      scene.add(g);
      const c = new THREE.Vector3((cr() - 0.5) * 80, 0, 70 + cr() * 30);
      this.critters.push({ obj: g, kind: 'gull', t: cr() * 100, c, r: 8 + cr() * 10, s: 0.25 + cr() * 0.15, wings });
    }
  }

  onSign?: (text: string) => void;

  groundAt(x: number, z: number, maxY = Infinity): number {
    const t = this.hf.height(x, z);
    const top = this.col.topAt(x, z, maxY);
    return Math.max(t, top);
  }

  update(dt: number, time: number, focus: THREE.Vector3) {
    // shadow camera follows the player so shadows stay crisp
    const d = this.sunDir;
    const snap = 0.5;
    const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    this.sun.position.set(fx + d.x * 70, focus.y + d.y * 70, fz + d.z * 70);
    this.sun.target.position.set(fx, focus.y, fz);
    this.veg.updateLOD(focus);
    for (const c of this.cliffs) c.updateLOD(focus);
    // lift the temple roof away while the hero stands inside the colonnade
    const inside = Math.hypot(focus.x - L.TEMPLE_POS.x, focus.z - L.TEMPLE_POS.z) < 7;
    this.roofK += ((inside ? 0 : 1) - this.roofK) * (1 - Math.exp(-dt * 6));
    this.templeRoof.position.y = (1 - this.roofK) * 9;
    this.templeRoof.visible = this.roofK > 0.04;
    this.clouds.children.forEach((c, i) => { c.position.x += dt * (0.8 + (i % 3) * 0.3); if (c.position.x > 240) c.position.x = -240; });
    for (const t of this.torches) if (t.lit) { const f = 1 + Math.sin(time * 18 + t.position.x) * 0.06 + Math.sin(time * 7.3) * 0.05; t.flame.scale.set(0.8 * f, 1.05 / f, 1); }
    for (const c of this.critters) {
      c.t += dt * c.s;
      if (c.kind === 'butterfly') {
        const x = c.c.x + Math.cos(c.t) * c.r + Math.sin(c.t * 2.3) * 0.6, z = c.c.z + Math.sin(c.t * 0.8) * c.r;
        const y = this.hf.height(x, z) + 0.8 + Math.sin(c.t * 3.1) * 0.35;
        c.obj.position.set(x, Math.max(y, 0.8), z);
        c.obj.rotation.y = -c.t + Math.PI / 2;
        const f = Math.sin(time * 22 + c.t) * 0.9;
        c.wings[0].rotation.z = f; c.wings[1].rotation.z = -f;
      } else {
        const x = c.c.x + Math.cos(c.t) * c.r, z = c.c.z + Math.sin(c.t) * c.r;
        c.obj.position.set(x, 14 + Math.sin(c.t * 2) * 2, z);
        c.obj.rotation.y = -c.t;
        c.obj.rotation.z = 0.25;
        const f = Math.sin(time * 4 + c.t * 3) * 0.45;
        c.wings[0].rotation.z = f; c.wings[1].rotation.z = -f;
      }
    }
  }
}
