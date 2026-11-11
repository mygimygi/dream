import * as THREE from 'three';
import { mulberry32 } from '../core/math';
import { paint, toy } from '../render/Materials';
import { at, blob, colorize, cyl, gradient, lathe, merge, rbox, sphere, taperTube } from './Geo';

/** Hand-modelled miniature props. Every prop is a small group of vertex-coloured meshes using the shared toy material. */
export const MAT = {
  vc: toy({ vertexColors: true }, { rim: 0.16 }),
  vcOcc: toy({ vertexColors: true }, { rim: 0.14, occlude: true }),
  vcDetail: toy({ vertexColors: true, roughness: 0.9 }, { rim: 0.12, detail: 0.35 }),
  vcDetailOcc: toy({ vertexColors: true, roughness: 0.9 }, { rim: 0.12, detail: 0.35, occlude: true }),
  metal: toy({ color: 0xe0b44c, metalness: 0.65, roughness: 0.35 }, { rim: 0.25 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb84a, emissiveIntensity: 1.3, roughness: 0.3 }),
};
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function mesh(g: THREE.BufferGeometry, m: THREE.Material = MAT.vc, cast = true) {
  const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o;
}
function planks(g: THREE.BufferGeometry, a: number, b: number, axis: 'x' | 'y' = 'x', w = 0.28) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b), t = new THREE.Color();
  return paint(g, (x, y, z) => {
    const v = axis === 'x' ? x : y;
    const k = Math.floor(v / w);
    const edge = Math.abs((v / w) - Math.round(v / w)) < 0.06 ? 0.75 : 1;
    return t.copy(ca).lerp(cb, ((k * 37) % 7) / 7).multiplyScalar(edge);
  });
}
function stoneRing(radius: number, count: number, size: number, seed: number, y = 0.15) {
  const r = mulberry32(seed); const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const g = blob(size * (0.8 + r() * 0.4), seed + i, 0.25, 1);
    gradient(g, 0x9a8f7c, 0xd6ccb6, -size, size);
    parts.push(at(g, Math.cos(a) * radius, y, Math.sin(a) * radius, 0, -a, 0, [1.25, 0.75, 1]));
  }
  return merge(parts);
}

function roundDoor(w: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 14 });
  return g;
}

