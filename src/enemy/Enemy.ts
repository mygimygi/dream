import * as THREE from 'three';
import { acornBeetle, conchKing, CreatureModel, exclaim, hermitCrab, lanternMoth, shroomling } from './EnemyModels';
import { angleDiff, clamp, damp, dampAngle } from '../core/math';
import { events } from '../core/Events';
import { bossArrow, bossBomb, bossUpdate, bossVulnerable, guardianModel, kingCrabModel, stormModel } from './Bosses';
import { blobShadow } from '../render/BlobShadow';
import { CollisionWorld } from '../world/Collision';

export type EnemyType = 'acorn' | 'shroom' | 'crab' | 'moth' | 'boss' | 'guardian' | 'kingCrab' | 'storm';
interface Stats { hp: number; speed: number; dmg: number; sight: number; model: () => CreatureModel; drop: number; }
const STATS: Record<EnemyType, Stats> = {
  acorn: { hp: 3, speed: 2.2, dmg: 1, sight: 10, model: acornBeetle, drop: 0.6 },
  shroom: { hp: 2, speed: 2.0, dmg: 1, sight: 13, model: shroomling, drop: 0.6 },
  crab: { hp: 4, speed: 3.0, dmg: 2, sight: 9, model: hermitCrab, drop: 0.7 },
  moth: { hp: 1, speed: 3.4, dmg: 1, sight: 12, model: lanternMoth, drop: 0.5 },
  boss: { hp: 26, speed: 2.4, dmg: 2, sight: 40, model: conchKing, drop: 0 },
  guardian: { hp: 20, speed: 2, dmg: 2, sight: 30, model: guardianModel, drop: 0 },
  kingCrab: { hp: 22, speed: 3, dmg: 2, sight: 30, model: kingCrabModel, drop: 0 },
  storm: { hp: 24, speed: 3, dmg: 2, sight: 40, model: stormModel, drop: 0 },
};
export interface EnemyEnv { groundAt(x: number, z: number, maxY?: number): number; col: CollisionWorld; playerPos: THREE.Vector3; playerAlive: () => boolean; }

export interface Projectile { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; dmg: number; grav: number; radius: number; }

