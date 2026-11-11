import * as THREE from 'three';
import { Heightfield, WORLD_HALF } from './Heightfield';
import { CollisionWorld, Collider } from './Collision';
import { ChunkedInstances, Inst, RemovableInstances, mat4 } from './Instancing';
import { bushModel, flowerModel, grassTuft, mushroomModel, palmTree, pineTree, rockModel, roundTree, TreeModel } from './PlantModels';
import { toy } from '../render/Materials';
import { fbm, mulberry32, noise2 } from '../core/math';
import { QualityProfile } from '../core/Quality';

export interface Zone { x: number; z: number; r: number; }
export interface CuttableBush { x: number; z: number; y: number; set: RemovableInstances; index: number; collider: Collider; alive: boolean; }

class Spacing {
  private g = new Map<number, { x: number; z: number; r: number }[]>();
  ok(x: number, z: number, r: number) {
    const i0 = Math.floor((x - 6) / 6), j0 = Math.floor((z - 6) / 6);
    for (let i = i0; i <= i0 + 2; i++) for (let j = j0; j <= j0 + 2; j++) {
      const l = this.g.get(i * 10000 + j); if (!l) continue;
      for (const o of l) if (Math.hypot(o.x - x, o.z - z) < Math.max(o.r, r)) return false;
    }
    return true;
  }
  add(x: number, z: number, r: number) { const k = Math.floor(x / 6) * 10000 + Math.floor(z / 6); if (!this.g.has(k)) this.g.set(k, []); this.g.get(k)!.push({ x, z, r }); }
}