export function cottage(seed: number, roofColor: number, wallColor = 0xf1e2c4): THREE.Group {
  const r = mulberry32(seed);
  const grp = new THREE.Group();
  const R = 2.6 + r() * 0.4, H = 2.5;
  // walls with a slight belly
  const wall = lathe([[R * 0.98, 0], [R, 0.4], [R * 1.03, H * 0.55], [R * 0.97, H], [R * 0.9, H + 0.05], [0, H + 0.05]], 28);
  gradient(wall, 0xd9c6a0, wallColor, 0, H);
  grp.add(mesh(wall, MAT.vcDetailOcc));
  grp.add(mesh(stoneRing(R + 0.05, 22, 0.42, seed), MAT.vcOcc));
  // thick mushroom roof with rolled rim
  const RR = R + 1.1, th = 2.3 + r() * 0.5;
  const roof = lathe([[0, H + th + 0.2], [0.5, H + th + 0.1], [RR * 0.55, H + th * 0.7], [RR * 0.88, H + th * 0.25], [RR, H + 0.15], [RR * 1.02, H - 0.05], [RR * 0.97, H - 0.22], [RR * 0.85, H - 0.18], [R * 0.95, H]], 32);
  const rc = new THREE.Color(roofColor), rd = rc.clone().multiplyScalar(0.68), t = new THREE.Color();
  paint(roof, (x, y, z) => {
    const a = Math.atan2(z, x), sh = 0.5 + 0.5 * Math.sin(a * 16 + y * 2);
    t.copy(rd).lerp(rc, Math.min(1, (y - H + 0.2) / th + 0.15));
    return t.multiplyScalar(0.9 + 0.1 * sh);
  });
  grp.add(mesh(roof, MAT.vcDetailOcc));
  // topknot
  grp.add(mesh(colorize(at(sphere(0.32, 14, 10), 0, H + th + 0.35, 0), rd.getHex()), MAT.vcOcc));
  // chimney
  const ca = r() * Math.PI * 2;
  const ch = merge([colorize(at(rbox(0.6, 1.3, 0.6, 0.12), 0, 0.65, 0), 0xb9ab95, 0.2, seed), colorize(at(rbox(0.75, 0.2, 0.75, 0.08), 0, 1.35, 0), 0x8f8270)]);
  grp.add(mesh(at(ch, Math.cos(ca) * RR * 0.45, H + th * 0.62, Math.sin(ca) * RR * 0.45), MAT.vcOcc));
  // door facing +z
  const door = planks(roundDoor(1.1, 1.75), 0x9a6236, 0x7a4a28, 'x', 0.22);
  grp.add(mesh(at(door, 0, 0.05, R - 0.02), MAT.vcOcc));
  const frame = colorize(at(new THREE.TorusGeometry(0.62, 0.09, 8, 20, Math.PI), 0, 1.2, R + 0.08), 0x6b4a2e);
  grp.add(mesh(frame, MAT.vcOcc));
  grp.add(mesh(colorize(at(sphere(0.07, 8, 6), 0.32, 0.85, R + 0.2), 0xe8c050), MAT.metal));
  // round windows
  for (const s of [-1, 1]) {
    const a = Math.PI / 2 + s * 0.85;
    const wx = Math.cos(a) * (R + 0.02), wz = Math.sin(a) * (R + 0.02);
    const ring = colorize(new THREE.TorusGeometry(0.36, 0.08, 8, 20), 0x7a5232);
    grp.add(mesh(at(ring, wx, 1.55, wz, 0, -a + Math.PI / 2, 0)));
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.33, 20), MAT.glass);
    at(glass.geometry, 0, 0, 0); glass.position.set(wx * 0.995, 1.55, wz * 0.995); glass.rotation.y = -a + Math.PI / 2;
    grp.add(glass);
    const cross = merge([colorize(rbox(0.06, 0.66, 0.04, 0.02), 0x7a5232), colorize(rbox(0.66, 0.06, 0.04, 0.02), 0x7a5232)]);
    grp.add(mesh(at(cross, wx * 1.005, 1.55, wz * 1.005, 0, -a + Math.PI / 2, 0)));
  }
  // step + flower boxes
  grp.add(mesh(colorize(at(rbox(1.5, 0.22, 0.7, 0.08), 0, 0.11, R + 0.35), 0xbdb09a, 0.15, seed)));
  return grp;
}

export function plankHouse(seed: number, roofColor: number): THREE.Group {
  const grp = new THREE.Group();
  const W = 5, D = 4, H = 2.6;
  const walls = planks(rbox(W, H, D, 0.25, 3), 0xc98b4e, 0xa86d3a, 'y', 0.32);
  at(walls, 0, H / 2, 0);
  grp.add(mesh(walls, MAT.vcDetailOcc));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) grp.add(mesh(colorize(at(rbox(0.45, H + 0.2, 0.45, 0.15), sx * W / 2, H / 2, sz * D / 2), 0x6e4426), MAT.vcOcc));
  const rc = new THREE.Color(roofColor);
  for (const s of [-1, 1]) {
    const slab = rbox(W + 1.4, 0.45, D / 2 + 1.25, 0.2, 3);
    const ang = s * 0.62;
    paint(slab, (x, y, z) => { const k = Math.abs(Math.sin(x * 4.2)); return rc.clone().multiplyScalar(0.82 + 0.18 * k); });
    at(slab, 0, H + 1.05, s * (D / 4 + 0.38), ang, 0, 0);
    grp.add(mesh(slab, MAT.vcDetailOcc));
  }
  grp.add(mesh(colorize(at(cyl(0.22, 0.22, W + 1.6, 12), 0, H + 1.78, 0, 0, 0, Math.PI / 2), rc.clone().multiplyScalar(0.7).getHex()), MAT.vcOcc));
  // gable triangles
  for (const sx of [-1, 1]) {
    const s = new THREE.Shape(); s.moveTo(-D / 2 - 0.1, 0); s.lineTo(0, 1.55); s.lineTo(D / 2 + 0.1, 0); s.lineTo(-D / 2 - 0.1, 0);
    const g = planks(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }), 0xd6a064, 0xb98450, 'y', 0.3);
    at(g, sx * (W / 2 - 0.05) - (sx > 0 ? 0.2 : 0), H, 0, 0, Math.PI / 2, 0);
    grp.add(mesh(g, MAT.vcOcc));
  }
  const door = planks(roundDoor(1.1, 1.8), 0x7a4a28, 0x8a5a32, 'x', 0.22);
  grp.add(mesh(at(door, 0, 0.05, D / 2 + 0.05), MAT.vcOcc));
  for (const sx of [-1.5, 1.5]) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), MAT.glass);
    glass.position.set(sx, 1.55, D / 2 + 0.14); grp.add(glass);
    grp.add(mesh(colorize(at(rbox(1.0, 1.0, 0.18, 0.06), sx, 1.55, D / 2 + 0.06), 0x6e4426)));
    grp.add(mesh(colorize(at(rbox(1.1, 0.25, 0.4, 0.06), sx, 0.95, D / 2 + 0.25), 0x8a5a32)));
    const fl: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) fl.push(colorize(at(sphere(0.12, 8, 6), sx - 0.38 + i * 0.25, 1.13, D / 2 + 0.28), [0xf06a8a, 0xffd34d, 0xffffff, 0xf06a8a][i]));
    grp.add(mesh(merge(fl)));
  }
  return grp;
}

