import * as THREE from 'three';
import { toy } from '../render/Materials';
import { at, blob, colorize, cyl, gradient, lathe, merge, rbox, sphere, taperTube } from '../world/Geo';

/** Chibi humanoid with a proper joint hierarchy so it can be animated procedurally.
 *  Used for the hero and the villagers (different outfits/hair). */
export interface HumanoidLook {
  skin: number; hair: number; hairHi: number; shirt: number; tunic: number; tunicHi: number; pants: number; boots: number; gloves: number;
  scarf?: number; cape?: number; hairStyle: 'hero' | 'bob' | 'bald' | 'braids' | 'short'; beard?: number; hat?: 'none' | 'straw' | 'cap'; hatColor?: number; scale?: number;
  eye?: number; apron?: number; eyeScale?: number; lashes?: boolean; armor?: string;
}
export const HERO_LOOK: HumanoidLook = {
  skin: 0xffd2b0, hair: 0xa8482a, hairHi: 0xe07b45, shirt: 0xf6ead2, tunic: 0x2f9e94, tunicHi: 0x55c2b2, pants: 0x7a5236, boots: 0x6b3f24,
  gloves: 0xc99a62, scarf: 0xf08a3a, cape: 0x237a78, hairStyle: 'hero', eye: 0x3a2a24,
};

export interface Rig {
  root: THREE.Group; body: THREE.Group; hips: THREE.Group; torso: THREE.Group; head: THREE.Group; neck: THREE.Group;
  armL: THREE.Group; foreL: THREE.Group; handL: THREE.Group; armR: THREE.Group; foreR: THREE.Group; handR: THREE.Group;
  legL: THREE.Group; shinL: THREE.Group; footL: THREE.Group; legR: THREE.Group; shinR: THREE.Group; footR: THREE.Group;
  eyes: THREE.Object3D[]; lids: THREE.Object3D[]; eyeScale: number; mouth: THREE.Mesh; cape?: THREE.Group; scarfTail?: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
}

