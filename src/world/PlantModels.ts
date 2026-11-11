import * as THREE from 'three';
import { mulberry32 } from '../core/math';
import { paint } from '../render/Materials';
import { at, blob, colorize, gradient, lathe, merge, sphere, sphericalNormals, taperTube, cyl } from './Geo';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export interface TreeModel { trunk: THREE.BufferGeometry; leaves: THREE.BufferGeometry; radius: number; height: number; }

function bark(g: THREE.BufferGeometry, base = 0x8a5a36, dark = 0x5e3a22) {
  const a = new THREE.Color(base), b = new THREE.Color(dark), t = new THREE.Color();
  return paint(g, (x, y, z) => {
    const ang = Math.atan2(z, x);
    const s = 0.5 + 0.5 * Math.sin(ang * 7 + y * 1.3 + Math.sin(y * 3) * 0.6);
    return t.copy(a).lerp(b, s * 0.55 + (y < 0.4 ? 0.25 : 0));
  });
}

/** Broadleaf: short curvy trunk with root flare and a lumpy multi-clump crown. */
export function roundTree(seed: number, palette: [number, number, number] = [0x2f6b2b, 0x5aa83a, 0x8fd04c], fruit = 0): TreeModel {
  const r = mulberry32(seed);
  const lean = (r() - 0.5) * 0.3;
  const trunkH = 2.0 + r() * 0.8;
  const trunk = taperTube([V(0, -0.3, 0), V(lean * 0.4, trunkH * 0.35, 0.05), V(lean, trunkH * 0.75, -0.05), V(lean * 1.2, trunkH + 0.5, 0)], 0.42, 0.2, 10, 10);
  const parts: THREE.BufferGeometry[] = [bark(trunk)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r();
    const root = at(sphere(0.3, 10, 8), Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36, 0, -a, 0.9, [1.5, 0.55, 0.7]);
    parts.push(bark(root));
  }
  // branches peeking into the crown
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2;
    parts.push(bark(taperTube([V(lean * 0.8, trunkH * 0.7, 0), V(Math.cos(a) * 0.7, trunkH + 0.3, Math.sin(a) * 0.7)], 0.14, 0.07, 4, 6)));
  }
  const crownY = trunkH + 1.35, R = 1.75 + r() * 0.5;
  const center = V(lean, crownY, 0);
  const leaves: THREE.BufferGeometry[] = [];
  const clumps = 6 + Math.floor(r() * 3);
  leaves.push(at(blob(R * 0.82, seed * 3.1, 0.16, 3, 0.86), center.x, center.y, center.z));
  for (let i = 0; i < clumps; i++) {
    const a = (i / clumps) * Math.PI * 2 + r() * 0.5;
    const up = (r() - 0.3) * 0.9;
    const d = R * (0.55 + r() * 0.2);
    const rr = R * (0.45 + r() * 0.2);
    leaves.push(at(blob(rr, seed + i * 7.7, 0.2, 2, 0.9), center.x + Math.cos(a) * d, center.y + up * R * 0.6, center.z + Math.sin(a) * d));
  }
  leaves.push(at(blob(R * 0.55, seed * 1.7, 0.2, 2), center.x, center.y + R * 0.62, center.z));
  const lg = merge(leaves);
  sphericalNormals(lg, center, 0.55);
  gradient(lg, palette[0], palette[2], crownY - R, crownY + R * 1.1, center, R * 1.15);
  // pale highlights on top lumps
  const mid = new THREE.Color(palette[1]);
  const col = lg.attributes.color, pos = lg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.5 + 0.5 * Math.sin(pos.getX(i) * 2.1 + pos.getZ(i) * 1.7 + seed);
    col.setXYZ(i, col.getX(i) * (0.9 + 0.1 * k) + mid.r * 0.05, col.getY(i) * (0.9 + 0.1 * k) + mid.g * 0.05, col.getZ(i) * (0.9 + 0.1 * k));
  }
  if (fruit) {
    // fruit/blossom dots tucked into the crown surface (part of the trunk mesh so they don't sway apart)
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, e = (r() - 0.2) * 1.0;
      const d = R * (0.95 + r() * 0.1);
      parts.push(colorize(at(sphere(0.13 + r() * 0.05, 10, 8), center.x + Math.cos(a) * Math.cos(e) * d, center.y + Math.sin(e) * d * 0.8, center.z + Math.sin(a) * Math.cos(e) * d), fruit));
    }
  }
  return { trunk: merge(parts), leaves: lg, radius: 0.55, height: crownY + R };
}

