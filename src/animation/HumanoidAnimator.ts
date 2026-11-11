import * as THREE from 'three';
import { Rig } from '../character/Humanoid';
import { clamp, damp, smoothstep } from '../core/math';
import { ATTACKS, JUMP_ATTACK, ROLL_TIME } from '../combat/AttackTable';

export type AnimAction = 'none' | 'attack' | 'jumpAttack' | 'roll' | 'guard' | 'hit' | 'dead' | 'itemGet' | 'interact' | 'talk' | 'wave' | 'sit';
export interface AnimInput {
  speed: number; maxSpeed: number; grounded: boolean; vy: number; turnRate: number;
  action: AnimAction; actionT: number; combo: number; landT: number; dist: number; guardW?: number;
}

type J = { x: number; y: number; z: number };
const JOINTS = ['hips', 'torso', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR'] as const;
type JointName = typeof JOINTS[number];
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = (t: number) => clamp(t) * clamp(t);

/** Procedural animator: builds a target pose every frame from layered cycles and action curves,
 *  then blends toward it with critically-damped smoothing so state changes never pop. */
export class HumanoidAnimator {
  private cur: Record<string, J> = {};
  private tgt: Record<string, J> = {};
  hipsY = 0.6; private hipsYcur = 0.6; bodySpin = 0; bodyFlip = 0;
  private blinkT = 2; private time = 0; private phase = 0; private lastDist = 0;
  constructor(public rig: Rig) {
    for (const j of JOINTS) { this.cur[j] = { x: 0, y: 0, z: 0 }; this.tgt[j] = { x: 0, y: 0, z: 0 }; }
    rig.armL.rotation.order = 'YXZ'; rig.armR.rotation.order = 'YXZ';
    rig.hips.rotation.order = 'YXZ'; rig.torso.rotation.order = 'YXZ';
  }
  private set(j: JointName, x = 0, y = 0, z = 0) { const t = this.tgt[j]; t.x = x; t.y = y; t.z = z; }
  private add(j: JointName, x = 0, y = 0, z = 0) { const t = this.tgt[j]; t.x += x; t.y += y; t.z += z; }

  update(dt: number, s: AnimInput) {
    this.time += dt;
    const r = this.rig;
    for (const j of JOINTS) this.set(j);
    const speedN = clamp(s.speed / Math.max(0.01, s.maxSpeed));
    const runW = smoothstep(0.55, 0.9, speedN);
    // phase advances with distance travelled => no foot sliding
    const stride = 1.0 + runW * 0.55;
    this.phase += ((s.dist - this.lastDist) / stride) * Math.PI;
    this.lastDist = s.dist;
    const ph = this.phase;
    const moveW = smoothstep(0.05, 0.35, speedN);
    let hipsY = 0.6, lambda = 16, spin = 0, flip = 0;

    // ---- base locomotion layer ----
    const breathe = Math.sin(this.time * 2.2);
    this.set('torso', 0.03 + breathe * 0.015, 0, 0);
    this.set('head', -0.04 + breathe * 0.02, Math.sin(this.time * 0.6) * 0.08 * (1 - moveW), 0);
    this.set('armL', 0.05, 0, -0.12); this.set('armR', 0.05, 0, 0.12);
    this.set('foreL', -0.15); this.set('foreR', -0.25); this.set('handR', 0.35);
    if (moveW > 0) {
      const amp = 0.55 + runW * 0.35;
      const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
      this.add('legL', -sL * amp * moveW); this.add('legR', -sR * amp * moveW);
      this.add('shinL', Math.max(0, Math.cos(ph)) * (0.7 + runW * 0.6) * moveW);
      this.add('shinR', Math.max(0, Math.cos(ph + Math.PI)) * (0.7 + runW * 0.6) * moveW);
      this.add('footL', sL * 0.25 * moveW); this.add('footR', sR * 0.25 * moveW);
      this.add('armL', sL * (0.55 + runW * 0.5) * moveW, 0, -0.05 * runW);
      this.add('armR', sR * (0.55 + runW * 0.5) * moveW, 0, 0.05 * runW);
      this.add('foreL', -0.4 * runW); this.add('foreR', -0.5 * runW);
      this.add('torso', 0.12 * moveW + 0.18 * runW, Math.sin(ph) * 0.12 * moveW, -s.turnRate * 0.06);
      this.add('hips', 0, -Math.sin(ph) * 0.1 * moveW, 0);
      hipsY += Math.abs(Math.cos(ph)) * (0.035 + 0.05 * runW) * moveW - 0.03 * runW;
      this.add('head', -0.08 * runW, 0, s.turnRate * 0.05);
    }
    // ---- airborne ----
    if (!s.grounded) {
      const up = clamp(s.vy / 6, -1, 1);
      this.set('legL', -0.9 + up * 0.2, 0, -0.08); this.set('shinL', 1.3);
      this.set('legR', 0.25, 0, 0.08); this.set('shinR', 0.5 - up * 0.2);
      this.set('armL', -0.4 - up * 0.6, 0, -0.7); this.set('armR', -0.4 - up * 0.6, 0, 0.7);
      this.set('foreL', -0.6); this.set('foreR', -0.6);
      this.add('torso', 0.1);
      lambda = 12;
    }
    // ---- landing squash ----
    const land = s.landT < 0.25 ? 1 - s.landT / 0.25 : 0;
    if (land > 0 && s.grounded) {
      hipsY -= 0.12 * land;
      this.add('shinL', 0.6 * land); this.add('shinR', 0.6 * land);
      this.add('legL', -0.35 * land); this.add('legR', -0.35 * land);
      this.add('torso', 0.25 * land);
    }

    // ---- action layer ----
    const t = s.actionT;
    switch (s.action) {
      case 'attack': {
        const a = ATTACKS[s.combo] ?? ATTACKS[0];
        const n = t / a.dur;
        lambda = 40;
        const wind = 0.22, sw = clamp((n - wind) / 0.35);
        const e = ease(sw);
        this.set('legL', -0.45, 0, -0.05); this.set('shinL', 0.45); this.set('legR', 0.35, 0, 0.05); this.set('shinR', 0.25);
        hipsY = 0.53;
        this.set('armL', -0.2, 0, -0.7); this.set('foreL', -0.6);
        if (a.name === 'slashA') {
          const yaw = n < wind ? 1.5 * ease(n / wind) : 1.5 - 3.0 * e;
          this.set('armR', -1.45, yaw, 0); this.set('foreR', -0.1); this.set('handR', 1.55);
          this.set('torso', 0.2, yaw * 0.45, 0);
        } else if (a.name === 'slashB') {
          const yaw = n < wind ? -1.3 * ease(n / wind) : -1.3 + 2.9 * e;
          this.set('armR', -1.35, yaw, 0); this.set('foreR', -0.15); this.set('handR', 1.55);
          this.set('torso', 0.2, yaw * 0.45, 0);
        } else {
          this.set('armR', -1.5, 1.4, 0.1); this.set('handR', 1.55); this.set('foreR', 0);
          this.set('armL', -0.2, 0, -1.2);
          spin = n < wind ? -0.6 * ease(n / wind) : -0.6 + (Math.PI * 2 + 0.6) * e;
          hipsY = 0.48;
        }
        if (n > 0.78) { /* recover blends via damping */ }
        break;
      }
      case 'jumpAttack': {
        const n = t / JUMP_ATTACK.dur; lambda = 40;
        const e = ease((n - 0.15) / 0.35);
        this.set('armR', -3.0 + 2.5 * e, 0, 0.1); this.set('handR', 1.55);
        this.set('armL', -2.4 + 1.6 * e, 0, -0.3);
        this.set('torso', -0.3 + 0.8 * e); this.set('legL', -1.0 + 0.6 * e); this.set('shinL', 1.2); this.set('legR', -0.2); this.set('shinR', 0.8);
        flip = n < 0.4 ? -0.25 * easeIn(n / 0.4) : 0;
        break;
      }
      case 'roll': {
        const n = clamp(t / ROLL_TIME);
        lambda = 40;
        flip = Math.PI * 2 * ease(n);
        hipsY = 0.62 - Math.sin(n * Math.PI) * 0.3;
        const tuck = Math.sin(clamp(n * 1.2) * Math.PI);
        this.set('legL', -1.6 * tuck); this.set('shinL', 2.2 * tuck); this.set('legR', -1.5 * tuck); this.set('shinR', 2.2 * tuck);
        this.set('armL', -1.2 * tuck, 0, -0.3); this.set('armR', -1.2 * tuck, 0, 0.3); this.set('foreL', -1.4 * tuck); this.set('foreR', -1.4 * tuck);
        this.set('torso', 0.6 * tuck); this.set('head', 0.4 * tuck);
        break;
      }
      case 'guard': {
        const w = s.guardW ?? 1;
        this.add('armL', (-1.25 - this.tgt.armL.x) * w, (0.65 - this.tgt.armL.y) * w, (-0.15 - this.tgt.armL.z) * w);
        this.add('foreL', (-1.0 - this.tgt.foreL.x) * w);
        this.add('armR', (0.3 - this.tgt.armR.x) * w, 0, 0.35 * w);
        this.add('torso', 0.15 * w); hipsY -= 0.06 * w;
        if (moveW < 0.1) { this.set('legL', -0.35, 0, -0.1); this.set('shinL', 0.35); this.set('legR', 0.3, 0, 0.1); this.set('shinR', 0.2); }
        break;
      }
      case 'hit': {
        const k = Math.sin(clamp(t / 0.42) * Math.PI);
        lambda = 30;
        this.set('torso', -0.45 * k, 0, 0.1 * k); this.set('head', -0.35 * k);
        this.set('armL', -0.5 * k, 0, -1.0 * k); this.set('armR', -0.5 * k, 0, 1.0 * k);
        this.set('legL', -0.3 * k); this.set('shinL', 0.4 * k);
        hipsY -= 0.05 * k;
        break;
      }
      case 'dead': {
        const n = ease(t / 0.8);
        lambda = 10;
        flip = -1.45 * n; hipsY = 0.6 - 0.38 * n;
        this.set('armL', -0.3, 0, -1.3); this.set('armR', -0.3, 0, 1.3); this.set('legL', -0.2, 0, -0.2); this.set('legR', 0.1, 0, 0.2);
        this.set('head', 0.2, 0.4, 0);
        break;
      }
      case 'itemGet': {
        const n = ease(t / 0.35);
        this.set('armL', -2.85 * n, 0, -0.35 * n); this.set('armR', -2.85 * n, 0, 0.35 * n);
        this.set('foreL', -0.2); this.set('foreR', -0.2); this.set('handR', 0);
        this.set('torso', -0.12 * n); this.set('head', -0.25 * n);
        this.set('legL', 0, 0, -0.12); this.set('legR', 0, 0, 0.12);
        hipsY = 0.6 + 0.02 * Math.sin(this.time * 6);
        break;
      }
      case 'interact': {
        const k = Math.sin(clamp(t / 0.5) * Math.PI);
        this.set('armR', -1.3 * k, -0.2, 0.2); this.set('armL', -1.3 * k, 0.2, -0.2); this.set('torso', 0.2 * k);
        break;
      }
      case 'talk': {
        this.set('armR', -0.5 + Math.sin(this.time * 4) * 0.15, -0.3, 0.3); this.set('foreR', -1.0);
        this.set('head', -0.05, Math.sin(this.time * 1.7) * 0.15, Math.sin(this.time * 2.3) * 0.08);
        break;
      }
      case 'wave': {
        this.set('armR', -2.6, 0, 0.4 + Math.sin(this.time * 9) * 0.35); this.set('foreR', -0.4);
        break;
      }
      case 'sit': { this.set('legL', -1.5); this.set('legR', -1.5); this.set('shinL', 1.5); this.set('shinR', 1.5); hipsY = 0.32; break; }
    }

    // ---- blend ----
    for (const j of JOINTS) {
      const c = this.cur[j], g = this.tgt[j];
      c.x = damp(c.x, g.x, lambda, dt); c.y = damp(c.y, g.y, lambda, dt); c.z = damp(c.z, g.z, lambda, dt);
      const o = (r as any)[j] as THREE.Object3D;
      o.rotation.set(c.x, c.y, c.z);
    }
    this.hipsYcur = damp(this.hipsYcur, hipsY, lambda, dt);
    r.hips.position.y = this.hipsYcur;
    // spin/flip are driven directly (they are fast, exact motions)
    this.bodySpin = s.action === 'attack' ? spin : damp(this.bodySpin, 0, 20, dt);
    this.bodyFlip = s.action === 'roll' || s.action === 'dead' || s.action === 'jumpAttack' ? flip : damp(this.bodyFlip, 0, 20, dt);
    r.hips.rotation.y += this.bodySpin;
    r.hips.rotation.x += this.bodyFlip;
    // secondary motion
    if (r.cape) r.cape.rotation.x = damp(r.cape.rotation.x, -(speedN * 0.55) - clamp(s.vy * 0.06, -0.3, 0.5) - Math.sin(this.time * 7) * 0.05 * speedN, 10, dt);
    if (r.scarfTail) {
      r.scarfTail.rotation.x = damp(r.scarfTail.rotation.x, -(speedN * 1.0) - Math.sin(this.time * 11) * 0.15 * speedN - 0.1, 12, dt);
      r.scarfTail.rotation.z = Math.sin(this.time * 5) * 0.1;
    }
    // squash & stretch on the whole body
    const sq = 1 - land * 0.1 + (!s.grounded ? clamp(Math.abs(s.vy) * 0.012, 0, 0.06) : 0);
    r.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    // face
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 && this.blinkT > 0;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    const hurt = s.action === 'hit' || s.action === 'dead';
    for (const e of r.eyes) e.scale.y = blink || hurt ? 0.12 : 1;
    const open = s.action === 'attack' || s.action === 'hit' || s.action === 'itemGet' || s.action === 'jumpAttack';
    r.mouth.scale.set(open ? 1.3 : 1, open ? 1.8 : 1, 1);
  }
}
