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

export function terrainColor(hf: Heightfield, x: number, z: number, h: number, ny: number, out: THREE.Color) {
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
  if (path > 0.01) {
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

export function buildTerrain(hf: Heightfield): THREE.Mesh {
  const n = hf.n;
  const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
  const H = hf.heights;
  const tmp = new THREE.Color();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL, h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    const hl = H[j * n + Math.max(0, i - 1)], hr = H[j * n + Math.min(n - 1, i + 1)];
    const hd = H[Math.max(0, j - 1) * n + i], hu = H[Math.min(n - 1, j + 1) * n + i];
    const v = new THREE.Vector3(hl - hr, 2 * CELL, hd - hu).normalize();
    nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z;
    terrainColor(hf, x, z, h, v.y, tmp);
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
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let t = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();

  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, envMapIntensity: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vWPos = (modelMatrix*vec4(transformed,1.0)).xyz; vWN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos; varying vec3 vWN; uniform float uTime;\n${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float steep = smoothstep(0.84, 0.62, vWN.y);
        // grass: large soft hue drift + fine mottling + tiny speckles
        float big = fbm2(vWPos.xz*0.05);
        float fine = vnoise(vWPos.xz*1.7);
        float spk = step(0.93, h21(floor(vWPos.xz*6.0)));
        vec3 grassTint = mix(vec3(0.92,1.0,0.86), vec3(1.08,1.04,0.88), big);
        vec3 g = diffuseColor.rgb * grassTint * (0.93 + 0.12*fine) * (1.0 + 0.06*spk);
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
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