export function buildHumanoid(look: HumanoidLook): Rig {
  const mat = toy({ vertexColors: true, roughness: 0.5 }, { rim: 0.3, rimColor: 0xfff0dc, gloss: 0.75 });
  const skinMat = toy({ vertexColors: true, roughness: 0.45 }, { rim: 0.35, rimColor: 0xffd8c8, gloss: 0.6 });
  const materials = [mat, skinMat];
  const M = (g: THREE.BufferGeometry, m: THREE.Material = mat) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
  const G = () => new THREE.Group();

  const root = G(), body = G(), hips = G(), torso = G(), neck = G(), head = G();
  root.add(body); body.add(hips); hips.position.y = 0.6; hips.add(torso);

  // pelvis/shorts
  hips.add(M(merge([colorize(at(lathe([[0.0, -0.14], [0.2, -0.12], [0.24, 0.0], [0.23, 0.1], [0.0, 0.1]], 16), 0, 0, 0), look.pants)])));
  // torso: shirt core + tunic flare + belt
  const tunic = lathe([[0.0, 0.42], [0.17, 0.42], [0.21, 0.32], [0.22, 0.15], [0.26, -0.04], [0.29, -0.16], [0.27, -0.19], [0, -0.19]], 20);
  gradient(tunic, look.tunic, look.tunicHi, -0.19, 0.42);
  const torsoParts = [tunic, colorize(at(new THREE.TorusGeometry(0.235, 0.04, 8, 22), 0, 0.02, 0, Math.PI / 2, 0, 0), 0x5a3a22)];
  torsoParts.push(colorize(at(rbox(0.08, 0.07, 0.03, 0.015), 0, 0.02, 0.245), 0xe8c050));
  // collar / shirt peeking
  torsoParts.push(colorize(at(lathe([[0.0, 0.0], [0.13, 0.0], [0.15, 0.05], [0.0, 0.06]], 16), 0, 0.4, 0), look.shirt));
  if (look.apron) torsoParts.push(colorize(at(rbox(0.32, 0.42, 0.04, 0.03), 0, 0.05, 0.22), look.apron));
  torso.add(M(merge(torsoParts)));
  if (look.armor === 'leatherVest') {
    const v = lathe([[0.0, 0.36], [0.2, 0.36], [0.245, 0.25], [0.25, 0.08], [0.265, -0.05], [0.0, -0.05]], 20);
    torso.add(M(colorize(v, 0x9a6a3e, 0.15, 5)));
    torso.add(M(colorize(at(new THREE.TorusGeometry(0.25, 0.022, 6, 22), 0, 0.22, 0, Math.PI / 2, 0, 0), 0x5a3a22)));
  } else if (look.armor === 'shellArmor') {
    const v = lathe([[0.0, 0.38], [0.21, 0.38], [0.26, 0.26], [0.27, 0.08], [0.285, -0.06], [0.0, -0.06]], 22);
    gradient(v, 0xd8a090, 0xfff0e6, -0.06, 0.38);
    torso.add(M(v));
    for (let i = 0; i < 5; i++) torso.add(M(colorize(at(rbox(0.05, 0.38, 0.02, 0.02), Math.sin(-0.7 + i * 0.35) * 0.27, 0.15, Math.cos(-0.7 + i * 0.35) * 0.27, 0, -0.7 + i * 0.35, 0), 0xe8b8a8)));
    for (const sgn of [-1, 1]) torso.add(M(gradient(at(sphere(0.12, 14, 10), sgn * 0.27, 0.36, 0, 0, 0, sgn * 0.3, [1.1, 0.6, 1]), 0xd8a090, 0xfff0e6, 0.3, 0.42)));
  }
  // satchel strap
  if (look.scarf) {
    
    torso.add(M(merge([colorize(at(rbox(0.15, 0.13, 0.08, 0.035), -0.27, -0.1, 0.02, 0, -1.2, 0), 0x8a5a32), colorize(at(rbox(0.16, 0.05, 0.09, 0.02), -0.27, -0.04, 0.02, 0, -1.2, 0), 0x6b4226)])));
  }

  torso.add(neck); neck.position.y = 0.43; neck.add(head); head.position.y = 0.05;
  // head: slightly wide sphere
  const headR = 0.34;
  const skull = sphere(headR, 32, 24);
  at(skull, 0, headR * 0.92, 0, 0, 0, 0, [1.06, 0.95, 1.0]);
  colorize(skull, look.skin);
  head.add(M(skull, skinMat));
  // ears
  for (const s of [-1, 1]) head.add(M(colorize(at(sphere(0.07, 12, 10), s * 0.35, 0.3, -0.01, 0, 0, 0, [0.6, 1, 0.8]), look.skin), skinMat));
  // nose + cheeks
  head.add(M(colorize(at(sphere(0.035, 10, 8), 0, 0.25, headR * 0.99), look.skin), skinMat));
  for (const s of [-1, 1]) head.add(M(colorize(at(sphere(0.06, 12, 8), s * 0.17, 0.2, 0.28, 0, s * 0.5, 0, [1, 0.55, 0.3]), 0xff9a8a), skinMat));
  // eyes: dark oval + big highlight + small highlight; lids for blinking
  const eyes: THREE.Object3D[] = [], lids: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const e = G(); e.position.set(s * 0.13, 0.3, 0.285); e.rotation.y = s * 0.36;
    const iris = M(colorize(at(sphere(0.078, 18, 14), 0, 0, 0, 0, 0, 0, [0.8, 1.15, 0.42]), look.eye ?? 0x3a2a24));
    const shine = M(colorize(at(sphere(0.026, 8, 6), 0.018, 0.035, 0.03), 0xffffff));
    const shine2 = M(colorize(at(sphere(0.012, 6, 5), -0.02, -0.035, 0.03), 0xffffff));
    e.add(iris, shine, shine2);
    const es = look.eyeScale ?? 1; e.scale.set(es, es, es);
    if (look.lashes) for (const k of [-1, 0, 1]) e.add(M(colorize(at(rbox(0.016, 0.032, 0.012, 0.006), k * 0.035 - s * 0.01, 0.095, 0.022, 0, 0, k * 0.55 - s * 0.35), 0x2a1a14)));
    head.add(e); eyes.push(e);
    const lid = M(colorize(at(sphere(0.07, 14, 8, ), 0, 0, 0, 0, 0, 0, [0.9, 1.3, 0.5]), look.skin), skinMat);
    lid.position.copy(e.position); lid.position.z -= 0.004; lid.rotation.y = e.rotation.y; lid.scale.y = 0.01; lid.visible = false;
    head.add(lid); lids.push(lid);
    // eyebrow
    head.add(M(colorize(at(rbox(0.09, 0.022, 0.02, 0.01), s * 0.13, 0.43, 0.305, 0, s * 0.3, -s * 0.12), look.hair)));
  }
  const mouth = M(colorize(at(new THREE.TorusGeometry(0.032, 0.009, 6, 12, Math.PI), 0, 0.165, 0.315, Math.PI, 0, 0), 0x8a3a30));
  head.add(mouth);

  // hair
  const hairParts: THREE.BufferGeometry[] = [];
  const hr = headR * 1.07;
  if (look.hairStyle !== 'bald') {
    const cap = new THREE.SphereGeometry(hr, 30, 20, 0, Math.PI * 2, 0, Math.PI * 0.56);
    at(cap, 0, headR * 0.98, -0.03, -0.62, 0, 0, [1.07, 1.0, 1.04]);
    hairParts.push(cap);
    // back of head
    hairParts.push(at(sphere(hr * 0.97, 24, 18), 0, headR * 0.86, -0.085, 0, 0, 0, [1.04, 0.98, 0.92]));
  }
  if (look.hairStyle === 'hero') {
    // swept bangs: soft overlapping locks
    const locks = [[-0.21, 0.52, 0.2, 0.7], [-0.09, 0.58, 0.24, 0.35], [0.05, 0.6, 0.24, -0.1], [0.18, 0.56, 0.21, -0.55]];
    for (const [x, y, z, rz] of locks) hairParts.push(at(blob(0.1, x * 10 + 3, 0.08, 2), x, y, z, 0.9, 0, rz, [1.15, 0.5, 0.75]));
    // side locks framing the face
    for (const s of [-1, 1]) hairParts.push(at(blob(0.08, s * 5, 0.08, 2), s * 0.31, 0.24, 0.1, 0.15, 0, s * 0.15, [0.55, 1.5, 0.75]));
    // big bun + cowlick sprout
    hairParts.push(at(blob(0.16, 12, 0.08, 2), 0, 0.58, -0.26));
    hairParts.push(at(taperTube([new THREE.Vector3(0, 0.62, 0.05), new THREE.Vector3(0.03, 0.78, 0.0), new THREE.Vector3(0.12, 0.84, -0.06), new THREE.Vector3(0.16, 0.78, -0.08)], 0.045, 0.012, 10, 7), 0, 0, 0));
  } else if (look.hairStyle === 'short') {
    // short tousled crop: small tufts across the forehead and crown
    const tufts = [[-0.17, 0.57, 0.22, 0.6], [-0.05, 0.62, 0.25, 0.2], [0.08, 0.61, 0.24, -0.25], [0.19, 0.55, 0.2, -0.6], [0.0, 0.7, 0.08, 0], [-0.12, 0.68, -0.05, 0.4], [0.13, 0.67, -0.04, -0.4]];
    for (const [x, y, z, rz] of tufts) hairParts.push(at(blob(0.09, x * 13 + 1, 0.12, 2), x, y, z, 0.7, 0, rz, [1.05, 0.55, 0.8]));
    for (const sgn of [-1, 1]) hairParts.push(at(blob(0.07, sgn * 3, 0.08, 2), sgn * 0.31, 0.3, 0.06, 0, 0, sgn * 0.2, [0.5, 1.0, 0.8]));
  } else if (look.hairStyle === 'bob') {
    for (const s of [-1, 1]) hairParts.push(at(blob(0.15, s * 7, 0.1, 2), s * 0.27, 0.22, -0.04, 0, 0, s * 0.15, [0.75, 1.4, 1.1]));
    hairParts.push(at(blob(0.2, 33, 0.1, 2), 0, 0.5, 0.2, 0.6, 0, 0, [1.5, 0.6, 0.6]));
  } else if (look.hairStyle === 'braids') {
    hairParts.push(at(blob(0.2, 21, 0.1, 2), 0, 0.5, 0.2, 0.6, 0, 0, [1.5, 0.6, 0.6]));
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) hairParts.push(at(sphere(0.07 - i * 0.008, 10, 8), s * 0.28, 0.15 - i * 0.11, -0.12));
  }
  if (hairParts.length) {
    const hg = merge(hairParts);
    gradient(hg, look.hair, look.hairHi, 0.1, 0.8);
    head.add(M(hg));
  }
  if (look.beard) {
    const b = merge([at(blob(0.2, 4, 0.12, 2), 0, 0.08, 0.2, 0, 0, 0, [1.3, 1.2, 0.8]), at(blob(0.08, 8, 0.1, 2), 0, -0.1, 0.25)]);
    head.add(M(colorize(b, look.beard)));
    for (const s of [-1, 1]) head.add(M(colorize(at(blob(0.06, s, 0.1, 1), s * 0.07, 0.19, 0.32, 0, 0, s * 0.4, [1.4, 0.6, 0.6]), look.beard)));
  }
  if (look.hat === 'straw') {
    const h = lathe([[0, 0.24], [0.2, 0.22], [0.3, 0.0], [0.6, -0.04], [0.62, -0.08], [0.55, -0.07], [0.3, -0.05], [0, -0.05]], 28);
    gradient(h, 0xc9a35a, 0xf0d58a, -0.1, 0.25);
    head.add(M(at(h, 0, 0.62, -0.02, -0.12, 0, 0)));
    head.add(M(colorize(at(new THREE.TorusGeometry(0.27, 0.03, 6, 20), 0, 0.64, -0.02, Math.PI / 2 - 0.12, 0, 0), look.hatColor ?? 0xd04a3a)));
  } else if (look.hat === 'cap') {
    const h = lathe([[0, 0.25], [0.2, 0.22], [0.36, 0.05], [0.37, 0], [0, 0]], 24);
    head.add(M(colorize(at(h, 0, 0.55, -0.02, -0.2, 0, 0), look.hatColor ?? 0x4a7ac8)));
    head.add(M(colorize(at(sphere(0.06, 8, 6), 0, 0.82, -0.08), 0xffffff)));
  }

  // scarf + tail
  let scarfTail: THREE.Group | undefined;
  if (look.scarf) {
    torso.add(M(colorize(at(new THREE.TorusGeometry(0.17, 0.065, 10, 22), 0, 0.41, 0, Math.PI / 2 - 0.1, 0, 0), look.scarf)));
    scarfTail = G(); scarfTail.position.set(0.1, 0.39, -0.14);
    const tail = merge([at(rbox(0.12, 0.3, 0.04, 0.02), 0, -0.15, 0), at(rbox(0.12, 0.08, 0.06, 0.02), 0, -0.31, 0)]);
    scarfTail.add(M(colorize(tail, look.scarf)));
    torso.add(scarfTail);
  }
  // short cape
  let cape: THREE.Group | undefined;
  if (look.cape) {
    cape = G(); cape.position.set(0, 0.42, -0.12);
    const cg = new THREE.CylinderGeometry(0.2, 0.34, 0.5, 18, 4, true, Math.PI * 0.5, Math.PI);
    at(cg, 0, -0.25, 0.08);
    gradient(cg, look.cape, look.tunicHi, -0.5, 0);
    const cm = toy({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }, { rim: 0.15, gloss: 0 }) as THREE.MeshPhysicalMaterial;
    if ((cm as any).isMeshPhysicalMaterial) { cm.sheen = 0.8; cm.sheenRoughness = 0.6; cm.sheenColor = new THREE.Color(0xffffff); }
    materials.push(cm);
    const cmesh = new THREE.Mesh(cg, cm); cmesh.castShadow = true;
    cape.add(cmesh);
    // little hood bunched on the shoulders
    cape.add(M(colorize(at(new THREE.TorusGeometry(0.17, 0.06, 8, 18, Math.PI), 0, 0.0, 0.05, -Math.PI / 2 + 0.3, 0, Math.PI), look.cape)));
    torso.add(cape);
  }

  // arms
  const mkArm = (s: number) => {
    const sh = G(); sh.position.set(s * 0.25, 0.36, 0);
    const up = M(merge([colorize(at(sphere(0.085, 12, 10), 0, 0, 0), look.tunic), colorize(at(cyl(0.06, 0.055, 0.18, 10), 0, -0.1, 0), look.shirt)]));
    sh.add(up);
    const fore = G(); fore.position.y = -0.19; sh.add(fore);
    fore.add(M(merge([colorize(at(sphere(0.058, 10, 8), 0, 0, 0), look.shirt), colorize(at(cyl(0.055, 0.06, 0.13, 10), 0, -0.07, 0), look.gloves), colorize(at(new THREE.TorusGeometry(0.06, 0.02, 6, 12), 0, -0.04, 0, Math.PI / 2, 0, 0), look.gloves)])));
    const hand = G(); hand.position.y = -0.17; fore.add(hand);
    hand.add(M(colorize(at(sphere(0.068, 12, 10), 0, 0, 0, 0, 0, 0, [1, 1.05, 0.9]), look.gloves)));
    hand.add(M(colorize(at(sphere(0.03, 8, 6), -s * 0.05, 0.02, 0.04), look.gloves)));
    torso.add(sh);
    return { sh, fore, hand };
  };
  const L = mkArm(-1), R = mkArm(1);
  // legs
  const mkLeg = (s: number) => {
    const leg = G(); leg.position.set(s * 0.11, 0.0, 0);
    leg.add(M(colorize(at(cyl(0.075, 0.065, 0.24, 10), 0, -0.12, 0), look.pants)));
    const shin = G(); shin.position.y = -0.25; leg.add(shin);
    shin.add(M(merge([colorize(at(sphere(0.066, 10, 8), 0, 0, 0), look.pants), colorize(at(cyl(0.075, 0.07, 0.2, 12), 0, -0.13, 0), look.boots), colorize(at(new THREE.TorusGeometry(0.075, 0.025, 6, 14), 0, -0.04, 0, Math.PI / 2, 0, 0), look.boots)])));
    const foot = G(); foot.position.y = -0.27; shin.add(foot);
    foot.add(M(colorize(merge([at(sphere(0.09, 14, 10), 0, 0.03, 0.04, 0, 0, 0, [0.95, 0.7, 1.45]), at(rbox(0.16, 0.035, 0.24, 0.015), 0, -0.035, 0.035)]), look.boots)));
    hips.add(leg);
    return { leg, shin, foot };
  };
  const LL = mkLeg(-1), RL = mkLeg(1);

  if (look.scale) root.scale.setScalar(look.scale);
  return {
    root, body, hips, torso, head, neck, armL: L.sh, foreL: L.fore, handL: L.hand, armR: R.sh, foreR: R.fore, handR: R.hand,
    legL: LL.leg, shinL: LL.shin, footL: LL.foot, legR: RL.leg, shinR: RL.shin, footR: RL.foot, eyes, lids, eyeScale: look.eyeScale ?? 1, mouth, cape, scarfTail, materials,
  };
}

