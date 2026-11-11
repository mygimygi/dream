import * as THREE from 'three';
import type { Game } from '../core/Game';
import { HOMES, SCHEDULES } from '../data/places';
import type { Period } from './TimeWeather';

/** Daily routines: each villager walks to their spot for the current period; at night they go home (indoors). */
export class NPCLife {
  constructor(private g: Game) {}
  target(id: string, period: Period): [number, number] | null {
    const s = SCHEDULES[id]; if (!s) return null;
    if (period === 'night') return HOMES[id] ?? null;
    return s[period];
  }
  update(dt: number) {
    const g = this.g, period = g.time_.period;
    for (const n of g.npcs) {
      if (n.talking) continue;
      const t = this.target(n.id, period); if (!t) continue;
      const home = period === 'night' ? HOMES[n.id] : null;
      const dx = t[0] - n.pos.x, dz = t[1] - n.pos.z, d = Math.hypot(dx, dz);
      const stop = home ? 3.3 : 0.15;
      if (d > stop) {
        const sp = Math.min(1.8, d * 2);
        let nx = n.pos.x + (dx / d) * sp * dt, nz = n.pos.z + (dz / d) * sp * dt;
        const r = g.world.col.resolve(nx, nz, 0.35, n.pos.y, 1.2, n.collider);
        // gently slide around obstacles
        if (r.hit) { nx = n.pos.x + (-dz / d) * sp * dt; nz = n.pos.z + (dx / d) * sp * dt; } else { nx = r.x; nz = r.z; }
        n.pos.x = nx; n.pos.z = nz; n.pos.y = g.world.groundAt(nx, nz);
        n.walking = sp; n.walkYaw = Math.atan2(dx, dz);
      } else n.walking = 0;
      n.hidden = !!home && d <= 3.4;
      n.rig.root.visible = !n.hidden;
      n.rig.root.position.copy(n.pos);
      if (n.collider) { n.collider.x = n.pos.x; n.collider.z = n.pos.z; n.collider.active = !n.hidden; }
    }
  }
}
export const _v = new THREE.Vector3();