export function well(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(stoneRing(1.05, 14, 0.42, 9, 0.3), MAT.vc));
  g.add(mesh(stoneRing(1.0, 13, 0.38, 19, 0.85), MAT.vc));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), new THREE.MeshStandardMaterial({ color: 0x2f8fb0, roughness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.6; g.add(water);
  for (const s of [-1, 1]) g.add(mesh(colorize(at(rbox(0.22, 2.4, 0.22, 0.08), s * 1.05, 1.5, 0), 0x6e4426)));
  const roof = merge([-1, 1].map((s) => planks(at(rbox(2.9, 0.18, 1.3, 0.08), 0, 2.85, s * 0.5, s * 0.55, 0, 0), 0xc0573a, 0x9a3f2a, 'x', 0.3)));
  g.add(mesh(roof));
  g.add(mesh(colorize(at(cyl(0.12, 0.12, 2.2, 10), 0, 2.2, 0, 0, 0, Math.PI / 2), 0x8a5a32)));
  g.add(mesh(colorize(at(lathe([[0, 0], [0.22, 0], [0.26, 0.35], [0.24, 0.38], [0, 0.38]], 12), 0.3, 1.5, 0), 0x9a6236)));
  return g;
}

export function fence(len: number, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 1.4) + 1);
  const parts: THREE.BufferGeometry[] = [];
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len * i) / (n - 1);
    parts.push(colorize(at(rbox(0.22, 1.0 + r() * 0.1, 0.22, 0.08), x, 0.5, 0, 0, 0, (r() - 0.5) * 0.06), 0x8a5a32, 0.2, i + seed));
    parts.push(colorize(at(sphere(0.13, 8, 6), x, 1.05, 0), 0x9a6a3e));
  }
  for (const y of [0.4, 0.75]) parts.push(colorize(at(rbox(len, 0.14, 0.12, 0.05), 0, y, 0.02), 0xa87244, 0.15, seed));
  g.add(mesh(merge(parts)));
  return g;
}

export function signpost(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(colorize(at(rbox(0.18, 1.3, 0.18, 0.06), 0, 0.65, 0), 0x7a4a28)));
  const board = planks(at(rbox(1.3, 0.75, 0.14, 0.12), 0, 1.25, 0.05), 0xc98b4e, 0xb07a40, 'y', 0.25);
  g.add(mesh(board));
  const lines: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) lines.push(colorize(at(rbox(0.8 - i * 0.15, 0.06, 0.02, 0.02), -0.05, 1.42 - i * 0.16, 0.13), 0x5a3a20));
  g.add(mesh(merge(lines)));
  return g;
}

