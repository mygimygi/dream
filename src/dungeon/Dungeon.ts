import * as THREE from 'three';
import { CollisionWorld } from '../world/Collision';
import { at, blob, colorize, gradient, merge, rbox } from '../world/Geo';
import { toy } from '../render/Materials';
import { mulberry32 } from '../core/math';
import { Gate, Plate, PushBlock, TorchSet } from '../puzzle/Puzzles';
import { mushroomModel } from '../world/PlantModels';
import { pillar } from '../world/Props';

/** 물빛 동굴 (Tide Cave): four rooms laid out north of an entrance, built far east of the island (x≈1000).
 *  A: torches → gate, B: push block on plate → gate, C: defeat all → small key chest, locked door → D: boss. */
export const DX = 1000;
export interface Room { x: number; z: number; hx: number; hz: number; name: string; }
export const ROOMS: Room[] = [
  { x: DX, z: 0, hx: 9, hz: 7, name: '입구의 방' },
  { x: DX, z: -20, hx: 9, hz: 7, name: '돌 굴리기 방' },
  { x: DX, z: -40, hx: 9, hz: 7, name: '나방의 방' },
  { x: DX, z: -66, hx: 13, hz: 11, name: '가시고둥의 방' },
];
export const DUNGEON_ENTRY = { x: DX, z: 5, yaw: Math.PI };

