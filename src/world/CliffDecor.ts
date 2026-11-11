import * as THREE from 'three';
import { Heightfield, WORLD_HALF } from './Heightfield';
import { toy } from '../render/Materials';
import { at, blob, gradient, rbox, merge } from './Geo';
import { mulberry32 } from '../core/math';
import { ChunkedInstances, Inst, mat4 } from './Instancing';
import { Zone } from './Vegetation';

/** Turns every terrace edge into a hand-built miniature: stacked rounded stone blocks on the cliff face,
 *  a soft grass lip overhanging the top, and pebbles scattered along path edges. */
export function buildCliffDecor(hf: Heightfield, parent: THREE.Object3D, exclude: Zone[], low = false): ChunkedInstances[] {
  const out: ChunkedInstances[] = [];
  const r = mulberry32(77);
  const stoneMat = toy({ vertexColors: true, roughness: 0.88 }, { rim: 0.12, detail: 0.28, gloss: 0 });
  const lipMat = toy({ vertexColors: true, roughness: 0.8 }, { rim: 0.2, rimColor: 0xf6ffd0, gloss: 0.08, wind: 0 });
  // unit stone: 1 x 1 x 1 rounded block with lighter top face
  const stoneGeos = [0, 1, 2].map((i) => {
    const g = rbox(1, 1, 1, 0.22 + i * 0.04, 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k); const n = Math.sin(x * 7 + i) * Math.sin(z * 6 + y * 5) * 0.035; p.setXYZ(k, x * (1 + n), y, z * (1 + n)); }
    g.computeVertexNormals();
    return gradient(g, 0x9a7650, 0xd2b07c, -0.5, 0.5);
  });
  const lipGeo = (() => { const g = at(blob(0.6, 4, 0.12, 2), 0, 0, 0, 0, 0, 0, [1.25, 0.32, 0.75]); return gradient(g, 0x3f8a2c, 0x6fb03c, -0.2, 0.2); })();
  const pebbleGeo = (() => { const g = at(blob(0.5, 9, 0.2, 1), 0, 0, 0, 0, 0, 0, [1, 0.45, 0.8]); return gradient(g, 0xa89c88, 0xe6dcc8, -0.2, 0.25); })();
  const stones: Inst[][] = [[], [], []], lips: Inst[] = [], pebbles: Inst[] = [];
  const used = new Set<number>();
  const SP = low ? 1.6 : 1.25;
  const key = (x: number, z: number) => Math.round(x / SP) * 100000 + Math.round(z / SP);
  const excluded = (x: number, z: number) => exclude.some((e) => Math.hypot(e.x - x, e.z - z) < e.r * 0.6);
  const tint = () => new THREE.Color(1, 1, 1).multiplyScalar(0.85 + r() * 0.25);
  for (let z = -WORLD_HALF + 2; z < WORLD_HALF - 2; z += 0.75) for (let x = -WORLD_HALF + 2; x < WORLD_HALF - 2; x += 0.75) {
    const e = 0.6;
    const gx = (hf.height(x + e, z) - hf.height(x - e, z)) / (2 * e), gz = (hf.height(x, z + e) - hf.height(x, z - e)) / (2 * e);
    const s = Math.hypot(gx, gz);
    if (s < 1.15) continue;
    const nx = gx / s, nz = gz / s; // uphill direction
    const top = hf.height(x + nx * 1.6, z + nz * 1.6), bot = hf.height(x - nx * 1.6, z - nz * 1.6);
    const H = top - bot;
    if (H < 1.1 || top < 0.6 || hf.pathAt(x, z) > 0.05) continue;
    const k = key(x, z); if (used.has(k)) continue;
    if (excluded(x, z)) continue;
    used.add(k);
    const yaw = Math.atan2(nx, nz);
    // stack stones from the foot to the lip, slightly recessed into the slope so the face looks built
    const rows = Math.max(1, Math.round(H / 0.95));
    const rh = H / rows;
    for (let i = 0; i < rows; i++) {
      const y = bot + rh * (i + 0.5);
      const off = ((i % 2) * 0.35 + (r() - 0.5) * 0.2);
      const t = (y - bot) / H;               // 0 bottom, 1 top
      const back = -0.9 + t * 1.5;          // follow the cliff profile
      const px = x + nx * back + Math.cos(yaw) * off, pz = z + nz * back - Math.sin(yaw) * off;
      const w = (1.05 + r() * 0.35) * (SP / 1.25);
      stones[Math.floor(r() * 3)].push({ m: mat4(px, y, pz, yaw + (r() - 0.5) * 0.12, 1).multiply(new THREE.Matrix4().makeScale(w, rh * 1.02, 0.85 + r() * 0.2)), c: tint() });
    }
    // grass lip overhanging the edge
    lips.push({ m: mat4(x + nx * 0.75, top - 0.05, z + nz * 0.75, yaw, 1).multiply(new THREE.Matrix4().makeScale(0.95 + r() * 0.3, 1, 1)), c: tint() });
  }
  // pebbles lining the paths
  for (let i = 0; i < 26000; i++) {
    const x = (r() * 2 - 1) * WORLD_HALF, z = (r() * 2 - 1) * WORLD_HALF;
    const p = hf.pathAt(x, z);
    if (p < 0.08 || p > 0.55 || hf.height(x, z) < 0.6 || excluded(x, z)) continue;
    const sc = 0.12 + r() * 0.22;
    pebbles.push({ m: mat4(x, hf.height(x, z) + 0.02, z, r() * 6, sc), c: tint() });
    if (pebbles.length > 2600) break;
  }
  stones.forEach((list, i) => { if (list.length) out.push(new ChunkedInstances(stoneGeos[i], stoneMat, list, parent, { cast: !low, chunk: 32, maxDist: low ? 75 : 110 })); });
  if (lips.length) out.push(new ChunkedInstances(lipGeo, lipMat, lips, parent, { cast: !low, chunk: 32, maxDist: low ? 75 : 110 }));
  if (pebbles.length) out.push(new ChunkedInstances(pebbleGeo, stoneMat, pebbles, parent, { cast: false, chunk: 32, maxDist: 70 }));
  void merge;
  return out;
}