/** Treasure chest; returns group with `lid` pivot for opening. */
export function chest(big = false): THREE.Group & { lid: THREE.Object3D } {
  const s = big ? 1.25 : 1;
  const g = new THREE.Group() as THREE.Group & { lid: THREE.Object3D };
  const body = planks(at(rbox(1.3, 0.75, 0.85, 0.08), 0, 0.375, 0), big ? 0x3b6fb5 : 0xa8622e, big ? 0x2f5a96 : 0x8a4e24, 'x', 0.26);
  g.add(mesh(body));
  const trim: THREE.BufferGeometry[] = [];
  for (const x of [-0.5, 0.5]) trim.push(at(rbox(0.14, 0.78, 0.9, 0.04), x, 0.39, 0));
  trim.push(at(rbox(1.34, 0.1, 0.9, 0.03), 0, 0.06, 0));
  g.add(mesh(merge(trim.map((t) => colorize(t, 0xe2b64a))), MAT.metal));
  const lid = new THREE.Group(); lid.position.set(0, 0.75, -0.42);
  const top = new THREE.CylinderGeometry(0.43, 0.43, 1.3, 18, 1, false, 0, Math.PI);
  at(top, 0, 0, 0.42, 0, 0, Math.PI / 2);
  planks(top, big ? 0x3b6fb5 : 0xb06a32, big ? 0x2f5a96 : 0x8a4e24, 'x', 0.26);
  lid.add(mesh(top));
  const lt: THREE.BufferGeometry[] = [];
  for (const x of [-0.5, 0.5]) lt.push(at(new THREE.TorusGeometry(0.44, 0.06, 6, 16, Math.PI), x, 0, 0.42, 0, Math.PI / 2, 0));
  lt.push(at(rbox(0.26, 0.3, 0.1, 0.04), 0, -0.05, 0.86));
  lid.add(mesh(merge(lt.map((t) => colorize(t, 0xe8c050))), MAT.metal));
  g.add(lid);
  g.lid = lid;
  g.scale.setScalar(s);
  return g;
}

export function pot(seed: number): THREE.Group {
  const r = mulberry32(seed);
  const g = new THREE.Group();
  const p = lathe([[0, 0], [0.3, 0], [0.42, 0.12], [0.48, 0.35], [0.42, 0.6], [0.26, 0.74], [0.27, 0.85], [0.31, 0.9], [0.22, 0.9], [0.2, 0.78], [0, 0.78]], 20);
  const base = new THREE.Color([0xd08c5a, 0xc77a4a, 0xb9a07a][Math.floor(r() * 3)]), stripe = new THREE.Color(0x7b4a30);
  paint(p, (x, y) => (Math.abs(y - 0.45) < 0.04 || Math.abs(y - 0.55) < 0.025 ? stripe : base));
  g.add(mesh(p));
  return g;
}

export function crate(): THREE.Group {
  const g = new THREE.Group();
  const b = planks(at(rbox(1, 1, 1, 0.08), 0, 0.5, 0), 0xc89254, 0xa8763e, 'y', 0.25);
  g.add(mesh(b));
  const fr: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) { fr.push(at(rbox(1.04, 0.14, 0.14, 0.04), 0, 0.5 + s * 0.45, 0.47)); fr.push(at(rbox(0.14, 1.04, 0.14, 0.04), s * 0.45, 0.5, 0.47)); }
  fr.push(at(rbox(0.12, 1.3, 0.1, 0.03), 0, 0.5, 0.5, 0, 0, 0.78));
  g.add(mesh(merge(fr.map((x) => colorize(x, 0x7a4a28)))));
  return g;
}

export function flameSprite(): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 40, 2, 32, 36, 30);
  gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,0.95)'); gr.addColorStop(0.6, 'rgba(255,110,30,0.5)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
  x.fillStyle = gr; x.beginPath(); x.ellipse(32, 36, 22, 28, 0, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff }));
  (s.material as THREE.SpriteMaterial).color.setScalar(2.2);
  return s;
}
export function torch(lit = true): THREE.Group & { flame: THREE.Sprite; lit: boolean } {
  const g = new THREE.Group() as THREE.Group & { flame: THREE.Sprite; lit: boolean };
  g.add(mesh(colorize(at(rbox(0.5, 0.25, 0.5, 0.08), 0, 0.12, 0), 0x8f8270)));
  g.add(mesh(colorize(at(cyl(0.11, 0.14, 1.3, 10), 0, 0.85, 0), 0x6e4426)));
  g.add(mesh(colorize(at(lathe([[0, 0], [0.18, 0], [0.34, 0.22], [0.36, 0.3], [0, 0.3]], 14), 0, 1.45, 0), 0x5b5b62), MAT.metal));
  const f = flameSprite(); f.position.y = 2.0; f.scale.set(0.8, 1.05, 1); f.visible = lit;
  g.add(f); g.flame = f; g.lit = lit;
  return g;
}

