import * as THREE from 'three';
import type { CollisionWorld } from '../world/Collision';
import { toy } from '../render/Materials';
import { at, blob, gradient, lathe, merge } from '../world/Geo';
import { roundTree, bushModel } from '../world/PlantModels';
import { pillar, MAT } from '../world/Props';
import { GROVE, SKY } from '../data/places';
import { mulberry32 } from '../core/math';

/** Boss arenas that live off-island (like the cave): the guardian's forest clearing and the sky garden. */
export function buildArenas(scene: THREE.Scene, col: CollisionWorld) {
  const r = mulberry32(5);
  const grove = new THREE.Group(); grove.visible = false; scene.add(grove);
  const R = 15;
  // mossy clearing floor with a raised rim
  const floor = lathe([[0, 0], [R, 0], [R + 1.5, 0.6], [R + 4, 2.2], [R + 10, 2.6], [R + 10, -2], [0, -2]], 48);
  gradient(floor, 0x4f8f35, 0x7cbf48, 0, 2.6);
  const fm = new THREE.Mesh(floor, toy({ vertexColors: true, roughness: 0.9 }, { detail: 0.3, gloss: 0 })); fm.receiveShadow = true;
  fm.position.set(GROVE.x, 0, GROVE.z); grove.add(fm);
  col.box(GROVE.x, GROVE.z, R + 2, R + 2, 0, -3, 0, { solid: false, walkTop: true });
  const trunkMat = toy({ vertexColors: true, roughness: 0.9 }, { gloss: 0, occlude: true }), leafMat = toy({ vertexColors: true, roughness: 0.75 }, { wind: 0.35, occlude: true, gloss: 0.1 });
  const tm = [0, 1, 2].map((i) => roundTree(500 + i * 7, [0x1f5a2a, 0x3f8f34, 0x6cb540]));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, d = R + 1 + r() * 2.5;
    const t = tm[i % 3]; const g = new THREE.Group();
    const a1 = new THREE.Mesh(t.trunk, trunkMat), a2 = new THREE.Mesh(t.leaves, leafMat); a1.castShadow = a2.castShadow = true; g.add(a1, a2);
    g.position.set(GROVE.x + Math.cos(a) * d, 0.5, GROVE.z + Math.sin(a) * d); g.scale.setScalar(1.2 + r() * 0.5); g.rotation.y = r() * 6; grove.add(g);
    col.circle(g.position.x, g.position.z, 1.2, -3, 8);
  }
  for (let i = 0; i < 12; i++) { const a = r() * Math.PI * 2, d = 8 + r() * 5; const b = new THREE.Mesh(bushModel(600 + i), MAT.vc); b.position.set(GROVE.x + Math.cos(a) * d, 0, GROVE.z + Math.sin(a) * d); b.scale.setScalar(0.9); grove.add(b); }
  // light shafts through the canopy
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 14, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xe8ffd0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); s.position.set(GROVE.x + (r() - 0.5) * 16, 7, GROVE.z + (r() - 0.5) * 16); s.rotation.z = 0.2; grove.add(s); }
  // exit marker (south)
  const exitStone = new THREE.Mesh(gradient(at(blob(0.6, 3, 0.2, 2), 0, 0.4, 0, 0, 0, 0, [1, 0.6, 1]), 0x8a8478, 0xc8c0b0, 0, 0.8), MAT.vcDetail); exitStone.position.set(GROVE.x, 0, GROVE.z + R - 1.5); grove.add(exitStone);

  // ---------------- sky garden ----------------
  const sky = new THREE.Group(); sky.visible = false; scene.add(sky);
  const SR = 16;
  const island = lathe([[0, -9], [4, -8], [10, -5], [SR + 0.5, -1.2], [SR + 1, 0], [SR, 0.25], [0, 0.25]], 56);
  const p = island.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); const col2 = y > 0.1 ? new THREE.Color(0xe8f0ff) : new THREE.Color(0xb8a890).lerp(new THREE.Color(0x8a7a68), Math.min(1, -y / 9)); c.set([col2.r, col2.g, col2.b], i * 3); }
  island.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const im = new THREE.Mesh(island, toy({ vertexColors: true, roughness: 0.8 }, { gloss: 0, detail: 0.2 })); im.receiveShadow = true; im.castShadow = true;
  im.position.set(SKY.x, 0, SKY.z); sky.add(im);
  // inlaid wind rune circle
  const rune = new THREE.Mesh(new THREE.RingGeometry(5.5, 6, 64), new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.6 })); rune.rotation.x = -Math.PI / 2; rune.position.set(SKY.x, 0.28, SKY.z); sky.add(rune);
  col.box(SKY.x, SKY.z, SR - 1, SR - 1, 0, -3, 0.25, { solid: false, walkTop: true });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const pl = pillar(4 + (i % 2) * 2, i % 3 === 0, 700 + i); pl.position.set(SKY.x + Math.cos(a) * (SR - 1.5), 0.2, SKY.z + Math.sin(a) * (SR - 1.5)); sky.add(pl); col.circle(pl.position.x, pl.position.z, 0.8, -3, 8); }
  // invisible rim so nobody falls off
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; col.circle(SKY.x + Math.cos(a) * (SR + 0.5), SKY.z + Math.sin(a) * (SR + 0.5), 1.4, -3, 10); }
  const clouds = new THREE.Group();
  const cm = toy({ color: 0xffffff, roughness: 1, emissive: 0x8090b0, emissiveIntensity: 0.3 }, { rim: 0.4 });
  for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = 24 + r() * 30; const cl = new THREE.Mesh(merge([0, 1, 2].map((k) => at(blob(2.5 + r() * 2, i * 3 + k, 0.1, 2), k * 3 - 3, r(), 0))), cm); cl.position.set(SKY.x + Math.cos(a) * d, -6 + r() * 10, SKY.z + Math.sin(a) * d); cl.scale.y = 0.55; clouds.add(cl); }
  sky.add(clouds);
  return { grove, sky, clouds };
}
