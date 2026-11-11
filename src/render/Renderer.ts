import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { QualityProfile } from '../core/Quality';

const TiltShift = (horizontal: boolean) => ({
  uniforms: { tDiffuse: { value: null }, uFocus: { value: 0.55 }, uBand: { value: 0.16 }, uAmount: { value: 2.2 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uFocus, uBand, uAmount; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      float d = abs(vUv.y - uFocus);
      float b = smoothstep(uBand, uBand + 0.32, d) * uAmount;
      vec2 dir = ${horizontal ? 'vec2(1.0,0.0)' : 'vec2(0.0,1.0)'} / uRes * b;
      vec4 c = texture2D(tDiffuse, vUv) * 0.2270270270;
      c += texture2D(tDiffuse, vUv + dir*1.3846153846) * 0.3162162162;
      c += texture2D(tDiffuse, vUv - dir*1.3846153846) * 0.3162162162;
      c += texture2D(tDiffuse, vUv + dir*3.2307692308) * 0.0702702703;
      c += texture2D(tDiffuse, vUv - dir*3.2307692308) * 0.0702702703;
      gl_FragColor = c;
    }`,
});
const Grade = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uSat: { value: 1.12 }, uWarm: { value: 0.035 }, uFade: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uSat, uWarm, uFade, uFlash; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb += vec3(uWarm, uWarm*0.4, -uWarm*0.6) * (1.0 - l);
      // gentle S-curve for a photographed-miniature contrast
      c.rgb = mix(c.rgb, c.rgb*c.rgb*(3.0-2.0*c.rgb), 0.36);
      vec2 q = vUv - 0.5;
      float v = 1.0 - uVig * smoothstep(0.25, 0.85, length(q*vec2(1.0,0.85))*1.25);
      c.rgb *= v;
      c.rgb = mix(c.rgb, vec3(1.0,0.95,0.9), uFlash);
      c.rgb = mix(c.rgb, vec3(0.02,0.03,0.05), uFade);
      gl_FragColor = c;
    }`,
};

export class RenderSystem {
  renderer: THREE.WebGLRenderer;
  composer!: EffectComposer;
  private tiltH!: ShaderPass; private tiltV!: ShaderPass; private bloom?: UnrealBloomPass; private gtao?: GTAOPass;
  grade!: ShaderPass; private fxaa?: ShaderPass; private smaa?: SMAAPass;
  q!: QualityProfile;
  constructor(public canvas: HTMLCanvasElement, public scene: THREE.Scene, public camera: THREE.PerspectiveCamera) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  setQuality(q: QualityProfile) {
    this.q = q;
    this.renderer.setPixelRatio(q.pixelRatio);
    this.renderer.shadowMap.enabled = q.shadows;
    this.composer?.dispose();
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(q.pixelRatio);
    composer.setSize(w, h);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = undefined; this.bloom = undefined;
    if (q.ao) {
      const g = new GTAOPass(this.scene, this.camera, w, h);
      g.output = GTAOPass.OUTPUT.Default;
      g.blendIntensity = 0.75;
      g.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: 12 });
      g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(g); this.gtao = g;
    }
    if (q.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.5, 1.35); composer.addPass(this.bloom); }
    this.tiltH = new ShaderPass(TiltShift(true)); this.tiltV = new ShaderPass(TiltShift(false));
    if (q.tiltShift) { composer.addPass(this.tiltH); composer.addPass(this.tiltV); }
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(Grade);
    composer.addPass(this.grade);
    this.fxaa = undefined; this.smaa = undefined;
    if (q.antialias === 'smaa') { this.smaa = new SMAAPass(w * q.pixelRatio, h * q.pixelRatio); composer.addPass(this.smaa); }
    else if (q.antialias === 'fxaa') { this.fxaa = new ShaderPass(FXAAShader); composer.addPass(this.fxaa); }
    this.composer = composer;
    this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    for (const p of [this.tiltH, this.tiltV]) p.uniforms.uRes.value.set(w * pr, h * pr);
    if (this.fxaa) this.fxaa.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));
    // portrait screens show less vertical depth: widen the band
    const portrait = h > w;
    for (const p of [this.tiltH, this.tiltV]) { p.uniforms.uBand.value = portrait ? 0.27 : 0.22; p.uniforms.uAmount.value = portrait ? 1.0 : 1.35; }
  }
  setFocus(screenY: number) { const f = 1 - screenY; for (const p of [this.tiltH, this.tiltV]) p.uniforms.uFocus.value = f; }
  render() { this.composer.render(); }
}
