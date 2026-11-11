import * as THREE from 'three';
import { Heightfield, WORLD_HALF } from './Heightfield';
import { GLSL_NOISE, U } from '../render/Materials';

/** Stylised toy-diorama water: depth-tinted from the terrain height map, shoreline foam bands,
 *  shallow caustics, animated normals, Fresnel sky reflection and sparkly sun glints (bloom-friendly). */
export function buildWater(hf: Heightfield, sunDir: THREE.Vector3): THREE.Mesh {
  const n = hf.n;
  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const v = Math.max(0, Math.min(255, Math.round(((hf.heights[i] + 6) / 12) * 255)));
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;

  const geo = new THREE.PlaneGeometry(900, 900, 180, 180);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uHeight: { value: tex }, uHalf: { value: WORLD_HALF }, uSun: { value: sunDir.clone() }, uTime: U.uTime,
      uShallow: { value: new THREE.Color(0x8ef0de) }, uMid: { value: new THREE.Color(0x2fb4c8) }, uDeep: { value: new THREE.Color(0x1a62a0) },
      uSky: { value: new THREE.Color(0xcfeeff) }, uSunCol: { value: new THREE.Color(0xfff2d0) },
    }]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime; varying vec3 vW;
      void main(){
        vec3 p = position;
        p.y += sin(p.x*0.35 + uTime*1.1)*0.035 + cos(p.z*0.3 + uTime*0.9)*0.035;
        vec4 w = modelMatrix * vec4(p,1.0); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uHeight; uniform float uHalf; uniform vec3 uSun; uniform float uTime;
      uniform vec3 uShallow, uMid, uDeep, uSky, uSunCol;
      varying vec3 vW;
      ${GLSL_NOISE}
      float terrainH(vec2 xz){ vec2 uv = (xz + uHalf)/(2.0*uHalf);
        if (uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) return -6.0;
        return texture2D(uHeight, uv).r*12.0 - 6.0; }
      void main(){
        float th = terrainH(vW.xz);
        float depth = max(0.0, vW.y - th);
        if (depth < 0.005) discard;
        // animated normal from two scrolling noise layers
        vec2 q1 = vW.xz*0.55 + vec2(uTime*0.12, uTime*0.07);
        vec2 q2 = vW.xz*1.3 - vec2(uTime*0.09, -uTime*0.11);
        float e = 0.15;
        float n0 = vnoise(q1)+0.5*vnoise(q2);
        float nx = vnoise(q1+vec2(e,0.0))+0.5*vnoise(q2+vec2(e,0.0));
        float nz = vnoise(q1+vec2(0.0,e))+0.5*vnoise(q2+vec2(0.0,e));
        vec3 N = normalize(vec3((n0-nx)*1.4, 1.0, (n0-nz)*1.4));
        vec3 V = normalize(cameraPosition - vW);
        // colour by depth
        vec3 col = mix(uShallow, uMid, smoothstep(0.0, 1.6, depth));
        col = mix(col, uDeep, smoothstep(1.4, 5.0, depth));
        // caustics on shallow floor
        float c = vnoise(vW.xz*1.8 + vec2(uTime*0.3, uTime*0.2)) * vnoise(vW.xz*2.3 - vec2(uTime*0.25, 0.0));
        col += vec3(0.9,1.0,0.95) * smoothstep(0.32, 0.6, c) * 0.35 * (1.0 - smoothstep(0.2, 1.8, depth));
        // lighting
        float diff = 0.75 + 0.25*max(dot(N, uSun), 0.0);
        col *= diff;
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        col = mix(col, uSky, fres*0.55);
        vec3 H = normalize(uSun + V);
        float spec = pow(max(dot(N, H), 0.0), 180.0);
        float glint = step(0.72, vnoise(vW.xz*3.5 + uTime*0.6)) * pow(max(dot(N,H),0.0), 40.0);
        col += uSunCol * (spec*1.6 + glint*1.4);
        // shoreline foam: a solid lip plus travelling bands
        float wob = vnoise(vW.xz*0.9 + uTime*0.2)*0.12;
        float lip = smoothstep(0.16 + wob, 0.03, depth);
        float band = smoothstep(0.85, 1.0, sin(depth*9.0 - uTime*1.6 + wob*20.0)) * smoothstep(0.75, 0.15, depth);
        float foam = max(lip, band*0.75);
        col = mix(col, vec3(1.0), foam*0.92);
        float alpha = mix(0.5, 0.94, smoothstep(0.0, 2.2, depth));
        alpha = max(alpha, foam);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0;
  m.renderOrder = 2;
  m.name = 'water';
  return m;
}

export function buildSky(): THREE.Mesh {
  const g = new THREE.SphereGeometry(700, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0x63b4ee) }, uHor: { value: new THREE.Color(0xe4f5ff) }, uBot: { value: new THREE.Color(0x9fd8e8) } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop,uHor,uBot; varying vec3 vP;
      void main(){ float y=vP.y; vec3 c = y>0.0 ? mix(uHor,uTop,pow(smoothstep(0.0,0.7,y),0.8)) : mix(uHor,uBot,smoothstep(0.0,-0.2,y));
      gl_FragColor=vec4(c,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const s = new THREE.Mesh(g, m);
  s.name = 'sky';
  s.frustumCulled = false;
  return s;
}
