import * as THREE from 'three';
import { CELL, Heightfield, WORLD_HALF } from './Heightfield';
import { clamp, fbm, lerp, noise2, smoothstep } from '../core/math';
import { GLSL_NOISE, U } from '../render/Materials';

const C = (h: number) => new THREE.Color(h);
const PAL = {
  grassA: C(0x67ad3c), grassB: C(0x8cc44a), grassForestA: C(0x4b9a36), grassForestB: C(0x63ab3c),
  grassMount: C(0x8db55a), grassDry: C(0xa8c25c), path: C(0xe3b46a), pathDark: C(0xc8954f),
  sand: C(0xf4e2ad), sandWet: C(0xd9bf86), seabed: C(0x9cc9a6), cliff: C(0xdcb886), cliffDark: C(0xb38657),
};

export function terrainColor(hf: Heightfield, x: number, z: number, h: number, ny: number, out: THREE.Color, withPath = true) {
  const region = hf.regionAt(x, z);
  const path = hf.pathAt(x, z), land = hf.landAt(x, z);
  const n1 = fbm(x * 0.06, z * 0.06, 3) * 0.5 + 0.5;
  // grass base by region
  let a = PAL.grassA, b = PAL.grassB;
  if (region === 'forest') { a = PAL.grassForestA; b = PAL.grassForestB; }
  else if (region === 'mountain' || region === 'temple') { a = PAL.grassMount; b = PAL.grassB; }
  else if (region === 'ruins') { a = PAL.grassDry; b = PAL.grassB; }
  out.copy(a).lerp(b, n1);
  // sun-bleached hill tops
  out.lerp(PAL.grassDry, clamp((h - 6) * 0.04) * 0.5);
  // sand: beach and coastline
  const sandAmt = Math.max(smoothstep(1.3, 0.5, h) * smoothstep(0.995, 0.85, land), smoothstep(0.6, 0.15, h));
  if (sandAmt > 0) {
    const s = PAL.sand.clone().lerp(PAL.sandWet, smoothstep(0.45, 0.05, h));
    out.lerp(s, sandAmt);
  }
  if (h < -0.1) out.copy(PAL.sandWet).lerp(PAL.seabed, smoothstep(-0.1, -3, h));
  // path
  if (withPath && path > 0.01) {
    const p = PAL.path.clone().lerp(PAL.pathDark, clamp(0.5 + noise2(x * 0.4, z * 0.4) * 0.6) * 0.6);
    out.lerp(p, smoothstep(0.05, 0.75, path));
  }
  // cliffs
  const cliff = smoothstep(0.82, 0.62, ny);
  if (cliff > 0) {
    const c = PAL.cliff.clone().lerp(PAL.cliffDark, clamp(0.35 + noise2(x * 0.15, h * 0.7) * 0.5));
    out.lerp(c, cliff);
  }
  return out;
}

/** Terrain is split into tiles so the camera only draws (and the sun only shadows) what is near;
 *  `step` = 2 halves the resolution on low-end devices. */
