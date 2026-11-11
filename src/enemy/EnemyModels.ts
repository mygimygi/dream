import * as THREE from 'three';
import { toy } from '../render/Materials';
import { at, blob, colorize, cyl, gradient, lathe, merge, rbox, sphere, taperTube } from '../world/Geo';

/** Original creature designs. Each returns a root plus named parts the AI animates. */
export interface CreatureModel { root: THREE.Group; body: THREE.Group; parts: Record<string, THREE.Object3D>; mats: THREE.MeshStandardMaterial[]; height: number; radius: number; }
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function mk() {
  const mat = toy({ vertexColors: true, roughness: 0.55 }, { rim: 0.3 });
  const M = (g: THREE.BufferGeometry, m: THREE.Material = mat) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
  return { mat, M };
}
function eyes(parent: THREE.Object3D, y: number, z: number, sep: number, r: number, angry = false) {
  const { M } = mk();
  const out: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * sep, y, z); e.rotation.y = s * 0.25;
    e.add(M(colorize(at(sphere(r, 14, 10), 0, 0, 0, 0, 0, 0, [1, 1.1, 0.6]), 0xffffff)));
    e.add(M(colorize(at(sphere(r * 0.62, 12, 10), 0, -r * 0.05, r * 0.35, 0, 0, 0, [1, 1.15, 0.6]), 0x24202a)));
    e.add(M(colorize(at(sphere(r * 0.2, 8, 6), r * 0.22, r * 0.3, r * 0.6), 0xffffff)));
    if (angry) e.add(M(colorize(at(rbox(r * 2.2, r * 0.35, r * 0.4, r * 0.1), 0, r * 0.95, r * 0.2, 0, 0, -s * 0.45), 0x3a2418)));
    parent.add(e); out.push(e);
  }
  return out;
}

/** 도토리딱정이: beetle wearing an acorn-cap shell. */
export function acornBeetle(): CreatureModel {
  const { mat, M } = mk();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 0.55;
  const belly = gradient(at(blob(0.55, 3, 0.04, 3, 0.85), 0, 0, 0), 0xc9925a, 0xf2d3a0, -0.5, 0.4);
  body.add(M(belly));
  // acorn cap: scaly dome
  const cap = lathe([[0, 0.62], [0.25, 0.58], [0.5, 0.42], [0.66, 0.15], [0.68, 0.02], [0.6, -0.05], [0, -0.04]], 26);
  const ca = new THREE.Color(0x8a5a2e), cb = new THREE.Color(0x5e3a1c), t = new THREE.Color();
  const p = cap.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = Math.sin(a * 14 + y * 18) * Math.sin(y * 22 - a * 7);
    t.copy(ca).lerp(cb, k > 0.2 ? 0.8 : 0.1);
    col.set([t.r, t.g, t.b], i * 3);
  }
  cap.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const capM = M(at(cap, 0, 0.12, -0.12, -0.35, 0, 0)); body.add(capM);
  body.add(M(colorize(at(taperTube([V(0, 0.72, -0.25), V(0.05, 0.9, -0.3), V(0.15, 0.95, -0.4)], 0.06, 0.03, 6, 6), 0, 0, 0), 0x5e3a1c)));
  // face
  const face = new THREE.Group(); body.add(face);
  const E = eyes(face, 0.08, 0.42, 0.17, 0.12);
  face.add(M(colorize(at(sphere(0.06, 8, 6), 0, -0.12, 0.5, 0, 0, 0, [1.4, 0.6, 0.6]), 0x6a3a2a)));
  for (const s of [-1, 1]) face.add(M(colorize(at(taperTube([V(s * 0.1, 0.32, 0.38), V(s * 0.22, 0.6, 0.5), V(s * 0.3, 0.7, 0.42)], 0.025, 0.015, 6, 5), 0, 0, 0), 0x4a2c18)));
  for (const s of [-1, 1]) face.add(M(colorize(at(sphere(0.05, 8, 6), s * 0.3, 0.7, 0.42), 0xf2c94c)));
  // legs
  const legs: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1, k = i % 3;
    const leg = new THREE.Group(); leg.position.set(s * 0.42, -0.22, 0.25 - k * 0.25);
    leg.add(M(colorize(at(taperTube([V(0, 0, 0), V(s * 0.2, -0.05, 0), V(s * 0.25, -0.3, 0)], 0.05, 0.035, 5, 5), 0, 0, 0), 0x3f2a18)));
    body.add(leg); legs.push(leg);
  }
  return { root, body, parts: { cap: capM, face, eyeL: E[0], eyeR: E[1], legs: legs as any }, mats: [mat], height: 1.3, radius: 0.65 };
}

