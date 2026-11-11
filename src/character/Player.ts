import * as THREE from 'three';
import { buildHumanoid, HERO_LOOK, HumanoidLook, Rig, shieldModel, swordModel } from './Humanoid';
import { ITEMS } from '../item/Items';
import { AnimAction, HumanoidAnimator } from '../animation/HumanoidAnimator';
import { ATTACKS, AttackDef, HIT_TIME, JUMP_ATTACK, ROLL_TIME } from '../combat/AttackTable';
import { angleDiff, clamp, damp, dampAngle } from '../core/math';
import { Input } from '../core/Input';
import { CameraRig } from '../camera/CameraRig';
import { Inventory } from '../inventory/Inventory';
import { events } from '../core/Events';
import { CollisionWorld } from '../world/Collision';
import { itemModel } from '../item/Items';
import { blobShadow } from '../render/BlobShadow';

export interface PlayerEnv {
  groundAt(x: number, z: number, maxY?: number): number;
  terrainAt(x: number, z: number): number;
  col: CollisionWorld;
  dungeon: () => boolean;
}

const WALK = 4.3, RUN = 7.2, ACCEL = 30, DECEL = 22, GRAV = 28, JUMP_V = 9.4, STEP_UP = 0.6, RADIUS = 0.42;

export class Player {
  rig: Rig; anim: HumanoidAnimator;
  pos = new THREE.Vector3(); vel = new THREE.Vector3(); yaw = 0; vy = 0; grounded = true;
  hp = 6; inv = 0; dist = 0; landT = 1; turnRate = 0;
  action: AnimAction = 'none'; actionT = 0; combo = 0; queued = false; swingId = 0;
  private sword: THREE.Object3D; private shield: THREE.Object3D; private shieldPiv = new THREE.Group();
  private held: THREE.Object3D | null = null; heldT = 0;
  guardW = 0; frozen = false; lookAhead = 0; riding = false; speedMul = 1; defenseMul = 1; extraHearts = 0; lastSafe = new THREE.Vector3(); private stepAcc = 0; inWater = false;
  shadow: THREE.Mesh;
  private knock = new THREE.Vector3();
  onLand?: (speed: number) => void;