export function buildTerrain(hf: Heightfield, opts: { step?: number; tiles?: number; castShadow?: boolean } = {}): THREE.Group {
  const n = hf.n;
  const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), pathA = new Float32Array(n * n);
  const H = hf.heights;
  const tmp = new THREE.Color();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL, h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    const hl = H[j * n + Math.max(0, i - 1)], hr = H[j * n + Math.min(n - 1, i + 1)];
    const hd = H[Math.max(0, j - 1) * n + i], hu = H[Math.min(n - 1, j + 1) * n + i];
    const v = new THREE.Vector3(hl - hr, 2 * CELL, hd - hu).normalize();
    nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z;
    terrainColor(hf, x, z, h, v.y, tmp, false);
    pathA[k] = hf.path[k] * smoothstep(0.82, 0.92, v.y) * (h > 0.4 ? 1 : 0);
    // cavity AO: darken where surrounded by higher ground (cliff feet, ditches)
    let avg = 0, cnt = 0;
    for (let dj = -4; dj <= 4; dj += 2) for (let di = -4; di <= 4; di += 2) {
      const ii = Math.min(n - 1, Math.max(0, i + di)), jj = Math.min(n - 1, Math.max(0, j + dj));
      avg += H[jj * n + ii]; cnt++;
    }
    avg /= cnt;
    const ao = clamp(1 - Math.max(0, avg - h) * 0.22, 0.55, 1) * lerp(1, 1.06, clamp((h - avg) * 0.5));
    col[k * 3] = tmp.r * ao; col[k * 3 + 1] = tmp.g * ao; col[k * 3 + 2] = tmp.b * ao;
  }
  const step = opts.step ?? 1, TILES = opts.tiles ?? 8;
  const attrs = {
    position: new THREE.BufferAttribute(pos, 3), normal: new THREE.BufferAttribute(nor, 3),
    color: new THREE.BufferAttribute(col, 3), aPath: new THREE.BufferAttribute(pathA, 1),
  };
  const per = Math.ceil((n - 1) / TILES / step) * step;
  const tiles: THREE.BufferGeometry[] = [];
  for (let tj = 0; tj < n - 1; tj += per) for (let ti = 0; ti < n - 1; ti += per) {
    const list: number[] = [];
    const i1 = Math.min(n - 1, ti + per), j1 = Math.min(n - 1, tj + per);
    for (let j = tj; j < j1; j += step) for (let i = ti; i < i1; i += step) {
      const ii = Math.min(n - 1, i + step), jj = Math.min(n - 1, j + step);
      const a = j * n + i, b = j * n + ii, c = jj * n + i, d = jj * n + ii;
      list.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    for (const [k, v] of Object.entries(attrs)) g.setAttribute(k, v);   // shared buffers: uploaded once
    g.setIndex(list);
    // bounds of just this tile
    let minY = Infinity, maxY = -Infinity;
    for (let j = tj; j <= j1; j += 2) for (let i = ti; i <= i1; i += 2) { const h = H[j * n + i]; if (h < minY) minY = h; if (h > maxY) maxY = h; }
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-WORLD_HALF + ti * CELL, minY, -WORLD_HALF + tj * CELL), new THREE.Vector3(-WORLD_HALF + i1 * CELL, maxY, -WORLD_HALF + j1 * CELL));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    tiles.push(g);
  }

  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, envMapIntensity: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPath; varying float vPath; varying vec3 vWPos; varying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vWPos = (modelMatrix*vec4(transformed,1.0)).xyz; vWN = normal; vPath = aPath;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vPath; varying vec3 vWPos; varying vec3 vWN; uniform float uTime;\n${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float steep = smoothstep(0.84, 0.62, vWN.y);
        // grass: large soft hue drift + fine mottling + tiny speckles
        float big = fbm2(vWPos.xz*0.05);
        float fine = vnoise(vWPos.xz*1.7);
        float spk = step(0.93, h21(floor(vWPos.xz*6.0)));
        vec3 grassTint = mix(vec3(0.92,1.0,0.86), vec3(1.08,1.04,0.88), big);
        vec3 g = diffuseColor.rgb * grassTint * (0.93 + 0.12*fine) * (1.0 + 0.06*spk);
        // lush/sparse grass patches: darker dense clumps and lighter worn spots
        float dens = fbm2(vWPos.xz*0.16 + 7.0);
        g *= mix(0.86, 1.07, smoothstep(0.3, 0.7, dens));
        g = mix(g, g*vec3(0.92,1.02,0.86), smoothstep(0.62,0.8, vnoise(vWPos.xz*0.5)));
        // dirt path with an irregular, grass-nibbled edge, warm earth tones, ruts and gravel
        float edgeN = (fbm2(vWPos.xz*0.9) - 0.5) * 0.55 + (vnoise(vWPos.xz*4.0) - 0.5) * 0.18;
        float pm = smoothstep(0.38, 0.52, vPath + edgeN);
        if (pm > 0.0) {
          float t1 = fbm2(vWPos.xz*0.45), t2 = vnoise(vWPos.xz*3.2);
          vec3 dirt = mix(vec3(0.34,0.17,0.07), vec3(0.56,0.32,0.14), t1); // linear-space warm earth
          dirt *= 0.9 + 0.14*t2;
          float rut = smoothstep(0.55, 0.9, vPath) * (0.5 + 0.5*sin(vWPos.x*1.7 + vWPos.z*1.3 + fbm2(vWPos.xz*0.3)*4.0));
          dirt *= 1.0 - 0.07*rut;
          float grav = step(0.955, h21(floor(vWPos.xz*8.0)));
          dirt = mix(dirt, vec3(0.52,0.44,0.34), grav*0.7);
          // a darker damp rim where grass meets soil
          float rim = smoothstep(0.38, 0.46, vPath + edgeN) * (1.0 - smoothstep(0.46, 0.6, vPath + edgeN));
          dirt *= 1.0 - 0.18*rim;
          g = mix(g, dirt, pm);
        }
        // cliff strata & pebbles
        float strata = fract(vWPos.y*0.85 + fbm2(vWPos.xz*0.25)*0.9);
        float band = smoothstep(0.0,0.08,strata)*smoothstep(1.0,0.82,strata);
        float peb = smoothstep(0.55,0.75,vnoise(vec2(vWPos.x+vWPos.z, vWPos.y)*2.3));
        vec3 r = diffuseColor.rgb * (0.80 + 0.2*band) * (1.0 - 0.07*peb);
        // lip: the rounded top edge of a cliff catches light
        r *= 1.0 + 0.08*smoothstep(0.62,0.8,vWN.y);
        diffuseColor.rgb = mix(g, r, steep);
      }`);
  };
  const group = new THREE.Group();
  for (const g of tiles) { const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.castShadow = opts.castShadow ?? true; group.add(mesh); }
  group.name = 'terrain';
  (group as any).material = m;
  return group;
  const mesh = new THREE.Mesh(tiles[0], m);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh as any;
}
