import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Merge every static child mesh of a prop group that shares a material into one mesh.
 *  A cottage drops from ~25 draw calls to ~4 (main + shadow pass), with identical visuals. */
export function bakeStatic(group: THREE.Object3D) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  group.traverse((o: any) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || Array.isArray(o.material)) return;
    const m = o.material as THREE.MeshStandardMaterial;
    if (!(m as any).vertexColors || m.transparent) return;
    let g = (o.geometry as THREE.BufferGeometry).clone();
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const e = byMat.get(m) ?? { geos: [], meshes: [] }; e.geos.push(g); e.meshes.push(o); byMat.set(m, e);
  });
  for (const [mat, e] of byMat) {
    if (e.meshes.length < 2) continue;
    const merged = mergeGeometries(e.geos, false); if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    for (const o of e.meshes) o.removeFromParent();
    group.add(mesh);
  }
}