export class Vegetation {
  lod: ChunkedInstances[] = [];
  bushes: CuttableBush[] = [];
  leafMat = toy({ vertexColors: true, roughness: 0.85 }, { wind: 0.35, occlude: true, rim: 0.22, rimColor: 0xf6ffd0, detail: 0.22 });
  trunkMat = toy({ vertexColors: true, roughness: 0.9 }, { occlude: true, rim: 0.1, detail: 0.3 });
  palmLeafMat = toy({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }, { wind: 0.4, occlude: true, rim: 0.2 });
  grassMat = toy({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }, { wind: 2.6, rim: 0.0, upNormal: true });
  plantMat = toy({ vertexColors: true, roughness: 0.75 }, { wind: 1.2, rim: 0.15 });
  rockMat = toy({ vertexColors: true, roughness: 0.82 }, { rim: 0.12, detail: 0.4 });
  bushMat = toy({ vertexColors: true, roughness: 0.85 }, { wind: 0.25, rim: 0.2, rimColor: 0xf6ffd0, detail: 0.2 });
  glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x3fd0ff, emissiveIntensity: 0.9, roughness: 0.5 });

  constructor(public hf: Heightfield, public col: CollisionWorld, public parent: THREE.Object3D, public q: QualityProfile, public exclude: Zone[]) {
    const sp = new Spacing();
    for (const z of exclude) sp.add(z.x, z.z, z.r);
    const rnd = mulberry32(2024);
    const excluded = (x: number, z: number, pad = 0) => exclude.some((e) => Math.hypot(e.x - x, e.z - z) < e.r + pad);
    const grassy = (x: number, z: number) => {
      const h = hf.height(x, z);
      return h > 1.0 && hf.pathAt(x, z) < 0.04 && hf.slope(x, z) < 0.42 && hf.landAt(x, z) > 0.985;
    };

    // ---------- trees ----------
    const roundVariants: TreeModel[] = [0, 1, 2, 3].map((i) => roundTree(11 + i * 17));
    const forestVariants: TreeModel[] = [0, 1, 2].map((i) => roundTree(101 + i * 13, [0x1f5a2a, 0x3f8f34, 0x6cb540]));
    const pineVariants = [0, 1, 2].map((i) => pineTree(51 + i * 7));
    const palmVariants = [0, 1].map((i) => palmTree(71 + i * 5));
    const tInst: Inst[][] = [[], [], [], [], [], [], [], [], [], [], [], []];
    const plan: { set: TreeModel[]; base: number }[] = [{ set: roundVariants, base: 0 }, { set: forestVariants, base: 4 }, { set: pineVariants, base: 7 }, { set: palmVariants, base: 10 }];
    const tryTree = (x: number, z: number, kind: number, spacing: number, sMin: number, sMax: number) => {
      if (excluded(x, z, 2) || !sp.ok(x, z, spacing)) return false;
      const set = plan[kind];
      const v = Math.floor(rnd() * set.set.length);
      const s = sMin + rnd() * (sMax - sMin);
      const y = hf.height(x, z) - 0.15;
      const tint = new THREE.Color().setHSL(0.27 + (rnd() - 0.5) * 0.05, 0.6, 0.5 + (rnd() - 0.5) * 0.1).multiplyScalar(2.0);
      tint.setRGB(Math.min(1.15, 0.85 + rnd() * 0.3), Math.min(1.15, 0.9 + rnd() * 0.2), Math.min(1.1, 0.85 + rnd() * 0.2));
      tInst[set.base + v].push({ m: mat4(x, y, z, rnd() * Math.PI * 2, s), c: tint });
      sp.add(x, z, spacing);
      col.circle(x, z, set.set[v].radius * s + 0.15, y - 1, y + 3.5, 'tree');
      return true;
    };
    for (let i = 0; i < 14000; i++) {
      const x = (rnd() * 2 - 1) * WORLD_HALF, z = (rnd() * 2 - 1) * WORLD_HALF;
      const h = hf.height(x, z);
      if (h < 0.3) continue;
      const region = hf.regionAt(x, z);
      const slope = hf.slope(x, z), path = hf.pathAt(x, z), land = hf.landAt(x, z);
      if (path > 0.02 || slope > 0.5) continue;
      const clump = fbm(x * 0.03, z * 0.03, 2);
      if (region === 'forest') { if (clump > -0.35) tryTree(x, z, rnd() < 0.8 ? 1 : 0, 3.6, 0.85, 1.35); }
      else if (region === 'mountain' || region === 'temple') { if (clump > 0.0 && rnd() < 0.5 && h > 3) tryTree(x, z, rnd() < 0.8 ? 2 : 0, 4.2, 0.8, 1.2); }
      else if (region === 'beach') { if (h > 0.45 && h < 2.2 && rnd() < 0.08) tryTree(x, z, 3, 6, 0.85, 1.15); }
      else if (region === 'meadow' || region === 'lake') { if (clump > 0.25 && rnd() < 0.35 && land > 0.98) tryTree(x, z, 0, 5, 0.8, 1.3); }
      else if (region === 'coast') { if (clump > 0.1 && rnd() < 0.2 && land > 0.98) tryTree(x, z, rnd() < 0.5 ? 0 : 2, 5, 0.8, 1.1); }
      else if (region === 'village') { const d = Math.hypot(x, z - 22); if (d > 18 && rnd() < 0.3) tryTree(x, z, 0, 6, 0.9, 1.25); }
      else if (region === 'ruins') { if (rnd() < 0.05) tryTree(x, z, 0, 6, 0.8, 1.1); }
    }
    plan.forEach((p) => p.set.forEach((tm, v) => {
      const items = tInst[p.base + v]; if (!items.length) return;
      const lm = p.base === 10 ? this.palmLeafMat : this.leafMat;
      this.lod.push(new ChunkedInstances(tm.trunk, this.trunkMat, items, parent, { cast: true, chunk: 40 }));
      this.lod.push(new ChunkedInstances(tm.leaves, lm, items, parent, { cast: true, chunk: 40 }));
    }));

    // ---------- rocks ----------
    const rockGeos = [0, 1, 2, 3].map((i) => rockModel(5 + i * 9, false));
    const mossGeos = [0, 1].map((i) => rockModel(80 + i * 9, true));
    const rInst: Inst[][] = [[], [], [], [], [], []];
    for (let i = 0; i < 9000; i++) {
      const x = (rnd() * 2 - 1) * WORLD_HALF, z = (rnd() * 2 - 1) * WORLD_HALF;
      const h = hf.height(x, z); if (h < -0.6) continue;
      const region = hf.regionAt(x, z);
      if (hf.pathAt(x, z) > 0.02 || excluded(x, z, 1)) continue;
      let p = 0.01;
      if (region === 'coast') p = 0.25; else if (region === 'mountain') p = 0.12; else if (region === 'beach') p = 0.04; else if (region === 'forest') p = 0.05; else if (region === 'ruins') p = 0.1;
      if (hf.slope(x, z) > 0.7) p *= 2.5;
      if (rnd() > p) continue;
      const s = 0.35 + Math.pow(rnd(), 2) * 1.6;
      if (!sp.ok(x, z, s * 1.6)) continue;
      sp.add(x, z, s * 1.6);
      const moss = region === 'forest' || (region === 'meadow' && rnd() < 0.3);
      const v = moss ? 4 + Math.floor(rnd() * 2) : Math.floor(rnd() * 4);
      const y = hf.height(x, z) + s * 0.08;
      rInst[v].push({ m: mat4(x, y, z, rnd() * 6.28, s, s * (0.7 + rnd() * 0.5)), c: new THREE.Color(1, 1, 1).multiplyScalar(0.9 + rnd() * 0.15) });
      if (s > 0.5) col.circle(x, z, s * 0.95, y - 1, y + s * 0.85, 'rock');
    }
    [...rockGeos, ...mossGeos].forEach((g, v) => { if (rInst[v].length) this.lod.push(new ChunkedInstances(g, this.rockMat, rInst[v], parent, { cast: true, chunk: 40 })); });

    // ---------- bushes (decor + cuttable) ----------
    const bushGeos = [bushModel(3), bushModel(9, [0x2a6f2a, 0x6db83c], 0xe0405a), bushModel(15, [0x2f7a3a, 0x8fd04c], 0xffffff)];
    const bInst: Inst[][] = [[], [], []];
    for (let i = 0; i < 9000; i++) {
      const x = (rnd() * 2 - 1) * WORLD_HALF, z = (rnd() * 2 - 1) * WORLD_HALF;
      if (!grassy(x, z) || excluded(x, z, 0.5)) continue;
      const region = hf.regionAt(x, z);
      const p = region === 'forest' ? 0.18 : region === 'village' ? 0.02 : 0.05;
      if (rnd() > p) continue;
      if (!sp.ok(x, z, 1.6)) continue;
      sp.add(x, z, 1.6);
      const v = Math.floor(rnd() * 3), s = 0.7 + rnd() * 0.7;
      bInst[v].push({ m: mat4(x, hf.height(x, z) - 0.1, z, rnd() * 6.28, s), c: new THREE.Color(1, 1, 1).multiplyScalar(0.9 + rnd() * 0.2) });
    }
    bushGeos.forEach((g, v) => { if (bInst[v].length) this.lod.push(new ChunkedInstances(g, this.bushMat, bInst[v], parent, { cast: true, chunk: 40 })); });

    // cuttable bushes: light leafy balls along paths and walls of hidden routes
    const cutPts: [number, number][] = [];
    // a hedge sealing the forest route to the shield chest
    for (let k = 0; k < 6; k++) cutPts.push([-72 - k * 0.2 + (k % 2) * 0.6, -6 - k * 1.3]);
    for (let k = 0; k < 3; k++) cutPts.push([-70.5 + k * 1.4, -8.5]);
    // scatter near paths
    for (let i = 0; i < 2500 && cutPts.length < 110; i++) {
      const x = (rnd() * 2 - 1) * WORLD_HALF, z = (rnd() * 2 - 1) * WORLD_HALF;
      const pa = hf.pathAt(x, z);
      if (pa > 0.001 || hf.slope(x, z) > 0.4 || hf.height(x, z) < 1 || excluded(x, z, 0.5)) continue;
      // within 4 units of a path
      let near = false;
      for (const a of [0, 1.57, 3.14, 4.71]) if (hf.pathAt(x + Math.cos(a) * 3.5, z + Math.sin(a) * 3.5) > 0.3) near = true;
      if (!near || !sp.ok(x, z, 1.4)) continue;
      sp.add(x, z, 1.4); cutPts.push([x, z]);
    }
    const cutGeo = bushModel(42, [0x3f8f2f, 0x9edb55]);
    const cutItems: Inst[] = cutPts.map(([x, z]) => ({ m: mat4(x, this.hf.height(x, z) - 0.05, z, rnd() * 6, 0.85), c: new THREE.Color(1, 1, 1) }));
    const set = new RemovableInstances(cutGeo, this.bushMat, cutItems, parent, true);
    cutPts.forEach(([x, z], i) => {
      const y = hf.height(x, z);
      const c = col.circle(x, z, 0.75, y - 1, y + 1.2, 'bush');
      const b: CuttableBush = { x, z, y, set, index: i, collider: c, alive: true };
      c.data = b;
      this.bushes.push(b);
    });

    // ---------- grass ----------
    const tufts = [grassTuft(1), grassTuft(2), grassTuft(3)];
    const gInst: Inst[][] = [[], [], []];
    let placed = 0;
    for (let i = 0; i < q.grassCount * 6 && placed < q.grassCount; i++) {
      const x = (rnd() * 2 - 1) * WORLD_HALF * 0.85, z = (rnd() * 2 - 1) * WORLD_HALF * 0.85;
      const n = fbm(x * 0.05 + 7, z * 0.05, 2);
      if (n < -0.15 && rnd() < 0.8) continue;
      const h = hf.height(x, z);
      if (h < 1.1 || hf.landAt(x, z) < 0.985 || hf.slope(x, z) > 0.55) continue;
      const pa = hf.pathAt(x, z); if (pa > 0.25) continue;
      if (excluded(x, z, -1.5)) continue;
      const region = hf.regionAt(x, z);
      const s = 0.7 + rnd() * 0.6 + (n > 0.3 ? 0.35 : 0);
      const c = region === 'forest' ? new THREE.Color(0.72, 0.86, 0.7) : region === 'mountain' ? new THREE.Color(0.95, 0.95, 0.85) : new THREE.Color(0.95 + rnd() * 0.12, 1.0, 0.85 + rnd() * 0.1);
      gInst[Math.floor(rnd() * 3)].push({ m: mat4(x, h - 0.04, z, rnd() * 6.28, s, s * (0.8 + rnd() * 0.5)), c });
      placed++;
    }
    tufts.forEach((g, v) => this.lod.push(new ChunkedInstances(g, this.grassMat, gInst[v], parent, { cast: false, chunk: 24, maxDist: q.level === 'low' ? 45 : 65 })));

    // ---------- flowers ----------
    const flowerGeos = [flowerModel(0xffffff, 0xffd64a, 1), flowerModel(0xffd84a, 0xf08a3a, 2), flowerModel(0xf47aa0, 0xfff0a0, 3), flowerModel(0x8ab8ff, 0xffffff, 4)];
    const fInst: Inst[][] = [[], [], [], []];
    placed = 0;
    for (let i = 0; i < q.flowerCount * 12 && placed < q.flowerCount; i++) {
      const x = (rnd() * 2 - 1) * WORLD_HALF * 0.85, z = (rnd() * 2 - 1) * WORLD_HALF * 0.85;
      const patch = noise2(x * 0.08 + 31, z * 0.08);
      if (patch < 0.35) continue;
      if (!grassy(x, z) || excluded(x, z, -2)) continue;
      const v = Math.floor((noise2(x * 0.02, z * 0.02) * 0.5 + 0.5) * 3.99) % 4;
      fInst[v].push({ m: mat4(x, hf.height(x, z) - 0.02, z, rnd() * 6.28, 0.9 + rnd() * 0.6) });
      placed++;
    }
    flowerGeos.forEach((g, v) => this.lod.push(new ChunkedInstances(g, this.plantMat, fInst[v], parent, { cast: false, chunk: 24, maxDist: 70 })));

    // ---------- mushrooms (forest) ----------
    const mush = [mushroomModel(0xd8452f), mushroomModel(0xe0a040)];
    const mInst: Inst[][] = [[], []];
    for (let i = 0; i < 6000; i++) {
      const x = (rnd() * 2 - 1) * WORLD_HALF, z = (rnd() * 2 - 1) * WORLD_HALF;
      if (hf.regionAt(x, z) !== 'forest' || !grassy(x, z) || rnd() > 0.25) continue;
      const v = rnd() < 0.7 ? 0 : 1;
      for (let k = 0; k < 3; k++) {
        const xx = x + (rnd() - 0.5) * 0.9, zz = z + (rnd() - 0.5) * 0.9;
        mInst[v].push({ m: mat4(xx, hf.height(xx, zz) - 0.03, zz, rnd() * 6, 0.6 + rnd() * 0.9) });
      }
    }
    mush.forEach((g, v) => this.lod.push(new ChunkedInstances(g, this.plantMat, mInst[v], parent, { cast: true, chunk: 32, maxDist: 80 })));
  }
  updateLOD(focus: THREE.Vector3) { for (const l of this.lod) l.updateLOD(focus); }
  cutBushAt(x: number, z: number, r: number): CuttableBush[] {
    const out: CuttableBush[] = [];
    for (const b of this.bushes) if (b.alive && Math.hypot(b.x - x, b.z - z) < r + 0.7) {
      b.alive = false; b.set.remove(b.index); this.col.remove(b.collider); out.push(b);
    }
    return out;
  }
  restoreBushes(ids: number[] | null) {
    // ids = indices that should stay cut (from save); others restored
    for (const b of this.bushes) { const cut = ids?.includes(b.index) ?? false; b.alive = !cut; b.collider.active = !cut; if (cut) b.set.remove(b.index); else b.set.restore(b.index); }
  }
}
