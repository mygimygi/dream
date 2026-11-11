import * as THREE from 'three';
let tex: THREE.Texture | null = null;
/** Soft radial contact shadow decal: grounds characters even where the shadow map is soft. */
export function blobShadow(r: number): THREE.Mesh {
  if (!tex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(20,30,20,0.85)'); g.addColorStop(0.5, 'rgba(20,30,20,0.45)'); g.addColorStop(1, 'rgba(20,30,20,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    tex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}
