import { clamp, distToSegment, fbm, lerp, noise2, smoothstep, smootherstep } from '../core/math';

/** Island authoring. Terraced "diorama" levels with rounded cliff lips, smooth ramps along paths,
 *  a sandy southern beach, cliff coast in the north-west, a mountain with a temple on top and a lake. */
export const WORLD_HALF = 132;
export const CELL = 0.75;
export const STEP = 2.0;
export const SEA_LEVEL = 0;

export type Region = 'meadow' | 'forest' | 'coast' | 'beach' | 'mountain' | 'lake' | 'cave' | 'village' | 'ruins' | 'temple';
export const REGION_NAMES: Record<Region, string> = {
  meadow: '바람결 초원', forest: '이끼숲', coast: '갈매기 절벽', beach: '조가비 해변', mountain: '구름봉 산길',
  lake: '거울 호수', cave: '물빛 동굴', village: '솔방울 마을', ruins: '옛 등대 폐허', temple: '달빛 사원',
};

export const PATHS: [number, number][][] = [
  [[0, 30], [2, 45], [-3, 60], [0, 80]],
  [[0, 12], [-2, -8], [-8, -26], [-4, -40], [8, -52], [6, -63], [0, -72]],
  [[-12, 26], [-30, 22], [-45, 12], [-62, 4], [-74, -10]],
  [[14, 26], [30, 22], [44, 32], [55, 45]],
  [[30, 22], [36, 6], [42, -8]],
  [[-8, -26], [-20, -36], [-29, -44]],
];
export const PATH_WIDTH = 2.3;

export const VILLAGE = { x: 0, z: 22, r: 24 };
export const TEMPLE = { x: 0, z: -82, r: 12 };
export const LAKE = { x: 63, z: -10, r: 16 };
export const LAKE_ISLE = { x: 66, z: -10, r: 5 };
export const RUINS = { x: 56, z: 50, r: 16 };
export const CAVE_MOUTH = { x: -31, z: -46.5 };
const MESAS = [
  { x: -30, z: 46, r: 9, add: 1 }, { x: -72, z: -30, r: 14, add: 1 }, { x: -74, z: -33, r: 6, add: 1 },
  { x: 30, z: -26, r: 10, add: 1 }, { x: -56, z: 42, r: 7, add: 1 }, { x: 22, z: 52, r: 6, add: 0.55 },
];

