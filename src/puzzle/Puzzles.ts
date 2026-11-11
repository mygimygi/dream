import * as THREE from 'three';
import { CollisionWorld, Collider } from '../world/Collision';
import { gate, pressurePlate, pushBlock, torch } from '../world/Props';
import { damp } from '../core/math';
import { events } from '../core/Events';

/** Grid-pushed stone block. Pushing = walking into it while facing it for a moment. */
export class PushBlock {
  obj: THREE.Group; col: Collider; target = new THREE.Vector3(); moving = false; pushT = 0;
  constructor(scene: THREE.Object3D, public cw: CollisionWorld, public x: number, public z: number, public groundAt: (x: number, z: number) => number, public id: string) {
    this.obj = pushBlock(); scene.add(this.obj);
    const y = groundAt(x, z);
    this.obj.position.set(x, y, z); this.target.copy(this.obj.position);
    this.col = cw.add({ kind: 'box', x, z, r: 1.4, hx: 0.95, hz: 0.95, rot: 0, y0: y - 1, y1: y + 1.9, solid: true, walkTop: true, active: true, tag: 'block' }, true);
  }
  setPos(x: number, z: number) { const y = this.groundAt(x, z); this.obj.position.set(x, y, z); this.target.copy(this.obj.position); this.col.x = x; this.col.z = z; this.col.y0 = y - 1; this.col.y1 = y + 1.9; }
  /** called each frame with the player's state; returns true when a push starts */
  tryPush(pp: THREE.Vector3, facing: THREE.Vector3, moving: boolean, dt: number, canMoveTo: (x: number, z: number) => boolean) {
    if (this.moving) return false;
    const dx = pp.x - this.col.x, dz = pp.z - this.col.z;
    const near = Math.abs(dx) < 1.55 && Math.abs(dz) < 1.55 && (Math.abs(dx) > 1.2 || Math.abs(dz) > 1.2);
    if (!near || !moving) { this.pushT = 0; return false; }
    // cardinal direction away from player
    let dir: [number, number] = Math.abs(dx) > Math.abs(dz) ? [-Math.sign(dx), 0] : [0, -Math.sign(dz)];
    if (facing.x * dir[0] + facing.z * dir[1] < 0.7) { this.pushT = 0; return false; }
    this.pushT += dt;
    if (this.pushT < 0.35) return false;
    this.pushT = 0;
    const nx = this.col.x + dir[0] * 2, nz = this.col.z + dir[1] * 2;
    if (!canMoveTo(nx, nz)) return false;
    this.moving = true; this.col.x = nx; this.col.z = nz;
    this.target.set(nx, this.groundAt(nx, nz), nz);
    events.emit('sfx', 'push');
    return true;
  }
  update(dt: number) {
    if (!this.moving) return;
    const p = this.obj.position;
    p.x = damp(p.x, this.target.x, 9, dt); p.z = damp(p.z, this.target.z, 9, dt); p.y = damp(p.y, this.target.y, 9, dt);
    if (p.distanceTo(this.target) < 0.02) { p.copy(this.target); this.moving = false; this.col.y0 = p.y - 1; this.col.y1 = p.y + 1.9; events.emit('dust', p.clone()); }
  }
}

export class Plate {
  obj: THREE.Group & { top: THREE.Object3D }; pressed = false;
  constructor(scene: THREE.Object3D, public x: number, public z: number, y: number) { this.obj = pressurePlate(); this.obj.position.set(x, y, z); scene.add(this.obj); }
  update(dt: number, blocks: PushBlock[]) {
    const was = this.pressed;
    this.pressed = blocks.some((b) => !b.moving && Math.abs(b.col.x - this.x) < 0.6 && Math.abs(b.col.z - this.z) < 0.6);
    this.obj.top.position.y = damp(this.obj.top.position.y, this.pressed ? -0.1 : 0, 12, dt);
    if (this.pressed && !was) events.emit('sfx', 'clank');
  }
}

export class Gate {
  obj: THREE.Group & { bars: THREE.Object3D }; open = false; private k = 0; col: Collider;
  constructor(scene: THREE.Object3D, cw: CollisionWorld, x: number, z: number, y: number, yaw: number, width: number, locked = false) {
    this.obj = gate(width); this.obj.position.set(x, y, z); this.obj.rotation.y = yaw; scene.add(this.obj);
    this.col = cw.box(x, z, width / 2 + 0.2, 0.35, -yaw, y - 2, y + 4, { tag: locked ? 'lockedDoor' : 'gate' });
    // side posts are always solid
    for (const s of [-1, 1]) cw.box(x + Math.cos(yaw) * s * (width / 2 + 0.5), z - Math.sin(yaw) * s * (width / 2 + 0.5), 0.55, 0.55, -yaw, y - 2, y + 4.5);
    if (locked) {
      // padlock plate for locked doors
      const lock = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16), new THREE.MeshStandardMaterial({ color: 0xe0b44c, metalness: 0.7, roughness: 0.3 }));
      lock.position.set(0, 1.5, 0.2); this.obj.bars.add(lock);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0xd8a83c, metalness: 0.6, roughness: 0.35 }));
      body.position.set(0, 1.2, 0.2); this.obj.bars.add(body);
    }
  }
  setOpen(o: boolean, instant = false) {
    if (o !== this.open && !instant) events.emit('sfx', 'door');
    this.open = o; this.col.active = !o; if (instant) this.k = o ? 1 : 0;
  }
  update(dt: number) { this.k = damp(this.k, this.open ? 1 : 0, 3, dt); this.obj.bars.position.y = -3.5 * this.k; this.obj.bars.visible = this.k < 0.98; }
}

export class TorchSet {
  torches: (THREE.Group & { flame: THREE.Sprite; lit: boolean })[] = [];
  lights: THREE.PointLight[] = [];
  constructor(scene: THREE.Object3D, cw: CollisionWorld, pts: [number, number][], y: number, lit = false) {
    for (const [x, z] of pts) {
      const t = torch(lit); t.position.set(x, y, z); scene.add(t); this.torches.push(t);
      cw.circle(x, z, 0.35, y - 1, y + 2.2);
      const l = new THREE.PointLight(0xffa860, lit ? 9 : 0, 11, 1.6); l.position.set(x, y + 2.1, z); scene.add(l); this.lights.push(l);
    }
  }
  light(i: number) { const t = this.torches[i]; if (t.lit) return false; t.lit = true; t.flame.visible = true; this.lights[i].intensity = 9; events.emit('sfx', 'torch'); return true; }
  allLit() { return this.torches.every((t) => t.lit); }
  nearest(p: THREE.Vector3, r: number) { let best = -1, bd = r; this.torches.forEach((t, i) => { const d = Math.hypot(t.position.x - p.x, t.position.z - p.z); if (d < bd) { bd = d; best = i; } }); return best; }
  update(time: number) {
    this.torches.forEach((t, i) => { if (!t.lit) return; const f = 1 + Math.sin(time * 17 + i * 3) * 0.07 + Math.sin(time * 6.1 + i) * 0.05; t.flame.scale.set(0.8 * f, 1.05 / f, 1); this.lights[i].intensity = 8 + Math.sin(time * 13 + i) * 1.2; });
  }
}