export class Enemy {
  m: CreatureModel; pos: THREE.Vector3; home: THREE.Vector3; yaw = Math.random() * 6.28;
  hp: number; maxHp: number; state = 'idle'; t = 0; stateT = 0; vel = new THREE.Vector3(); knock = new THREE.Vector3();
  flash = 0; lastSwing = -1; dead = false; deadT = 0; removed = false; alert = 0; vy = 0; dizzy = 0; phase2 = false;
  private ex: THREE.Sprite; private shadow: THREE.Mesh; private hpBar: THREE.Sprite; private hpCanvas: HTMLCanvasElement; private wander = new THREE.Vector3();
  st: Stats; radius: number;
  onDeath?: (e: Enemy) => void;
  constructor(public type: EnemyType, x: number, z: number, public scene: THREE.Scene, public env: EnemyEnv, public shots: Projectile[]) {
    this.st = STATS[type];
    this.m = this.st.model();
    this.hp = this.maxHp = this.st.hp;
    this.radius = this.m.radius;
    this.pos = new THREE.Vector3(x, env.groundAt(x, z), z); this.home = this.pos.clone();
    scene.add(this.m.root);
    this.ex = exclaim(); this.ex.position.y = this.m.height + 0.5; this.m.root.add(this.ex);
    this.shadow = blobShadow(this.radius * 1.3); scene.add(this.shadow);
    this.hpCanvas = document.createElement('canvas'); this.hpCanvas.width = 128; this.hpCanvas.height = 20;
    const tex = new THREE.CanvasTexture(this.hpCanvas);
    this.hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    this.hpBar.scale.set(this.isBoss ? 0 : 1.1, 0.17, 1); this.hpBar.position.y = this.m.height + 0.25; this.hpBar.visible = false; this.hpBar.renderOrder = 11;
    this.m.root.add(this.hpBar);
    this.pickWander();
  }
  private drawHp() {
    const x = this.hpCanvas.getContext('2d')!;
    x.clearRect(0, 0, 128, 20);
    x.fillStyle = 'rgba(30,24,20,0.85)'; x.beginPath(); x.roundRect(0, 0, 128, 20, 10); x.fill();
    x.fillStyle = '#f0485a'; x.beginPath(); x.roundRect(4, 4, 120 * (this.hp / this.maxHp), 12, 6); x.fill();
    (this.hpBar.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }
  private pickWander() { const a = Math.random() * 6.28, d = Math.random() * 5; this.wander.set(this.home.x + Math.cos(a) * d, 0, this.home.z + Math.sin(a) * d); }
  set(s: string) { this.state = s; this.stateT = 0; }
  get isBoss() { return this.type === 'boss' || this.type === 'guardian' || this.type === 'kingCrab' || this.type === 'storm'; }
  bombHit = () => bossBomb(this) || (this.damage(2, this.pos.clone().add(new THREE.Vector3(0, 0, 1)), 10), true);
  arrowHit = () => bossArrow(this);

  damage(dmg: number, from: THREE.Vector3, force = 7) {
    if (this.dead) return;
    if (this.type === 'boss' && this.state === 'roll') { events.emit('sfx', 'clank'); this.knock.set(0, 0, 0); return; }
    if (this.isBoss && this.type !== 'boss' && !bossVulnerable(this)) { events.emit('sfx', 'clank'); return; }
    if (this.dizzy > 0) dmg *= 2;
    this.hp -= dmg; this.flash = 0.18;
    const d = new THREE.Vector3().subVectors(this.pos, from).setY(0).normalize();
    this.knock.copy(d).multiplyScalar(this.isBoss ? force * 0.15 : force);
    if (!this.isBoss) { this.vy = 3; this.set('hurt'); }
    this.hpBar.visible = !this.isBoss; this.drawHp();
    events.emit('enemyHit', this);
    if (this.hp <= 0) { this.dead = true; this.deadT = 0; events.emit('sfx', this.isBoss ? 'bossDie' : 'enemyDie'); this.onDeath?.(this); }
    else events.emit('sfx', 'creature');
  }

  update(dt: number) {
    const env = this.env, p = env.playerPos;
    this.t += dt; this.stateT += dt;
    if (this.flash > 0) this.flash -= dt;
    for (const m of this.m.mats) m.emissive.setRGB(this.flash > 0 ? 1 : 0, this.flash > 0 ? 0.9 : 0, this.flash > 0 ? 0.8 : 0);
    if (this.dead) {
      this.deadT += dt;
      const k = clamp(this.deadT / 0.5);
      this.m.root.rotation.y += dt * 14 * (1 - k);
      this.m.root.scale.setScalar(Math.max(0.01, 1 - k * k));
      this.m.root.position.y = this.pos.y + Math.sin(k * Math.PI) * 0.8;
      if (this.deadT > 0.5 && !this.removed) { this.removed = true; this.m.root.removeFromParent(); this.shadow.removeFromParent(); events.emit('enemyGone', this); }
      return;
    }
    const toP = new THREE.Vector3().subVectors(p, this.pos).setY(0);
    const dist = toP.length();
    const sees = env.playerAlive() && dist < this.st.sight && Math.abs(p.y - this.pos.y) < 4;
    let speed = 0; let desired: THREE.Vector3 | null = null;
    const faceP = Math.atan2(toP.x, toP.z);

    switch (this.type) {
      case 'acorn': {
        if (this.state === 'idle' || this.state === 'wander') {
          if (sees) { this.set('alert'); this.alertPop(); break; }
          desired = new THREE.Vector3().subVectors(this.wander, this.pos).setY(0);
          if (desired.length() < 0.5 || this.stateT > 4) { this.pickWander(); this.stateT = 0; }
          speed = this.st.speed * 0.45;
        } else if (this.state === 'alert') {
          this.yaw = dampAngle(this.yaw, faceP, 10, dt);
          if (this.stateT > 0.65) { this.set('charge'); events.emit('sfx', 'charge'); }
        } else if (this.state === 'charge') {
          speed = 8; desired = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          if (this.stateT > 0.75) this.set('rest');
        } else if (this.state === 'rest') { if (this.stateT > 1.1) this.set(sees ? 'alert' : 'wander'); }
        else if (this.state === 'hurt') { if (this.stateT > 0.4) this.set('rest'); }
        break;
      }
      case 'shroom': {
        if (this.state === 'idle' || this.state === 'wander') {
          if (sees) { this.set('kite'); this.alertPop(); break; }
          desired = new THREE.Vector3().subVectors(this.wander, this.pos).setY(0); speed = this.st.speed * 0.4;
          if (desired.length() < 0.5 || this.stateT > 4) { this.pickWander(); this.stateT = 0; }
        } else if (this.state === 'kite') {
          if (!sees && this.stateT > 2) { this.set('wander'); break; }
          this.yaw = dampAngle(this.yaw, faceP, 8, dt);
          if (dist < 5) { desired = toP.clone().negate(); speed = this.st.speed; }
          else if (dist > 8) { desired = toP.clone(); speed = this.st.speed * 0.8; }
          else { desired = new THREE.Vector3(-toP.z, 0, toP.x); speed = this.st.speed * 0.5 * Math.sign(Math.sin(this.t * 0.7)); }
          if (this.stateT > 2.4) this.set('puff');
        } else if (this.state === 'puff') {
          this.yaw = dampAngle(this.yaw, faceP, 10, dt);
          if (this.stateT > 0.45 && this.stateT - dt <= 0.45) this.shoot(toP, 'spore');
          if (this.stateT > 0.8) this.set('kite');
        } else if (this.state === 'hurt') { if (this.stateT > 0.4) this.set('kite'); }
        break;
      }
      case 'crab': {
        if (this.state === 'idle' || this.state === 'wander') {
          if (sees) { this.set('chase'); this.alertPop(); break; }
          desired = new THREE.Vector3().subVectors(this.wander, this.pos).setY(0); speed = this.st.speed * 0.35;
          if (desired.length() < 0.5 || this.stateT > 3.5) { this.pickWander(); this.stateT = 0; }
        } else if (this.state === 'chase') {
          if (!sees && this.stateT > 2) { this.set('wander'); break; }
          // crabs face the player but scuttle sideways in arcs
          this.yaw = dampAngle(this.yaw, faceP, 7, dt);
          const side = new THREE.Vector3(-toP.z, 0, toP.x).normalize().multiplyScalar(Math.sin(this.t * 1.3) * 1.2);
          desired = toP.clone().normalize().add(side); speed = dist > 1.8 ? this.st.speed : 0;
          if (dist < 2.0 && this.stateT > 0.6) this.set('windup');
        } else if (this.state === 'windup') {
          this.yaw = dampAngle(this.yaw, faceP, 10, dt);
          if (this.stateT > 0.5) { this.set('pinch'); events.emit('sfx', 'snap'); }
        } else if (this.state === 'pinch') {
          if (this.stateT < 0.1) { speed = 6; desired = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
          if (this.stateT > 0.5) this.set('chase');
        } else if (this.state === 'hurt') { if (this.stateT > 0.35) this.set('chase'); }
        break;
      }
      case 'moth': {
        if (this.state === 'idle' || this.state === 'wander') {
          desired = new THREE.Vector3().subVectors(this.wander, this.pos).setY(0); speed = 1.5;
          if (desired.length() < 0.5 || this.stateT > 3) { this.pickWander(); this.stateT = 0; }
          if (sees) { this.set('circle'); this.alertPop(); }
        } else if (this.state === 'circle') {
          const tangent = new THREE.Vector3(-toP.z, 0, toP.x).normalize();
          desired = tangent.add(toP.clone().normalize().multiplyScalar((dist - 4) * 0.4)); speed = this.st.speed;
          this.yaw = dampAngle(this.yaw, faceP, 6, dt);
          if (this.stateT > 2.5 + Math.random()) this.set('swoop');
        } else if (this.state === 'swoop') {
          desired = toP.clone(); speed = 7.5;
          if (this.stateT > 0.6 || dist < 0.6) this.set('circle');
        } else if (this.state === 'hurt') { if (this.stateT > 0.3) this.set('circle'); }
        break;
      }
      case 'boss': this.bossAI(dt, toP, dist, faceP); return;
      case 'guardian': case 'kingCrab': case 'storm': bossUpdate(this, dt, toP, dist, faceP); if (this.alert > 0) this.alert = 0; return;
    }
    if (this.alert > 0) { this.alert -= dt; this.ex.visible = this.alert > 0; this.ex.position.y = this.m.height + 0.5 + Math.sin((0.6 - this.alert) * 20) * 0.05; }

    if (desired && desired.lengthSq() > 1e-4 && speed !== 0) {
      desired.normalize();
      if (this.type !== 'crab' || this.state === 'wander') this.yaw = dampAngle(this.yaw, Math.atan2(desired.x, desired.z) * Math.sign(speed) + (speed < 0 ? Math.PI : 0), 8, dt);
      this.vel.x = damp(this.vel.x, desired.x * speed, 8, dt); this.vel.z = damp(this.vel.z, desired.z * speed, 8, dt);
    } else { this.vel.x = damp(this.vel.x, 0, 8, dt); this.vel.z = damp(this.vel.z, 0, 8, dt); }
    this.integrate(dt);
    this.animate(dt);
  }
  private alertPop() { this.alert = 0.7; events.emit('sfx', 'alert'); }

  private integrate(dt: number) {
    const env = this.env;
    this.knock.multiplyScalar(Math.exp(-8 * dt));
    let nx = this.pos.x + (this.vel.x + this.knock.x) * dt, nz = this.pos.z + (this.vel.z + this.knock.z) * dt;
    // leash to home
    const hd = Math.hypot(nx - this.home.x, nz - this.home.z);
    if (hd > (this.type === 'boss' ? 30 : 16)) { nx = this.pos.x; nz = this.pos.z; this.set(this.type === 'boss' ? this.state : 'wander'); this.wander.copy(this.home); }
    const cur = env.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6);
    const g = env.groundAt(nx, nz, this.pos.y + 0.6);
    const flying = this.type === 'moth';
    if (!flying && (g - cur > 0.55 || cur - g > 1.2 || g < 0.1 && cur > 0.3)) { nx = this.pos.x; nz = this.pos.z; this.vel.multiplyScalar(-0.3); if (this.state === 'charge') this.set('rest'); }
    const r = env.col.resolve(nx, nz, this.radius * 0.8, this.pos.y, 1.2);
    if ((r.hit && this.state === 'charge')) this.set('rest');
    this.pos.x = r.x; this.pos.z = r.z;
    const gy = env.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6);
    this.vy -= 20 * dt; this.pos.y += this.vy * dt;
    if (this.pos.y < gy) { this.pos.y = gy; this.vy = 0; }
    this.m.root.position.copy(this.pos);
    this.m.root.rotation.y = this.yaw;
    this.shadow.position.set(this.pos.x, gy + 0.04, this.pos.z);
  }