/** Rounded conifer: stacked soft skirts. */
export function pineTree(seed: number): TreeModel {
  const r = mulberry32(seed);
  const h = 4.2 + r() * 1.6;
  const trunk = bark(taperTube([V(0, -0.3, 0), V(0, h * 0.5, 0), V(0, h * 0.8, 0)], 0.3, 0.12, 6, 8), 0x7a4e30, 0x4e3220);
  const tiers = 4;
  const leaves: THREE.BufferGeometry[] = [];
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const w = (1.0 - t * 0.7) * (1.8 + r() * 0.2), y0 = 1.0 + t * (h - 1.2), th = 1.5 - t * 0.25;
    const g = lathe([[0.0, 0], [w * 0.75, 0.02], [w, 0.18], [w * 0.92, 0.4], [w * 0.55, th * 0.7], [w * 0.2, th], [0.0, th + 0.05]], 18);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), z = p.getZ(k), a = Math.atan2(z, x);
      const s = 1 + 0.07 * Math.sin(a * 9 + i * 2 + seed) * (p.getY(k) < 0.5 ? 1 : 0.3);
      p.setXYZ(k, x * s, p.getY(k), z * s);
    }
    g.computeVertexNormals();
    at(g, 0, y0, 0, 0, r() * 6, 0);
    leaves.push(g);
  }
  const lg = merge(leaves);
  gradient(lg, 0x1f4d2e, 0x5f9c4a, 0.8, h + 1.2, V(0, h * 0.55, 0), h * 0.7);
  return { trunk, leaves: lg, radius: 0.45, height: h + 1.3 };
}

/** Palm: ringed bending trunk + drooping fronds + coconuts. */
export function palmTree(seed: number): TreeModel {
  const r = mulberry32(seed);
  const h = 4.5 + r() * 1.5, bend = 0.8 + r() * 0.8;
  const top = V(bend, h, 0.1);
  const trunk = bark(taperTube([V(0, -0.3, 0), V(bend * 0.1, h * 0.35, 0), V(bend * 0.45, h * 0.7, 0.05), top], 0.3, 0.2, 18, 9, 9), 0xb48a5a, 0x8a6440);
  const nuts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) { const a = i * 2.1; nuts.push(colorize(at(sphere(0.2, 10, 8), top.x + Math.cos(a) * 0.25, h - 0.2, top.z + Math.sin(a) * 0.25), 0x6b4a26)); }
  const fronds: THREE.BufferGeometry[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const len = 2.6 + r() * 0.6;
    // a leaf: strip with width profile, arched
    const seg = 10;
    const pos: number[] = [], idx: number[] = [];
    for (let s = 0; s <= seg; s++) {
      const t = s / seg;
      const w = Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.45 + 0.05;
      const x = t * len, y = Math.sin(t * Math.PI * 0.8) * 0.7 - t * t * 1.4;
      pos.push(x, y + w * 0.15, -w, x, y + 0.12, 0, x, y + w * 0.15, w);
      if (s < seg) { const b = s * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    gradient(g, 0x3f8a32, 0x8ccf4e, -1, 0.6);
    at(g, top.x, top.y, top.z, 0, a, 0);
    fronds.push(g.toNonIndexed());
  }
  return { trunk: merge([trunk, ...nuts]), leaves: merge(fronds), radius: 0.4, height: h + 1 };
}

export function bushModel(seed: number, palette: [number, number] = [0x2f7a2e, 0x7cc443], berries = 0): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r();
    const rr = 0.45 + r() * 0.25;
    parts.push(at(blob(rr, seed + i * 3.3, 0.22, 2), Math.cos(a) * 0.35, rr * 0.75, Math.sin(a) * 0.35));
  }
  parts.push(at(blob(0.55, seed * 0.7, 0.2, 2), 0, 0.7, 0));
  const g = merge(parts);
  sphericalNormals(g, V(0, 0.45, 0), 0.5);
  gradient(g, palette[0], palette[1], 0, 1.25, V(0, 0.55, 0), 0.9);
  if (!berries) return g;
  const bs: THREE.BufferGeometry[] = [g];
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, e = 0.2 + r() * 0.9;
    const v = V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(0.8);
    bs.push(colorize(at(sphere(0.07, 6, 5), v.x, v.y + 0.45, v.z), berries));
  }
  return merge(bs);
}

