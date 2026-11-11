import * as THREE from 'three';
import type { Game } from '../core/Game';
import { damp } from '../core/math';

export type Period = 'morning' | 'day' | 'evening' | 'night';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog';
export const PERIOD_NAMES: Record<Period, string> = { morning: '아침', day: '낮', evening: '저녁', night: '밤' };
export const WEATHER_NAMES: Record<Weather, string> = { clear: '맑음', cloudy: '흐림', rain: '비', fog: '안개' };
const WEATHER_ICON: Record<Weather, string> = { clear: '☀', cloudy: '☁', rain: '☂', fog: '≋' };

/** Game clock (1 in-game hour = 30 real seconds, so a day lasts 12 minutes) and weather state machine.
 *  Drives sun angle/colour, sky & fog tint, lamp glow, rain particles and wet ground. */
export class TimeWeather {
  hour = 8;           // 0..24
  day = 1;
  weather: Weather = 'clear';
  private weatherLeft = 6; // in-game hours
  private k = { cloud: 0, rain: 0, fog: 0, night: 0 };
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  readonly HOUR_SECONDS = 30;
  constructor(private g: Game) {
    const N = 900;
    this.rainPos = new Float32Array(N * 6);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xcfe4f4, transparent: true, opacity: 0.55, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false;
    g.scene.add(this.rain);
    for (let i = 0; i < N; i++) this.seedDrop(i, true);
  }
  get period(): Period { const h = this.hour; return h >= 5 && h < 10 ? 'morning' : h < 17 && h >= 10 ? 'day' : h >= 17 && h < 20.5 ? 'evening' : 'night'; }
  get isNight() { return this.period === 'night'; }
  clock() { const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  label() { return `${WEATHER_ICON[this.weather]} ${this.day}일째 ${PERIOD_NAMES[this.period]} ${this.clock()}`; }
  private seedDrop(i: number, anywhere = false) {
    const c = this.g.player?.pos ?? new THREE.Vector3();
    const x = c.x + (Math.random() - 0.5) * 50, z = c.z + (Math.random() - 0.5) * 50, y = c.y + (anywhere ? Math.random() * 22 : 18 + Math.random() * 6);
    this.rainPos.set([x, y, z, x + 0.12, y + 0.7, z + 0.05], i * 6);
  }
  setWeather(w: Weather, hours = 4 + Math.random() * 5) { this.weather = w; this.weatherLeft = hours; this.g.events?.emit?.('weather', w); }
  sleepUntilMorning() { if (this.hour > 6) this.day++; this.hour = 6.5; }
  update(dt: number) {
    const g = this.g;
    const prevPeriod = this.period;
    this.hour += dt / this.HOUR_SECONDS;
    if (this.hour >= 24) { this.hour -= 24; this.day++; g.onNewDay?.(); }
    this.weatherLeft -= dt / this.HOUR_SECONDS;
    if (this.weatherLeft <= 0) {
      const r = Math.random();
      this.setWeather(r < 0.5 ? 'clear' : r < 0.72 ? 'cloudy' : r < 0.9 ? 'rain' : 'fog');
    }
    if (this.period !== prevPeriod) g.onPeriodChange?.(this.period);
    const W = this.weather;
    this.k.cloud = damp(this.k.cloud, W === 'cloudy' || W === 'rain' ? 1 : W === 'fog' ? 0.6 : 0, 0.5, dt);
    this.k.rain = damp(this.k.rain, W === 'rain' ? 1 : 0, 0.6, dt);
    this.k.fog = damp(this.k.fog, W === 'fog' ? 1 : W === 'rain' ? 0.35 : 0, 0.4, dt);
    // daylight curve: 0 at night, 1 at noon
    const h = this.hour;
    const sunUp = THREE.MathUtils.smoothstep(h, 5, 7.5) * (1 - THREE.MathUtils.smoothstep(h, 18.5, 20.5));
    const night = 1 - sunUp;
    this.k.night = night;
    const warm = THREE.MathUtils.smoothstep(h, 15.5, 19) * (1 - THREE.MathUtils.smoothstep(h, 19.5, 21)) + (1 - THREE.MathUtils.smoothstep(h, 5.5, 8.5)) * sunUp;
    if (g.area !== 'island') { this.rain.visible = false; return; }
    const w = g.world;
    // sun arc east -> west
    const t = (h - 6) / 13 * Math.PI;
    const el = Math.max(0.18, Math.sin(Math.min(Math.PI, Math.max(0, t))) * 1.05);
    const az = -1.2 + (h - 6) / 13 * 2.4;
    w.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    const sunCol = new THREE.Color(0xfff0d6).lerp(new THREE.Color(0xffa860), warm * 0.75);
    w.sun.color.copy(sunCol);
    w.sun.intensity = (2.7 * sunUp + 0.35 * night) * (1 - this.k.cloud * 0.55);
    if (night > 0.5) w.sun.color.lerp(new THREE.Color(0x8fa8e0), night);
    w.hemi.intensity = (1.05 * sunUp + 0.42 * night) * (1 - this.k.cloud * 0.25);
    w.hemi.color.set(0xcfe9ff).lerp(new THREE.Color(0x5a6aa8), night * 0.85);
    (g.scene as any).environmentIntensity = 0.2 * sunUp + 0.06;
    // sky & fog tint
    const dayFog = new THREE.Color(0xd6f0ff), duskFog = new THREE.Color(0xf2c8a8), nightFog = new THREE.Color(0x1c2a48), greyFog = new THREE.Color(0xc0c8d0);
    const fogC = dayFog.clone().lerp(duskFog, warm * 0.6).lerp(nightFog, night).lerp(greyFog.clone().lerp(nightFog, night), this.k.cloud * 0.5 + this.k.fog * 0.4);
    const f = g.scene.fog as THREE.Fog;
    f.color.copy(fogC); (g.scene.background as THREE.Color).copy(fogC);
    f.near = 95 - this.k.fog * 78; f.far = 260 - this.k.fog * 190;
    const sky = g.scene.getObjectByName('sky') as THREE.Mesh | undefined;
    if (sky) {
      const u = (sky.material as THREE.ShaderMaterial).uniforms;
      u.uTop.value.set(0x63b4ee).lerp(new THREE.Color(0x4a6ab0), warm * 0.4).lerp(new THREE.Color(0x0a1430), night).lerp(new THREE.Color(0x8898a8), this.k.cloud * 0.6 * (1 - night));
      u.uHor.value.copy(fogC);
      u.uBot.value.copy(fogC).multiplyScalar(0.9);
    }
    (w.water.material as THREE.ShaderMaterial).uniforms.uSun.value.copy(w.sunDir);
    (w.water.material as THREE.ShaderMaterial).uniforms.uSky.value.set(0xcfeeff).lerp(new THREE.Color(0x2a3a68), night);
    // lamps & windows glow brighter at night
    const glass = (w as any).glassMat as THREE.MeshStandardMaterial | undefined;
    if (glass) glass.emissiveIntensity = 1.0 + night * 2.2;
    // rain
    this.rain.visible = this.k.rain > 0.02;
    (this.rain.material as THREE.LineBasicMaterial).opacity = 0.55 * this.k.rain;
    if (this.rain.visible) {
      const n = this.rainPos.length / 6, P = g.player.pos;
      for (let i = 0; i < n; i++) {
        const o = i * 6; const fall = dt * 26;
        this.rainPos[o + 1] -= fall; this.rainPos[o + 4] -= fall; this.rainPos[o] -= fall * 0.12; this.rainPos[o + 3] -= fall * 0.12;
        if (this.rainPos[o + 1] < P.y - 2 || Math.abs(this.rainPos[o] - P.x) > 28 || Math.abs(this.rainPos[o + 2] - P.z) > 28) this.seedDrop(i);
      }
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      if (Math.random() < dt * 25) g.particles.emit({ pos: new THREE.Vector3(P.x + (Math.random() - 0.5) * 16, g.groundAt(P.x, P.z) + 0.05, P.z + (Math.random() - 0.5) * 16), count: 1, spread: 0.6, up: 1.2, life: 0.25, size: 0.12, color: 0xdff0ff, grav: 6 });
    }
    // wet ground darkening
    const terrain = g.scene.getObjectByName('terrain') as THREE.Mesh | undefined;
    if (terrain) (terrain.material as THREE.MeshStandardMaterial).color.setScalar(1 - this.k.rain * 0.18 - night * 0.05);
    g.audio.setRain?.(this.k.rain);
  }
  toJSON() { return { hour: this.hour, day: this.day, weather: this.weather, left: this.weatherLeft }; }
  load(d: any) { if (!d) return; this.hour = d.hour ?? 8; this.day = d.day ?? 1; this.weather = d.weather ?? 'clear'; this.weatherLeft = d.left ?? 5; }
}