export function bridge(len: number, width = 2.4): THREE.Group {
  const g = new THREE.Group();
  const n = Math.round(len / 0.45);
  const parts: THREE.BufferGeometry[] = [];
  const r = mulberry32(5);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * (len / n);
    parts.push(colorize(at(rbox(len / n - 0.05, 0.16, width + (r() - 0.5) * 0.15, 0.04), x, -0.08, 0, 0, 0, (r() - 0.5) * 0.04), 0xb07a44, 0.25, i));
  }
  for (const s of [-1, 1]) parts.push(colorize(at(rbox(len, 0.18, 0.18, 0.06), 0, -0.22, s * (width / 2 - 0.1)), 0x6e4426));
  const posts = Math.round(len / 3) + 1;
  for (let i = 0; i < posts; i++) {
    const x = -len / 2 + (i * len) / (posts - 1);
    for (const s of [-1, 1]) {
      parts.push(colorize(at(rbox(0.2, 2.6, 0.2, 0.06), x, -0.4, s * (width / 2)), 0x7a4a28));
      parts.push(colorize(at(sphere(0.13, 8, 6), x, 0.92, s * (width / 2)), 0x8a5a32));
    }
  }
  for (const s of [-1, 1]) parts.push(colorize(at(cyl(0.05, 0.05, len, 6), 0, 0.82, s * (width / 2), 0, 0, Math.PI / 2), 0xd9c08a));
  g.add(mesh(merge(parts)));
  return g;
}

export function pillar(h: number, broken: boolean, seed: number): THREE.Group {
  const g = new THREE.Group();
  const r = mulberry32(seed);
  const shaft = new THREE.CylinderGeometry(0.5, 0.56, h, 16, 6);
  const p = shaft.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), fl = 1 - 0.06 * Math.max(0, Math.cos(a * 8));
    let y = p.getY(i);
    if (broken && y > h / 2 - 0.01) y -= (0.5 + 0.5 * Math.sin(a * 3 + seed)) * 0.7;
    p.setXYZ(i, x * fl, y, z * fl);
  }
  shaft.computeVertexNormals();
  gradient(shaft, 0xb3a890, 0xe6dcc4, -h / 2, h / 2);
  const parts = [at(shaft, 0, h / 2 + 0.35, 0), colorize(at(rbox(1.4, 0.4, 1.4, 0.1), 0, 0.2, 0), 0xb8ad96, 0.2, seed)];
  if (!broken) parts.push(colorize(at(rbox(1.35, 0.35, 1.35, 0.1), 0, h + 0.5, 0), 0xd8ceb6));
  // moss
  const moss = gradient(blob(0.5, seed, 0.3, 1), 0x4f8f2e, 0x86c24a, -0.4, 0.4);
  parts.push(at(moss, 0.3, 0.45, 0.35, 0, 0, 0, [1.2, 0.35, 0.8]));
  g.add(mesh(merge(parts), MAT.vcDetailOcc)); // fades like roofs when it hides the hero
  g.rotation.y = r() * Math.PI;
  return g;
}

export function stoneWall(len: number, h: number, seed: number, ruined = false): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const rows = Math.max(1, Math.round(h / 0.55));
  for (let row = 0; row < rows; row++) {
    let x = -len / 2 + (row % 2 ? 0.35 : 0);
    const y = 0.28 + row * 0.55;
    while (x < len / 2 - 0.2) {
      const w = Math.min(0.8 + r() * 0.6, len / 2 - x);
      if (!(ruined && row > 1 && r() < 0.35 + row * 0.1)) {
        const b = colorize(at(rbox(w - 0.06, 0.5, 0.9, 0.12), x + w / 2, y, (r() - 0.5) * 0.06), 0xcdbfa2, 0.25, Math.floor(r() * 1000));
        parts.push(b);
      }
      x += w;
    }
  }
  return merge(parts);
}

