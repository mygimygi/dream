import * as THREE from 'three';
import type { Enemy } from './Enemy';
import { acornBeetle, CreatureModel, hermitCrab } from './EnemyModels';
import { toy } from '../render/Materials';
import { at, blob, colorize, gradient, lathe, sphere, taperTube } from '../world/Geo';
import { clamp, damp, dampAngle } from '../core/math';
import { events } from '../core/Events';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function scaled(m: CreatureModel, s: number, tint?: number): CreatureModel {
  m.root.scale.setScalar(s); m.height *= s; m.radius *= s;
  if (tint) m.root.traverse((o: any) => { if (o.isMesh && o.geometry.attributes.color) { const c = o.geometry.attributes.color; const t = new THREE.Color(tint); for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.7 + t.r * 0.3, c.getY(i) * 0.7 + t.g * 0.3, c.getZ(i) * 0.7 + t.b * 0.3); } });
  return m;
}
/** 이끼숲 수호자: a moss-covered giant beetle with a sprouting crown. */
export function guardianModel(): CreatureModel {
  const m = scaled(acornBeetle(), 2.5, 0x4f8f2e);
  const crown = new THREE.Group(); crown.position.set(0, 0.95, -0.2);
  const mat = toy({ vertexColors: true, roughness: 0.7 }, { rim: 0.25 });
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const s = new THREE.Mesh(gradient(at(blob(0.16, i, 0.2, 1), Math.cos(a) * 0.25, 0.1, Math.sin(a) * 0.25, 0, 0, 0, [0.7, 1.4, 0.7]), 0x3f8a2c, 0x9ad850, 0, 0.3), mat); crown.add(s); }
  m.body.add(crown); m.parts.crown = crown;
  return m;
}
export function kingCrabModel(): CreatureModel { return scaled(hermitCrab(), 2.4, 0xe0705a); }
/** 폭풍해파리: translucent storm-cloud jellyfish with a single big eye and lightning tentacles. */
export function stormModel(): CreatureModel {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 4;
  const bellMat = new THREE.MeshPhysicalMaterial({ color: 0x9a8ae8, emissive: 0x3a2a7a, emissiveIntensity: 0.6, roughness: 0.25, transmission: 0.0, transparent: true, opacity: 0.88, clearcoat: 1 });
  const bell = new THREE.Mesh(lathe([[0, 2.1], [0.9, 2.0], [1.7, 1.5], [2.1, 0.7], [2.2, 0.1], [2.0, -0.05], [1.4, 0.15], [0, 0.2]], 40), bellMat); bell.castShadow = true; body.add(bell);
  const spots = new THREE.Mesh(gradient(at(blob(0.3, 1, 0.3, 1), 0, 2.0, 0, 0, 0, 0, [2.5, 0.4, 2.5]), 0xd8c8ff, 0xffffff, 1.9, 2.2), toy({ vertexColors: true }, { rim: 0.4 })); body.add(spots);
  const eye = new THREE.Group(); eye.position.set(0, 0.9, 1.75); body.add(eye);
  const sclera = new THREE.Mesh(sphere(0.55, 24, 16), new THREE.MeshStandardMaterial({ color: 0xfffbe8, roughness: 0.2 })); sclera.scale.set(1, 1, 0.5); eye.add(sclera);
  const iris = new THREE.Mesh(sphere(0.3, 18, 12), new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0xffb000, emissiveIntensity: 1.6 })); iris.position.z = 0.22; iris.scale.set(1, 1, 0.5); eye.add(iris);
  const lid = new THREE.Mesh(sphere(0.6, 20, 12, ), new THREE.MeshStandardMaterial({ color: 0x6a5ac8, roughness: 0.4 })); lid.scale.set(1, 1, 0.55); eye.add(lid);
  const tents: THREE.Object3D[] = [];
  const tMat = new THREE.MeshStandardMaterial({ color: 0xb8a8ff, emissive: 0x6a50ff, emissiveIntensity: 0.9, roughness: 0.3 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, t = new THREE.Group(); t.position.set(Math.cos(a) * 1.4, 0.1, Math.sin(a) * 1.4);
    t.add(new THREE.Mesh(taperTube([V(0, 0, 0), V(Math.cos(a) * 0.3, -1.2, Math.sin(a) * 0.3), V(Math.cos(a) * 0.1, -2.4, Math.sin(a) * 0.1), V(Math.cos(a) * 0.4, -3.4, Math.sin(a) * 0.4)], 0.18, 0.04, 14, 8), tMat));
    body.add(t); tents.push(t);
  }
  return { root, body, parts: { eye, lid, iris, bell, tents: tents as any }, mats: [bellMat as any], height: 6.5, radius: 2.3 };
}

