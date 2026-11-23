export type QualityLevel = 'minimal' | 'low' | 'medium' | 'high';
export interface QualityProfile {
  level: QualityLevel; pixelRatio: number; shadowSize: number; shadows: boolean; ao: boolean; bloom: boolean;
  tiltShift: boolean; grassCount: number; flowerCount: number; antialias: 'smaa' | 'fxaa' | 'none';
}
export const PROFILES: Record<QualityLevel, Omit<QualityProfile, 'level'>> = {
  // weakest phones/tablets: no shadow map (contact shadows stay), simple lighting, fewer plants
  minimal: { pixelRatio: 0.8, shadowSize: 512, shadows: false, ao: false, bloom: false, tiltShift: false, grassCount: 2500, flowerCount: 250, antialias: 'none' },
  low: { pixelRatio: 1, shadowSize: 1024, shadows: true, ao: false, bloom: false, tiltShift: false, grassCount: 6000, flowerCount: 500, antialias: 'none' },
  medium: { pixelRatio: 1.5, shadowSize: 2048, shadows: true, ao: false, bloom: true, tiltShift: true, grassCount: 22000, flowerCount: 1400, antialias: 'smaa' },
  high: { pixelRatio: 2, shadowSize: 4096, shadows: true, ao: true, bloom: true, tiltShift: true, grassCount: 42000, flowerCount: 2200, antialias: 'smaa' },
};
/** GPU name (when the browser exposes it) */
export function gpuName(): string {
  try {
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    (gl.getExtension('WEBGL_lose_context') as any)?.loseContext();
    return name;
  } catch { return ''; }
}
/** phones AND tablets: iPadOS reports a Mac user agent, so also check for a multi-touch screen */
export function isMobile() {
  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints > 0;
  const iPadAsMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  // Galaxy Tab (Samsung Internet / Chrome) often runs in "desktop site" mode with an X11 Linux UA
  const androidDesktopMode = /X11; Linux|Linux x86_64/.test(ua) && touch;
  const anyCoarse = matchMedia('(pointer:coarse)').matches || matchMedia('(any-pointer:coarse)').matches;
  return /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|SM-[TXP]\d/i.test(ua) || iPadAsMac || androidDesktopMode || (anyCoarse && touch);
}
/** Pick a starting profile from device class, GPU family, memory and core count (refined at runtime by the fps check). */
export function detectQuality(): QualityLevel {
  const mobile = isMobile();
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory ?? 8;
  const gpu = gpuName();
  const weakGpu = /Mali-(4|T[0-8])|Mali-G(31|51|52|57|68)|Adreno \(TM\) ?[1-6]\d\d|PowerVR|SwiftShader|llvmpipe|Intel.*HD Graphics [2-5]\d{2,3}/i.test(gpu);
  const strongMobile = /Apple GPU|Adreno \(TM\) ?7[3-9]\d|Adreno.*8\d\d|Mali-G7[1-9]\d|Immortalis/i.test(gpu);
  // touch devices start on 'low' at most (tablets have many pixels too); the runtime check can drop to 'minimal'
  // weak mobile GPUs (Galaxy Tab A / S6 Lite: Mali-G52/G57, Adreno 610/618...) go straight to minimal
  const weakMobileGpu = weakGpu && !/Adreno \(TM\) ?6[4-9]\d/i.test(gpu);
  if (mobile) return weakMobileGpu || mem <= 3 || !gpu ? 'minimal' : 'low';
  void strongMobile;
  if (weakGpu) return 'low';
  return cores >= 8 && mem >= 8 ? 'high' : 'medium';
}
export function profile(level: QualityLevel): QualityProfile {
  const p = PROFILES[level];
  // phones: never render above 1.5x even on 3x screens (fill-rate is the bottleneck)
  let cap = p.pixelRatio;
  if (isMobile()) {
    // tablets have big screens: keep the rendered pixel count within a fixed budget
    const css = Math.max(1, window.innerWidth * window.innerHeight);
    const budget = level === 'minimal' ? 0.75e6 : 1.0e6;
    cap = Math.min(1.25, p.pixelRatio, Math.max(0.6, Math.sqrt(budget / css)));
  }
  return { level, ...p, pixelRatio: Math.min(cap, window.devicePixelRatio || 1) };
}