export function grassTuft(seed: number, lite = false): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const pos: number[] = [], col: number[] = [];
  const base = new THREE.Color(0x4f9a33), tip = new THREE.Color(0x8cc650), c = new THREE.Color();
  const blades = lite ? 7 : 11;
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, lean = 0.3 + r() * 0.35, h = 0.11 + r() * 0.11, w = 0.06 + r() * 0.03;
    const ox = (r() - 0.5) * 0.4, oz = (r() - 0.5) * 0.4;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const seg = lite ? 2 : 4;
    const pts: number[][] = [];
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, ww = w * Math.sin(Math.PI * (0.18 + t * 0.8)) * (t === 1 ? 0.25 : 1);
      const bx = ox + dx * lean * t * t * h * 2, bz = oz + dz * lean * t * t * h * 2, by = t * h;
      pts.push([bx - px * ww, by, bz - pz * ww, bx + px * ww, by, bz + pz * ww, t]);
    }
    for (let s = 0; s < seg; s++) {
      const p0 = pts[s], p1 = pts[s + 1];
      const tri = [[p0[0], p0[1], p0[2], p0[6]], [p0[3], p0[4], p0[5], p0[6]], [p1[0], p1[1], p1[2], p1[6]], [p0[3], p0[4], p0[5], p0[6]], [p1[3], p1[4], p1[5], p1[6]], [p1[0], p1[1], p1[2], p1[6]]];
      for (const v of tri) { pos.push(v[0], v[1], v[2]); c.copy(base).lerp(tip, v[3]); col.push(c.r, c.g, c.b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // normals point up so blades light like the ground they grow from
  const nn = new Float32Array(pos.length);
  for (let i = 0; i < nn.length; i += 3) { nn[i] = 0; nn[i + 1] = 1; nn[i + 2] = 0; }
  g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  return g;
}

/** Clover / low leafy ground cover: overlapping rounded leaves, reads as soft volume instead of blades. */
export function cloverClump(seed: number): THREE.BufferGeometry {
  // leaves are flat rounded discs (6 triangles each) instead of spheres: ~160 triangles per clump
  const r = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = r() * 0.22, y = 0.05 + r() * 0.06;
    for (let k = 0; k < 3; k++) {
      const b = a + (k / 3) * Math.PI * 2;
      const leaf = new THREE.CircleGeometry(0.06, 6);
      leaf.deleteAttribute('uv');
      at(leaf, Math.cos(a) * d + Math.cos(b) * 0.05, y, Math.sin(a) * d + Math.sin(b) * 0.05, -Math.PI / 2 + 0.25, 0, -b, [1.25, 0.9, 1]);
      parts.push(leaf);
    }
  }
  const g = merge(parts);
  gradient(g, 0x3f8a2c, 0x7cbf48, 0.0, 0.12);
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}
/** Bell-flower spray: a few drooping cups on arching stems. */
export function bellFlower(color: number, seed: number): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r(), h = 0.25 + r() * 0.15;
    parts.push(colorize(taperTube([V(0, 0, 0), V(Math.cos(a) * 0.05, h * 0.7, Math.sin(a) * 0.05), V(Math.cos(a) * 0.12, h, Math.sin(a) * 0.12)], 0.012, 0.008, 4, 4), 0x4f9a35));
    parts.push(colorize(at(lathe([[0, 0.08], [0.05, 0.07], [0.065, 0.0], [0.05, -0.01], [0, 0.03]], 8), Math.cos(a) * 0.13, h - 0.08, Math.sin(a) * 0.13), color));
  }
  parts.push(gradient(at(blob(0.09, seed, 0.3, 1), 0, 0.05, 0, 0, 0, 0, [1.2, 0.5, 1.2]), 0x3f8a2c, 0x6fb03c, 0, 0.1));
  return merge(parts);
}
/** Daisy cluster: several small white flowers at different heights. */
export function daisyCluster(seed: number): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const x = (r() - 0.5) * 0.35, z = (r() - 0.5) * 0.35, h = 0.12 + r() * 0.14;
    parts.push(colorize(at(cyl(0.01, 0.012, h, 4), x, h / 2, z), 0x4f9a35));
    for (let k = 0; k < 7; k++) { const b = (k / 7) * Math.PI * 2; parts.push(colorize(at(sphere(0.03, 6, 4), x + Math.cos(b) * 0.04, h, z + Math.sin(b) * 0.04, 0, -b, 0, [1.4, 0.3, 0.6]), 0xffffff)); }
    parts.push(colorize(at(sphere(0.022, 6, 4), x, h + 0.01, z), 0xffc93a));
  }
  return merge(parts);
}
export function flowerModel(petal: number, center = 0xffd64a, seed = 1): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const stemH = 0.28 + r() * 0.12;
  parts.push(colorize(at(cyl(0.015, 0.02, stemH, 5), 0, stemH / 2, 0), 0x4f9a35));
  parts.push(colorize(at(sphere(0.06, 6, 4), 0.06, 0.08, 0, 0, 0, 0.5, [1.4, 0.3, 0.7]), 0x5aa83a));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(colorize(at(sphere(0.065, 8, 6), Math.cos(a) * 0.07, stemH, Math.sin(a) * 0.07, 0, -a, 0, [1.3, 0.35, 0.9]), petal));
  }
  parts.push(colorize(at(sphere(0.045, 8, 6), 0, stemH + 0.02, 0, 0, 0, 0, [1, 0.6, 1]), center));
  return merge(parts);
}