export function statue(): THREE.Group {
  // a little guardian owl carved from stone (original design)
  const g = new THREE.Group();
  const st = 0xc9c0ad;
  const body = gradient(at(blob(0.62, 3, 0.06, 3, 1.25), 0, 1.3, 0), 0xa59c88, 0xded6c2, 0.6, 2.1);
  const head = gradient(at(blob(0.5, 7, 0.05, 3, 0.9), 0, 2.1, 0.05), 0xb8af9a, 0xe8e0cc, 1.7, 2.6);
  const parts = [body, head, colorize(at(rbox(1.3, 0.6, 1.3, 0.12), 0, 0.3, 0), 0x9a907c)];
  for (const s of [-1, 1]) {
    parts.push(colorize(at(sphere(0.17, 12, 10), s * 0.2, 2.15, 0.45, 0, 0, 0, [1, 1, 0.5]), 0xf3efe2));
    parts.push(colorize(at(sphere(0.08, 10, 8), s * 0.2, 2.15, 0.52), 0x3a4a5a));
    parts.push(colorize(at(sphere(0.12, 8, 6), s * 0.32, 2.55, 0, 0, 0, s * 0.4, [0.7, 1.6, 0.7]), st));
    parts.push(colorize(at(blob(0.35, s + 4, 0.1, 2), s * 0.52, 1.35, 0, 0, 0, 0, [0.45, 1.1, 0.8]), 0xb3aa95));
  }
  parts.push(colorize(at(new THREE.ConeGeometry(0.08, 0.2, 8), 0, 2.02, 0.52, Math.PI / 2 + 0.4, 0, 0), 0xd9a64a));
  g.add(mesh(merge(parts), MAT.vcDetail));
  return g;
}

export function caveMouth(): THREE.Group {
  const g = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  const r = mulberry32(77);
  // arch of boulders around a dark hole
  for (let i = 0; i <= 9; i++) {
    const a = (i / 9) * Math.PI;
    const rr = 1.3 + r() * 0.5;
    parts.push(at(gradient(blob(rr, i * 3.3, 0.22, 2), 0x8f826c, 0xd2c3a2, -rr, rr), Math.cos(a) * 3.3, Math.sin(a) * 3.6 + 0.2, 0, 0, 0, 0, [1, 1, 1.2]));
  }
  for (let i = 0; i < 6; i++) parts.push(at(gradient(blob(2.4, 40 + i, 0.2, 2), 0x8f826c, 0xc8b998, -2, 2), (i - 2.5) * 2.6, 4.6 + r(), -1.8 - r()));
  parts.push(at(gradient(blob(1.2, 9, 0.3, 2), 0x4f8f2e, 0x8cc84c, -1, 1), -1.5, 5.6, 0.4, 0, 0, 0, [2.2, 0.5, 1.3]));
  g.add(mesh(merge(parts), MAT.vcDetail));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(3.1, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x07060c }));
  hole.position.set(0, 0.05, -0.4); g.add(hole);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3), new THREE.MeshBasicMaterial({ color: 0x07060c }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.06, -1.9); g.add(floor);
  return g;
}