/** 버섯꼬마: hopping mushroom imp that puffs spores. */
export function shroomling(): CreatureModel {
  const { mat, M } = mk();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 0.0;
  const stem = gradient(lathe([[0, 0.05], [0.32, 0.05], [0.38, 0.2], [0.34, 0.55], [0.28, 0.75], [0, 0.78]], 18), 0xe8dcc0, 0xfff6e2, 0, 0.8);
  body.add(M(stem));
  const capG = new THREE.Group(); capG.position.y = 0.7; body.add(capG);
  const cap = lathe([[0, -0.05], [0.55, -0.02], [0.72, 0.08], [0.7, 0.22], [0.55, 0.42], [0.3, 0.56], [0, 0.6]], 24);
  const red = new THREE.Color(0x7a4ac8), spot = new THREE.Color(0xfff0ff);
  const cp = cap.attributes.position, cc = new Float32Array(cp.count * 3);
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
    const s = Math.sin(x * 9 + 1) * Math.sin(z * 9) * Math.sin(y * 12 + 2);
    const c = y < 0.0 ? new THREE.Color(0xe8d8b8) : s > 0.35 ? spot : red.clone().lerp(new THREE.Color(0xa070f0), y);
    cc.set([c.r, c.g, c.b], i * 3);
  }
  cap.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  capG.add(M(cap));
  const E = eyes(body, 0.45, 0.3, 0.13, 0.1, true);
  body.add(M(colorize(at(new THREE.TorusGeometry(0.05, 0.015, 6, 10, Math.PI), 0, 0.28, 0.35, 0, 0, Math.PI), 0x6a3a3a)));
  const feet: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const f = M(colorize(at(sphere(0.13, 10, 8), 0, 0, 0.05, 0, 0, 0, [1, 0.6, 1.3]), 0x8a6aa0)); f.position.set(s * 0.18, 0.06, 0); body.add(f); feet.push(f); }
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const a = M(colorize(at(sphere(0.08, 8, 6), 0, 0, 0, 0, 0, 0, [1, 1.4, 1]), 0xf0e2c8)); a.position.set(s * 0.38, 0.38, 0.05); body.add(a); arms.push(a); }
  return { root, body, parts: { cap: capG, eyeL: E[0], eyeR: E[1], footL: feet[0], footR: feet[1], armL: arms[0], armR: arms[1] }, mats: [mat], height: 1.35, radius: 0.6 };
}