/** Shared boss brains. Each boss: telegraph -> attack -> recover, a weakness, and a phase change at 50%. */
export function bossUpdate(e: Enemy, dt: number, toP: THREE.Vector3, dist: number, faceP: number) {
  const P = e.m.parts, phase2 = e.hp <= e.maxHp / 2;
  const spd = phase2 ? 1.3 : 1;
  let desired: THREE.Vector3 | null = null, speed = 0;
  const go = (s: string) => e.set(s);
  if (e.state === 'idle') { if (dist < 22) { go(e.type === 'storm' ? 'float' : 'stalk'); events.emit('bossStart', e); } }
  if (e.type === 'guardian') {
    switch (e.state) {
      case 'stalk': e.yaw = dampAngle(e.yaw, faceP, 3, dt); desired = toP.clone(); speed = 1.6 * spd; if (e.stateT > (phase2 ? 1.6 : 2.4)) go(phase2 && Math.random() < 0.4 ? 'summon' : 'windup'); break;
      case 'windup': e.yaw = dampAngle(e.yaw, faceP, 6, dt); if (e.stateT > 0.9) { go('charge'); events.emit('sfx', 'charge'); } break; // stomping tell
      case 'charge': speed = 11 * spd; desired = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)); if (e.stateT > 1.6) go('stalk'); break;
      case 'stun': if (e.stateT > 3) go('stalk'); break;
      case 'summon': if (e.stateT > 0.6 && e.stateT - dt <= 0.6) { events.emit('summon', { type: 'acorn', x: e.pos.x + 4, z: e.pos.z }); events.emit('summon', { type: 'acorn', x: e.pos.x - 4, z: e.pos.z }); } if (e.stateT > 1.2) go('stalk'); break;
    }
    const tell = e.state === 'windup' ? Math.sin(e.stateT * 30) * 0.08 : 0;
    e.m.body.rotation.z = tell; e.m.body.rotation.x = e.state === 'charge' ? 0.25 : e.state === 'stun' ? -0.5 : 0;
    if (P.crown) P.crown.rotation.y += dt * (e.state === 'stun' ? 8 : 1);
  } else if (e.type === 'kingCrab') {
    switch (e.state) {
      case 'stalk': e.yaw = dampAngle(e.yaw, faceP, 4, dt); { const side = new THREE.Vector3(-toP.z, 0, toP.x).normalize().multiplyScalar(Math.sin(e.t) * 1.5); desired = toP.clone().normalize().add(side); speed = dist > 3.5 ? 3.2 * spd : 0; }
        if (e.stateT > (phase2 ? 1.8 : 2.6)) go(Math.random() < 0.45 ? 'hide' : 'raise'); break;
      case 'raise': e.yaw = dampAngle(e.yaw, faceP, 6, dt); if (e.stateT > 0.8) { go('slam'); events.emit('shake', 0.5); events.emit('sfx', 'thud');
        const n = phase2 ? 16 : 10; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; e.shoot(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 'spike', 6); } } break;
      case 'slam': if (e.stateT > 0.8) go('stalk'); break;
      case 'hide': if (e.stateT > 4) go('stalk'); break;   // invulnerable shell: break it with a bomb
      case 'exposed': if (e.stateT > 3.5) go('stalk'); break;
    }
    const up = e.state === 'raise' ? clamp(e.stateT / 0.8) : 0;
    P.clawL.rotation.x = -up * 1.5; P.clawR.rotation.x = -up * 1.5;
    e.m.body.position.y = damp(e.m.body.position.y, e.state === 'hide' ? 0.05 : 0.35, 8, dt);
    e.m.body.rotation.x = e.state === 'exposed' ? 0.4 + Math.sin(e.t * 14) * 0.05 : 0;
  } else if (e.type === 'storm') {
    const eyeOpen = e.state === 'eye';
    switch (e.state) {
      case 'float': { const ang = e.t * 0.4; const tgt = new THREE.Vector3(e.home.x + Math.cos(ang) * 7, 0, e.home.z + Math.sin(ang) * 7); desired = tgt.sub(e.pos).setY(0); speed = Math.min(4, desired.length() * 1.5); e.yaw = dampAngle(e.yaw, faceP, 3, dt);
        if (e.stateT > (phase2 ? 2.2 : 3)) go(Math.random() < 0.5 ? 'orbs' : 'eye'); break; }
      case 'orbs': { const shots = e.hp <= e.maxHp / 4 ? 3 : phase2 ? 2 : 1; for (let s = 0; s < shots; s++) { const t = 0.5 + s * 0.6; if (e.stateT > t && e.stateT - dt <= t) { const n = 12; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + s * 0.25; e.shoot(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 'spark', 6.5); } events.emit('sfx', 'zap'); } }
        if (e.stateT > 0.8 + shots * 0.6) go(phase2 && Math.random() < 0.4 ? 'summon' : 'float'); break; }
      case 'summon': if (e.stateT > 0.5 && e.stateT - dt <= 0.5) for (let i = 0; i < 2; i++) events.emit('summon', { type: 'moth', x: e.pos.x + (i ? 4 : -4), z: e.pos.z + 2 }); if (e.stateT > 1.2) go('float'); break;
      case 'eye': e.yaw = dampAngle(e.yaw, faceP, 5, dt); if (e.stateT > 2.8) go('float'); break;     // weak point open: shoot it with an arrow
      case 'fallen': if (e.stateT > 4.5) { go('float'); events.emit('sfx', 'zap'); } break;            // on the ground: sword damage
    }
    const lidOpen = eyeOpen ? clamp(e.stateT * 3) : e.state === 'fallen' ? 1 : 0;
    P.lid.scale.set(1, 1 - lidOpen * 0.95, 0.55); P.lid.position.y = lidOpen * 0.45;
    (P.iris as THREE.Mesh).visible = lidOpen > 0.3;
    // it sinks low while the eye is open, so a level arrow can reach it
    const h = e.state === 'fallen' ? 1.4 : eyeOpen ? 1.6 : 4 + Math.sin(e.t * 1.5) * 0.4;
    e.m.body.position.y = damp(e.m.body.position.y, h, e.state === 'fallen' ? 6 : 2, dt);
    (P.tents as unknown as THREE.Object3D[]).forEach((t, i) => { t.rotation.x = Math.sin(e.t * 2 + i) * 0.25; t.rotation.z = Math.cos(e.t * 1.7 + i) * 0.25; });
    e.m.body.scale.setScalar(1 + Math.sin(e.t * 2.5) * 0.03);
  }
  if (desired && desired.lengthSq() > 1e-4 && speed) { desired.normalize(); if (e.state !== 'charge') e.yaw = dampAngle(e.yaw, Math.atan2(desired.x, desired.z), 4, dt); e.vel.x = damp(e.vel.x, desired.x * speed, 5, dt); e.vel.z = damp(e.vel.z, desired.z * speed, 5, dt); }
  else { e.vel.x = damp(e.vel.x, 0, 6, dt); e.vel.z = damp(e.vel.z, 0, 6, dt); }
  e.knock.multiplyScalar(Math.exp(-8 * dt));
  const nx = e.pos.x + (e.vel.x + e.knock.x) * dt, nz = e.pos.z + (e.vel.z + e.knock.z) * dt;
  const r = e.env.col.resolve(nx, nz, e.radius * 0.85, e.pos.y, 3);
  e.pos.x = r.x; e.pos.z = r.z;
  if (Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z) > 16) { const d = new THREE.Vector3(e.home.x - e.pos.x, 0, e.home.z - e.pos.z).normalize(); e.pos.x += d.x * 0.2; e.pos.z += d.z * 0.2; if (e.state === 'charge') { e.set('stun'); events.emit('shake', 0.6); events.emit('sfx', 'thud'); } }
  if (e.type === 'guardian' && e.state === 'charge' && r.hit) { e.set('stun'); events.emit('shake', 0.7); events.emit('sfx', 'thud'); }
  e.pos.y = e.env.groundAt(e.pos.x, e.pos.z, e.pos.y + 1);
  e.m.root.position.copy(e.pos); e.m.root.rotation.y = e.yaw;
}
/** weakness hooks */
export function bossBomb(e: Enemy) {
  if (e.type === 'guardian') { if (e.state === 'charge' || e.state === 'windup') { e.set('stun'); events.emit('sfx', 'thud'); } e.damage(2, e.pos.clone().add(new THREE.Vector3(0, 0, 1)), 2); return true; }
  if (e.type === 'kingCrab') { if (e.state === 'hide') { e.set('exposed'); events.emit('sfx', 'clank'); events.emit('toast', '껍데기가 깨졌다! 지금 공격!'); } else e.damage(2, e.pos, 2); return true; }
  return false;
}
export function bossArrow(e: Enemy) {
  if (e.type === 'storm') { if (e.state === 'eye') { e.set('fallen'); e.flash = 0.3; events.emit('sfx', 'thud'); events.emit('shake', 0.6); events.emit('toast', '폭풍해파리가 떨어졌다! 검으로 공격!'); } else events.emit('sfx', 'clank'); return true; }
  return false;
}
/** can this boss take sword damage right now? */
export function bossVulnerable(e: Enemy) {
  if (e.type === 'kingCrab') return e.state !== 'hide';
  if (e.type === 'storm') return e.state === 'fallen';
  return true;
}
