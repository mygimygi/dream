import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/math';

/** Third-person quarter-view rig: orbit yaw, limited pitch, smooth zoom, look-ahead,
 *  terrain-aware so it never dips into hills, plus trauma-based screen shake. */
export class CameraRig {
  yaw = 0; pitch = 0.8; dist = 19; targetDist = 19; targetYaw = 0; targetPitch = 0.8;
  target = new THREE.Vector3(); private look = new THREE.Vector3(); private ahead = new THREE.Vector3();
  trauma = 0; sensitivity = 1; minDist = 10; maxDist = 90;
  private lift = 0;
  constructor(public cam: THREE.PerspectiveCamera, private groundAt: (x: number, z: number) => number) {}
  orbit(dx: number, dy: number) { this.targetYaw -= dx * 0.005 * this.sensitivity; this.targetPitch = clamp(this.targetPitch + dy * 0.004 * this.sensitivity, 0.42, 1.25); }
  zoom(d: number) { this.targetDist = clamp(this.targetDist * (1 + d * 0.1), this.minDist, this.maxDist); }
  shake(a: number) { this.trauma = Math.min(1, this.trauma + a); }
  snap(p: THREE.Vector3) { this.target.copy(p); this.look.copy(p); this.yaw = this.targetYaw; this.pitch = this.targetPitch; this.dist = this.targetDist; this.update(0.016, p, new THREE.Vector3(), true); }
  update(dt: number, focus: THREE.Vector3, vel: THREE.Vector3, instant = false) {
    const k = instant ? 1000 : 1;
    this.ahead.set(vel.x, 0, vel.z).multiplyScalar(0.28);
    this.target.x = damp(this.target.x, focus.x + this.ahead.x, 6 * k, dt);
    this.target.z = damp(this.target.z, focus.z + this.ahead.z, 6 * k, dt);
    this.target.y = damp(this.target.y, focus.y, 4 * k, dt);
    this.yaw = dampAngle(this.yaw, this.targetYaw, 10 * k, dt);
    this.pitch = damp(this.pitch, this.targetPitch, 10 * k, dt);
    this.dist = damp(this.dist, this.targetDist, 8 * k, dt);
    const lookAt = this.look.copy(this.target).add(new THREE.Vector3(0, 0.9, 0));
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const off = new THREE.Vector3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).multiplyScalar(this.dist);
    const pos = lookAt.clone().add(off);
    // keep above terrain along the boom
    let need = 0;
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      const px = lookAt.x + off.x * t, pz = lookAt.z + off.z * t, py = lookAt.y + off.y * t;
      const g = this.groundAt(px, pz) + 1.1;
      if (g > py) need = Math.max(need, (g - py) / t);
    }
    this.lift = damp(this.lift, need, need > this.lift ? 14 : 3, dt);
    pos.y += this.lift;
    // shake
    const s = this.trauma * this.trauma;
    if (s > 0) {
      const t = performance.now() * 0.05;
      pos.x += Math.sin(t * 1.7) * s * 0.35; pos.y += Math.sin(t * 2.3) * s * 0.3; pos.z += Math.cos(t * 1.9) * s * 0.35;
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
    }
    this.cam.position.copy(pos);
    this.cam.lookAt(lookAt);
  }
  /** world -> screen direction helpers for camera-relative movement */
  forward(out: THREE.Vector3) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right(out: THREE.Vector3) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
}