  constructor(scene: THREE.Scene, public env: PlayerEnv, public input: Input, public camRig: CameraRig, public invt: Inventory) {
    this.scene = scene;
    this.rig = buildHumanoid(HERO_LOOK);
    scene.add(this.rig.root);
    this.anim = new HumanoidAnimator(this.rig);
    this.sword = swordModel(); this.sword.rotation.x = Math.PI / 2; this.sword.position.set(0, -0.02, 0.02);
    this.rig.handR.add(this.sword);
    this.shield = shieldModel();
    this.shieldPiv.add(this.shield);
    this.rig.torso.add(this.shieldPiv);
    this.look = { ...HERO_LOOK };
    this.shadow = blobShadow(0.75); scene.add(this.shadow);
  }
  scene: THREE.Scene; look: HumanoidLook; private gearKey = '';
  get maxHp() { return (this.invt.maxHearts + this.invt.armorHearts() + this.extraHearts) * 2; }
  /** Rebuild the body (appearance or worn armour changed) and re-attach the hand-held gear. */
  setLook(look: HumanoidLook) {
    this.look = { ...look };
    const old = this.rig.root;
    this.rig = buildHumanoid({ ...look, armor: this.invt.equipped.armor || undefined });
    this.rig.root.position.copy(old.position); this.rig.root.rotation.copy(old.rotation);
    old.removeFromParent();
    this.scene.add(this.rig.root);
    this.anim = new HumanoidAnimator(this.rig);
    this.gearKey = '';
    this.syncGear();
  }
  /** Swap sword/shield meshes to match what is equipped. */
  syncGear() {
    const e = this.invt.equipped;
    const key = `${e.weapon}|${e.shield}|${e.armor}`;
    if (key === this.gearKey) return;
    const armorChanged = this.gearKey.split('|')[2] !== e.armor && this.gearKey !== '';
    this.gearKey = key;
    if (armorChanged) { this.setLook(this.look); return; }
    this.sword.removeFromParent(); this.shield.removeFromParent();
    this.sword = swordModel(ITEMS[e.weapon]?.tier ?? 1); this.sword.rotation.x = Math.PI / 2; this.sword.position.set(0, -0.02, 0.02);
    this.rig.handR.add(this.sword);
    this.shield = shieldModel(e.shield || 'shield'); this.shieldPiv.add(this.shield);
    this.rig.torso.add(this.shieldPiv);
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }
  place(x: number, z: number, yaw: number) {
    this.pos.set(x, this.env.groundAt(x, z), z); this.yaw = yaw; this.vel.set(0, 0, 0); this.vy = 0; this.grounded = true;
    this.lastSafe.copy(this.pos); this.action = 'none';
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = yaw;
  }
  isAttacking() { return this.action === 'attack' || this.action === 'jumpAttack'; }
  currentAttack(): AttackDef | null { return this.action === 'attack' ? ATTACKS[this.combo] : this.action === 'jumpAttack' ? JUMP_ATTACK : null; }
  attackActive() { const a = this.currentAttack(); return !!a && this.actionT >= a.hit0 && this.actionT <= a.hit1; }
  invulnerable() { return this.inv > 0 || (this.action === 'roll' && this.actionT < ROLL_TIME * 0.8) || this.action === 'dead' || this.action === 'itemGet'; }
  guarding() { return this.action === 'guard' && this.guardW > 0.6; }
  facing(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  /** returns true if damage applied */
  hurt(dmg: number, from: THREE.Vector3, knock = 7): 'hit' | 'blocked' | 'ignored' {
    if (this.invulnerable()) return 'ignored';
    const dir = new THREE.Vector3().subVectors(this.pos, from).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    dir.normalize();
    if (this.guarding()) {
      const toAttacker = Math.atan2(-dir.x, -dir.z);
      const arc = ITEMS[this.invt.equipped.shield]?.guardArc ?? 1.25;
      if (Math.abs(angleDiff(this.yaw, toAttacker)) < arc) {
        this.knock.copy(dir).multiplyScalar(knock * (arc > 1.5 ? 0.25 : 0.45));
        events.emit('sfx', 'block'); events.emit('blocked', this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 0.6, 1, Math.cos(this.yaw) * 0.6)));
        return 'blocked';
      }
    }
    dmg = Math.max(1, Math.round(dmg * this.defenseMul));
    this.hp = Math.max(0, this.hp - dmg);
    this.inv = 1.1;
    this.knock.copy(dir).multiplyScalar(knock);
    this.vy = Math.max(this.vy, 3.5); this.grounded = false;
    if (this.hp <= 0) { this.setAction('dead'); events.emit('playerDead'); }
    else this.setAction('hit');
    events.emit('sfx', 'hurt'); events.emit('hp', this.hp);
    this.camRig.shake(0.45);
    return 'hit';
  }
  heal(n: number) { this.hp = Math.min(this.maxHp, this.hp + n); events.emit('hp', this.hp); }
  private setAction(a: AnimAction) { this.action = a; this.actionT = 0; }

  showItem(id: string | null) {
    if (this.held) { this.held.removeFromParent(); this.held = null; }
    if (id) {
      this.held = itemModel(id); this.held.scale.setScalar(1.15);
      this.rig.root.add(this.held); this.held.position.set(0, 2.25, 0.1);
      this.setAction('itemGet'); this.heldT = 0;
    } else if (this.action === 'itemGet') this.setAction('none');
  }

  update(dt: number) {
    const inp = this.input;
    this.actionT += dt;
    if (this.inv > 0) this.inv -= dt;
    this.landT += dt;
    this.syncGear();
    this.sword.visible = !!this.invt.equipped.weapon;
    this.shield.visible = !!this.invt.equipped.shield;

    // ---------------- intent ----------------
    const mv = inp.move();
    const fwd = this.camRig.forward(new THREE.Vector3()), rgt = this.camRig.right(new THREE.Vector3());
    const wish = new THREE.Vector3().addScaledVector(rgt, mv.x).addScaledVector(fwd, -mv.y);
    const mag = Math.min(1, wish.length());
    if (mag > 0.01) wish.normalize();
    const locked = this.frozen || this.action === 'dead' || this.action === 'itemGet' || this.action === 'hit' || this.action === 'interact';
    const hasSword = !!this.invt.equipped.weapon;

    if (!locked) {
      // guard
      const wantGuard = inp.isDown('guard') && !!this.invt.equipped.shield && this.grounded && !this.isAttacking() && this.action !== 'roll';
      if (wantGuard && this.action === 'none') this.setAction('guard');
      if (this.action === 'guard' && !wantGuard) this.setAction('none');
      // attack / combo
      if (inp.wasPressed('attack') && hasSword && !this.riding) {
        if (!this.grounded && this.action !== 'jumpAttack' && this.action !== 'roll') { this.setAction('jumpAttack'); this.swingId++; this.vy = Math.max(this.vy, 3); events.emit('sfx', 'swing2'); }
        else if (this.action === 'none' || this.action === 'guard') { this.combo = 0; this.startSwing(wish, mag); }
        else if (this.action === 'attack') this.queued = true;
      }
      // roll
      if (inp.wasPressed('roll') && !this.riding && this.grounded && (this.action === 'none' || this.action === 'guard' || (this.action === 'attack' && this.actionT > 0.2))) {
        this.setAction('roll');
        const d = mag > 0.1 ? wish : this.facing();
        this.yaw = Math.atan2(d.x, d.z);
        this.vel.set(d.x, 0, d.z).multiplyScalar(10.5);
        events.emit('sfx', 'roll');
      }
      // jump
      if (inp.wasPressed('jump') && this.grounded && (this.action === 'none' || this.action === 'guard')) {
        this.vy = JUMP_V * (this.riding ? 1.15 : 1); this.grounded = false; this.setAction('none'); events.emit('sfx', 'jump');
        events.emit('dust', this.pos.clone());
      }
    }

    // ---------------- action timeline ----------------
    if (this.action === 'attack') {
      const a = ATTACKS[this.combo];
      if (this.actionT > a.dur - a.comboWindow && this.queued && this.combo < ATTACKS.length - 1) { this.combo++; this.startSwing(wish, mag); }
      else if (this.actionT >= a.dur) { this.setAction('none'); this.combo = 0; }
    } else if (this.action === 'jumpAttack') { if (this.actionT >= JUMP_ATTACK.dur && this.grounded) this.setAction('none'); }
    else if (this.action === 'roll') { if (this.actionT >= ROLL_TIME) this.setAction('none'); }
    else if (this.action === 'hit') { if (this.actionT >= HIT_TIME) this.setAction('none'); }
    else if (this.action === 'interact') { if (this.actionT >= 0.5) this.setAction('none'); }
    else if (this.action === 'itemGet') { if (this.held) { this.held.rotation.y += dt * 2.5; this.held.position.y = 2.25 + Math.sin(this.actionT * 3) * 0.06; } }
    this.guardW = damp(this.guardW, this.action === 'guard' ? 1 : 0, 18, dt);

    // ---------------- horizontal velocity ----------------
    let maxSpeed = ((inp.isDown('run') || (inp.stick.active && mag > 0.92)) ? RUN : WALK) * this.speedMul;
    if (this.action === 'guard') maxSpeed = 2.0;
    const canSteer = !locked && (this.action === 'none' || this.action === 'guard' || (!this.grounded && this.action !== 'roll'));
    if (this.action === 'roll') {
      const t = this.actionT / ROLL_TIME;
      const sp = 10.5 * (1 - t * 0.7);
      this.vel.set(Math.sin(this.yaw) * sp, 0, Math.cos(this.yaw) * sp);
    } else if (canSteer) {
      const target = wish.clone().multiplyScalar(maxSpeed * mag);
      const a = mag > 0.01 ? ACCEL : DECEL;
      const k = this.grounded ? 1 : 0.45;
      this.vel.x = damp(this.vel.x, target.x, (a / maxSpeed) * 2.2 * k, dt);
      this.vel.z = damp(this.vel.z, target.z, (a / maxSpeed) * 2.2 * k, dt);
      if (mag > 0.05 && this.action !== 'guard') {
        const ty = Math.atan2(wish.x, wish.z);
        this.lookAhead = angleDiff(this.yaw, ty);
        const prev = this.yaw;
        this.yaw = dampAngle(this.yaw, ty, 14, dt);
        this.turnRate = damp(this.turnRate, angleDiff(prev, this.yaw) / dt, 10, dt);
      } else { this.turnRate = damp(this.turnRate, 0, 8, dt); this.lookAhead = 0; }
    } else {
      // attack lunge decays; other locked states brake
      this.vel.x = damp(this.vel.x, 0, this.isAttacking() ? 9 : 12, dt);
      this.vel.z = damp(this.vel.z, 0, this.isAttacking() ? 9 : 12, dt);
    }
    // knockback
    this.knock.multiplyScalar(Math.exp(-7 * dt));
    const vx = this.vel.x + this.knock.x, vz = this.vel.z + this.knock.z;

    // ---------------- integrate with terrain & colliders ----------------
    const env = this.env;
    let nx = this.pos.x + vx * dt, nz = this.pos.z + vz * dt;
    const curG = env.groundAt(this.pos.x, this.pos.z, this.pos.y + STEP_UP);
    const tryMove = (x: number, z: number) => {
      const g = env.groundAt(x, z, this.pos.y + STEP_UP);
      const rise = g - Math.max(this.pos.y, curG);
      if (rise > (this.grounded ? STEP_UP : 0.15)) return false;          // cliff wall
      if (!env.dungeon() && env.terrainAt(x, z) < -0.75 && g < -0.5) return false;  // deep water
      return true;
    };
    if (!tryMove(nx, nz)) {
      // slide along whichever axis is free
      if (tryMove(nx, this.pos.z)) nz = this.pos.z;
      else if (tryMove(this.pos.x, nz)) nx = this.pos.x;
      else { nx = this.pos.x; nz = this.pos.z; this.vel.x *= 0.5; this.vel.z *= 0.5; }
    }
    const res = env.col.resolve(nx, nz, RADIUS, this.pos.y, 1.4);
    if (tryMove(res.x, res.z)) { nx = res.x; nz = res.z; } else { nx = this.pos.x; nz = this.pos.z; }
    const moved = Math.hypot(nx - this.pos.x, nz - this.pos.z);
    this.pos.x = nx; this.pos.z = nz;
    if (this.grounded) this.dist += moved;

    // vertical
    const g = env.groundAt(this.pos.x, this.pos.z, this.pos.y + STEP_UP);
    if (this.grounded) {
      if (this.pos.y - g > 0.45) { this.grounded = false; this.vy = 0; }
      else this.pos.y = damp(this.pos.y, g, 30, dt);
    }
    if (!this.grounded) {
      this.vy -= GRAV * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= g && this.vy <= 0) {
        const impact = -this.vy;
        this.pos.y = g; this.vy = 0; this.grounded = true; this.landT = 0;
        events.emit('sfx', 'land'); if (impact > 6) events.emit('dust', this.pos.clone());
        this.onLand?.(impact);
        if (this.action === 'jumpAttack') { this.camRig.shake(0.25); events.emit('jumpSlam', this.pos.clone()); }
      }
    }
    // safety: fell into the sea or out of the map
    if (this.pos.y < -4) { this.place(this.lastSafe.x, this.lastSafe.z, this.yaw); this.hurt(1, this.pos.clone().add(new THREE.Vector3(0, 0, 1)), 0); events.emit('splash', this.pos.clone()); }
    if (this.grounded && g > -0.2 && moved > 0) {
      if (env.terrainAt(this.pos.x, this.pos.z) > 0.1 || env.dungeon()) this.lastSafe.copy(this.pos);
    }
    this.inWater = !env.dungeon() && this.grounded && env.terrainAt(this.pos.x, this.pos.z) < 0.05 && g < 0.2;

    // footsteps
    if (this.grounded && moved > 0) {
      this.stepAcc += moved;
      const stride = 0.9 + (Math.hypot(vx, vz) > 5.5 ? 0.5 : 0);
      if (this.stepAcc > stride) { this.stepAcc = 0; events.emit('step', { pos: this.pos.clone(), water: this.inWater }); }
    }

    // ---------------- visuals ----------------
    this.rig.root.position.copy(this.pos);
    if (this.riding) this.rig.root.position.y += 0.95;
    this.rig.root.rotation.y = this.yaw;
    const blink = this.inv > 0 && this.action !== 'dead' && Math.floor(this.inv * 14) % 2 === 0;
    this.rig.root.visible = !blink;
    // shield: carried on the back, raised in front while guarding
    const w = this.guardW;
    this.shieldPiv.position.set(-0.08 * (1 - w) - 0.2 * w, 0.2 + 0.05 * w, -0.27 * (1 - w) + 0.42 * w);
    this.shieldPiv.rotation.set(0, Math.PI * (1 - w) + 0.15 * w, 0);
    const spd = this.riding ? 0 : Math.hypot(this.vel.x, this.vel.z);
    this.anim.update(dt, { speed: spd, maxSpeed: RUN, grounded: this.grounded, vy: this.vy, turnRate: this.turnRate, action: this.riding && this.action === 'none' ? 'sit' : this.action, actionT: this.actionT, combo: this.combo, landT: this.landT, dist: this.riding ? 0 : this.dist, guardW: this.guardW, lookAhead: this.lookAhead });
    // blob contact shadow (soft AO under the feet)
    const sg = env.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.2);
    this.shadow.position.set(this.pos.x, sg + 0.04, this.pos.z);
    const hgt = clamp(1 - (this.pos.y - sg) * 0.25, 0.3, 1);
    this.shadow.scale.setScalar(hgt);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * hgt;
  }
  private startSwing(wish: THREE.Vector3, mag: number) {
    const a = ATTACKS[this.combo];
    this.setAction('attack'); this.queued = false; this.swingId++;
    if (mag > 0.2) this.yaw = Math.atan2(wish.x, wish.z);
    this.vel.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(a.lunge);
    events.emit('sfx', this.combo === 2 ? 'spin' : 'swing');
  }
}
