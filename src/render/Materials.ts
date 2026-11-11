import * as THREE from 'three';

/** Shared uniforms driven once per frame by the game loop. */
export const U = {
  uTime: { value: 0 },
  uPlayer: { value: new THREE.Vector3() },
  uCam: { value: new THREE.Vector3() },
  uOccR: { value: 2.4 },
};

export const GLSL_NOISE = /* glsl */ `
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm2(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5;} return s; }
float bayer4(vec2 p){ ivec2 q = ivec2(mod(p,4.0)); int i = q.x + q.y*4;
  int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(m[i])+0.5)/16.0; }
`;

export interface ToyOpts {
  wind?: number;          // sway amplitude (0 = none)
  occlude?: boolean;      // dither-fade when between camera and player
  rim?: number;           // toy plastic rim light strength
  rimColor?: THREE.ColorRepresentation;
  detail?: number;        // world-space surface mottling
  upNormal?: boolean;     // light thin cards (grass) like the ground they grow from
}

export function toy(params: THREE.MeshStandardMaterialParameters, o: ToyOpts = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, ...params });
  const up = !!o.upNormal; const wind = o.wind ?? 0, occ = !!o.occlude, rim = o.rim ?? 0.18, detail = o.detail ?? 0;
  const rimColor = new THREE.Color(o.rimColor ?? 0xfff1d6);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uPlayer = U.uPlayer; sh.uniforms.uCam = U.uCam; sh.uniforms.uOccR = U.uOccR;
    sh.uniforms.uRimColor = { value: rimColor };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; varying vec3 vWPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      ${wind > 0 ? `{
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = modelMatrix[3].xyz;
        #endif
        float sw = max(position.y, 0.0) * ${wind.toFixed(3)};
        float ph = uTime*1.6 + ip.x*0.31 + ip.z*0.23;
        transformed.x += (sin(ph) + 0.35*sin(ph*2.7+position.y*3.0)) * sw * 0.05;
        transformed.z += (cos(ph*0.83) + 0.3*sin(ph*2.1+position.x*2.0)) * sw * 0.035;
      }` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 w = vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            w = instanceMatrix * w;
          #endif
          vWPos = (modelMatrix * w).xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; uniform vec3 uPlayer; uniform vec3 uCam; uniform float uOccR; uniform vec3 uRimColor; varying vec3 vWPos;\n${GLSL_NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      ${occ ? `{ vec3 seg = uPlayer - uCam; float tt = clamp(dot(vWPos-uCam, seg)/dot(seg,seg), 0.0, 1.0);
        float dd = length(vWPos - (uCam + seg*tt));
        float th = smoothstep(uOccR, uOccR*0.45, dd) * smoothstep(0.98, 0.8, tt);
        if (th > 0.0 && bayer4(gl_FragCoord.xy) < th*0.82) discard; }` : ''}`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      ${up ? 'normal = normalize((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz);' : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      ${detail > 0 ? `diffuseColor.rgb *= 1.0 + ${detail.toFixed(3)} * (fbm2(vWPos.xz*2.2 + vWPos.y) - 0.5);` : ''}`)
      .replace('#include <opaque_fragment>', `
        { float fr = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
          outgoingLight += uRimColor * pow(fr, 3.0) * ${rim.toFixed(3)} * (0.4 + 0.6*diffuseColor.rgb); }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `toy_${wind}_${occ}_${rim}_${detail}_${up}`;
  return m;
}

/** Vertex-colour helper: paints every vertex of a geometry. */
export function paint(g: THREE.BufferGeometry, fn: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => THREE.Color | [number, number, number]) {
  const p = g.attributes.position, n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0);
    if (Array.isArray(c)) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
    else { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export function solidColor(g: THREE.BufferGeometry, c: THREE.ColorRepresentation) {
  const cc = new THREE.Color(c);
  return paint(g, () => cc);
}