/** 소라게: hermit crab with a spiral shell. */
export function hermitCrab(): CreatureModel {
  const { mat, M } = mk();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 0.35;
  body.add(M(gradient(at(blob(0.42, 5, 0.05, 3, 0.7), 0, 0, 0.1), 0xd8553a, 0xf48a62, -0.3, 0.3)));
  // spiral shell from stacked tori
  const shell: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 12, r = 0.5 * (1 - t * 0.85);
    shell.push(at(sphere(r, 16, 12), 0, 0.35 + t * 0.75, -0.25 - t * 0.2 + Math.sin(t * 6) * 0.05, 0, t * 4, 0, [1, 0.75, 1]));
  }
  const sg = merge(shell);
  const sa = new THREE.Color(0xf3d9b8), sb = new THREE.Color(0xc98a6a), tc = new THREE.Color();
  const sp = sg.attributes.position, scol = sg.attributes.color;
  for (let i = 0; i < sp.count; i++) { const k = Math.sin(sp.getY(i) * 26 + Math.atan2(sp.getZ(i) + 0.3, sp.getX(i)) * 2) > 0.3 ? 1 : 0; tc.copy(sa).lerp(sb, k * 0.7); scol.setXYZ(i, tc.r, tc.g, tc.b); }
  const shellM = M(sg); body.add(shellM);
  const E: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const st = new THREE.Group(); st.position.set(s * 0.14, 0.15, 0.38); body.add(st);
    st.add(M(colorize(at(cyl(0.03, 0.035, 0.3, 6), 0, 0.15, 0), 0xd8553a)));
    const e = new THREE.Group(); e.position.y = 0.33; st.add(e);
    e.add(M(colorize(at(sphere(0.085, 12, 10), 0, 0, 0), 0xffffff)));
    e.add(M(colorize(at(sphere(0.05, 10, 8), 0, 0, 0.055), 0x1a1820)));
    E.push(st);
  }
  const claws: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Group(); c.position.set(s * 0.42, 0.0, 0.32); body.add(c);
    c.add(M(colorize(at(cyl(0.05, 0.06, 0.25, 6), 0, 0, 0.1, Math.PI / 2, 0, 0), 0xd8553a)));
    const pincer = merge([at(sphere(0.17, 12, 10), 0, 0, 0.3, 0, 0, 0, [0.8, 0.7, 1.2]), at(sphere(0.08, 8, 6), s * 0.06, 0.07, 0.48, 0, 0, 0, [0.7, 0.6, 1.4])]);
    c.add(M(gradient(pincer, 0xc8402a, 0xff8a62, -0.1, 0.2)));
    claws.push(c);
  }
  const legs: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1, k = i % 3;
    const l = new THREE.Group(); l.position.set(s * 0.3, -0.05, 0.1 - k * 0.2);
    l.add(M(colorize(at(taperTube([V(0, 0, 0), V(s * 0.25, 0.08, 0), V(s * 0.38, -0.3, 0)], 0.04, 0.025, 5, 5), 0, 0, 0), 0xd8553a)));
    body.add(l); legs.push(l);
  }
  return { root, body, parts: { shell: shellM, eyeL: E[0], eyeR: E[1], clawL: claws[0], clawR: claws[1], legs: legs as any }, mats: [mat], height: 1.2, radius: 0.7 };
}

/** 등불나방: fluffy moth with a glowing belly lantern (cave). */
export function lanternMoth(): CreatureModel {
  const { mat, M } = mk();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 1.6;
  body.add(M(gradient(at(blob(0.3, 2, 0.15, 2, 1.1), 0, 0, 0), 0x6a5a8a, 0xb8a8e0, -0.3, 0.3)));
  const glow = new THREE.Mesh(at(sphere(0.2, 14, 10), 0, -0.25, -0.15, 0, 0, 0, [1, 1.2, 1]), new THREE.MeshStandardMaterial({ color: 0x9ff0ff, emissive: 0x6fe0ff, emissiveIntensity: 2.2 }));
  body.add(glow);
  const E = eyes(body, 0.05, 0.24, 0.11, 0.09);
  for (const s of [-1, 1]) body.add(M(colorize(at(taperTube([V(s * 0.06, 0.22, 0.15), V(s * 0.2, 0.45, 0.25), V(s * 0.32, 0.5, 0.1)], 0.02, 0.01, 6, 4), 0, 0, 0), 0x3a3048)));
  const wings: THREE.Object3D[] = [];
  const wm = toy({ color: 0xd8c8f8, side: THREE.DoubleSide, roughness: 0.5, transparent: true, opacity: 0.92 }, { rim: 0.5 });
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.15, 0.1, -0.05);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(s * 0.4, 0.5, s * 0.9, 0.35, s * 0.8, -0.05); shape.bezierCurveTo(s * 0.7, -0.3, s * 0.3, -0.35, 0, 0);
    const w = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), wm); w.rotation.x = -Math.PI / 2 + 0.3;
    piv.add(w); body.add(piv); wings.push(piv);
  }
  return { root, body, parts: { wingL: wings[0], wingR: wings[1], glow, eyeL: E[0], eyeR: E[1] }, mats: [mat], height: 2.0, radius: 0.55 };
}

