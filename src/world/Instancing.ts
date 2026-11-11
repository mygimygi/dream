import * as THREE from 'three';

/** Chunked instancing: instances are split into spatial tiles so frustum culling and distance LOD work per tile. */
export interface Inst { m: THREE.Matrix4; c?: THREE.Color; }
export class ChunkedInstances {
  meshes: THREE.InstancedMesh[] = [];
  private centers: THREE.Vector3[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material, items: Inst[], parent: THREE.Object3D,
    opts: { chunk?: number; cast?: boolean; receive?: boolean; maxDist?: number } = {}) {
    const chunk = opts.chunk ?? 32;
    const map = new Map<string, Inst[]>();
    const p = new THREE.Vector3();
    for (const it of items) {
      p.setFromMatrixPosition(it.m);
      const k = Math.floor(p.x / chunk) + ',' + Math.floor(p.z / chunk);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    for (const list of map.values()) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const c = new THREE.Vector3();
      list.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, it.c); p.setFromMatrixPosition(it.m); c.add(p); });
      c.divideScalar(list.length);
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = opts.cast ?? false; im.receiveShadow = opts.receive ?? true;
      im.computeBoundingSphere();
      parent.add(im);
      this.meshes.push(im); this.centers.push(c);
    }
    this.maxDist = opts.maxDist ?? Infinity;
  }
  maxDist: number;
  updateLOD(focus: THREE.Vector3) {
    if (this.maxDist === Infinity) return;
    const md2 = this.maxDist * this.maxDist;
    for (let i = 0; i < this.meshes.length; i++) {
      const c = this.centers[i];
      const dx = c.x - focus.x, dz = c.z - focus.z;
      this.meshes[i].visible = dx * dx + dz * dz < md2;
    }
  }
}

/** Instances that can be removed individually (cuttable bushes, breakable pots). */
export class RemovableInstances {
  mesh: THREE.InstancedMesh;
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, public items: Inst[], parent: THREE.Object3D, cast = true) {
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    items.forEach((it, i) => { this.mesh.setMatrixAt(i, it.m); if (it.c) this.mesh.setColorAt(i, it.c); });
    if (!items.length) this.mesh.setMatrixAt(0, this.hidden);
    this.mesh.castShadow = cast; this.mesh.receiveShadow = true;
    this.mesh.computeBoundingSphere();
    parent.add(this.mesh);
  }
  remove(i: number) { this.mesh.setMatrixAt(i, this.hidden); this.mesh.instanceMatrix.needsUpdate = true; }
  restore(i: number) { this.mesh.setMatrixAt(i, this.items[i].m); this.mesh.instanceMatrix.needsUpdate = true; }
}

export function mat4(x: number, y: number, z: number, ry = 0, s = 1, sy = s, tilt = 0) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, ry, tilt * 0.5)), new THREE.Vector3(s, sy, s));
}
