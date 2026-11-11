import * as THREE from 'three';
import { buildHumanoid, HumanoidLook } from './Humanoid';
import { HumanoidAnimator } from '../animation/HumanoidAnimator';
import { blobShadow } from '../render/BlobShadow';
import { dampAngle } from '../core/math';

const LOOKS: Record<string, HumanoidLook> = {
  elder: { skin: 0xf2c4a2, hair: 0xe8e4dc, hairHi: 0xffffff, shirt: 0xf3e6c8, tunic: 0x7a5aa8, tunicHi: 0x9a7ac8, pants: 0x5a4a6a, boots: 0x6a4a34, gloves: 0xf2c4a2, hairStyle: 'braids', hat: 'none', apron: 0xe8d8b0, scale: 0.92, eye: 0x3a2a24 },
  baker: { skin: 0xffd8b8, hair: 0x5a3422, hairHi: 0x8a5a3a, shirt: 0xffffff, tunic: 0xe86a5a, tunicHi: 0xf08a7a, pants: 0x6a4a3a, boots: 0x5a3a24, gloves: 0xffd8b8, hairStyle: 'bob', apron: 0xfff6e6, eye: 0x4a2a1a },
  fisher: { skin: 0xd8a080, hair: 0x3a2a20, hairHi: 0x5a4030, shirt: 0xe8eef6, tunic: 0x3a6aa8, tunicHi: 0x5a8ac8, pants: 0x4a4a5a, boots: 0x3a3a44, gloves: 0xd8a080, hairStyle: 'bald', beard: 0x5a4030, hat: 'straw', hatColor: 0x2f6aa8, scale: 1.08 },
  kid: { skin: 0xffd2b0, hair: 0xe0b04a, hairHi: 0xffd870, shirt: 0xffffff, tunic: 0x6ab84a, tunicHi: 0x8ad86a, pants: 0x4a6aa8, boots: 0xc04a3a, gloves: 0xffd2b0, hairStyle: 'bob', hat: 'cap', hatColor: 0xe8584a, scale: 0.8 },
};

export class NPC {
  rig; anim: HumanoidAnimator; pos: THREE.Vector3; yaw = 0; homeYaw = 0; talking = false; t = Math.random() * 10;
  constructor(scene: THREE.Scene, public id: string, public name: string, x: number, z: number, y: number) {
    this.rig = buildHumanoid(LOOKS[id] ?? LOOKS.baker);
    scene.add(this.rig.root);
    this.pos = new THREE.Vector3(x, y, z);
    this.rig.root.position.copy(this.pos);
    this.homeYaw = Math.atan2(0 - x, 22 - z);
    this.yaw = this.homeYaw;
    this.anim = new HumanoidAnimator(this.rig);
    const sh = blobShadow(0.6); sh.position.set(x, y + 0.04, z); scene.add(sh);
  }
  update(dt: number, player: THREE.Vector3) {
    this.t += dt;
    const d = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
    const target = d < 5 ? Math.atan2(player.x - this.pos.x, player.z - this.pos.z) : this.homeYaw;
    this.yaw = dampAngle(this.yaw, target, 5, dt);
    this.rig.root.rotation.y = this.yaw;
    const wave = !this.talking && d < 7 && d > 3 && Math.sin(this.t * 0.7) > 0.6;
    this.anim.update(dt, { speed: 0, maxSpeed: 1, grounded: true, vy: 0, turnRate: 0, action: this.talking ? 'talk' : wave ? 'wave' : 'none', actionT: this.t, combo: 0, landT: 1, dist: 0 });
  }
}