/** Coral-wood sword (hero's first weapon) — an original design. */
export function swordModel(tier = 1): THREE.Group {
  const g = new THREE.Group();
  const m = toy({ vertexColors: true, roughness: 0.45, metalness: tier > 1 ? 0.5 : 0.05 }, { rim: 0.35 });
  const bladeCol = tier === 3 ? 0xfff6e0 : tier > 1 ? 0xdfe9f2 : 0xf2d9b0;
  const s = new THREE.Shape();
  s.moveTo(-0.045, 0); s.lineTo(-0.05, 0.5); s.quadraticCurveTo(-0.04, 0.62, 0, 0.7); s.quadraticCurveTo(0.04, 0.62, 0.05, 0.5); s.lineTo(0.045, 0); s.lineTo(-0.045, 0);
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
  at(blade, 0, 0.1, -0.009);
  if (tier === 3) blade.scale(1.35, 1.25, 1.2);
  gradient(blade, tier === 3 ? 0xd8cdb0 : tier > 1 ? 0x9fb6c8 : 0xc99a62, bladeCol, 0.1, 0.9);
  const guard = colorize(at(rbox(tier === 3 ? 0.32 : 0.24, 0.05, 0.07, 0.02), 0, 0.09, 0), tier === 3 ? 0x2f9e94 : tier > 1 ? 0x3a6fc8 : 0xe0705a);
  const gem = colorize(at(sphere(0.03, 10, 8), 0, 0.09, 0.035), 0x7fe6d6);
  const grip = colorize(at(cyl(0.024, 0.026, 0.14, 8), 0, 0.0, 0), 0x6b3f24);
  const pommel = colorize(at(sphere(0.035, 10, 8), 0, -0.08, 0), 0xe0b44c);
  const mesh = new THREE.Mesh(merge([blade, guard, gem, grip, pommel]), m); mesh.castShadow = true;
  g.add(mesh);
  return g;
}
/** Round wooden shield with a spiral shell emblem — an original design. */
export function shieldModel(kind = 'shield'): THREE.Group {
  const g = new THREE.Group();
  const m = toy({ vertexColors: true, roughness: 0.55 }, { rim: 0.3 });
  const body = lathe([[0, 0.045], [0.18, 0.04], [0.24, 0.02], [0.25, -0.01], [0.23, -0.03], [0, -0.03]], 28);
  at(body, 0, 0, 0, Math.PI / 2, 0, 0);
  const turtle = kind === 'turtleShield';
  if (turtle) body.scale(1.18, 1.18, 1.4);
  gradient(body, turtle ? 0x3f7a3a : 0x2f7a98, turtle ? 0x8cc06a : 0x4fb0c8, -0.25, 0.25);
  const rim = colorize(at(new THREE.TorusGeometry(kind === 'turtleShield' ? 0.29 : 0.245, 0.026, 8, 30), 0, 0, 0.0), kind === 'turtleShield' ? 0x6a4a2a : 0xd8a24a);
  const parts: THREE.BufferGeometry[] = [body, rim];
  // shell emblem: spiral of shrinking beads
  if (turtle) {
    // hexagonal shell plates
    for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI * 2, r = i === 6 ? 0 : 0.15; parts.push(colorize(at(new THREE.CylinderGeometry(0.075, 0.08, 0.04, 6), Math.cos(a) * r, Math.sin(a) * r, 0.06, Math.PI / 2, 0, 0), 0xc8e09a)); }
  } else for (let i = 0; i < 16; i++) {
    const t = i / 16, a = t * Math.PI * 3.2, r = 0.13 * (1 - t * 0.8);
    parts.push(colorize(at(sphere(0.032 * (1 - t * 0.6), 8, 6), Math.cos(a) * r, Math.sin(a) * r, 0.045), 0xfff1d8));
  }
  const mesh = new THREE.Mesh(merge(parts), m); mesh.castShadow = true;
  g.add(mesh);
  return g;
}