  private animate(dt: number) {
    const P = this.m.parts, t = this.t, sp = Math.hypot(this.vel.x, this.vel.z);
    const b = this.m.body;
    switch (this.type) {
      case 'acorn': {
        const legs = P.legs as unknown as THREE.Object3D[];
        legs.forEach((l, i) => { l.rotation.x = Math.sin(t * (6 + sp * 3) + i * 2.1) * 0.5 * Math.min(1, sp); });
        b.position.y = 0.55 + Math.abs(Math.sin(t * 10)) * 0.04 * Math.min(1, sp);
        const wind = this.state === 'alert' ? Math.sin(this.stateT * 40) * 0.05 : 0;
        b.rotation.x = this.state === 'charge' ? 0.25 : this.state === 'alert' ? -0.15 : 0;
        b.rotation.z = wind;
        P.cap.rotation.x = -0.35 + (this.state === 'hurt' ? 0.4 : 0);
        break;
      }
      case 'shroom': {
        const hop = Math.abs(Math.sin(t * 6)) * Math.min(1, sp * 0.8);
        b.position.y = hop * 0.35;
        const squash = this.state === 'puff' ? 1 - Math.sin(clamp(this.stateT / 0.45) * Math.PI) * 0.25 : 1 - hop * 0.08;
        b.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
        P.cap.rotation.z = Math.sin(t * 3) * 0.08;
        P.armL.position.y = 0.38 + Math.sin(t * 6) * 0.05; P.armR.position.y = 0.38 - Math.sin(t * 6) * 0.05;
        break;
      }
      case 'crab': {
        const legs = P.legs as unknown as THREE.Object3D[];
        legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 14 + i * 1.7) * 0.4 * Math.min(1, sp); });
        const up = this.state === 'windup' ? clamp(this.stateT / 0.5) : this.state === 'pinch' ? 1 - clamp(this.stateT / 0.3) : 0;
        P.clawL.rotation.x = -up * 1.2 + Math.sin(t * 3) * 0.1; P.clawR.rotation.x = -up * 1.2 - Math.sin(t * 3) * 0.1;
        P.eyeL.rotation.z = Math.sin(t * 2) * 0.2; P.eyeR.rotation.z = -Math.sin(t * 2.3) * 0.2;
        b.position.y = 0.35 + Math.abs(Math.sin(t * 14)) * 0.03 * Math.min(1, sp);
        break;
      }
      case 'moth': {
        const f = Math.sin(t * 28) * 0.8;
        P.wingL.rotation.z = f; P.wingR.rotation.z = -f;
        b.position.y = 1.6 + Math.sin(t * 3) * 0.25 - (this.state === 'swoop' ? 0.6 : 0);
        b.rotation.x = this.state === 'swoop' ? 0.5 : 0.1;
        break;
      }
    }
    this.hpBar.position.y = this.m.height + 0.25;
  }

  shoot(dir: THREE.Vector3, kind: 'spore' | 'spike' | 'spark', speed = 7) {
    const d = dir.clone().setY(0).normalize();
    const mat = kind === 'spore'
      ? new THREE.MeshStandardMaterial({ color: 0xc8a0ff, emissive: 0x8a50ff, emissiveIntensity: 1.2, roughness: 0.4 })
      : kind === 'spark' ? new THREE.MeshStandardMaterial({ color: 0xe8e0ff, emissive: 0x9a7aff, emissiveIntensity: 2.2, roughness: 0.2 })
      : new THREE.MeshStandardMaterial({ color: 0xffd0e0, emissive: 0xff6a8a, emissiveIntensity: 1.0, roughness: 0.3 });
    const geo = kind === 'spark' ? new THREE.IcosahedronGeometry(0.3, 1) : kind === 'spore' ? new THREE.IcosahedronGeometry(0.22, 2) : new THREE.ConeGeometry(0.16, 0.6, 8).rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
    const h = kind === 'spore' ? 0.9 : kind === 'spark' ? 1.1 : this.type === 'kingCrab' ? 0.6 : 1.0;
    mesh.position.set(this.pos.x + d.x * this.radius, this.pos.y + h, this.pos.z + d.z * this.radius);
    mesh.lookAt(mesh.position.clone().add(d));
    this.scene.add(mesh);
    const vel = d.multiplyScalar(speed);
    if (kind === 'spore') vel.y = 3;
    this.shots.push({ mesh, vel, life: 3, dmg: this.st.dmg, grav: kind === 'spore' ? 7 : 0, radius: kind === 'spore' ? 0.35 : 0.3 });
    events.emit('sfx', kind === 'spore' ? 'puff' : 'spike');
  }

  // ---------------- boss ----------------
  private bossAI(dt: number, toP: THREE.Vector3, dist: number, faceP: number) {
    const P = this.m.parts;
    this.phase2 = this.hp <= this.maxHp / 2;
    const spd = this.phase2 ? 1.35 : 1;
    let speed = 0, desired: THREE.Vector3 | null = null;
    if (this.dizzy > 0) this.dizzy -= dt;
    switch (this.state) {
      case 'idle': if (dist < 26) { this.set('crawl'); events.emit('bossStart'); } break;
      case 'crawl':
        this.yaw = dampAngle(this.yaw, faceP, 2.5 * spd, dt);
        desired = toP.clone(); speed = this.st.speed * spd;
        if (this.stateT > (this.phase2 ? 2.2 : 3.2)) this.set(Math.random() < 0.55 ? 'curl' : 'burst');
        break;
      case 'curl':
        this.yaw = dampAngle(this.yaw, faceP, 6, dt);
        if (this.stateT > 0.8) { this.set('roll'); events.emit('sfx', 'roll'); }
        break;
      case 'roll': {
        speed = 13 * spd; desired = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        // steer slightly toward the player early on
        if (this.stateT < 0.5) this.yaw = dampAngle(this.yaw, faceP, 1.5, dt);
        if (this.stateT > 3) this.set('crawl');
        break;
      }
      case 'stun':
        if (this.stateT > (this.phase2 ? 2.0 : 2.8)) this.set('crawl');
        break;
      case 'burst': {
        const n = this.phase2 ? 14 : 10;
        const shots = this.phase2 ? 2 : 1;
        for (let s = 0; s < shots; s++) {
          const at = 0.6 + s * 0.7;
          if (this.stateT > at && this.stateT - dt <= at) {
            for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + s * 0.3; this.shoot(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 'spike', 6.5); }
            events.emit('shake', 0.3);
          }
        }
        if (this.stateT > 1.2 + shots * 0.6) this.set('crawl');
        break;
      }
    }
    if (desired) {
      desired.normalize();
      if (this.state !== 'roll') this.yaw = dampAngle(this.yaw, Math.atan2(desired.x, desired.z), 3, dt);
      this.vel.x = damp(this.vel.x, desired.x * speed, this.state === 'roll' ? 4 : 5, dt); this.vel.z = damp(this.vel.z, desired.z * speed, this.state === 'roll' ? 4 : 5, dt);
    } else { this.vel.x = damp(this.vel.x, 0, 6, dt); this.vel.z = damp(this.vel.z, 0, 6, dt); }
    // integrate in the arena
    const before = this.pos.clone();
    this.knock.multiplyScalar(Math.exp(-8 * dt));
    const nx = this.pos.x + (this.vel.x + this.knock.x) * dt, nz = this.pos.z + (this.vel.z + this.knock.z) * dt;
    const r = this.env.col.resolve(nx, nz, this.radius, this.pos.y, 3);
    this.pos.x = r.x; this.pos.z = r.z;
    if (this.state === 'roll' && r.hit && this.stateT > 0.2) {
      this.set('stun'); this.dizzy = this.phase2 ? 2.0 : 2.8; this.vel.set(0, 0, 0);
      events.emit('shake', 0.7); events.emit('sfx', 'thud'); events.emit('bossWall', this.pos.clone());
    }
    void before;
    this.pos.y = this.env.groundAt(this.pos.x, this.pos.z, this.pos.y + 1);
    this.m.root.position.copy(this.pos);
    this.m.root.rotation.y = this.yaw;
    this.shadow.position.set(this.pos.x, this.pos.y + 0.04, this.pos.z); this.shadow.scale.setScalar(1.4);
    // animation
    const t = this.t;
    const curl = this.state === 'curl' ? clamp(this.stateT / 0.6) : this.state === 'roll' ? 1 : this.state === 'stun' ? 1 - clamp(this.stateT / 0.4) : 0;
    P.head.scale.setScalar(1 - curl * 0.85); P.head.position.z = 1.8 - curl * 1.4;
    P.shell.rotation.x = this.state === 'roll' ? this.stateT * 12 : damp(P.shell.rotation.x % (Math.PI * 2), 0, 6, dt);
    this.m.body.position.y = this.state === 'roll' ? 0.4 + Math.abs(Math.sin(t * 12)) * 0.15 : Math.sin(t * 2) * 0.05;
    P.stalkL.rotation.z = Math.sin(t * 2.2) * 0.2 + (this.state === 'stun' ? Math.sin(t * 12) * 0.5 : 0);
    P.stalkR.rotation.z = -Math.sin(t * 2.5) * 0.2 - (this.state === 'stun' ? Math.sin(t * 13) * 0.5 : 0);
    if (this.state === 'burst') { const k = Math.sin(clamp(this.stateT / 0.6) * Math.PI); this.m.body.scale.set(1 + k * 0.08, 1 - k * 0.08, 1 + k * 0.08); } else this.m.body.scale.set(1, 1, 1);
  }
  /** contact damage check vs a point */
  touching(p: THREE.Vector3) {
    if (this.dead) return false;
    if (this.type === 'boss' && this.state === 'stun') return false;
    if ((this.type === 'guardian' && this.state === 'stun') || (this.type === 'storm' && this.state !== 'fallen') || (this.type === 'kingCrab' && this.state === 'exposed')) return false;
    const dy = p.y - this.pos.y;
    const h = this.type === 'moth' ? [0.6, 2.4] : [-0.5, this.m.height];
    if (dy < h[0] - 1 || dy > h[1]) return false;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    const active = this.type === 'crab' ? this.state === 'pinch' && this.stateT < 0.3 : true;
    if (this.type === 'crab' && !active) return d < this.radius * 0.6;
    return d < this.radius + 0.35;
  }
  get angryAttack() { return this.type === 'crab' && this.state === 'pinch'; }
  dispose() { this.m.root.removeFromParent(); this.shadow.removeFromParent(); }
}
export { angleDiff };