export class Dungeon {
  group = new THREE.Group();
  torchesA: TorchSet; gateA: Gate; gateB: Gate; doorC: Gate; plateB: Plate; blockB: PushBlock; exitPos = new THREE.Vector3(DX, 0, 7.2);
  ambient: THREE.Object3D[] = [];
  crystals: THREE.Mesh[] = [];
  constructor(scene: THREE.Scene, public col: CollisionWorld) {
    scene.add(this.group);
    const r = mulberry32(31);
    const wallMat = toy({ vertexColors: true, roughness: 0.85 }, { rim: 0.1, detail: 0.3, occlude: true });
    const floorMat = toy({ vertexColors: true, roughness: 0.8 }, { rim: 0.05, detail: 0.25 });
    const floors: THREE.BufferGeometry[] = [], walls: THREE.BufferGeometry[] = [];
    const tile = (x: number, z: number) => {
      const h = 0.25 + r() * 0.06;
      const c = new THREE.Color(0x5f8a92).lerp(new THREE.Color(0x7fa8a8), r()).multiplyScalar(0.9 + r() * 0.15);
      floors.push(colorize(at(rbox(1.94, h, 1.94, 0.12, 2), x, -h / 2, z), c.getHex(), 0.15, Math.floor(r() * 999)));
    };
    const corridor = (z0: number, z1: number) => {
      for (let z = z0; z > z1; z -= 2) for (const x of [-1, 1]) tile(DX + x, z - 1);
      for (const s of [-1, 1]) wallSeg(DX + s * 2.6, (z0 + z1) / 2, 0.6, Math.abs(z0 - z1) / 2, 1);
      col.box(DX, (z0 + z1) / 2, 2, Math.abs(z0 - z1) / 2 + 0.2, 0, -3, 0, { solid: false, walkTop: true });
    };
    const wallSeg = (cx: number, cz: number, hx: number, hz: number, low = 0) => {
      const len = Math.max(hx, hz) * 2, alongX = hx > hz;
      const n = Math.max(1, Math.round(len / 1.4));
      for (let row = 0; row < 3 - low; row++) for (let i = 0; i < n; i++) {
        const t = -len / 2 + (i + 0.5 + (row % 2) * 0.3) * (len / n);
        if (Math.abs(t) > len / 2) continue;
        const w = len / n - 0.08;
        const c = new THREE.Color(0x4a6a78).lerp(new THREE.Color(0x6a8a94), r()).getHex();
        const g = colorize(at(rbox(alongX ? w : 1.1, 1.05, alongX ? 1.1 : w, 0.22, 2), alongX ? cx + t : cx, 0.52 + row * 1.05, alongX ? cz : cz + t, 0, 0, (r() - 0.5) * 0.04), c, 0.2, i + row * 10);
        walls.push(g);
      }
      // moss tufts along the top
      if (!low) for (let t = -len / 2 + 1; t < len / 2 - 0.5; t += 2.2 + r() * 1.5) {
        const ms = 0.45 + r() * 0.3;
        walls.push(gradient(at(blob(ms, cx + cz + t, 0.25, 1), alongX ? cx + t : cx, 3 * 1.05 + 0.02, alongX ? cz : cz + t, 0, r() * 3, 0, [1.4, 0.35, 1.1]), 0x3f7a4a, 0x7aba5a, -0.2, 0.2));
      }
      col.box(cx, cz, hx, hz, 0, -3, 6);
    };
    ROOMS.forEach((rm, ri) => {
      for (let x = -rm.hx + 1; x < rm.hx; x += 2) for (let z = -rm.hz + 1; z < rm.hz; z += 2) tile(rm.x + x, rm.z + z);
      col.box(rm.x, rm.z, rm.hx, rm.hz, 0, -3, 0, { solid: false, walkTop: true });
      // walls with a 4-wide gap north (except last) and south
      const gapN = ri < ROOMS.length - 1, gapS = true;
      for (const [side, gap] of [[-1, gapN], [1, gapS]] as [number, boolean][]) {
        const z = rm.z + side * (rm.hz + 0.55);
        if (gap) { const seg = (rm.hx - 2) / 2; for (const s of [-1, 1]) wallSeg(rm.x + s * (2 + seg + 0.55), z, seg + 0.55, 0.55); }
        else wallSeg(rm.x, z, rm.hx + 1.1, 0.55);
      }
      for (const s of [-1, 1]) wallSeg(rm.x + s * (rm.hx + 0.55), rm.z, 0.55, rm.hz + 1.1);
      // corner pillars
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const p = pillar(3.6, false, ri * 4 + sx + sz * 2); p.position.set(rm.x + sx * (rm.hx - 1.1), 0, rm.z + sz * (rm.hz - 1.1)); this.group.add(p);
        col.circle(p.position.x, p.position.z, 0.75, -2, 5);
      }
      // glowing cave mushrooms and crystals along walls
      for (let k = 0; k < 8; k++) {
        const side = k % 4, t = (r() - 0.5) * 1.6;
        const x = rm.x + (side === 0 ? -rm.hx + 0.6 : side === 1 ? rm.hx - 0.6 : t * rm.hx);
        const z = rm.z + (side === 2 ? -rm.hz + 0.6 : side === 3 ? rm.hz - 0.6 : t * rm.hz);
        if (Math.abs(x - DX) < 2.8 && (side === 2 || side === 3)) continue;
        if (r() < 0.5) {
          const m = new THREE.Mesh(mushroomModel(0x3fc8e8, true), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x2fb8e0, emissiveIntensity: 0.7, roughness: 0.4 }));
          m.position.set(x, 0, z); m.scale.setScalar(1.2 + r()); this.group.add(m);
        } else {
          const cg = merge([0, 1, 2].map((i) => at(new THREE.OctahedronGeometry(0.3 + r() * 0.2, 0), (i - 1) * 0.25, 0.35 + r() * 0.3, (r() - 0.5) * 0.3, r(), r(), (i - 1) * 0.4, [0.6, 1.8, 0.6])));
          const cm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0x8fe8ff, emissive: 0x3fb0e8, emissiveIntensity: 1.3, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 }));
          cm.position.set(x, 0, z); this.group.add(cm); this.crystals.push(cm);
        }
      }
    });
    corridor(-7.0, -13.0); corridor(-27.0, -33.0); corridor(-47.0, -55.0);
    // entrance stairs/light shaft
    for (let i = 0; i < 2; i++) tile(DX + (i ? 1 : -1), 9);
    col.box(DX, 9, 2, 1.2, 0, -3, 0, { solid: false, walkTop: true });
    for (const s of [-1, 1]) wallSeg(DX + s * 2.6, 9, 0.6, 1.4, 0);
    wallSeg(DX, 10.6, 3.2, 0.5, 0);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 9, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    shaft.position.set(DX, 4.5, 8.4); this.group.add(shaft);

    const fm = new THREE.Mesh(merge(floors), floorMat); fm.receiveShadow = true; this.group.add(fm);
    const wm = new THREE.Mesh(merge(walls), wallMat); wm.castShadow = true; wm.receiveShadow = true; this.group.add(wm);
    // shallow water channels in room B and D (decor)
    const wmat = new THREE.MeshStandardMaterial({ color: 0x3fb8d8, emissive: 0x0f5a78, emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75 });
    for (const [x, z, w, d] of [[DX - 6.5, -20, 2.6, 12], [DX + 10, -66, 2.4, 18], [DX - 10, -66, 2.4, 18]]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), wmat); pl.rotation.x = -Math.PI / 2; pl.position.set(x, 0.02, z); this.group.add(pl);
    }

    // ---- puzzles ----
    const ga = (z: number) => z;
    this.torchesA = new TorchSet(this.group, col, [[DX - 4, -3.5], [DX + 4, -3.5]], 0, false);
    this.gateA = new Gate(this.group, col, DX, ga(-7.2), 0, 0, 3.6);
    this.blockB = new PushBlock(this.group, col, DX - 4, -18, () => 0, 'blockB');
    this.plateB = new Plate(this.group, DX + 4, -22, 0);
    this.gateB = new Gate(this.group, col, DX, -27.2, 0, 0, 3.6);
    this.doorC = new Gate(this.group, col, DX, -47.2, 0, 0, 3.6, true);
    // lit torches elsewhere for mood
    const deco = new TorchSet(this.group, col, [[DX - 7, -35], [DX + 7, -35], [DX - 11, -57], [DX + 11, -57], [DX - 11, -75], [DX + 11, -75]], 0, true);
    this.decoTorches = deco;
  }
  decoTorches: TorchSet;
  update(dt: number, time: number) {
    this.torchesA.update(time); this.decoTorches.update(time);
    this.gateA.update(dt); this.gateB.update(dt); this.doorC.update(dt);
    this.blockB.update(dt); this.plateB.update(dt, [this.blockB]);
    for (const c of this.crystals) c.rotation.y += dt * 0.2;
  }
  roomAt(x: number, z: number) { return ROOMS.findIndex((r) => Math.abs(x - r.x) <= r.hx + 0.5 && Math.abs(z - r.z) <= r.hz + 0.5); }
}
