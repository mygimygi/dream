/** Lightweight 2.5D collision: circles and oriented boxes with vertical extents, on a spatial hash.
 *  Boxes can be "walkTop" so characters can stand on them (bridges, push blocks, steps, floors). */
export interface Collider {
  kind: 'circle' | 'box';
  x: number; z: number; r: number;       // circle radius (or bounding radius for boxes)
  hx: number; hz: number; rot: number;   // box half extents + yaw
  y0: number; y1: number;                // vertical extent
  solid: boolean; walkTop: boolean; active: boolean;
  tag?: string; data?: any;
}
const CS = 8;
export class CollisionWorld {
  private grid = new Map<number, Collider[]>();
  dynamic: Collider[] = [];
  private key(i: number, j: number) { return (i + 4096) * 8192 + (j + 4096); }
  circle(x: number, z: number, r: number, y0 = -100, y1 = 100, tag?: string): Collider {
    return this.add({ kind: 'circle', x, z, r, hx: r, hz: r, rot: 0, y0, y1, solid: true, walkTop: false, active: true, tag });
  }
  box(x: number, z: number, hx: number, hz: number, rot: number, y0: number, y1: number, opts: Partial<Collider> = {}): Collider {
    return this.add({ kind: 'box', x, z, r: Math.hypot(hx, hz), hx, hz, rot, y0, y1, solid: true, walkTop: false, active: true, ...opts });
  }
  add(c: Collider, dynamic = false) {
    if (dynamic) { this.dynamic.push(c); return c; }
    const i0 = Math.floor((c.x - c.r) / CS), i1 = Math.floor((c.x + c.r) / CS);
    const j0 = Math.floor((c.z - c.r) / CS), j1 = Math.floor((c.z + c.r) / CS);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k)!.push(c);
    }
    return c;
  }
  query(x: number, z: number, r: number, out: Collider[] = []): Collider[] {
    out.length = 0;
    const seen = new Set<Collider>();
    const i0 = Math.floor((x - r) / CS), i1 = Math.floor((x + r) / CS), j0 = Math.floor((z - r) / CS), j1 = Math.floor((z + r) / CS);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = this.grid.get(this.key(i, j));
      if (l) for (const c of l) if (c.active && !seen.has(c)) { seen.add(c); out.push(c); }
    }
    for (const c of this.dynamic) if (c.active && Math.abs(c.x - x) < c.r + r + 1 && Math.abs(c.z - z) < c.r + r + 1) out.push(c);
    return out;
  }
  /** Push a vertical cylinder (x,z,radius, feet y, height) out of solid colliders. Returns corrected xz. */
  resolve(x: number, z: number, rad: number, y: number, h: number, ignore?: Collider): { x: number; z: number; hit: Collider | null } {
    let hit: Collider | null = null;
    const list = this.query(x, z, rad + 1);
    for (let iter = 0; iter < 2; iter++) for (const c of list) {
      if (!c.solid || c === ignore) continue;
      if (y + h < c.y0 || y > c.y1 - 0.05) continue; // above (standing on it) or below
      if (c.kind === 'circle') {
        const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + rad;
        if (d < m && d > 1e-5) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; hit = c; }
      } else {
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
        const lx = (x - c.x) * cs - (z - c.z) * sn, lz = (x - c.x) * sn + (z - c.z) * cs;
        const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
        let dx = lx - qx, dz = lz - qz, d = Math.hypot(dx, dz);
        if (d < rad) {
          let nlx: number, nlz: number;
          if (d > 1e-5) { nlx = qx + (dx / d) * rad; nlz = qz + (dz / d) * rad; }
          else { // centre inside box: exit along shallowest axis
            const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
            if (px < pz) { nlx = Math.sign(lx || 1) * (c.hx + rad); nlz = lz; } else { nlx = lx; nlz = Math.sign(lz || 1) * (c.hz + rad); }
          }
          x = c.x + nlx * cs + nlz * sn; z = c.z - nlx * sn + nlz * cs; hit = c;
        }
      }
    }
    return { x, z, hit };
  }
  /** Highest walkable top under (x,z) that is not above maxY. */
  topAt(x: number, z: number, maxY: number): number {
    let best = -Infinity;
    for (const c of this.query(x, z, 0.5)) {
      if (!c.walkTop || c.y1 > maxY) continue;
      if (this.inside(c, x, z, 0.15)) best = Math.max(best, c.y1);
    }
    return best;
  }
  inside(c: Collider, x: number, z: number, pad = 0) {
    if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + pad;
    const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    const lx = (x - c.x) * cs - (z - c.z) * sn, lz = (x - c.x) * sn + (z - c.z) * cs;
    return Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad;
  }
  remove(c: Collider) { c.active = false; }
}