function pathDist(x: number, z: number) {
  let d = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, distToSegment(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
  return d;
}

export interface Sample { h: number; path: number; land: number; smooth: number; lake: number; mountain: number; }

export function computeSample(x: number, z: number): Sample {
  const warp = fbm(x * 0.012 + 3.1, z * 0.012 - 1.7, 3);
  const r = Math.hypot(x, z * 1.04);
  const coastR = 100 + 10 * warp + 4 * noise2(x * 0.05, z * 0.05);
  const land = smoothstep(coastR + 7, coastR - 9, r);

  let L = 1.0 + 0.48 * fbm(x * 0.017 + 1.3, z * 0.017 - 2.1, 3);
  const dm = Math.hypot(x * 1.05, z + 76) + 7 * fbm(x * 0.03, z * 0.03, 2);
  const mountain = smoothstep(54, 12, dm);
  L += 3.25 * mountain;
  for (const m of MESAS) {
    const d = Math.hypot(x - m.x, z - m.z) + 3 * noise2(x * 0.09 + m.x, z * 0.09);
    L += m.add * smoothstep(m.r + 2.5, m.r - 2.5, d);
  }
  // flatten the village and the temple summit
  const dv = Math.hypot(x - VILLAGE.x, (z - VILLAGE.z) * 1.1);
  L = lerp(L, 1.0, smoothstep(VILLAGE.r + 4, VILLAGE.r - 6, dv));
  const dt = Math.hypot(x - TEMPLE.x, z - TEMPLE.z);
  L = lerp(L, 4.0, smoothstep(TEMPLE.r + 4, TEMPLE.r - 2, dt));
  const dr = Math.hypot(x - RUINS.x, z - RUINS.z);
  L = lerp(L, 1.0, smoothstep(RUINS.r + 3, RUINS.r - 4, dr));
  // lake bowl with a small island
  const dl = Math.hypot((x - LAKE.x) / 1.25, z - LAKE.z) + 2.2 * noise2(x * 0.08, z * 0.08);
  const lake = smoothstep(LAKE.r + 3, LAKE.r - 5, dl);
  L = lerp(L, -0.9, lake);
  const di = Math.hypot(x - LAKE_ISLE.x, z - LAKE_ISLE.z);
  L = lerp(L, 1.02, smoothstep(LAKE_ISLE.r + 1.5, LAKE_ISLE.r - 1.5, di));

  // sea
  L = lerp(-1.6, L, land);

  // terrace
  const fl = Math.floor(L);
  const T = fl + smootherstep(0.45, 0.55, L - fl);

  const pd = pathDist(x, z);
  const path = 1 - smoothstep(PATH_WIDTH * 0.55, PATH_WIDTH, pd);
  const pathRamp = 1 - smoothstep(PATH_WIDTH + 1.5, PATH_WIDTH + 6, pd);
  const southBeach = smoothstep(40, 62, z) * (1 - land * smoothstep(0.75, 1, land));
  const eastBeach = smoothstep(70, 86, x) * smoothstep(-30, 10, z) * (1 - smoothstep(0.85, 1, land));
  const smooth = clamp(Math.max(pathRamp, southBeach * 1.2, eastBeach, lake * 1.1, smoothstep(0.4, 0.05, land) * 0.4));

  let h = lerp(T, L, smooth) * STEP;
  // gentle rolling hills on top of plateaus (not on paths/village)
  const calm = Math.max(path, smoothstep(VILLAGE.r, VILLAGE.r - 8, dv), smoothstep(TEMPLE.r, TEMPLE.r - 4, dt), smoothstep(RUINS.r + 2, RUINS.r - 6, dr));
  h += 0.32 * fbm(x * 0.045 + 9, z * 0.045 - 4, 3) * land * (1 - calm) * (1 - lake);
  // soft round hills (walkable) for the rolling-meadow silhouette
  const hill = smoothstep(0.05, 0.55, fbm(x * 0.03 + 5.2, z * 0.03 + 2.7, 3));
  h += 1.5 * hill * smoothstep(0.9, 1, land) * (1 - calm) * (1 - lake) * (1 - mountain * 0.7);
  h -= 0.1 * path;
  if (h < -5) h = -5;
  return { h, path, land, smooth, lake, mountain };
}

export class Heightfield {
  readonly n: number;
  readonly heights: Float32Array;
  readonly path: Float32Array;
  readonly land: Float32Array;
  readonly mountain: Float32Array;

  constructor() {
    this.n = Math.round((WORLD_HALF * 2) / CELL) + 1;
    const n = this.n;
    this.heights = new Float32Array(n * n);
    this.path = new Float32Array(n * n);
    this.land = new Float32Array(n * n);
    this.mountain = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const s = computeSample(-WORLD_HALF + i * CELL, -WORLD_HALF + j * CELL);
      const k = j * n + i;
      this.heights[k] = s.h; this.path[k] = s.path; this.land[k] = s.land; this.mountain[k] = s.mountain;
    }
  }
  private bilinear(arr: Float32Array, x: number, z: number, outside: number) {
    const fx = (x + WORLD_HALF) / CELL, fz = (z + WORLD_HALF) / CELL;
    if (fx < 0 || fz < 0 || fx >= this.n - 1 || fz >= this.n - 1) return outside;
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, n = this.n;
    const a = arr[j * n + i], b = arr[j * n + i + 1], c = arr[(j + 1) * n + i], d = arr[(j + 1) * n + i + 1];
    // match the mesh triangulation (diagonal from (i+1,j) to (i,j+1))
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }
  height(x: number, z: number) { return this.bilinear(this.heights, x, z, -5); }
  pathAt(x: number, z: number) { return this.bilinear(this.path, x, z, 0); }
  landAt(x: number, z: number) { return this.bilinear(this.land, x, z, 0); }
  slope(x: number, z: number) {
    const e = 0.5;
    const dx = this.height(x + e, z) - this.height(x - e, z), dz = this.height(x, z + e) - this.height(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }
  regionAt(x: number, z: number): Region {
    if (x > 500) return 'cave';
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r - 2) return 'village';
    if (Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < TEMPLE.r + 6) return 'temple';
    if (Math.hypot(x - RUINS.x, z - RUINS.z) < RUINS.r + 3) return 'ruins';
    if (Math.hypot((x - LAKE.x) / 1.25, z - LAKE.z) < LAKE.r + 8) return 'lake';
    const h = this.height(x, z), land = this.landAt(x, z);
    if (this.bilinear(this.mountain, x, z, 0) > 0.35) return 'mountain';
    if (x < -40 + 6 * noise2(z * 0.03, 1) && Math.abs(z) < 62 && land > 0.8) return 'forest';
    if (land < 0.97 && h < 1.4 && z > 30) return 'beach';
    if (land < 0.97) return 'coast';
    return 'meadow';
  }
}
