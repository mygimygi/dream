import * as THREE from 'three';
import { Heightfield, WORLD_HALF } from '../world/Heightfield';
import { terrainColor } from '../world/Terrain';
import { ROOMS } from '../dungeon/Dungeon';

/** North-up circular minimap: pre-rendered island colours + live markers. */
export class Minimap {
  canvas = document.createElement('canvas');
  private base = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  markers: { x: number; z: number; color: string; kind: 'chest' | 'npc' | 'goal' | 'enemy' }[] = [];
  constructor(hf: Heightfield) {
    this.canvas.width = this.canvas.height = 300;
    this.ctx = this.canvas.getContext('2d')!;
    const N = 256; this.base.width = this.base.height = N;
    const b = this.base.getContext('2d')!, img = b.createImageData(N, N);
    const c = new THREE.Color();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -WORLD_HALF + (i / N) * WORLD_HALF * 2, z = -WORLD_HALF + (j / N) * WORLD_HALF * 2;
      const h = hf.height(x, z);
      if (h < 0) { const d = Math.min(1, -h / 3); c.setRGB(0.38 - d * 0.15, 0.78 - d * 0.25, 0.85 - d * 0.1); }
      else {
        const e = 0.6;
        const nx = hf.height(x - e, z) - hf.height(x + e, z), nz = hf.height(x, z - e) - hf.height(x, z + e);
        const ny = 1 / Math.hypot(nx, 2 * e, nz) * 2 * e;
        terrainColor(hf, x, z, h, ny, c);
        const shade = 1 + (nx * -0.5 + nz * -0.5) * 0.25 + h * 0.02;
        c.multiplyScalar(Math.max(0.6, Math.min(1.3, shade)));
      }
      const k = (j * N + i) * 4;
      img.data[k] = Math.min(255, c.r * 255 * 1.1); img.data[k + 1] = Math.min(255, c.g * 255 * 1.05); img.data[k + 2] = Math.min(255, c.b * 255); img.data[k + 3] = 255;
    }
    b.putImageData(img, 0, 0);
  }
  /** Camera-aligned minimap: whatever is "up" on screen is "up" on the map, so pushing forward
   *  always moves the arrow toward the top. A rim "N" marks north. */
  draw(px: number, pz: number, yaw: number, camYaw: number, dungeon: boolean, room: number) {
    const x = this.ctx, S = 300;
    x.save(); x.clearRect(0, 0, S, S);
    x.translate(S / 2, S / 2);
    x.rotate(camYaw);
    if (dungeon) {
      x.fillStyle = '#26303a'; x.fillRect(-S, -S, S * 2, S * 2);
      const sc = 3.2;
      x.scale(sc, sc); x.translate(-px, -pz);
      ROOMS.forEach((r, i) => { x.fillStyle = i === room ? '#8fd0d8' : '#5a7a88'; x.beginPath(); x.roundRect(r.x - r.hx, r.z - r.hz, r.hx * 2, r.hz * 2, 2); x.fill(); });
      x.fillStyle = '#5a7a88'; x.fillRect(998, -55, 4, 50);
    } else {
      const zoom = 2.2 * (256 / (WORLD_HALF * 2)) * 1.17; // canvas px per map px
      x.scale(zoom, zoom);
      const k = 256 / (WORLD_HALF * 2);
      x.translate(-(px + WORLD_HALF) * k, -(pz + WORLD_HALF) * k);
      x.imageSmoothingEnabled = true;
      x.drawImage(this.base, 0, 0);
      for (const m of this.markers) {
        const mx = (m.x + WORLD_HALF) * k, mz = (m.z + WORLD_HALF) * k;
        x.fillStyle = m.color; x.strokeStyle = '#4a3424'; x.lineWidth = 0.6;
        x.beginPath();
        if (m.kind === 'goal') { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2 - camYaw, r = i % 2 ? 1.6 : 3.6; x.lineTo(mx + Math.cos(a) * r, mz + Math.sin(a) * r); } x.closePath(); }
        else x.arc(mx, mz, m.kind === 'npc' ? 1.8 : 2.2, 0, Math.PI * 2);
        x.fill(); x.stroke();
      }
    }
    x.restore();
    // camera view cone: the camera always looks "up" on this map
    x.save(); x.translate(S / 2, S / 2);
    x.fillStyle = 'rgba(255,255,255,0.14)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 120, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); x.closePath(); x.fill();
    x.restore();
    // player arrow, rotated into the camera-aligned frame
    x.save(); x.translate(S / 2, S / 2); x.rotate(Math.PI - yaw + camYaw);
    x.fillStyle = '#f07a50'; x.strokeStyle = '#fff'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(0, -16); x.lineTo(12, 12); x.lineTo(0, 6); x.lineTo(-12, 12); x.closePath(); x.stroke(); x.fill();
    x.restore();
    // north marker on the rim
    if (!dungeon) {
      const r = 128, nx = S / 2 + Math.sin(camYaw) * -r * -1, ny = S / 2 - Math.cos(camYaw) * r;
      x.save(); x.fillStyle = '#c95a34'; x.beginPath(); x.arc(nx, ny, 17, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.font = 'bold 20px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', nx, ny + 1); x.restore();
    }
  }

}
