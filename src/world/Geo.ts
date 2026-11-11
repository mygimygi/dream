import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { clamp, mulberry32, noise3 } from '../core/math';
import { paint } from '../render/Materials';

/** Geometry toolkit for the hand-crafted miniature look: lumpy blobs, tapered tubes, lathes, rounded boxes.
 *  Everything ends up as a single vertex-coloured, non-indexed-normals-smoothed BufferGeometry. */

export function clean(g: THREE.BufferGeometry) {
  g = g.index ? g : g;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  if (!g.attributes.color) paint(g, () => [1, 1, 1]);
  return g.index ? g.toNonIndexed() : g;
}
export function merge(list: THREE.BufferGeometry[]) {
  const g = mergeGeometries(list.map(clean), false)!;
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

/** Organic lump: subdivided icosphere displaced with 3D noise, smooth normals. */
export function blob(r: number, seed: number, rough = 0.18, detail = 3, squash = 1): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = noise3(v.x * 1.6 + seed, v.y * 1.6 - seed * 0.7, v.z * 1.6 + seed * 1.3);
    const n2 = noise3(v.x * 4 + seed, v.y * 4, v.z * 4 - seed) * 0.35;
    const s = r * (1 + rough * (n + n2));
    p.setXYZ(i, v.x * s, v.y * s * squash, v.z * s);
  }
  g.computeVertexNormals();
  return g;
}

/** Tube along a curve whose radius tapers with t; optional ring bumps (palm trunks). */
export function taperTube(pts: THREE.Vector3[], r0: number, r1: number, seg = 12, radial = 10, bumps = 0) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const p = g.attributes.position;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let s = 0; s <= seg; s++) {
    const t = s / seg;
    curve.getPointAt(t, c);
    let r = r0 + (r1 - r0) * t;
    if (bumps) r *= 1 + 0.12 * Math.max(0, Math.sin(t * Math.PI * 2 * bumps));
    for (let k = 0; k <= radial; k++) {
      const i = s * (radial + 1) + k;
      v.fromBufferAttribute(p, i).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  // cap the bottom so it never shows a hole
  return g;
}

export function lathe(profile: [number, number][], seg = 20) {
  // LatheGeometry faces outward only when the profile runs bottom -> top
  if (profile[0][1] > profile[profile.length - 1][1]) profile = profile.slice().reverse();
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  g.computeVertexNormals();
  return g;
}
export function rbox(w: number, h: number, d: number, r = 0.08, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
}
export function sphere(r: number, ws = 16, hs = 12) { return new THREE.SphereGeometry(r, ws, hs); }
export function cyl(rt: number, rb: number, h: number, s = 14) { return new THREE.CylinderGeometry(rt, rb, h, s); }

export function colorize(g: THREE.BufferGeometry, c: THREE.ColorRepresentation, vary = 0, seed = 1) {
  const base = new THREE.Color(c);
  const r = mulberry32(seed);
  const k = vary ? 1 - vary / 2 + r() * vary : 1;
  return paint(g, (x, y, z) => {
    const n = vary ? 1 + (noise3(x * 3, y * 3, z * 3)) * vary * 0.5 : 1;
    return [base.r * k * n, base.g * k * n, base.b * k * n];
  });
}
/** gradient bottom->top in local y with AO toward a centre point */
export function gradient(g: THREE.BufferGeometry, bottom: THREE.ColorRepresentation, top: THREE.ColorRepresentation, y0: number, y1: number, center?: THREE.Vector3, rad = 1) {
  const a = new THREE.Color(bottom), b = new THREE.Color(top), t = new THREE.Color();
  return paint(g, (x, y, z) => {
    t.copy(a).lerp(b, clamp((y - y0) / (y1 - y0)));
    if (center) {
      const d = Math.hypot(x - center.x, y - center.y, z - center.z) / rad;
      t.multiplyScalar(0.62 + 0.38 * clamp(d * d));
    }
    return t;
  });
}
export function at(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s));
  g.applyMatrix4(m);
  return g;
}
/** bend normals toward a sphere around `center` – gives foliage clumps the soft "single ball" shading */
export function sphericalNormals(g: THREE.BufferGeometry, center: THREE.Vector3, amt = 0.6) {
  const p = g.attributes.position, n = g.attributes.normal;
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).sub(center).normalize();
    nn.fromBufferAttribute(n, i).lerp(v, amt).normalize();
    n.setXYZ(i, nn.x, nn.y, nn.z);
  }
  return g;
}