export function pushBlock(): THREE.Group {
  const g = new THREE.Group();
  const b = gradient(at(rbox(1.9, 1.9, 1.9, 0.22, 4), 0, 0.95, 0), 0x9e9584, 0xd8cfba, 0, 1.9);
  g.add(mesh(b, MAT.vcDetail));
  // carved spiral rune on every side
  const rune: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 4; s++) {
    const t = at(new THREE.TorusGeometry(0.42, 0.06, 6, 24, Math.PI * 1.6), 0, 0.95, 0.97);
    rune.push(at(t, 0, 0, 0, 0, (s * Math.PI) / 2, 0));
  }
  g.add(mesh(merge(rune.map((x) => colorize(x, 0x6d7f8e)))));
  return g;
}
export function pressurePlate(): THREE.Group & { top: THREE.Object3D } {
  const g = new THREE.Group() as THREE.Group & { top: THREE.Object3D };
  g.add(mesh(colorize(at(rbox(2.4, 0.16, 2.4, 0.06), 0, 0.08, 0), 0x8a8170)));
  const top = mesh(colorize(at(rbox(1.9, 0.18, 1.9, 0.08), 0, 0.12, 0), 0x5f8fb5));
  g.add(top); g.top = top;
  return g;
}
export function gate(width: number): THREE.Group & { bars: THREE.Object3D } {
  const g = new THREE.Group() as THREE.Group & { bars: THREE.Object3D };
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) parts.push(gradient(at(rbox(1.0, 3.6, 1.0, 0.18), s * (width / 2 + 0.5), 1.8, 0), 0x9e9584, 0xd8cfba, 0, 3.6));
  parts.push(gradient(at(rbox(width + 2.2, 0.8, 1.1, 0.2), 0, 3.9, 0), 0xb0a690, 0xe0d7c2, 3.5, 4.3));
  g.add(mesh(merge(parts), MAT.vcDetail));
  const bars = new THREE.Group();
  const bp: THREE.BufferGeometry[] = [];
  const n = Math.round(width / 0.45);
  for (let i = 0; i < n; i++) bp.push(at(cyl(0.07, 0.07, 3.4, 8), -width / 2 + 0.25 + (i * (width - 0.5)) / (n - 1), 1.7, 0));
  bp.push(at(rbox(width, 0.16, 0.16, 0.05), 0, 2.6, 0)); bp.push(at(rbox(width, 0.16, 0.16, 0.05), 0, 0.6, 0));
  bars.add(mesh(merge(bp.map((x) => colorize(x, 0x6a6a72))), MAT.metal));
  g.add(bars); g.bars = bars;
  return g;
}
export function stairs(steps: number, w: number, rise: number, run: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < steps; i++) parts.push(colorize(at(rbox(w, rise * (i + 1), run, 0.06), 0, (rise * (i + 1)) / 2, -i * run), 0xcfc3a8, 0.18, i));
  return merge(parts);
}

/** The temple on the summit: round sanctum, columns, dome and a pedestal for the pearl. */
export function temple(): THREE.Group {
  const g = new THREE.Group();
  const base = gradient(lathe([[0, 0], [7.4, 0], [7.6, 0.4], [7.2, 0.6], [6.4, 0.65], [6.5, 1.0], [6.1, 1.2], [0, 1.2]], 40), 0xa49a85, 0xe2d8c2, 0, 1.2);
  g.add(mesh(base, MAT.vcDetail));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    if (Math.abs(Math.sin(a) - 1) < 0.05) continue;
    const p = pillar(4.2, false, 300 + i); p.position.set(Math.cos(a) * 5.2, 1.0, Math.sin(a) * 5.2); g.add(p);
  }
  // roof parts live in their own group so the game can lift them away while the hero is inside
  const roof = new THREE.Group(); roof.name = 'templeRoof';
  const ring = gradient(at(new THREE.TorusGeometry(5.2, 0.55, 10, 40), 0, 6.1, 0, Math.PI / 2, 0, 0), 0xcfc4ac, 0xece3cd, 5.6, 6.6);
  roof.add(mesh(ring, MAT.vcOcc));
  const dome = lathe([[5.4, 6.4], [5.0, 7.6], [3.9, 8.8], [2.2, 9.6], [0.6, 9.85], [0, 9.9]], 40);
  gradient(dome, 0x5f8fc8, 0x9fd0f0, 6.4, 9.9);
  roof.add(mesh(dome, MAT.vcOcc));
  roof.add(mesh(colorize(at(sphere(0.45, 16, 12), 0, 10.2, 0), 0xf3d36a), MAT.metal));
  g.add(roof);
  const ped = gradient(lathe([[0, 0], [0.9, 0], [0.7, 0.3], [0.5, 1.1], [0.75, 1.3], [0, 1.35]], 20), 0xa49a85, 0xe2d8c2, 0, 1.35);
  g.add(mesh(at(ped, 0, 1.2, 0), MAT.vcDetail));
  return g;
}

export function lanternPost(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(colorize(at(rbox(0.16, 2.2, 0.16, 0.05), 0, 1.1, 0), 0x5a3a22)));
  g.add(mesh(colorize(at(taperTube([V(0, 2.1, 0), V(0.3, 2.35, 0), V(0.55, 2.2, 0)], 0.05, 0.04, 6, 6), 0, 0, 0), 0x5a3a22)));
  const lamp = new THREE.Mesh(at(lathe([[0, 0], [0.16, 0.02], [0.2, 0.2], [0.14, 0.36], [0, 0.38]], 10), 0.55, 1.78, 0), MAT.glass);
  g.add(lamp);
  return g;
}