export function mushroomModel(cap = 0xd8452f, glow = false): THREE.BufferGeometry {
  const stem = colorize(lathe([[0.0, 0], [0.12, 0], [0.1, 0.18], [0.09, 0.32], [0.0, 0.33]], 10), 0xf3e6c8);
  const c = lathe([[0.0, 0.28], [0.3, 0.27], [0.32, 0.31], [0.26, 0.42], [0.14, 0.5], [0.0, 0.52]], 16);
  const base = new THREE.Color(cap), spot = new THREE.Color(glow ? 0xd8fbff : 0xfff6e8);
  paint(c, (x, y, z) => {
    if (y < 0.3) return [0.95, 0.88, 0.75];
    const s = Math.sin(x * 22) * Math.sin(z * 22) * Math.sin(y * 30);
    return s > 0.45 ? spot : base;
  });
  return merge([stem, c]);
}

export type RockKind = 'round' | 'flat' | 'angular' | 'stack' | 'boulder';
/** Rocks with distinct silhouettes: soft round, flat slab, faceted angular, stacked pile, big ledge boulder. */
export function rockModel(seed: number, moss = false, kind: RockKind = 'round'): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  if (kind === 'stack') {
    g = merge([at(blob(0.85, seed, 0.2, 2), 0, -0.05, 0, 0, 0, 0, [1.1, 0.55, 1]), at(blob(0.55, seed + 3, 0.22, 2), 0.15, 0.45, 0.05, 0, 0, 0.2, [1, 0.6, 0.9]), at(blob(0.32, seed + 7, 0.25, 2), -0.05, 0.8, 0, 0, 0, -0.2, [1, 0.7, 1])]);
    g.computeVertexNormals();
  } else {
    const detail = kind === 'angular' ? 1 : 3;
    const rough = kind === 'angular' ? 0.18 : kind === 'flat' ? 0.15 : 0.28;
    g = blob(1, seed, rough, detail, 1);
    const p = g.attributes.position;
    const sy = kind === 'flat' ? 0.38 : kind === 'boulder' ? 0.95 : kind === 'angular' ? 0.85 : 0.78;
    const sx = kind === 'flat' ? 1.35 : kind === 'boulder' ? 1.25 : 1.1;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i);
      if (y < -0.25) y = -0.25 + (y + 0.25) * 0.2;
      // boulders get a flat ledge top
      if (kind === 'boulder' && y > 0.55) y = 0.55 + (y - 0.55) * 0.25;
      p.setXYZ(i, p.getX(i) * sx, y * sy, p.getZ(i));
    }
    g.computeVertexNormals();
  }
  const a = new THREE.Color(kind === 'angular' ? 0x8f8a82 : 0xa59a88), b = new THREE.Color(kind === 'angular' ? 0xcfcac0 : 0xd8cdb6), m = new THREE.Color(0x6aa83d), t = new THREE.Color();
  paint(g, (x, y, z, nx, ny) => {
    t.copy(a).lerp(b, Math.min(1, Math.max(0, (y + 0.3) * 0.9)));
    // faint mineral banding and speckle
    t.multiplyScalar(0.94 + 0.08 * Math.sin(y * 9 + x * 2.3) + 0.04 * Math.sin(x * 23 + z * 19));
    if ((moss || kind === 'boulder') && ny > 0.55 && y > 0.1) t.lerp(m, Math.min(1, (ny - 0.55) * (moss ? 3 : 1.6)));
    return t;
  });
  return g;
}