/** 가시고둥왕: giant spiked conch snail (dungeon boss). */
export function conchKing(): CreatureModel {
  const { mat, M } = mk();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // soft foot/body
  const foot = gradient(at(blob(1.6, 8, 0.05, 3, 0.45), 0, 0.55, 0.3, 0, 0, 0, [1, 1, 1.5]), 0x5fae9a, 0x9fe0c8, 0, 1.2);
  body.add(M(foot));
  const head = new THREE.Group(); head.position.set(0, 1.1, 1.8); body.add(head);
  head.add(M(gradient(at(blob(0.9, 3, 0.05, 3), 0, 0, 0, 0, 0, 0, [1.2, 0.9, 1]), 0x6fbfa8, 0xbff0dc, -0.7, 0.8)));
  const stalks: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const st = new THREE.Group(); st.position.set(s * 0.45, 0.5, 0.2); head.add(st);
    st.add(M(colorize(at(taperTube([V(0, 0, 0), V(s * 0.1, 0.5, 0.05), V(s * 0.15, 0.9, 0.1)], 0.12, 0.08, 8, 8), 0, 0, 0), 0x7fcfb8)));
    const e = new THREE.Group(); e.position.set(s * 0.15, 1.0, 0.12); st.add(e);
    e.add(M(colorize(at(sphere(0.26, 16, 12), 0, 0, 0), 0xfffbe8)));
    e.add(M(colorize(at(sphere(0.15, 12, 10), 0, 0, 0.16), 0x2a1838)));
    e.add(M(colorize(at(sphere(0.05, 8, 6), 0.05, 0.06, 0.28), 0xffffff)));
    e.add(M(colorize(at(rbox(0.5, 0.1, 0.12, 0.04), 0, 0.24, 0.14, 0, 0, -s * 0.35), 0x2f5a50)));
    stalks.push(st);
  }
  head.add(M(colorize(at(new THREE.TorusGeometry(0.22, 0.05, 8, 14, Math.PI), 0, -0.25, 0.85, 0, 0, Math.PI), 0x2f3a3a)));
  // the great conch shell with spikes
  const shellG = new THREE.Group(); shellG.position.set(0, 1.4, -0.5); body.add(shellG);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 16, r = 1.7 * (1 - t * 0.82);
    const a = t * Math.PI * 3.2;
    parts.push(at(sphere(r, 22, 16), Math.cos(a) * 0.35 * (1 - t), t * 2.8, Math.sin(a) * 0.35 * (1 - t) - t * 0.5, 0, a, 0, [1, 0.72, 1]));
    if (i % 2 === 0 && i < 14) for (let k = 0; k < 6; k++) {
      const b = (k / 6) * Math.PI * 2 + i;
      const cone = at(new THREE.ConeGeometry(0.16 * (1 - t * 0.6), 0.7 * (1 - t * 0.5), 8), 0, 0, 0);
      const dir = V(Math.cos(b), 0.35, Math.sin(b)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
      cone.applyQuaternion(q);
      parts.push(at(cone, Math.cos(b) * r * 0.95, t * 2.8 + 0.1, Math.sin(b) * r * 0.95 - t * 0.5));
    }
  }
  const sg = merge(parts);
  const sa = new THREE.Color(0xf6d8c0), sb = new THREE.Color(0xd86a7a), sc = new THREE.Color(0x8a4a7a), tc = new THREE.Color();
  const pp = sg.attributes.position, pc = sg.attributes.color;
  for (let i = 0; i < pp.count; i++) {
    const y = pp.getY(i), x = pp.getX(i), z = pp.getZ(i);
    const band = Math.sin(y * 9 + Math.atan2(z, x) * 1.0);
    tc.copy(sa).lerp(sb, band > 0.3 ? 0.75 : 0.1);
    if (Math.hypot(x, z) > 1.85 - y * 0.45) tc.lerp(sc, 0.6);
    pc.setXYZ(i, tc.r, tc.g, tc.b);
  }
  const shellM = M(sg); shellG.add(shellM);
  return { root, body, parts: { head, shell: shellG, stalkL: stalks[0], stalkR: stalks[1] }, mats: [mat], height: 5, radius: 2.1 };
}

export function exclaim(): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 64; c.height = 96;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff'; x.strokeStyle = '#3a2a20'; x.lineWidth = 8;
  x.beginPath(); x.roundRect(8, 4, 48, 88, 22); x.fill(); x.stroke();
  x.fillStyle = '#e8484a'; x.fillRect(26, 18, 12, 40); x.beginPath(); x.arc(32, 74, 7, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(0.45, 0.68, 1); s.renderOrder = 10; s.visible = false;
  return s;
}
